import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers3, Play, Search, Target, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation, useEvalMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, JobBar, LockedBanner, Pager, Panel, Pill, PrincipalNote, SelectBox, Stat, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { RateBars, SERIES } from '@/features/evaluation/components/statCharts';
import { useEvalStore } from '@/store/eval.store';
import type { DatasetBundle, Job } from '@/types/eval';

const PAGE_SIZE = 10;
const GRADE_LABELS = ['0 · not relevant', '1 · partial', '2 · substantial', '3 · answers'];

export const parseJudgement = (j: string): number | null =>
  j === 'unjudged' ? null : j === 'nonrelevant' ? 0 : Number(j.split(':')[1]);

/** 0–3 grade picker with an explicit "unjudged" state. */
export function GradeButtons({
  value, onChange, disabled,
}: { value: number | null; onChange: (grade: number | null) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex flex-wrap gap-1">
      {[0, 1, 2, 3].map((g) => (
        <button key={g} type="button" disabled={disabled} title={GRADE_LABELS[g]} onClick={() => onChange(g)}
          className={cn(
            'h-7 min-w-[28px] rounded-md border px-2 font-mono text-[11px] transition-colors disabled:opacity-40',
            value === g
              ? g === 0 ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : 'border-white/10 text-muted-foreground hover:text-foreground',
          )}>
          {g}
        </button>
      ))}
      {value !== null && (
        <button type="button" disabled={disabled} onClick={() => onChange(null)}
          className="h-7 rounded-md border border-white/10 px-2 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40">
          clear
        </button>
      )}
    </div>
  );
}

export function PoolingSection({ bundle }: { bundle: DatasetBundle }) {
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const locked = bundle.manifest.status === 'frozen';
  const qc = useQueryClient();
  const trackJob = useEvalStore((s) => s.trackJob);
  const [depth, setDepth] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [docPage, setDocPage] = useState(1);
  const [idQuery, setIdQuery] = useState('');

  const pool = useQuery({ queryKey: ['eval', 'pool', id, version], queryFn: () => evalApi.pool(id, version) });
  const start = useEvalMutation(() => evalApi.startPool(id, version, depth), {
    success: 'Pooling started',
    onSuccess: (job: Job) => { setJobId(job.id); trackJob(job.id); },
  });
  const judge = useDatasetMutation((body: { item_id: string; doc_id: string; grade: number; clear?: boolean }) =>
    evalApi.judge(id, version, body));

  const view = pool.data;
  const rows = useMemo(() => view?.items ?? [], [view]);
  const filtered = useMemo(() => {
    const q = idQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.item_id.toLowerCase().includes(q));
  }, [rows, idQuery]);
  const current = rows.find((r) => r.item_id === selected) ?? null;

  useEffect(() => { setQueuePage(1); }, [id, version, rows.length, idQuery]);
  useEffect(() => { setDocPage(1); }, [selected]);

  const queuePages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeQueuePage = Math.min(queuePage, queuePages);
  const queueSlice = filtered.slice((safeQueuePage - 1) * PAGE_SIZE, safeQueuePage * PAGE_SIZE);

  const docs = current?.docs ?? [];
  const docPages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
  const safeDocPage = Math.min(docPage, docPages);
  const docSlice = docs.slice((safeDocPage - 1) * PAGE_SIZE, safeDocPage * PAGE_SIZE);
  const offReady = !!bundle.indexes.off?.current;
  const unjudgedCount = current
    ? current.docs.filter((d) => parseJudgement(d.judgement) === null).length
    : rows.reduce((n, r) => n + r.unjudged, 0);
  const simulate = useDatasetMutation(
    () => evalApi.simulateJudge(id, version, current?.item_id),
    'Simulated labeling — unjudged pool marked 0',
  );

  function setGrade(itemId: string, docId: string, grade: number | null) {
    judge.mutate(
      { item_id: itemId, doc_id: docId, grade: grade ?? 0, clear: grade === null },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ['eval', 'pool', id, version] }) },
    );
  }

  function runSimulate() {
    simulate.mutate(undefined, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ['eval', 'pool', id, version] }),
    });
  }

  return (
    <div className="space-y-4">
      {locked && (
        <LockedBanner>Frozen versions cannot be relabelled. Fork to judge the pool — the audit trail stays on this version.</LockedBanner>
      )}

      <Panel
        title={current ? current.item_id : 'Pool & judge'}
        icon={current ? Target : Layers3}
        subtitle={current
          ? <>{current.docs.length} pooled documents{current.relevant_not_pooled.length > 0 && <> · <span className="text-amber-300">relevant but never retrieved: {current.relevant_not_pooled.join(', ')}</span></>}</>
          : 'Union of top-k from several retrievers, then judge every document in the pool.'}
        actions={
          current ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setSelected(null)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Queue
            </Button>
          ) : undefined
        }
      >
        {current ? (
          <div key={current.item_id} className="animate-fade-in space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p dir="auto" className="text-sm font-medium">{current.query}</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                disabled={locked || unjudgedCount === 0 || simulate.isPending}
                onClick={runSimulate}>
                <Wand2 className="h-3.5 w-3.5" /> Simulate Labeling
              </Button>
            </div>
            <div className="space-y-2">
              {docSlice.map((d) => {
                const grade = parseJudgement(d.judgement);
                return (
                  <div key={d.doc_id} className={cn('rounded-lg border p-2.5',
                    grade === null ? 'border-amber-500/25 bg-amber-500/[0.03]' : grade > 0 ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-white/8 bg-card/30')}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-medium">{d.doc_id}</span>
                      {Object.entries(d.retrieved_by).map(([v, rank]) => <Pill key={v}>{v} #{rank}</Pill>)}
                      <span className="ml-auto">
                        <GradeButtons value={grade} disabled={locked || judge.isPending}
                          onChange={(g) => setGrade(current.item_id, d.doc_id, g)} />
                      </span>
                    </div>
                    <p dir="auto" className="mt-1.5 line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{d.excerpt}</p>
                  </div>
                );
              })}
            </div>
            <Pager page={safeDocPage} pageSize={PAGE_SIZE} total={docs.length} onPage={setDocPage} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Depth (top-k per retriever)" className="w-48">
                <SelectBox value={depth} onChange={setDepth} options={[5, 10, 15, 20].map((d) => ({ value: d, label: `${d}` }))} />
              </Field>
              <Button className="gap-1.5" disabled={!offReady || start.isPending} onClick={() => start.mutate(undefined)}>
                <Play className="h-4 w-4" /> {view?.exists ? 'Rebuild pool' : 'Build pool'}
              </Button>
              <Button variant="outline" className="gap-1.5"
                disabled={locked || !view?.exists || unjudgedCount === 0 || simulate.isPending}
                onClick={runSimulate}>
                <Wand2 className="h-4 w-4" /> Simulate Labeling
              </Button>
            </div>
            {!offReady && <p className="text-xs text-amber-300">Index the corpus (normalisation off) first — pooling searches it.</p>}
            {view?.exists && (
              <p className="text-[11px] text-muted-foreground">
                Simulate Labeling marks remaining unjudged pooled documents as <strong>0 · not relevant</strong> so you can
                experiment without clicking every pair. Gold relevant grades are left alone.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Retrievers: hybrid (vector + full-text) · vector-only · chunk-level vector{bundle.meta.lang === 'ar' ? ' · hybrid with query normalisation' : ''}.
              Diversity is the point: each finds documents the others miss.
            </p>
            <JobBar jobId={jobId} />

            {view?.exists && view.summary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Stat label="Judged" value={`${Math.round(view.summary.judged_share * 100)}%`} sub={`${view.summary.judged_pairs}/${view.summary.pooled_pairs} pairs`} />
                  <Stat label="Items fully judged" value={view.summary.items_fully_judged} />
                  <Stat label="Relevant in pool" value={view.summary.relevant_pooled} />
                  <Stat label="Relevant never pooled" value={view.summary.relevant_never_pooled}
                    className={view.summary.relevant_never_pooled ? 'border-amber-500/30' : ''} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium">Relevant documents found by only one retriever</p>
                  <RateBars
                    max={Math.max(1, ...Object.values(view.summary.unique_relevant_by_variant))}
                    rows={Object.entries(view.summary.unique_relevant_by_variant).map(([name, n], i) => ({
                      label: name, value: n, color: SERIES[i % SERIES.length],
                    }))}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    (bar length = count; the % label reads as a raw count here) — a non-zero bar is a document a single-system pool would have missed.
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState icon={Layers3} title="No pool yet">Build one to see how much of your evaluation rests on unjudged documents.</EmptyState>
            )}

            {view?.exists && rows.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Queue · most unjudged first</p>
                  <div className="relative w-full sm:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <TextField
                      className="h-8 bg-black/30 pl-8 text-xs"
                      placeholder="Search by question id…"
                      value={idQuery}
                      onChange={(e) => setIdQuery(e.target.value)}
                    />
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted-foreground">
                    No question id matches “{idQuery.trim()}”.
                  </p>
                ) : (
                  <>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr><th className="py-1.5 pr-2">id</th><th className="pr-2">query</th><th className="pr-2">split</th><th /></tr>
                        </thead>
                        <tbody>
                          {queueSlice.map((r) => (
                            <tr key={r.item_id}
                              className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
                              onClick={() => setSelected(r.item_id)}>
                              <td className="py-1.5 pr-2 font-mono">{r.item_id}</td>
                              <td className="max-w-[420px] truncate pr-2" dir="auto">{r.query}</td>
                              <td className="pr-2">{r.split === 'holdout' ? <Pill tone="info">holdout</Pill> : r.split ? <Pill>{r.split}</Pill> : <Pill>—</Pill>}</td>
                              <td className="text-right">{r.unjudged ? <Pill tone="warn">{r.unjudged} unjudged</Pill> : <Pill tone="good">done</Pill>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pager page={safeQueuePage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setQueuePage} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      <PrincipalNote title="Unjudged is not irrelevant">
        Your labels cover the documents <strong>you</strong> thought of. Every other document is scored as non-relevant by
        assumption, so a retriever that finds a relevant document you never labelled is <strong>penalised for being
        right</strong> — a bias toward whatever resembles your own search. Pooling (the TREC method) runs several diverse
        systems, judges the union of their top results, and records explicit <strong>0 = not relevant</strong> judgements.
        Runs then report <strong>judged@k</strong>: how much of each top-k window rests on real judgements rather than the
        assumption.
      </PrincipalNote>
    </div>
  );
}

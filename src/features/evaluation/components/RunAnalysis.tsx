import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, LineChart as LineIcon, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import { EmptyState, Field, Pager, Pill, PrincipalNote, SelectBox, TextField } from './EvalPrimitives';
import { LineChart, RateBars, SERIES } from './statCharts';
import { METRIC_INFO, METRIC_KEYS, fmt3 } from '@/features/evaluation/lib/evalStats';
import type { FailureRow } from '@/types/eval';

const PAGE_SIZE = 5;

const SWEEP_LABELS: Record<string, string> = {
  hit_rate: 'Hit rate', recall: 'Recall', precision: 'Precision', mrr: 'MRR', ndcg: 'NDCG', graded_ndcg: 'NDCG graded', map: 'MAP',
};

export function SweepsPanel({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['eval', 'sweeps', runId], queryFn: () => evalApi.sweeps(runId, 20) });
  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl border border-white/8 bg-black/20" />;
  if (!data.k.n) return <EmptyState icon={LineIcon} title="No judged queries in this run" />;

  const kSeries = Object.entries(data.k.series).map(([name, values], i) => ({
    name: SWEEP_LABELS[name] ?? name, color: SERIES[i % SERIES.length],
    values: values.map((y, j) => ({ x: data.k.ks[j], y })),
  }));
  const t = data.threshold.points;
  const tSeries = [
    { name: `Recall@${data.threshold.k}`, color: SERIES[1], values: t.map((p) => ({ x: p.threshold, y: p.recall })) },
    { name: `Precision@${data.threshold.k}`, color: SERIES[2], values: t.map((p) => ({ x: p.threshold, y: p.precision })) },
    { name: 'MRR', color: SERIES[3], values: t.map((p) => ({ x: p.threshold, y: p.mrr })) },
    { name: 'Empty results', color: SERIES[4], dashed: true, values: t.map((p) => ({ x: p.threshold, y: p.empty_share })) },
  ];
  const firstEmpty = t.find((p) => p.empty_share > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 2xl:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          <p className="mb-2 text-xs font-medium">Every metric at k = 1…20 <span className="font-normal text-muted-foreground">(computed exactly at each k, from the stored rankings)</span></p>
          <LineChart series={kSeries} markers={[{ x: data.k.run_k, label: `run k=${data.k.run_k}` }]} formatX={(v) => `${v}`} />
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          <p className="mb-2 text-xs font-medium">Dropping results below a similarity floor <span className="font-normal text-muted-foreground">({data.threshold.score_kind})</span></p>
          <LineChart series={tSeries} formatX={(v) => v.toFixed(2)}
            markers={firstEmpty ? [{ x: firstEmpty.threshold, label: 'first empty result' }] : []} />
        </div>
      </div>
      <PrincipalNote title="Reading sweeps">
        Recall climbs with k while precision falls — <strong>k is a decision about what the generator consumes</strong>, not a
        tuning knob to maximise a number. Hit rate flattens early: once any relevant result is inside the window it cannot move.
        The threshold sweep recreates the <strong>CRAG_MIN_SCORE</strong> finding offline: a low floor keeps noisy context, a high
        floor starves retrieval (empty results). The useful range is the gap between those two failure modes.
      </PrincipalNote>
    </div>
  );
}

export function FailuresPanel({ runId }: { runId: string }) {
  const [metric, setMetric] = useState('recall@k');
  const [threshold, setThreshold] = useState(1);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['eval', 'failures', runId, metric, threshold],
    queryFn: () => evalApi.failures(runId, metric, threshold),
  });

  useEffect(() => { setPage(1); }, [metric, threshold, runId, data?.failed]);

  const failures = data?.failures ?? [];
  const totalPages = Math.max(1, Math.ceil(failures.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = failures.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
        <Field label="Failure = metric below" className="w-44">
          <SelectBox value={metric} onChange={setMetric} options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))} />
        </Field>
        <Field label="Threshold" className="w-24">
          <TextField type="number" step={0.1} min={0} max={1} value={threshold} onChange={(e) => setThreshold(Math.max(0, Math.min(1, Number(e.target.value))))} />
        </Field>
        {data && (
          <p className="pb-2 text-xs text-muted-foreground">
            {data.failed} of {data.scored} queries failed ({Math.round(data.failure_rate * 100)}%) · {data.tagged} tagged
          </p>
        )}
      </div>

      {data && data.failed > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="mb-1.5 text-xs font-medium">Suggested causes (auto)</p>
            <RateBars max={data.failed}
              rows={Object.entries(data.suggested_counts).map(([k, n], i) => ({ label: data.taxonomy[k]?.label ?? k, value: n, color: SERIES[i % SERIES.length], sub: data.taxonomy[k]?.hint }))} />
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="mb-1.5 text-xs font-medium">Your tags</p>
            {Object.keys(data.tag_counts).length ? (
              <RateBars max={data.failed}
                rows={Object.entries(data.tag_counts).map(([k, n], i) => ({ label: data.taxonomy[k]?.label ?? k, value: n, color: SERIES[(i + 3) % SERIES.length] }))} />
            ) : <p className="text-xs text-muted-foreground">No tags yet — suggestions are hypotheses; confirm or correct them below.</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">Bars show share of failed queries.</p>
          </div>
        </div>
      )}

      {isLoading && <div className="h-40 animate-pulse rounded-xl border border-white/8 bg-black/20" />}
      {data && data.failed === 0 && <EmptyState icon={Bug} title="No failures at this threshold" />}
      {slice.map((f) => <FailureCard key={f.item_id} runId={runId} row={f} taxonomy={data!.taxonomy} />)}
      {data && data.failed > 0 && <Pager page={safePage} pageSize={PAGE_SIZE} total={failures.length} onPage={setPage} />}

      <PrincipalNote title="Error analysis">
        A mean says <strong>that</strong> a system fails; only the individual failures say <strong>why</strong>, and "why" is the only
        thing you can act on. Suggested causes are heuristics from the data — treat them as hypotheses. A <strong>label gap</strong>
        (the top result was never judged) is a dataset problem, not a retriever problem: judge it before blaming the system.
      </PrincipalNote>
    </div>
  );
}

function FailureCard({ runId, row, taxonomy }: { runId: string; row: FailureRow; taxonomy: Record<string, { auto: boolean; label: string; hint: string }> }) {
  const qc = useQueryClient();
  const [tags, setTags] = useState<string[]>(row.tags);
  const [note, setNote] = useState(row.note);
  const save = useEvalMutation(() => evalApi.tagFailure(runId, row.item_id, tags, note), {
    success: 'Tagged',
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eval', 'failures', runId] }); qc.invalidateQueries({ queryKey: ['eval', 'learning'] }); },
  });
  const dirty = JSON.stringify(tags) !== JSON.stringify(row.tags) || note !== row.note;

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-black/20 text-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">{row.item_id}</span>
        <span dir="auto" className="min-w-0 flex-1 truncate font-medium" title={row.query}>{row.query}</span>
        <span className={cn('font-mono tabular-nums', row.value === 0 ? 'text-red-400' : 'text-muted-foreground')}>{fmt3(row.value)}</span>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-white/8 bg-black/25 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Top 5 · relevant: {row.relevant.map((d) => `${d}${row.relevant_ranks[d] ? ` @${row.relevant_ranks[d]}` : ' (not retrieved)'}`).join(', ')}
          </p>
          <ol className="mt-1.5 space-y-1">
            {row.top.map((h) => (
              <li key={h.rank} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="w-4 text-muted-foreground">{h.rank}</span>
                <span className={cn(h.grade > 0 ? 'text-emerald-300' : h.judged ? 'text-red-300' : 'text-amber-300')}>{h.doc_id}</span>
                <span className="text-muted-foreground">{h.grade > 0 ? `grade ${h.grade}` : h.judged ? 'judged not relevant' : 'unjudged'}</span>
                <span className="ml-auto text-muted-foreground">{h.score.toFixed(3)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-2">
          {row.suggested.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.suggested.map((s) => <Pill key={s} tone="info" title={taxonomy[s]?.hint}>suggested: {taxonomy[s]?.label ?? s}</Pill>)}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {Object.entries(taxonomy).map(([key, t]) => {
              const on = tags.includes(key);
              return (
                <button key={key} type="button" title={t.hint}
                  onClick={() => setTags((cur) => on ? cur.filter((x) => x !== key) : [...cur, key])}
                  className={cn('rounded-full border px-2 py-0.5 text-[10px] transition-colors', on ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 text-muted-foreground hover:text-foreground')}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <TextField className="h-8 text-xs" placeholder="note — what would fix this?" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" className="h-8 gap-1 text-xs" disabled={!dirty || save.isPending} onClick={() => save.mutate(undefined)}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

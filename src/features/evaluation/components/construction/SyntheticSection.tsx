import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Check, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation, useEvalMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, JobBar, LockedBanner, Panel, Pill, PrincipalNote, Segmented, SelectBox, Stat, TextArea, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { ScoreHistogram, VIZ } from '@/features/evaluation/components/charts';
import { useEvalStore } from '@/store/eval.store';
import type { Candidate, DatasetBundle, Job, Split } from '@/types/eval';

const REJECT_REASONS = [
  'leaky: copies the document wording',
  'evidence not in document',
  'not answerable from the document',
  'ambiguous question',
  'unnatural phrasing',
  'duplicate of an existing item',
];

export function SyntheticSection({ bundle }: { bundle: DatasetBundle }) {
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const locked = bundle.manifest.status === 'frozen';
  const qc = useQueryClient();
  const trackJob = useEvalStore((s) => s.trackJob);

  const [docIds, setDocIds] = useState<string[]>([]);
  const [perDoc, setPerDoc] = useState(2);
  const [style, setStyle] = useState<'user' | 'keyword' | 'hard'>('user');
  const [temperature, setTemperature] = useState(0.7);
  const [seed, setSeed] = useState(7);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showReviewed, setShowReviewed] = useState(false);

  const view = useQuery({ queryKey: ['eval', 'candidates', id, version], queryFn: () => evalApi.candidates(id, version) });
  const generate = useEvalMutation(
    () => evalApi.generate(id, version, { doc_ids: docIds.length ? docIds : null, per_doc: perDoc, style, temperature, seed }),
    { success: 'Generation started — an 8B model takes a while per document', onSuccess: (j: Job) => { setJobId(j.id); trackJob(j.id); } },
  );

  const summary = view.data?.summary;
  const candidates = view.data?.candidates ?? [];
  const pending = candidates.filter((c) => c.status === 'pending');
  const reviewed = candidates.filter((c) => c.status !== 'pending');
  const refresh = () => qc.invalidateQueries({ queryKey: ['eval', 'candidates', id, version] });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="Generate candidate questions" icon={Bot} subtitle="Local Ollama (llama3.1 8B) — no document text leaves the network.">
          <div className="space-y-3">
            <Field label="Style">
              <Segmented value={style} onChange={setStyle}
                options={[{ value: 'user', label: 'user-like' }, { value: 'keyword', label: 'keywords' }, { value: 'hard', label: 'hard paraphrase' }]} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Per document">
                <SelectBox value={perDoc} onChange={setPerDoc} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))} />
              </Field>
              <Field label={`Temperature · ${temperature.toFixed(1)}`}>
                <input type="range" min={0} max={1.5} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
              </Field>
              <Field label="Seed"><TextField type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></Field>
            </div>
            <Field label={`Documents · ${docIds.length ? docIds.length : 'all'}`}>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {bundle.corpus.map((d) => {
                  const on = docIds.includes(d.doc_id);
                  return (
                    <button key={d.doc_id} type="button" onClick={() => setDocIds((cur) => on ? cur.filter((x) => x !== d.doc_id) : [...cur, d.doc_id])}
                      className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px]', on ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 text-muted-foreground hover:text-foreground')}>
                      {d.doc_id}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Button className="gap-1.5" disabled={!bundle.corpus.length || generate.isPending} onClick={() => generate.mutate(undefined)}>
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
            <JobBar jobId={jobId} />
          </div>
        </Panel>

        <Panel title="Review queue" icon={Sparkles}>
          {!summary || summary.total === 0 ? (
            <EmptyState icon={Bot} title="No candidates yet" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Pending" value={summary.pending} sub={`${summary.total} generated`} />
                <Stat label="Accepted" value={summary.accepted} sub={summary.acceptance_rate !== null ? `${Math.round(summary.acceptance_rate * 100)}% of reviewed` : ''} />
                <Stat label="Evidence found" value={summary.evidence_found_rate !== null ? `${Math.round(summary.evidence_found_rate * 100)}%` : '—'} sub="quoted verbatim?" />
                <Stat label="Mean overlap" value={summary.mean_overlap !== null ? `${Math.round(summary.mean_overlap * 100)}%` : '—'} sub={`${summary.copied} copied verbatim`} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Lexical overlap with the source document</p>
                <ScoreHistogram height={120} series={[{ label: 'overlap', values: candidates.map((c) => c.lexical_overlap), color: VIZ.treatment }]} />
                <p className="text-[10px] text-muted-foreground">Real user questions sit left. A pile near 1.0 means the model is quoting its source — easy mode for lexical search.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {locked && <LockedBanner>Frozen — accepting a candidate adds an item, which requires a draft. Fork to review.</LockedBanner>}

      {pending.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((c) => <CandidateCard key={c.id} candidate={c} bundle={bundle} locked={locked} onDone={refresh} />)}
        </div>
      )}

      {reviewed.length > 0 && (
        <Panel title={`Reviewed · ${reviewed.length}`} icon={Check}
          actions={<Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowReviewed((v) => !v)}>{showReviewed ? 'hide' : 'show'}</Button>}>
          {showReviewed && (
            <table className="w-full text-xs">
              <tbody>
                {reviewed.map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="py-1 pr-2">{c.status === 'accepted' ? <Pill tone="good">→ {c.item_id}</Pill> : <Pill tone="bad">rejected</Pill>}</td>
                    <td className="max-w-[360px] truncate pr-2" dir="auto" title={c.query}>{c.query}</td>
                    <td className="pr-2 font-mono text-[10px]">{c.doc_id}</td>
                    <td className="text-muted-foreground">{c.reject_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      <PrincipalNote title="Synthetic data: fast, and easy to fool yourself with">
        Generated questions <strong>echo their source text</strong> (high lexical overlap), are <strong>always answerable
        from one chunk</strong> (no multi-hop, no unanswerable), and follow the model's phrasing, not your users'. They flatter
        hybrid/lexical retrieval and hide exactly the failures real questions expose. Use them to grow <strong>dev</strong>;
        keep the <strong>holdout human-written</strong>. Reject aggressively and write down why — the rejection reasons are
        a dataset about your generator.
      </PrincipalNote>
    </div>
  );
}

function CandidateCard({ candidate: c, bundle, locked, onDone }: { candidate: Candidate; bundle: DatasetBundle; locked: boolean; onDone: () => void }) {
  const [query, setQuery] = useState(c.query);
  const [split, setSplit] = useState<Split>('dev');
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const accept = useDatasetMutation(
    () => evalApi.acceptCandidate(bundle.meta.id, bundle.manifest.version, c.id, { query, split }),
    'Accepted into the golden set',
  );
  const reject = useEvalMutation(() => evalApi.rejectCandidate(bundle.meta.id, bundle.manifest.version, c.id, reason), { onSuccess: onDone });
  const overlapTone = c.lexical_overlap >= 0.8 ? 'bad' : c.lexical_overlap >= 0.5 ? 'warn' : 'good';

  return (
    <div className="space-y-2 rounded-xl border border-white/8 bg-card/30 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-mono text-muted-foreground">{c.doc_id} · chunk {c.chunk_index}</span>
        <Pill tone={overlapTone}>overlap {Math.round(c.lexical_overlap * 100)}%</Pill>
        {c.copied && <Pill tone="bad">copied verbatim</Pill>}
        <Pill tone={c.evidence_found ? 'good' : 'bad'}>{c.evidence_found ? 'evidence found' : 'evidence NOT in doc'}</Pill>
        <Pill>{c.style} · T={c.temperature}</Pill>
      </div>
      <TextArea dir="auto" className="min-h-[48px] font-sans text-sm" value={query} onChange={(e) => setQuery(e.target.value)} />
      {c.evidence && <p dir="auto" className="border-l-2 border-white/15 pl-2 text-xs text-muted-foreground">“{c.evidence}”</p>}
      {c.answer && <p dir="auto" className="text-[11px] text-muted-foreground">answer: {c.answer}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <SelectBox className="h-8 w-28 text-xs" value={split} onChange={setSplit} options={[{ value: 'dev', label: 'dev' }, { value: 'holdout', label: 'holdout ⚠' }]} />
        <Button size="sm" className="gap-1 text-xs" disabled={locked || accept.isPending || !query.trim()}
          onClick={() => accept.mutate(undefined, { onSuccess: onDone })}>
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
        <SelectBox className="h-8 min-w-0 flex-1 text-xs" value={reason} onChange={setReason} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />
        <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted-foreground hover:text-red-400" disabled={reject.isPending} onClick={() => reject.mutate(undefined)}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import {
  FlaskConical, Loader2, Play, Save, Search, Sigma, SlidersHorizontal, Info, Target, Undo2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import {
  useDatasetMutation, useEvalMutation, useJob, useSelectedDataset,
} from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, JobBar, Panel, Pill, PrincipalNote, SelectBox, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { DEFAULT_VARIANT, VariantEditor } from '@/features/evaluation/components/VariantEditor';
import { RunDetail } from '@/features/evaluation/components/RunViews';
import { METRIC_INFO, METRIC_KEYS, fmt3 } from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type { DatasetBundle, Job, RankedHit, SearchRequest, SearchResponse, VariantSpec } from '@/types/eval';

const GRADE_LABEL = ['not relevant', 'partially', 'substantially', 'fully answers'];

export function RetrievalEvalPage() {
  const { data: bundle, datasetId } = useSelectedDataset();
  if (!datasetId || !bundle) {
    return (
      <EmptyState icon={FlaskConical} title="Select or create a dataset first">
        Use the dataset picker above, or create one under Dataset Construction.
      </EmptyState>
    );
  }
  return <RetrievalWorkbench key={`${bundle.meta.id}@${bundle.manifest.version}`} bundle={bundle} />;
}

function RetrievalWorkbench({ bundle }: { bundle: DatasetBundle }) {
  const draft = bundle.manifest.status === 'draft';
  const [variant, setVariant] = useState<VariantSpec>({ ...DEFAULT_VARIANT, name: 'probe' });
  const [k, setK] = useState(5);
  const [itemId, setItemId] = useState('');
  const [query, setQuery] = useState('');
  const [judgments, setJudgments] = useState<Record<string, number> | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);

  const item = bundle.items.find((i) => i.id === itemId) ?? null;
  const baseRelevant = judgments ?? item?.relevant ?? {};
  const indexState = bundle.indexes[variant.corpus_index];
  const indexReady = !!indexState?.current;

  const search = useEvalMutation((body: SearchRequest) => evalApi.search(body), { onSuccess: setResponse });
  const saveItem = useDatasetMutation(
    (rel: Record<string, number>) => {
      const id = item?.id ?? nextItemId(bundle);
      const base = item ?? {
        id, query, lang: bundle.meta.lang, relevant: {}, evidence: [], ground_truth: '', difficulty: 'medium' as const,
        trap: 'none', tags: [], split: null, pinned: false, notes: '', judged_nonrelevant: [], origin: 'human',
      };
      setItemId(id);
      return evalApi.putItem(bundle.meta.id, bundle.manifest.version, { ...base, relevant: rel });
    },
    'Judgements saved to the golden set',
  );

  function run(rel: Record<string, number> | null = judgments, q = query, it = item) {
    if (!q.trim() || !indexReady) return;
    search.mutate({
      dataset_id: bundle.meta.id, version: bundle.manifest.version, variant, query: q, k,
      item_id: it?.id ?? null, relevant: rel,
    });
  }

  function pickItem(id: string) {
    setItemId(id);
    setJudgments(null);
    const it = bundle.items.find((i) => i.id === id) ?? null;
    if (it) {
      setQuery(it.query);
      run(null, it.query, it);
    }
  }

  function cycleGrade(hit: RankedHit) {
    const current = baseRelevant[hit.doc_id] ?? 0;
    const next = (current + 1) % 4;
    const updated = { ...baseRelevant };
    if (next === 0) delete updated[hit.doc_id];
    else updated[hit.doc_id] = next;
    setJudgments(updated);
    run(updated);
  }

  const diverges = judgments !== null && JSON.stringify(judgments) !== JSON.stringify(item?.relevant ?? {});

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {/* Query bar */}
        <Panel title="Probe" icon={Search} subtitle="Run one query, see the ranking, and see exactly how each metric is computed from it.">
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => { e.preventDefault(); run(); }}
          >
            <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <Field label="Golden item (optional)">
                <SelectBox value={itemId} onChange={pickItem}
                  options={[{ value: '', label: 'free query — judge results yourself' },
                    ...bundle.items.map((i) => ({ value: i.id, label: `${i.split === 'holdout' ? '🔒 ' : ''}${i.id} · ${i.query.slice(0, 48)}` }))]} />
              </Field>
              <Field label="Query">
                <div className="flex gap-2">
                  <TextField dir="auto" value={query} placeholder="Ask the index…" className="h-10 text-sm"
                    onChange={(e) => { setQuery(e.target.value); if (item && e.target.value !== item.query) setItemId(''); }} />
                  <Button type="submit" className="h-10 gap-1.5" disabled={!query.trim() || !indexReady || search.isPending}>
                    {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
                  </Button>
                </div>
              </Field>
            </div>
            {!indexReady && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {indexState ? indexState.reason : `No '${variant.corpus_index}' index`} — index the corpus in Dataset Construction.
              </p>
            )}
            {item?.split === 'holdout' && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Holdout item. Inspecting it and then changing the system leaks it into your tuning — prefer dev items while iterating.
              </p>
            )}
          </form>
        </Panel>

        {response ? (
          <>
            <ResultsPanel response={response} relevant={baseRelevant} onGrade={cycleGrade} level={variant.level} k={k} />
            {(diverges || (!item && judgments && Object.keys(judgments).length > 0)) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neon/30 bg-neon/[0.05] p-3 text-xs">
                <Target className="h-4 w-4 text-neon" />
                <span className="flex-1">
                  {item ? <>Your judgements differ from golden item <strong>{item.id}</strong>.</> : <>This query has ad-hoc judgements.</>}
                  {' '}Metrics above use your judgements.
                </span>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => { setJudgments(null); run(null); }}>
                  <Undo2 className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" disabled={!draft || saveItem.isPending}
                  title={draft ? '' : 'Frozen dataset — fork to add judgements'}
                  onClick={() => judgments && saveItem.mutate(judgments, { onSuccess: () => setJudgments(null) })}>
                  <Save className="h-3.5 w-3.5" /> {item ? 'Update golden item' : 'Add as golden item'}
                </Button>
              </div>
            )}
            <ExplainPanel response={response} k={k} />
          </>
        ) : (
          <Panel title="Results" icon={FlaskConical}>
            <EmptyState icon={FlaskConical} title="Run a query">
              Pick a golden item to score against its judgements, or type a free query and click the grade chips to
              judge results yourself — metrics recompute as you judge.
            </EmptyState>
          </Panel>
        )}

        <BatchRun bundle={bundle} variant={variant} k={k} indexReady={indexReady} />
      </div>

      {/* Configuration rail */}
      <div className="space-y-4">
        <Panel title="Retrieval configuration" icon={SlidersHorizontal}>
          <div className="space-y-3">
            <VariantEditor value={variant} onChange={setVariant}
              indexed={{ off: !!bundle.indexes.off?.current, conservative: !!bundle.indexes.conservative?.current, aggressive: !!bundle.indexes.aggressive?.current }} />
            <Field label="k (cutoff)" hint="Set metrics at k; rank-aware metrics (MRR, NDCG, MAP) at max(k, 10). Keep k at what the generator consumes.">
              <TextField type="number" min={1} max={50} value={k} onChange={(e) => setK(Math.max(1, Math.min(50, Number(e.target.value) || 5)))} />
            </Field>
            <Button size="sm" variant="outline" className="w-full text-xs" disabled={!query.trim() || !indexReady} onClick={() => run()}>
              Re-run with this configuration
            </Button>
          </div>
        </Panel>
        <PrincipalNote title="Variants & the control group">
          A <strong>variant</strong> is one complete configuration. Change one field at a time and the difference is that
          field’s effect. In the Arabic normalisation study, the <strong>English set is the control group</strong>: it has
          nothing to normalise, so a movement there means the change did something general — not that it fixed Arabic
          orthography. Without a control, attribution is a guess.
        </PrincipalNote>
      </div>
    </div>
  );
}

function nextItemId(bundle: DatasetBundle) {
  let n = bundle.items.length + 1;
  while (bundle.items.some((i) => i.id === `q-${String(n).padStart(3, '0')}`)) n++;
  return `q-${String(n).padStart(3, '0')}`;
}

/* ── Results ─────────────────────────────────────────────────────────────── */

function ResultsPanel({
  response, relevant, onGrade, level, k,
}: {
  response: SearchResponse; relevant: Record<string, number>; onGrade: (hit: RankedHit) => void;
  level: VariantSpec['level']; k: number;
}) {
  const { result, notes } = response;
  const hasJudgements = Object.keys(result.relevant_units).length > 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Panel title={`Ranking · ${result.ranked.length} ${level === 'chunk' ? 'chunks' : 'documents'}`} icon={FlaskConical}
        subtitle={<>{result.latency_ms.toFixed(0)} ms{result.query_sent !== result.query && <> · sent as <span dir="auto" className="font-mono text-foreground">“{result.query_sent}”</span></>}</>}>
        <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {result.ranked.map((hit) => {
            const docGrade = relevant[hit.doc_id] ?? 0;
            const credited = hit.grade > 0;
            return (
              <div key={`${hit.rank}-${hit.unit_id}`}
                className={cn('rounded-lg border p-2.5 transition-colors',
                  credited ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-white/8 bg-card/30',
                  hit.rank > k && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold',
                    hit.rank <= k ? 'bg-neon/15 text-neon' : 'bg-white/5 text-muted-foreground')}>{hit.rank}</span>
                  <span className="font-mono font-medium">{hit.doc_id}</span>
                  {hit.chunk_id && <span className="font-mono text-[10px] text-muted-foreground">chunk {hit.chunk_id.slice(0, 8)}</span>}
                  {!hit.novel && <Pill tone="warn" title="Relevant document, but its evidence was already credited higher up">duplicate evidence</Pill>}
                  {hit.rank === k && <Pill tone="neon">k cutoff</Pill>}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    cos {hit.score.toFixed(3)}{hit.rrf_score > 0 && ` · rrf ${hit.rrf_score.toFixed(4)}`}
                  </span>
                  <button
                    onClick={() => onGrade(hit)}
                    title={`Document judgement: ${GRADE_LABEL[docGrade]} — click to cycle`}
                    className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors',
                      docGrade ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/15 text-muted-foreground hover:text-foreground')}
                  >
                    {docGrade ? `grade ${docGrade}` : 'judge'}
                  </button>
                </div>
                <p dir="auto" className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{hit.excerpt}</p>
              </div>
            );
          })}
          {result.ranked.length === 0 && <EmptyState icon={Search} title="No results" />}
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel title="Metrics" icon={Sigma} subtitle={hasJudgements ? `${Object.keys(result.relevant_units).length} relevant unit(s)` : 'no judgements'}>
          {hasJudgements ? (
            <div className="space-y-1.5">
              {METRIC_KEYS.map((m) => {
                const info = METRIC_INFO[m];
                const value = result.metrics[m];
                return (
                  <div key={m} className="group rounded-lg border border-white/8 bg-card/30 px-2.5 py-1.5" title={`${info.measures}\n\nMisleads when: ${info.misleads}`}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs">{info.label} <span className="font-mono text-[10px] text-muted-foreground">@{info.cutoff === 'k' ? k : Math.max(k, 10)}</span></span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{fmt3(value)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-neon" style={{ width: `${(value ?? 0) * 100}%` }} />
                    </div>
                    <p className="mt-1 hidden text-[10px] leading-snug text-muted-foreground group-hover:block">{info.misleads}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Metrics are undefined without relevance judgements. Click “judge” on results.</p>
          )}
        </Panel>
        {notes.length > 0 && (
          <div className="space-y-1.5">
            {notes.map((n, i) => (
              <p key={i} className="flex items-start gap-1.5 rounded-lg border border-white/8 bg-card/30 p-2 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-neon" /> {n}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── The arithmetic, shown ───────────────────────────────────────────────── */

function ExplainPanel({ response, k }: { response: SearchResponse; k: number }) {
  const { explain: e, result } = response;
  if (!e.relevant_count) return null;
  const relInK = e.rows.filter((r) => r.in_k && r.relevant).length;
  const m = result.metrics;

  const formulas: [string, string, number][] = [
    ['Hit rate@k', `${relInK > 0 ? 'a relevant result is in the top ' + k : 'no relevant result in the top ' + k}`, m['hit_rate']],
    ['Recall@k', `${e.found_in_k} found ÷ ${e.relevant_count} relevant`, m['recall@k']],
    ['Precision@k', `${relInK} relevant ÷ ${e.returned_in_k} returned in top ${k}`, m['precision@k']],
    ['MRR', e.first_relevant_rank ? `1 ÷ rank ${e.first_relevant_rank} (first relevant)` : `no relevant result in top ${e.deep_k}`, m['mrr']],
    ['NDCG', `DCG ${e.dcg.toFixed(3)} ÷ IDCG ${e.idcg.toFixed(3)}`, m['ndcg@k']],
    ['NDCG graded', `DCG ${e.graded_dcg.toFixed(3)} ÷ IDCG ${e.graded_idcg.toFixed(3)}`, m['graded_ndcg@k']],
    ['AP', `Σ P@rank ${e.ap_sum.toFixed(3)} ÷ min(|rel|, ${e.deep_k}) = ${e.ap_denominator}`, m['map']],
  ];

  return (
    <Panel title="How the numbers were computed" icon={Sigma}
      subtitle={`Set metrics at k=${k}; rank-aware metrics at deep k=${e.deep_k}. Same arithmetic as retrieval_metrics.py.`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">rank</th><th className="pr-2">unit</th><th className="pr-2">grade</th>
                <th className="pr-2" title="position discount">1/log₂(r+1)</th><th className="pr-2">DCG gain</th>
                <th className="pr-2" title="(2^grade − 1) × discount">graded gain</th><th className="pr-2">P@rank</th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r) => (
                <tr key={r.rank} className={cn('border-t border-white/5', r.relevant && 'text-foreground', !r.relevant && 'text-muted-foreground', !r.in_k && 'opacity-60')}>
                  <td className="py-1 pr-2 font-mono">{r.rank}{r.rank === k && <span className="ml-1 text-neon">┤k</span>}</td>
                  <td className="max-w-[180px] truncate pr-2 font-mono text-[10px]" title={r.unit_id}>{r.unit_id}</td>
                  <td className="pr-2 font-mono">{r.relevant ? r.grade : '·'}</td>
                  <td className="pr-2 font-mono">{r.discount.toFixed(3)}</td>
                  <td className="pr-2 font-mono">{r.relevant ? r.dcg_gain.toFixed(3) : '·'}</td>
                  <td className="pr-2 font-mono">{r.relevant ? r.graded_gain.toFixed(3) : '·'}</td>
                  <td className="pr-2 font-mono">{r.precision_at_rank !== null ? `${r.cumulative_hits}/${r.rank} = ${r.precision_at_rank.toFixed(3)}` : '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5">
          {formulas.map(([name, expr, value]) => (
            <div key={name} className="flex items-baseline justify-between gap-3 rounded-md border border-white/8 bg-card/30 px-2.5 py-1.5 text-xs">
              <span className="font-medium">{name}</span>
              <span className="flex-1 truncate text-right font-mono text-[10px] text-muted-foreground" title={expr}>{expr}</span>
              <span className="font-mono font-semibold tabular-nums">= {fmt3(value)}</span>
            </div>
          ))}
          <PrincipalNote title="Reading this table">
            <strong>IDCG</strong> is the DCG of the perfect ranking — every relevant unit packed at the top, best grade
            first — so NDCG is “how close to ideal”, comparable across questions with different numbers of relevant
            documents. Notice how fast the discount falls: rank 1 is worth 1.000, rank 10 only 0.289.
          </PrincipalNote>
        </div>
      </div>
    </Panel>
  );
}

/* ── Batch run over a split ──────────────────────────────────────────────── */

function BatchRun({ bundle, variant, k, indexReady }: { bundle: DatasetBundle; variant: VariantSpec; k: number; indexReady: boolean }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const trackJob = useEvalStore((s) => s.trackJob);
  const { data: job } = useJob(jobId);
  const hasHoldout = bundle.items.some((i) => i.split === 'holdout');
  const devCount = bundle.items.filter((i) => i.split === 'dev' && Object.keys(i.relevant).length).length;
  const [split, setSplit] = useState<'dev' | 'all'>(hasHoldout || devCount ? 'dev' : 'all');

  const start = useEvalMutation(
    () => evalApi.adhocRun({ dataset_id: bundle.meta.id, version: bundle.manifest.version, variant, split, k }),
    { success: 'Batch run started', onSuccess: (j: Job) => { setJobId(j.id); trackJob(j.id); } },
  );
  const runId = useMemo(() => (job?.status === 'done' ? String(job.result.run_id ?? '') : ''), [job]);

  return (
    <Panel title="Score a whole split (exploratory)" icon={Play}
      subtitle="The same configuration over every answerable item, with 95% bootstrap intervals. For A/B decisions, use Experiments."
      actions={
        <>
          <SelectBox className="h-8 w-44 text-xs" value={split} onChange={setSplit}
            options={[
              { value: 'dev', label: `dev (${devCount} answerable)` },
              ...(!hasHoldout ? [{ value: 'all' as const, label: 'all (no holdout exists)' }] : []),
            ]} />
          <Button size="sm" className="gap-1.5 text-xs" disabled={!indexReady || start.isPending || job?.status === 'running'} onClick={() => start.mutate(undefined)}>
            <Play className="h-3.5 w-3.5" /> Run {variant.name}
          </Button>
        </>
      }>
      <div className="space-y-3">
        {hasHoldout && (
          <p className="text-[11px] text-muted-foreground">
            Holdout items are not available here: ad-hoc runs would let you look at the holdout without a record. Evaluate the
            holdout through a registered experiment.
          </p>
        )}
        <JobBar jobId={jobId} />
        {runId && <RunDetail runId={runId} title={`Result · ${variant.name}`} />}
      </div>
    </Panel>
  );
}

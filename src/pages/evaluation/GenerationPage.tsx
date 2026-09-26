import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Boxes, FlaskConical, GitCompareArrows, Loader2, Play, Plus, Split, Trash2, Waypoints,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { genApi } from '@/api/evalGen.api';
import { useEvalMutation, useSelectedDataset } from '@/features/evaluation/hooks/useEval';
import {
  useGenConfig, useGenRun, useGenRuns, useScenarios, useTrackedJob,
} from '@/features/evaluation/hooks/useGen';
import {
  EmptyState, Field, JobBar, Pill, PrincipalNote, SelectBox, Stat, TextArea, TextField, Toggle,
} from '@/features/evaluation/components/EvalPrimitives';
import { ForestPlot } from '@/features/evaluation/components/charts';
import {
  Bench, LabPage, MetricCard, OUTCOME_TONE, OutcomePill, STAGE_COLOR, StackBar, StageChip, Well, f2,
  metricLabel, pct, useUrlTab, type LabTab,
} from '@/features/evaluation/components/gen/GenUI';
import { fmtTime } from '@/features/evaluation/lib/evalStats';
import type {
  FaultMatrix, GenCompare, GenItemResult, GenRunSummary, MetricResult, PipelineSpec, PlaygroundResponse,
} from '@/types/evalGen';

type Tab = 'playground' | 'pipeline' | 'components' | 'compare';

const TABS: LabTab<Tab>[] = [
  { id: 'playground', title: 'Metrics playground', blurb: 'Four texts, five metrics — see every claim and verdict, then break one thing at a time.', icon: FlaskConical },
  { id: 'pipeline',   title: 'Pipeline runs',      blurb: 'Run a CRAG-shaped pipeline over the dev split and keep the full trace of every stage.', icon: Waypoints },
  { id: 'components', title: 'Components',         blurb: 'Where did it fail? Stage funnel, blame, and fault injection to test the attribution itself.', icon: Boxes },
  { id: 'compare',    title: 'Compare runs',       blurb: 'Paired deltas per metric, outcome transitions, and what moved between stages.', icon: GitCompareArrows },
];

export function GenerationPage() {
  const [tab, setTab] = useUrlTab(TABS);
  return (
    <LabPage title="Generation" tab={tab} onTab={setTab} tabs={TABS}
      blurb={<>Generation metrics, measured on your own pipeline — and traced back to the <strong className="text-foreground">stage</strong> that caused each failure.</>}>
      {tab === 'playground' && <Playground />}
      {tab === 'pipeline' && <Pipeline />}
      {tab === 'components' && <ComponentsTab />}
      {tab === 'compare' && <CompareTab />}
    </LabPage>
  );
}

/* ── Playground ──────────────────────────────────────────────────────────── */

const ALL_METRICS = ['faithfulness', 'answer_relevance', 'context_precision', 'context_recall', 'answer_correctness'];

function Playground() {
  const scenarios = useScenarios();
  const config = useGenConfig();
  const [scenarioId, setScenarioId] = useState('baseline-good');
  const [question, setQuestion] = useState('');
  const [contexts, setContexts] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [reference, setReference] = useState('');
  const [metrics, setMetrics] = useState<string[]>(ALL_METRICS);
  const [embedding, setEmbedding] = useState(true);
  const [model, setModel] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResponse | null>(null);
  const scenario = scenarios.data?.find((s) => s.id === scenarioId);

  useEffect(() => {
    if (!scenario) return;
    setQuestion(scenario.question); setContexts(scenario.contexts); setAnswer(scenario.answer); setReference(scenario.reference);
    setResult(null);
  }, [scenarioId, scenarios.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useEvalMutation(
    () => genApi.playground({ question, contexts, answer, reference, metrics, model, embedding_relevance: embedding }),
    { onSuccess: setResult },
  );
  const move = (i: number, d: number) => {
    const next = [...contexts];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setContexts(next);
  };
  const expect = (name: string) => scenario?.expect[name] ?? scenario?.expect[name.replace('_embedding', '')];

  return (
    <Bench
      controls={
        <>
          <Field label="Scenario" hint="Each one breaks exactly one thing. Edit any text afterwards and run again.">
            <SelectBox value={scenarioId} onChange={setScenarioId}
              options={(scenarios.data ?? []).map((s) => ({ value: s.id, label: s.title }))} />
          </Field>
          <Field label="Metrics">
            <div className="space-y-1.5">
              {ALL_METRICS.map((m) => (
                <Toggle key={m} checked={metrics.includes(m)} label={metricLabel(m)}
                  onChange={(on) => setMetrics(on ? [...metrics, m] : metrics.filter((x) => x !== m))} />
              ))}
              <Toggle checked={embedding} onChange={setEmbedding} label="+ embedding relevance (RAGAS method)" />
            </div>
          </Field>
          <Field label="Judge model" hint="The model that computes every metric. Change it and the fingerprint changes.">
            <SelectBox value={model ?? ''} onChange={(v) => setModel(v || null)}
              options={[{ value: '', label: `default (${config.data?.default_model ?? '…'})` },
                ...(config.data?.models ?? []).filter((m) => !m.includes('embed')).map((m) => ({ value: m, label: m }))]} />
          </Field>
          <Button className="w-full gap-1.5" disabled={run.isPending || !question.trim()} onClick={() => run.mutate(undefined)}>
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {run.isPending ? 'Judging…' : 'Score'}
          </Button>
          {run.isPending && <p className="text-[11px] text-muted-foreground">One LLM call per claim, per chunk and per statement — 10–30 s on a GPU.</p>}
          <PrincipalNote title="Which texts each metric reads">
            <strong>Faithfulness</strong>: answer ↔ context. <strong>Answer relevance</strong>: answer ↔ question.
            <strong> Context precision</strong>: context ↔ reference (rank-weighted). <strong>Context recall</strong>: reference ↔ context.
            <strong> Correctness</strong>: answer ↔ reference. A metric is blind to every text it does not read — that is where each one lies.
          </PrincipalNote>
        </>
      }
    >
      {scenario && (
        <div className="rounded-xl border border-neon/20 bg-neon/[0.05] p-3 text-xs leading-relaxed">
          <p className="font-semibold text-neon">{scenario.title}</p>
          <p className="mt-1 text-muted-foreground">{scenario.lesson}</p>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Question"><TextField value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>
        <Field label="Reference answer (ground truth)"><TextField value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Answer (what the system said)" className="lg:col-span-2">
          <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-[64px] font-sans text-sm" />
        </Field>
      </div>
      <Well title={`Retrieved context · ${contexts.length} chunk${contexts.length === 1 ? '' : 's'} (rank order)`}
        actions={<Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setContexts([...contexts, ''])}><Plus className="h-3.5 w-3.5" /> chunk</Button>}>
        <div className="space-y-2">
          {contexts.map((c, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <span className="font-mono text-[10px] text-neon">#{i + 1}</span>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" className="text-muted-foreground hover:text-red-400" onClick={() => setContexts(contexts.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <TextArea value={c} onChange={(e) => setContexts(contexts.map((x, j) => (j === i ? e.target.value : x)))} className="min-h-[60px] flex-1 font-sans text-xs" />
            </div>
          ))}
          {!contexts.length && <p className="text-xs text-muted-foreground">No context. Faithfulness and context metrics need at least one chunk.</p>}
        </div>
      </Well>
      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Pill tone="neon">judge {result.judge.model} · T={result.judge.temperature}</Pill>
            <Pill>fingerprint {result.judge.fingerprint}</Pill>
            <Pill>{result.calls} LLM calls</Pill>
            {result.abstention && <Pill tone="warn">answer detected as abstention</Pill>}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {Object.values(result.results).map((r: MetricResult) => (
              <MetricCard key={r.name} result={r} expect={expect(r.name)}
                failureMode={config.data?.failure_modes[r.name.replace('_embedding', '').replace('answer_verdict', 'answer_correctness')]} />
            ))}
          </div>
        </>
      )}
    </Bench>
  );
}

/* ── Pipeline runs ───────────────────────────────────────────────────────── */

export const DEFAULT_SPEC: PipelineSpec = {
  name: 'baseline', candidate_k: 10, min_score: 0, rerank: 'none', top_n: 4, grader: true, generator: 'strict',
  generate_temperature: 0, grounding: false, fault: 'none', model: null,
};

function SpecEditor({ spec, onChange }: { spec: PipelineSpec; onChange: (s: PipelineSpec) => void }) {
  const config = useGenConfig();
  const set = <K extends keyof PipelineSpec>(k: K, v: PipelineSpec[K]) => onChange({ ...spec, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Name"><TextField value={spec.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Candidates (k)" hint="Stage 1: chunks fetched"><TextField type="number" min={1} max={50} value={spec.candidate_k} onChange={(e) => set('candidate_k', Number(e.target.value))} /></Field>
        <Field label="Context (top n)" hint="Kept for the generator"><TextField type="number" min={1} max={20} value={spec.top_n} onChange={(e) => set('top_n', Number(e.target.value))} /></Field>
      </div>
      <Field label="Min similarity"><TextField type="number" step={0.05} min={0} max={0.99} value={spec.min_score} onChange={(e) => set('min_score', Number(e.target.value))} /></Field>
      <Field label="Rerank" hint="Reorder the candidates before the top-n cut.">
        <SelectBox value={spec.rerank} onChange={(v) => set('rerank', v)} options={[
          { value: 'none', label: 'none — keep vector order' }, { value: 'lexical', label: 'lexical — word overlap' }, { value: 'llm', label: 'llm — grade each chunk (slow)' },
        ]} />
      </Field>
      <Field label="Generator prompt">
        <SelectBox value={spec.generator} onChange={(v) => set('generator', v)} options={[
          { value: 'strict', label: 'strict — CRAG prompt, abstains' }, { value: 'lenient', label: 'lenient — always answers (hallucinates)' }, { value: 'verbose', label: 'verbose — long answers' },
        ]} />
      </Field>
      <Field label={`Generator temperature · ${spec.generate_temperature.toFixed(1)}`}>
        <input type="range" min={0} max={1.5} step={0.1} value={spec.generate_temperature} onChange={(e) => set('generate_temperature', Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
      </Field>
      <div className="space-y-1.5">
        <Toggle checked={spec.grader} onChange={(v) => set('grader', v)} label="CRAG relevance grader" />
        <Toggle checked={spec.grounding} onChange={(v) => set('grounding', v)} label="Grounding check + one regeneration" />
      </div>
      <Field label="Fault injection" hint={config.data?.faults[spec.fault]}>
        <SelectBox value={spec.fault} onChange={(v) => set('fault', v)}
          options={Object.keys(config.data?.faults ?? { none: '' }).map((f) => ({ value: f as PipelineSpec['fault'], label: f === 'none' ? 'none' : `break ${f}` }))} />
      </Field>
    </div>
  );
}

function runLabel(r: GenRunSummary) {
  const ok = r.aggregates.answer_ok;
  return `${r.spec.name} · ${r.item_ids.length} items · ${ok ? `ok ${pct(ok.mean)}` : r.status} · ${fmtTime(r.created_at)}`;
}

function Pipeline() {
  const { data: bundle, datasetId, version } = useSelectedDataset();
  const runs = useGenRuns();
  const [spec, setSpec] = useState<PipelineSpec>(DEFAULT_SPEC);
  const [limit, setLimit] = useState<number | ''>('');
  const [llmCtx, setLlmCtx] = useState(true);
  const [judgeModel, setJudgeModel] = useState<string | null>(null);
  const config = useGenConfig();
  const [selected, setSelected] = useState<string | null>(null);
  const tracked = useTrackedJob();
  const devN = bundle?.items.filter((i) => i.split === 'dev').length ?? 0;
  const indexed = !!bundle?.indexes.off?.current;

  const start = useEvalMutation(
    () => genApi.startRun({ dataset_id: datasetId!, version: version!, spec, split: 'dev', limit: limit || null, llm_context_metrics: llmCtx, judge_model: judgeModel }),
    { success: 'Generation run started', onSuccess: (j) => tracked.start(j.id) },
  );
  useEffect(() => {
    const id = tracked.job?.status === 'done' ? String(tracked.job.result.run_id ?? '') : '';
    if (id) setSelected(id);
  }, [tracked.job?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!selected && runs.data?.[0]) setSelected(runs.data[0].id); }, [runs.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bundle) return <EmptyState icon={Split} title="Pick a dataset">Choose the frozen Kestrel dataset at the top right.</EmptyState>;
  const perItem = llmCtx ? 14 : 9;

  return (
    <Bench
      controls={
        <>
          <SpecEditor spec={spec} onChange={setSpec} />
          <Field label="Questions" hint={`Dev split: ${devN} questions. Leave empty for all of them.`}>
            <TextField type="number" min={1} max={devN} placeholder={`all ${devN}`} value={limit} onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : '')} />
          </Field>
          <Toggle checked={llmCtx} onChange={setLlmCtx} label="LLM context precision/recall (slower)" />
          <Field label="Metrics judge model" hint="Scores faithfulness, correctness… A different judge = a different fingerprint; the gate will refuse to compare across it.">
            <SelectBox value={judgeModel ?? ''} onChange={(v) => setJudgeModel(v || null)}
              options={[{ value: '', label: `default (${config.data?.default_model ?? '…'})` },
                ...(config.data?.models ?? []).filter((m) => !m.includes('embed')).map((m) => ({ value: m, label: m }))]} />
          </Field>
          <Button className="w-full gap-1.5" disabled={!indexed || start.isPending || tracked.running} onClick={() => start.mutate(undefined)}>
            <Play className="h-4 w-4" /> Run on dev
          </Button>
          {!indexed && <p className="text-[11px] text-amber-300">Index the corpus ('off') in Golden Sets → Index first.</p>}
          <p className="text-[11px] text-muted-foreground">≈ {perItem} LLM calls per question · about {Math.round(((limit || devN) * perItem * 0.8) / 60) || 1} min on a GPU.</p>
          <JobBar jobId={tracked.jobId} />
        </>
      }
    >
      <Well title="Runs on this dataset" hint="Every run keeps its spec, its judge fingerprint and the full trace of every item.">
        {runs.data?.length ? (
          <SelectBox value={selected ?? ''} onChange={setSelected} options={runs.data.map((r) => ({ value: r.id, label: runLabel(r) }))} />
        ) : <p className="text-xs text-muted-foreground">No generation runs yet.</p>}
      </Well>
      {selected && <RunView runId={selected} />}
    </Bench>
  );
}

const HEADLINE = ['answer_ok', 'faithfulness', 'answer_relevance', 'answer_correctness', 'context_recall_labels', 'context_precision_labels', 'context_recall', 'context_precision', 'false_abstention', 'answered_unanswerable'];

function RunView({ runId }: { runId: string }) {
  const run = useGenRun(runId);
  const [item, setItem] = useState<string | null>(null);
  const r = run.data;
  if (!r) return <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Loading run…</p>;
  const open = r.results.find((x) => x.item_id === item);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Pill>
        <Pill tone="neon">{r.spec.name}</Pill>
        {r.spec.fault !== 'none' && <Pill tone="bad">fault: {r.spec.fault}</Pill>}
        <Pill>k={r.spec.candidate_k} → n={r.spec.top_n} · rerank {r.spec.rerank} · grader {r.spec.grader ? 'on' : 'off'} · {r.spec.generator}</Pill>
        <Pill>judge {r.judge_fingerprint}</Pill>
        <Pill>{r.dataset_id} v{r.dataset_version} ({r.dataset_status})</Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {HEADLINE.filter((m) => r.aggregates[m]).map((m) => {
          const a = r.aggregates[m];
          return <Stat key={m} label={metricLabel(m)} value={f2(a.mean)} sub={`[${f2(a.low)}, ${f2(a.high)}] · n=${a.n}`} />;
        })}
      </div>
      <Well title="Per question" hint="Click a row to open its full trace.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-1">item</th><th>trap</th><th>outcome</th><th>blame</th><th>stages</th><th>faith.</th><th>correct.</th><th>ctx recall (labels)</th></tr>
            </thead>
            <tbody>
              {r.results.map((x) => (
                <tr key={x.item_id} onClick={() => setItem(x.item_id === item ? null : x.item_id)}
                  className={cn('cursor-pointer border-t border-white/5 hover:bg-white/[0.03]', x.item_id === item && 'bg-neon/[0.06]')}>
                  <td className="py-1.5 font-mono">{x.item_id}</td>
                  <td className="text-muted-foreground">{x.trap}</td>
                  <td>{x.error ? <Pill tone="bad">error</Pill> : <OutcomePill outcome={x.outcome} />}</td>
                  <td><span className="font-mono" style={{ color: STAGE_COLOR[x.blame] }}>{x.blame}</span></td>
                  <td><div className="flex gap-0.5">{x.stages.map((s) => (
                    <span key={s.stage} title={`${s.stage}: ${s.status} — ${s.detail}`} className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: s.status === 'ok' ? '#0ca30c' : s.status === 'warn' ? '#c98500' : s.status === 'fail' ? '#d03b3b' : 'rgba(255,255,255,0.15)' }} />
                  ))}</div></td>
                  <td className="font-mono">{f2(x.metrics.faithfulness)}</td>
                  <td className="font-mono">{f2(x.metrics.answer_correctness)}</td>
                  <td className="font-mono">{f2(x.metrics.context_recall_labels)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Well>
      {open && <ItemTrace item={open} />}
    </div>
  );
}

export function ItemTrace({ item }: { item: GenItemResult }) {
  const config = useGenConfig();
  const kept = new Set(item.contexts.map((c) => c.chunk_id));
  const detail = (name: string) => item.details[name] as MetricResult | undefined;
  return (
    <Well title={<span className="flex items-center gap-2"><span className="font-mono">{item.item_id}</span> · {item.query}</span>}
      hint={`Reference: ${item.ground_truth || '—'}`}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <OutcomePill outcome={item.outcome} />
          <span className="text-[11px] text-muted-foreground">blame</span>
          <Pill tone={item.blame === 'none' ? 'good' : 'bad'}>{item.blame}</Pill>
          {item.flags.map((f) => <Pill key={f} tone="warn">{f.replace(/_/g, ' ')}</Pill>)}
          <Pill>{Math.round(item.latency_ms / 100) / 10}s</Pill>
        </div>
        <div className="grid gap-1.5">
          {item.stages.map((s) => (
            <div key={s.stage} className="flex items-start gap-2 text-[11px]">
              <StageChip stage={s.stage} status={s.status} />
              <span className="text-muted-foreground">{s.detail}</span>
            </div>
          ))}
        </div>
        {item.units.length > 0 && (
          <div className="text-[11px]"><p className="text-muted-foreground">Evidence units (from the golden labels):</p>
            <ol className="ml-4 list-decimal">{item.units.map((u, i) => <li key={i}>{u}</li>)}</ol></div>
        )}
        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">Candidates (stage 1) — ✦ holds evidence · ▸ kept in the context</p>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {item.candidates.map((c) => (
              <details key={c.chunk_id || c.rank} className={cn('rounded-md border px-2 py-1 text-[11px]', c.evidence_units.length ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-white/8')}>
                <summary className="cursor-pointer">
                  <span className="font-mono">#{c.rank}</span> {kept.has(c.chunk_id) && <span className="text-neon">▸</span>} {c.evidence_units.length > 0 && <span className="text-emerald-400">✦</span>}{' '}
                  <span className="font-mono">{c.doc_id}</span> <span className="text-muted-foreground">· {f2(c.score)}</span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.text}</p>
              </details>
            ))}
          </div>
        </div>
        {item.grade && <p className="text-[11px]"><span className="text-muted-foreground">Grader: </span><Pill tone={item.grade.relevant ? 'good' : 'bad'}>{item.grade.relevant ? 'relevant' : 'not relevant'}</Pill> {item.grade.reason}</p>}
        {item.grounding && <p className="text-[11px]"><span className="text-muted-foreground">Grounding check: </span><Pill tone={item.grounding.grounded ? 'good' : 'warn'}>{item.grounding.grounded ? 'grounded' : 'not grounded'}</Pill> {item.grounding.regenerated && '→ regenerated once. '}{item.grounding.reason}</p>}
        <div className="rounded-lg border border-white/8 bg-card/50 p-2 text-xs"><p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Answer</p><p className="whitespace-pre-wrap">{item.answer}</p></div>
        <div className="grid gap-2 lg:grid-cols-2">
          {['faithfulness', 'answer_correctness', 'answer_verdict', 'answer_relevance', 'context_recall_labels', 'context_recall', 'context_precision_labels', 'context_precision']
            .map((n) => detail(n)).filter((d): d is MetricResult => !!d && Array.isArray(d.steps))
            .map((d) => <MetricCard key={d.name} result={{ ...d, flags: d.flags ?? [], steps: d.steps ?? [], note: d.note ?? '' }} failureMode={config.data?.failure_modes[d.name]} />)}
        </div>
      </div>
    </Well>
  );
}

/* ── Components ──────────────────────────────────────────────────────────── */

function ComponentsTab() {
  const { datasetId, version } = useSelectedDataset();
  const runs = useGenRuns();
  const [runId, setRunId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<FaultMatrix | null>(null);
  const [limit, setLimit] = useState(12);
  const [suiteGrader, setSuiteGrader] = useState(false);
  const tracked = useTrackedJob();
  const run = useGenRun(runId);
  useEffect(() => { if (!runId && runs.data?.[0]) setRunId(runs.data[0].id); }, [runs.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const suite = useEvalMutation(
    () => genApi.faultSuite({ dataset_id: datasetId!, version: version!, spec: { ...DEFAULT_SPEC, grader: suiteGrader, name: suiteGrader ? 'suite-grader-on' : 'suite' }, faults: ['none', 'ingestion', 'retrieval', 'rerank', 'grade', 'generation'], limit }),
    { success: 'Fault suite started (6 runs)', onSuccess: (j) => tracked.start(j.id) },
  );
  const build = useEvalMutation((ids: string[]) => genApi.faultMatrix(ids), { onSuccess: setMatrix });
  useEffect(() => {
    const ids = tracked.job?.status === 'done' ? (tracked.job.result.run_ids as string[] | undefined) : undefined;
    if (ids?.length) { setPicked(ids); build.mutate(ids); }
  }, [tracked.job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // A run still in progress has no components yet.
  const c = run.data?.status === 'done' && run.data.components?.funnel ? run.data.components : undefined;
  return (
    <div className="space-y-5">
      <Well title="Run" actions={runs.data?.length ? <SelectBox className="w-[28rem] max-w-full text-xs" value={runId ?? ''} onChange={setRunId} options={runs.data.map((r) => ({ value: r.id, label: runLabel(r) }))} /> : undefined}>
        {!c ? <p className="text-xs text-muted-foreground">{run.data?.status === 'running' ? 'This run is still running — its components appear when it finishes.' : 'Run the pipeline first (Pipeline runs tab).'}</p> : (
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium">Funnel — answerable questions that survive each stage</p>
              <div className="space-y-1.5">
                {c.funnel.map((f, i) => {
                  const top = c.funnel[0].n || 1;
                  return (
                    <div key={f.step} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{i + 1}. {f.step}</span>
                      <div className="h-3.5 rounded-r bg-white/[0.04]"><div className="h-full rounded-r bg-[#3987e5]" style={{ width: `${(f.n / top) * 100}%` }} /></div>
                      <span className="text-right font-mono">{f.n}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">The biggest drop between two steps is the stage to fix first.</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium">Blame — the first stage that failed, per question</p>
              <StackBar counts={c.blame} colors={STAGE_COLOR} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(c.blame).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <span key={k} className="flex items-center gap-1 text-[11px]"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAGE_COLOR[k] }} />{k} <span className="font-mono">{n}</span></span>
                ))}
              </div>
              <p className="mb-1 mt-4 text-xs font-medium">Stage verdicts</p>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th>stage</th><th>ok</th><th>warn</th><th>fail</th><th>skip</th></tr></thead>
                <tbody>{Object.entries(c.stages).map(([s, v]) => (
                  <tr key={s} className="border-t border-white/5"><td className="py-1">{s}</td><td className="font-mono text-emerald-400">{v.ok ?? 0}</td><td className="font-mono text-amber-300">{v.warn ?? 0}</td><td className="font-mono text-red-400">{v.fail ?? 0}</td><td className="font-mono text-muted-foreground">{v.skip ?? 0}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="xl:col-span-2">
              <p className="mb-1 text-xs font-medium">Blame by trap</p>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">trap</th>{['none', 'ingestion', 'retrieval', 'rerank', 'grade', 'generation'].map((s) => <th key={s}>{s}</th>)}</tr></thead>
                <tbody>{Object.entries(c.blame_by_trap).map(([t, v]) => (
                  <tr key={t} className="border-t border-white/5"><td className="py-1">{t}</td>{['none', 'ingestion', 'retrieval', 'rerank', 'grade', 'generation'].map((s) => <td key={s} className="font-mono">{v[s] ?? ''}</td>)}</tr>
                ))}</tbody>
              </table>
              {Object.keys(c.flags).length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">Flags: {Object.entries(c.flags).map(([f, n]) => `${f.replace(/_/g, ' ')} ×${n}`).join(' · ')}
                  {c.flags.correct_without_evidence ? ' — a correct answer without the labelled evidence in the context means a label gap or knowledge leaking from the model.' : ''}</p>
              )}
            </div>
          </div>
        )}
      </Well>

      <Well title="Fault injection — does attribution find the stage you broke?"
        hint="Six runs over the same questions: one clean, then one per broken stage (LLM context metrics off, for speed). A good diagnostic puts every failure of the 'break rerank' run on rerank.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Questions per run"><TextField type="number" min={4} max={40} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-28" /></Field>
          <Toggle checked={suiteGrader} onChange={setSuiteGrader} label="CRAG grader on (hides downstream faults behind its own failures)" />
          <Button className="gap-1.5" disabled={!datasetId || suite.isPending || tracked.running} onClick={() => suite.mutate(undefined)}><Play className="h-4 w-4" /> Run fault suite</Button>
          <span className="text-[11px] text-muted-foreground">≈ {Math.round((limit * 6 * 7 * 0.8) / 60)} min</span>
        </div>
        <JobBar jobId={tracked.jobId} className="mt-3" />
        <div className="mt-3">
          <p className="mb-1 text-[11px] text-muted-foreground">…or pick existing runs with different faults:</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {(runs.data ?? []).map((r) => (
              <button key={r.id} type="button" onClick={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])}
                className={cn('rounded-full border px-2 py-0.5 text-[10px]', picked.includes(r.id) ? 'border-neon/50 bg-neon/15 text-neon' : 'border-white/10 text-muted-foreground')}>
                {r.spec.name} · {r.spec.fault} · {fmtTime(r.created_at)}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-2 text-xs" disabled={!picked.length || build.isPending} onClick={() => build.mutate(picked)}>Build matrix ({picked.length})</Button>
        </div>
        {matrix && (
          <table className="mt-4 w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-1">injected ↓ · blamed →</th>{matrix.stages.map((s) => <th key={s}>{s}</th>)}<th>failed</th><th>masked</th><th>accuracy</th></tr>
            </thead>
            <tbody>{matrix.rows.map((row) => (
              <tr key={row.run_id} className="border-t border-white/5">
                <td className="py-1.5 font-medium">{row.fault}</td>
                {matrix.stages.map((s) => (
                  <td key={s} className={cn('font-mono', s === row.fault && 'rounded bg-emerald-500/15 text-emerald-300')}>{row.blamed[s] ?? ''}</td>
                ))}
                <td className="font-mono">{row.failed}</td>
                <td className="font-mono text-muted-foreground">{row.masked}</td>
                <td className="font-mono">{row.accuracy == null ? '—' : pct(row.accuracy)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {matrix && <p className="mt-2 text-[11px] text-muted-foreground"><strong className="text-foreground">masked</strong> = questions the fault did not break (e.g. the generator guessed right without context). The <strong className="text-foreground">none</strong> row shows the pipeline&apos;s own failures — those are the ones to study.</p>}
      </Well>
    </div>
  );
}

/* ── Compare ─────────────────────────────────────────────────────────────── */

function CompareTab() {
  const runs = useGenRuns();
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [res, setRes] = useState<GenCompare | null>(null);
  const cmp = useEvalMutation(() => genApi.compare(a, b), { onSuccess: setRes });
  const options = (runs.data ?? []).map((r) => ({ value: r.id, label: runLabel(r) }));
  const rows = useMemo(() => (res?.metrics ?? []).filter((m) => m.low != null).map((m) => ({
    label: metricLabel(m.metric), sublabel: `n=${m.n} · W/L/T ${m.wins}/${m.losses}/${m.ties}`,
    mean: ['false_abstention', 'answered_unanswerable'].includes(m.metric) ? -m.delta : m.delta,
    low: ['false_abstention', 'answered_unanswerable'].includes(m.metric) ? -(m.high ?? 0) : m.low,
    high: ['false_abstention', 'answered_unanswerable'].includes(m.metric) ? -(m.low ?? 0) : m.high,
    emphasis: m.metric === 'answer_ok',
  })), [res]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="A (baseline)"><SelectBox value={a} onChange={setA} options={options} /></Field>
        <Field label="B (candidate)"><SelectBox value={b} onChange={setB} options={options} /></Field>
        <Button disabled={!a || !b || a === b || cmp.isPending} onClick={() => cmp.mutate(undefined)} className="gap-1.5"><GitCompareArrows className="h-4 w-4" /> Compare A → B</Button>
      </div>
      {res && (
        <>
          {res.warnings.map((w) => <p key={w} className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">{w}</p>)}
          <Well title={`Paired deltas (B − A) over ${res.n} questions`} hint={`Spec differs in: ${res.spec_diff.join(', ') || 'nothing'}. Rates where lower is better (false abstention, answered unanswerable) are flipped so right = better.`}>
            <ForestPlot rows={rows} />
          </Well>
          <div className="grid gap-4 lg:grid-cols-2">
            <Well title="Outcome transitions (A → B)">
              <table className="w-full text-xs"><tbody>{res.transitions.map((t) => (
                <tr key={`${t.from}-${t.to}`} className={cn('border-t border-white/5', t.from !== t.to && 'text-foreground')}>
                  <td className="py-1"><Pill tone={OUTCOME_TONE[t.from] ?? 'neutral'}>{t.from}</Pill></td><td>→</td>
                  <td><Pill tone={OUTCOME_TONE[t.to] ?? 'neutral'}>{t.to}</Pill></td><td className="text-right font-mono">{t.n}</td>
                </tr>
              ))}</tbody></table>
            </Well>
            <Well title="Blame A vs B">
              <p className="mb-1 text-[11px] text-muted-foreground">A</p><StackBar counts={res.blame_a} colors={STAGE_COLOR} />
              <p className="mb-1 mt-2 text-[11px] text-muted-foreground">B</p><StackBar counts={res.blame_b} colors={STAGE_COLOR} />
              <div className="mt-3 max-h-48 overflow-y-auto">
                {res.items.map((i) => <p key={i.item_id} className="text-[11px]"><span className="font-mono">{i.item_id}</span>: {i.a} ({i.blame_a}) → {i.b} ({i.blame_b})</p>)}
              </div>
            </Well>
          </div>
        </>
      )}
    </div>
  );
}


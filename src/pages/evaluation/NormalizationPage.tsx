import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileUp, Languages, Loader2, Play, RefreshCw, Search } from 'lucide-react';
import { evalApi, evalErrorMessage } from '@/api/eval.api';
import { evalNormalizationApi as normApi } from '@/api/evalNormalization.api';
import { Button } from '@/components/ui/button';
import {
  EmptyState, Field, Panel, Pill, PrincipalNote, SelectBox, Stat, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import type { Job } from '@/types/eval';
import type {
  NormalizationConfig, NormalizationDataset, NormalizationMetric, NormalizationOptions,
  NormalizationQuery, NormalizationReport,
} from '@/types/evalNormalization';

const keys = {
  options: ['eval', 'normalization', 'options'],
  datasets: ['eval', 'normalization', 'datasets'],
  runs: ['eval', 'normalization', 'runs'],
};
const metrics: NormalizationMetric[] = ['ndcg@10', 'recall@5', 'recall@10', 'recall@100', 'mrr@10'];
const fmt = (value: number) => value.toFixed(4);
const signed = (value: number) => `${value > 0 ? '+' : ''}${fmt(value)}`;

export function NormalizationPage() {
  const options = useQuery({ queryKey: keys.options, queryFn: normApi.options, retry: false });
  const datasets = useQuery({ queryKey: keys.datasets, queryFn: normApi.datasets, retry: false });
  if (options.isError || datasets.isError) return (
    <EmptyState icon={AlertTriangle} title="Arabic Norm could not load">
      <p>{evalErrorMessage(options.error ?? datasets.error)}</p>
      <Button className="mt-3 gap-1.5" size="sm" variant="outline" onClick={() => { void options.refetch(); void datasets.refetch(); }}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </EmptyState>
  );
  if (!options.data || !datasets.data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Arabic Norm…</p>;
  return <NormalizationWorkspace options={options.data} datasets={datasets.data} />;
}

function NormalizationWorkspace({ options, datasets }: { options: NormalizationOptions; datasets: NormalizationDataset[] }) {
  const qc = useQueryClient();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [datasetId, setDatasetId] = useState(datasets[0]?.dataset_id ?? '');
  const [config, setConfig] = useState<NormalizationConfig>({
    ...options.defaults,
    dense_model: options.defaults.dense_model ?? 'facebook/mcontriever',
    dense_revision: options.defaults.dense_revision ?? '9ff6abed2c2fdf32bbbd8b4e98fb10160e317375',
  });
  const [jobInfo, setJobInfo] = useState<{ id: string; datasetId: string } | null>(null);
  const [runId, setRunId] = useState('');
  const [importError, setImportError] = useState('');
  const dataset = datasets.find((d) => d.dataset_id === datasetId);
  const dense = config.retrievers.includes('dense');
  const denseValid = !dense || (!!config.dense_model?.trim() && /^[a-fA-F0-9]{40}$/.test(config.dense_revision ?? ''));
  const job = useQuery({
    queryKey: ['eval', 'job', jobInfo?.id],
    queryFn: () => evalApi.job(jobInfo!.id),
    enabled: !!jobInfo,
    retry: false,
    refetchInterval: (q) => q.state.data?.status === 'running' ? 1000 : false,
  });
  const running = !!jobInfo && (!job.data || job.data.status === 'running');
  const completedRun = job.data?.status === 'done' ? job.data.result.run_id : undefined;
  useEffect(() => {
    if (typeof completedRun !== 'string') return;
    void qc.invalidateQueries({ queryKey: keys.runs });
    if (jobInfo?.datasetId === datasetId) setRunId(completedRun);
  }, [completedRun, datasetId, jobInfo?.datasetId, qc]);

  const runs = useQuery({
    queryKey: [...keys.runs, datasetId], queryFn: () => normApi.runs(datasetId), enabled: !!dataset,
  });
  const report = useQuery({
    queryKey: ['eval', 'normalization', 'run', runId], queryFn: () => normApi.run(runId), enabled: !!runId,
  });
  const importer = useEvalMutation((body: unknown) => normApi.importDataset(body), {
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: keys.datasets });
      setDatasetId(result.dataset_id);
      setRunId('');
    },
    success: 'Passage dataset imported',
  });
  const start = useEvalMutation<void, Job>(() => normApi.start({ dataset_id: datasetId, config }), {
    onSuccess: (result) => setJobInfo({ id: result.id, datasetId }),
  });

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImportError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('For bundles above 20 MB, use the dataset CLI described in docs/experiment-3.');
      importer.mutate(JSON.parse(await file.text()));
    } catch (error) {
      setImportError(evalErrorMessage(error));
    }
  }

  function update<K extends keyof NormalizationConfig>(key: K, value: NormalizationConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Languages className="h-5 w-5 text-neon" /> Arabic normalization</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Measure orthographic changes against a raw baseline, inspect the rankings, and export the evidence for your article.</p>
        </div>
        <Pill tone="info">Passage retrieval · Experiment 3</Pill>
      </div>

      <Panel title="1. Choose the evidence" icon={FileUp}
        subtitle="Import the small diagnostic bundle from docs/experiment-3, or prepare MIRACL with the guide’s CLI. These datasets are independent of Golden Sets."
        actions={<>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void qc.invalidateQueries({ queryKey: keys.datasets })}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={importer.isPending} onClick={() => uploadRef.current?.click()}>
            {importer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />} Import JSON
          </Button>
        </>}>
        <input ref={uploadRef} type="file" accept=".json,application/json" className="hidden" aria-label="Import passage dataset JSON"
          onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="space-y-3">
          {importError && <p role="alert" className="text-xs text-red-400">{importError}</p>}
          {importer.isError && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(importer.error)}</p>}
          {datasets.length ? <Field label="Passage dataset">
            <SelectBox value={datasetId} onChange={(id) => { setDatasetId(id); setRunId(''); }}
              options={datasets.map((d) => ({ value: d.dataset_id, label: `${d.name} · ${d.document_count.toLocaleString()} passages · ${d.query_count.toLocaleString()} queries` }))} />
          </Field> : <EmptyState icon={FileUp} title="Start with a diagnostic dataset">
            Click Import JSON and choose docs/experiment-3/data/diagnostic-bundle.json. For MIRACL, follow the preparation guide and refresh this list after the CLI finishes.
          </EmptyState>}
          {dataset && <DatasetProvenance dataset={dataset} />}
        </div>
      </Panel>

      <Panel title="2. Run the controlled comparison" icon={Play}
        subtitle="Raw is always the reference within each retriever. Primary metric: nDCG@10. All conditions use the same queries, judgments, and corpus.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Retrieval systems" hint="Dense retrieval requires the optional local model dependency.">
              <SelectBox value={config.retrievers.join(',')} onChange={(v) => update('retrievers', v.split(',') as NormalizationConfig['retrievers'])}
                options={[{ value: 'bm25', label: 'Controlled BM25' }, { value: 'dense', label: 'Dense only' }, { value: 'bm25,dense', label: 'BM25 + dense' }]} />
            </Field>
            <Field label="Apply normalization to">
              <SelectBox value={config.normalization_side} onChange={(v) => update('normalization_side', v)}
                options={[{ value: 'both', label: 'Queries + passages (primary)' }, { value: 'query', label: 'Queries only (secondary)' }]} />
            </Field>
            <Field label="Bootstrap resamples">
              <TextField aria-label="Bootstrap resamples" type="number" min={100} max={20000} step={100} value={config.bootstrap_samples}
                onChange={(e) => update('bootstrap_samples', Number(e.target.value))} />
            </Field>
            <Field label="Random seed">
              <TextField aria-label="Random seed" type="number" min={0} max={4294967295} step={1} value={config.seed}
                onChange={(e) => update('seed', Number(e.target.value))} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Normalization conditions</legend>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {options.presets.map((preset) => <label key={preset.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-card/30 p-3">
                <input type="checkbox" className="mt-0.5 accent-[hsl(var(--neon))]" checked={config.presets.includes(preset.id)} disabled={preset.id === 'raw'}
                  onChange={(e) => update('presets', e.target.checked ? [...config.presets, preset.id] : config.presets.filter((id) => id !== preset.id))} />
                <span><span className="block text-xs font-medium">{preset.label}{preset.id === 'raw' && ' · reference'}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{preset.description}</span></span>
              </label>)}
            </div>
          </fieldset>
          <PrincipalNote title="What makes this BM25 baseline controlled?">
            <p>{options.tokenizer}</p>
            <p className="mt-2">Each passage remains a retrieval unit with its original ID. The raw condition must preserve Arabic marks and letter variants. This BM25 implementation is a controlled experimental baseline; it is not an exact reproduction of MIRACL’s official Arabic analyzer.</p>
          </PrincipalNote>
          {dense && <div className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3">
            <p className="text-xs text-muted-foreground">Choose one model and freeze its commit and input formatting before running. Starting a dense run may download model weights if they are not cached; passage and query text is encoded locally.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Dense model" hint="Use a model that was not trained on the evaluation labels."><TextField aria-label="Dense model" value={config.dense_model ?? ''} placeholder="organization/model" onChange={(e) => update('dense_model', e.target.value)} /></Field>
              <Field label="Model revision" hint="Required: the exact 40-character commit hash."><TextField aria-label="Model revision" value={config.dense_revision ?? ''} placeholder="40-character commit" onChange={(e) => update('dense_revision', e.target.value)} /></Field>
              <Field label="Query prefix"><TextField aria-label="Query prefix" value={config.query_prefix} placeholder="As required by the model card" onChange={(e) => update('query_prefix', e.target.value)} /></Field>
              <Field label="Passage prefix"><TextField aria-label="Passage prefix" value={config.document_prefix} placeholder="As required by the model card" onChange={(e) => update('document_prefix', e.target.value)} /></Field>
              <Field label="Batch size"><TextField aria-label="Dense batch size" type="number" min={1} max={256} value={config.dense_batch_size} onChange={(e) => update('dense_batch_size', Number(e.target.value))} /></Field>
              <Field label="Maximum sequence length"><TextField aria-label="Maximum sequence length" type="number" min={8} max={8192} value={config.dense_max_seq_length} onChange={(e) => update('dense_max_seq_length', Number(e.target.value))} /></Field>
            </div>
          </div>}
          <div className="flex flex-wrap items-center gap-3">
            <Button className="gap-1.5" disabled={!dataset || running || start.isPending || !denseValid || config.presets.length < 2 || !Number.isInteger(config.bootstrap_samples) || config.bootstrap_samples < 100 || config.bootstrap_samples > 20000 || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295}
              onClick={() => start.mutate()}>
              {running || start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start comparison
            </Button>
            <span className="text-xs text-muted-foreground">{config.presets.length * config.retrievers.length} conditions · paired 95% intervals · retrieval depth 100</span>
          </div>
          {config.presets.length < 2 && <p className="text-xs text-amber-300">Select at least one normalization condition to compare with raw.</p>}
          {dense && !denseValid && <p className="text-xs text-amber-300">Enter a model name and exact commit revision to enable the run.</p>}
          {start.isError && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(start.error)}</p>}
          {job.isError && <div role="alert" className="text-xs text-red-400">Job status could not load: {evalErrorMessage(job.error)} <Button size="sm" variant="ghost" onClick={() => void job.refetch()}>Retry status</Button></div>}
          {job.data && <JobProgress job={job.data} />}
        </div>
      </Panel>

      <Panel title="3. Read the evidence" icon={Search} subtitle="Saved reports retain the exact dataset hashes and run configuration.">
        <div className="space-y-3">
          {runs.isError && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(runs.error)}</p>}
          {!!runs.data?.length && <Field label="Saved comparison">
            <SelectBox value={runId} onChange={setRunId} placeholder="Choose a report"
              options={runs.data.map((r) => ({ value: r.run_id, label: `${new Date(r.created_at).toLocaleString()} · ${r.run_id}` }))} />
          </Field>}
          {report.isFetching && <p className="text-xs text-muted-foreground">Loading report…</p>}
          {report.isError && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(report.error)}</p>}
          {report.data ? <ReportView key={report.data.run_id} report={report.data} /> : <p className="text-sm text-muted-foreground">Run a comparison or select a saved report. The diagnostic fixture validates behavior; use real held-out queries to support publication claims.</p>}
        </div>
      </Panel>
    </div>
  );
}

function DatasetProvenance({ dataset }: { dataset: NormalizationDataset }) {
  const scope = dataset.provenance.scope ?? 'unspecified';
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone={scope === 'full-corpus-all-dev-queries' ? 'info' : 'warn'}>{String(scope)}</Pill>
      <span className="text-xs text-muted-foreground">Source: {String(dataset.provenance.source ?? 'not recorded')}</span>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Passages" value={dataset.document_count.toLocaleString()} />
      <Stat label="Queries" value={dataset.query_count.toLocaleString()} />
      <Stat label="Judgments" value={dataset.qrel_count.toLocaleString()} />
    </div>
    <Warnings warnings={dataset.warnings} />
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">Provenance and dataset hashes</summary>
      <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/20 p-3">{JSON.stringify({ dataset_id: dataset.dataset_id, provenance: dataset.provenance, hashes: dataset.hashes }, null, 2)}</pre>
    </details>
  </div>;
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
    {warnings.map((warning, index) => <p key={index} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</p>)}
  </div>;
}

function JobProgress({ job }: { job: Job }) {
  const progress = job.status === 'done' ? 100 : job.total ? Math.min(100, 100 * job.done / job.total) : 0;
  return <div className="space-y-2 rounded-lg border border-white/10 bg-card/40 p-3" aria-live="polite">
    <div className="flex items-center gap-2 text-xs">
      {job.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" />}
      <span>{job.label}</span><Pill tone={job.status === 'failed' ? 'bad' : job.status === 'done' ? 'good' : 'info'}>{job.status}</Pill>
      <span className="ml-auto font-mono text-muted-foreground">{job.done}/{job.total}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-neon transition-all" style={{ width: `${progress}%` }} /></div>
    {job.message && <p className="text-xs text-muted-foreground">{job.message}</p>}
    {job.error && <p role="alert" className="text-xs text-red-400">{job.error}</p>}
  </div>;
}

function ReportView({ report }: { report: NormalizationReport }) {
  const [metric, setMetric] = useState<NormalizationMetric>('ndcg@10');
  const [condition, setCondition] = useState(() => Math.max(0, report.conditions.findIndex((c) => c.preset === 'conservative')));
  const [offset, setOffset] = useState(0);
  const [queryId, setQueryId] = useState('');
  const [queryDraft, setQueryDraft] = useState('');
  const [passageId, setPassageId] = useState('');
  useEffect(() => setPassageId(''), [offset, queryId]);
  const selected = report.conditions[condition];
  const baseline = report.conditions.findIndex((c) => c.retriever === selected.retriever && c.preset === 'raw');
  const detail = useQuery({
    queryKey: ['eval', 'normalization', 'queries', report.run_id, condition, offset, queryId],
    queryFn: () => normApi.queries(report.run_id, condition, offset, 1, queryId),
  });
  const rawDetail = useQuery({
    queryKey: ['eval', 'normalization', 'queries', report.run_id, baseline, offset, queryId],
    queryFn: () => normApi.queries(report.run_id, baseline, offset, 1, queryId), enabled: baseline >= 0,
  });
  const query = detail.data?.items[0];
  const rawQuery = rawDetail.data?.items[0];
  const passage = useQuery({
    queryKey: ['eval', 'normalization', 'passage', report.run_id, condition, passageId],
    queryFn: () => normApi.passage(report.run_id, condition, passageId),
    enabled: !!passageId,
  });
  const download = useEvalMutation<void, void>(async () => {
    const blob = await normApi.export(report.run_id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arabic-normalization-${report.run_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2"><Pill tone="info">{String(report.dataset.provenance.scope ?? 'unspecified corpus')}</Pill><Pill>{report.config.normalization_side === 'both' ? 'queries + passages' : 'query only'}</Pill><Pill>{report.dataset.query_count} queries</Pill></div>
      <Button size="sm" variant="outline" className="gap-1.5" disabled={download.isPending} onClick={() => download.mutate()}>
        {download.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Full report JSON
      </Button>
    </div>
    <Warnings warnings={report.warnings} />
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full whitespace-nowrap text-left text-xs">
        <caption className="p-3 text-left text-sm font-medium">Mean scores over all evaluated queries</caption>
        <thead className="bg-white/5 text-muted-foreground"><tr><th className="p-3">Condition</th>{metrics.map((key) => <th key={key} className="p-3 text-right">{key}</th>)}<th className="p-3 text-right">Queries changed</th><th className="p-3 text-right">Passages changed</th></tr></thead>
        <tbody>{report.conditions.map((row, index) => <tr key={`${row.retriever}-${row.preset}`} className={`border-t border-white/5 ${condition === index ? 'bg-neon/5' : ''}`}>
          <td className="p-3"><button type="button" onClick={() => setCondition(index)} className="text-left hover:text-neon" aria-label={`Inspect ${row.retriever} ${row.preset}`}>{row.retriever} · {row.preset}</button></td>
          {metrics.map((key) => <td key={key} className="p-3 text-right font-mono tabular-nums">{fmt(row.metrics[key])}</td>)}
          <td className="p-3 text-right font-mono">{row.changed_queries}/{report.dataset.query_count}</td><td className="p-3 text-right font-mono">{row.changed_documents}/{report.dataset.document_count}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-medium">Paired differences from each retriever’s raw condition</h4><div className="w-44"><SelectBox value={metric} onChange={setMetric} options={metrics.map((key) => ({ value: key, label: key }))} /></div></div>
      <p className="text-xs text-muted-foreground">Absolute score differences with paired 95% bootstrap intervals. Wins, losses, and ties are per query. Intervals are not adjusted for multiple comparisons.</p>
      <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full whitespace-nowrap text-left text-xs">
        <thead className="bg-white/5 text-muted-foreground"><tr><th className="p-3">Condition</th><th className="p-3 text-right">Δ {metric}</th><th className="p-3 text-right">95% interval</th><th className="p-3 text-right">Win / loss / tie</th></tr></thead>
        <tbody>{report.conditions.filter((row) => row.preset !== 'raw').map((row) => {
          const comparison = row.comparison_to_raw?.[metric];
          return <tr key={`${row.retriever}-${row.preset}`} className="border-t border-white/5"><td className="p-3">{row.retriever} · {row.preset}</td><td className="p-3 text-right font-mono">{comparison ? signed(comparison.delta) : '—'}</td><td className="p-3 text-right font-mono">{comparison ? `[${signed(comparison.ci_low)}, ${signed(comparison.ci_high)}]` : '—'}</td><td className="p-3 text-right font-mono">{comparison ? `${comparison.wins} / ${comparison.losses} / ${comparison.ties}` : '—'}</td></tr>;
        })}</tbody>
      </table></div>
    </div>
    <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <Field label="Inspect condition"><SelectBox value={condition} onChange={setCondition} options={report.conditions.map((c, index) => ({ value: index, label: `${c.retriever} · ${c.preset}` }))} /></Field>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0 || !!queryId} aria-label="Previous query" onClick={() => setOffset((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <TextField aria-label="Query number" className="w-20" type="number" min={1} max={report.dataset.query_count} value={offset + 1} disabled={!!queryId}
          onChange={(e) => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= report.dataset.query_count) setOffset(value - 1); }} />
        <span className="text-xs tabular-nums">/ {report.dataset.query_count}</span>
        <Button size="sm" variant="outline" disabled={offset + 1 >= report.dataset.query_count || !!queryId} aria-label="Next query" onClick={() => setOffset((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); setQueryId(queryDraft.trim()); setOffset(0); }}>
      <TextField aria-label="Find exact query ID" className="min-w-40 flex-1" placeholder="Find an exact query ID from the exported report" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} />
      <Button size="sm" variant="outline" type="submit">Find query</Button>
      {queryId && <Button size="sm" variant="ghost" onClick={() => { setQueryId(''); setQueryDraft(''); setOffset(0); }}>Show all queries</Button>}
    </form>
    {(detail.isError || rawDetail.isError) && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(detail.error ?? rawDetail.error)}</p>}
    {(detail.isFetching || rawDetail.isFetching) && <p className="text-xs text-muted-foreground">Loading query rankings…</p>}
    {detail.data?.total === 0 && <p className="text-xs text-amber-300">No query matches that ID in this report.</p>}
    {query && <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap gap-2"><Pill>{query.qid}</Pill><Pill tone={query.query_changed ? 'neon' : 'neutral'}>{query.query_changed ? 'query changed' : 'query unchanged'}</Pill>{query.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>
      <div className="grid gap-3 md:grid-cols-2"><div><p className="text-[11px] text-muted-foreground">Original query</p><p dir="auto" lang="ar" className="mt-1 rounded-lg bg-black/20 p-3 text-base leading-loose">{query.query}</p></div><div><p className="text-[11px] text-muted-foreground">Normalized query</p><p dir="auto" lang="ar" className="mt-1 rounded-lg bg-black/20 p-3 text-base leading-loose">{query.normalized_query}</p></div></div>
      <div className="flex flex-wrap gap-2 text-xs"><span>{metric}: {fmt(query.metrics[metric])}</span>{rawQuery?.qid === query.qid && <span className="text-muted-foreground">· raw {fmt(rawQuery.metrics[metric])} · Δ {signed(query.metrics[metric] - rawQuery.metrics[metric])}</span>}</div>
      <p className="text-[11px] text-muted-foreground">Top 10 passage IDs. Click an ID to inspect its original and transformed text. The full JSON includes deeper rankings. Unjudged passages count as nonrelevant in benchmark scores.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Ranking title={`${selected.retriever} · raw`} query={rawQuery?.qid === query.qid ? rawQuery : undefined} onSelect={setPassageId} />
        <Ranking title={`${selected.retriever} · ${selected.preset}`} query={query} onSelect={setPassageId} />
      </div>
      {passageId && <div className="space-y-2 rounded-lg border border-white/10 p-3">
        <p className="text-xs font-medium">Passage {passageId} · {selected.preset}</p>
        {passage.isFetching && <p className="text-xs text-muted-foreground">Loading passage…</p>}
        {passage.isError && <p role="alert" className="text-xs text-red-400">{evalErrorMessage(passage.error)}</p>}
        {passage.data && <>
          <div className="grid gap-3 md:grid-cols-2">
            <div><p className="text-[11px] text-muted-foreground">Original title + passage</p><p dir="auto" lang="ar" className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-sm leading-loose">{passage.data.retrieval_input}</p></div>
            <div><p className="text-[11px] text-muted-foreground">After document normalization · {passage.data.preset}</p><p dir="auto" lang="ar" className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-sm leading-loose">{passage.data.normalized_input}</p></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Shown before model prefixes, tokenization and truncation. Query-only experiments keep passages raw.</p>
        </>}
      </div>}
    </div>}
    <details className="rounded-lg border border-white/10 p-3 text-xs">
      <summary className="cursor-pointer font-medium">Query slices · {selected.retriever} / {selected.preset}</summary>
      <p className="my-2 text-muted-foreground">Slices are descriptive and can overlap. An unchanged query may still retrieve different passages after corpus normalization.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-muted-foreground"><tr><th className="p-2">Slice</th><th className="p-2 text-right">Queries</th>{metrics.map((key) => <th key={key} className="p-2 text-right">{key}</th>)}</tr></thead><tbody>{Object.entries(selected.slices).map(([tag, slice]) => <tr key={tag} className="border-t border-white/5"><td className="p-2">{tag}</td><td className="p-2 text-right">{slice.query_count}</td>{metrics.map((key) => <td key={key} className="p-2 text-right font-mono">{slice.query_count ? fmt(slice.metrics[key]) : '—'}</td>)}</tr>)}</tbody></table></div>
    </details>
    <details className="rounded-lg border border-white/10 p-3 text-xs"><summary className="cursor-pointer font-medium">Recorded configuration and provenance</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify({ run_id: report.run_id, created_at: report.created_at, config: report.config, dataset: report.dataset, provenance: report.provenance }, null, 2)}</pre></details>
  </div>;
}

function Ranking({ title, query, onSelect }: { title: string; query?: NormalizationQuery; onSelect: (id: string) => void }) {
  return <div className="min-w-0 overflow-x-auto rounded-lg border border-white/10">
    <p className="bg-white/5 px-3 py-2 text-xs font-medium">{title}</p>
    {query ? <table className="w-full text-left text-[11px]"><thead className="text-muted-foreground"><tr><th className="p-2">Rank</th><th className="p-2">Passage ID</th><th className="p-2 text-right">Score</th><th className="p-2">Judgment</th></tr></thead><tbody>{query.ranking.slice(0, 10).map((hit, index) => <tr key={hit.passage_id} className="border-t border-white/5"><td className="p-2 font-mono">{index + 1}</td><td className="max-w-48 break-all p-2 font-mono"><button type="button" className="text-left underline decoration-white/20 underline-offset-2 hover:text-neon" onClick={() => onSelect(hit.passage_id)}>{hit.passage_id}</button></td><td className="p-2 text-right font-mono">{fmt(hit.score)}</td><td className="p-2"><Pill tone={hit.relevance != null && hit.relevance > 0 ? 'good' : 'neutral'}>{hit.relevance == null ? 'unjudged' : hit.relevance > 0 ? 'relevant' : 'nonrelevant'}</Pill></td></tr>)}</tbody></table> : <p className="p-3 text-xs text-muted-foreground">Loading ranking…</p>}
  </div>;
}

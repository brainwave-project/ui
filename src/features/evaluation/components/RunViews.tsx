import { useMemo, useState } from 'react';
import { AlertOctagon, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRun } from '@/features/evaluation/hooks/useEval';
import { METRIC_INFO, METRIC_KEYS, fmt3, fmtSigned, fmtTime, shortHash } from '@/features/evaluation/lib/evalStats';
import { ForestPlot, ScoreHistogram, VIZ } from './charts';
import { EmptyState, Panel, Pill, Segmented, SelectBox, SeverityBadge } from './EvalPrimitives';
import { FailuresPanel, SweepsPanel } from './RunAnalysis';
import type { Aggregate, CompareReport, ReportWarning, VariantSpec } from '@/types/eval';

export const variantSummary = (v: VariantSpec) =>
  [
    v.level,
    v.level === 'document' ? (v.hybrid ? 'hybrid' : 'vector') : 'vector',
    `corpus:${v.corpus_index}`,
    `query:${v.query_normalization}`,
    `min ${v.min_score}`,
    `fetch ${v.fetch}`,
  ].join(' · ');

/** A mean with its CI on a fixed [0, 1] track — the interval is drawn, not just printed. */
export function MiniInterval({ mean, low, high, color = VIZ.baseline }: { mean: number; low: number | null; high: number | null; color?: string }) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  return (
    <div className="relative h-3 w-full min-w-[80px]">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
      {low !== null && high !== null && Number.isFinite(low) && Number.isFinite(high) && (
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
          style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})`, background: color }} />
      )}
      <div className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
        style={{ left: pct(mean), background: color }} />
    </div>
  );
}

export function AggregateTable({ aggregates, k }: { aggregates: Record<string, Aggregate>; k: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="py-1 pr-3">metric</th><th className="pr-3">mean</th><th className="pr-3">95% bootstrap CI</th><th className="w-40 pr-3" /><th className="pr-3">sd</th><th>n</th></tr>
        </thead>
        <tbody>
          {METRIC_KEYS.filter((m) => aggregates[m]).map((m) => {
            const a = aggregates[m];
            const info = METRIC_INFO[m];
            return (
              <tr key={m} className="border-t border-white/5" title={`${info.measures}\n\nMisleads when: ${info.misleads}`}>
                <td className="py-1.5 pr-3">
                  {info.label}
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">@{info.cutoff === 'k' ? k : Math.max(k, 10)}</span>
                </td>
                <td className="pr-3 font-mono tabular-nums">{fmt3(a.mean)}</td>
                <td className="pr-3 font-mono tabular-nums text-muted-foreground">[{fmt3(a.low)}, {fmt3(a.high)}]</td>
                <td className="pr-3"><MiniInterval mean={a.mean} low={a.low} high={a.high} /></td>
                <td className="pr-3 font-mono tabular-nums text-muted-foreground">{fmt3(a.sd)}</td>
                <td className="font-mono tabular-nums text-muted-foreground">{a.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type RunTab = 'summary' | 'sweeps' | 'failures';

export function RunDetail({ runId, title }: { runId: string; title?: string }) {
  const { data: run, isLoading } = useRun(runId);
  const [metric, setMetric] = useState('recall@k');
  const [tab, setTab] = useState<RunTab>('summary');
  const scored = useMemo(() => (run?.results ?? []).filter((r) => !r.error && r.metrics[metric] !== undefined), [run, metric]);

  if (isLoading || !run) return <Panel title={title ?? runId} icon={ListOrdered}><div className="h-24" /></Panel>;
  const errors = run.results.filter((r) => r.error);
  const sorted = [...scored].sort((a, b) => a.metrics[metric] - b.metrics[metric]);
  const judged = run.diagnostics?.judged_at_k;

  return (
    <Panel title={title ?? run.id} icon={ListOrdered}
      subtitle={<>{variantSummary(run.variant)} · split <strong className="text-foreground">{run.split}</strong> · k={run.k} · {fmtTime(run.created_at)}</>}
      actions={
        <>
          <Segmented size="xs" value={tab} onChange={setTab}
            options={[{ value: 'summary', label: 'summary' }, { value: 'sweeps', label: 'sweeps' }, { value: 'failures', label: 'failures' }]} />
          <Pill tone={run.dataset_status === 'frozen' ? 'info' : 'warn'} title={run.dataset_hash}>{run.dataset_status} {shortHash(run.dataset_hash)}</Pill>
          <Pill tone={run.status === 'done' ? 'good' : run.status === 'failed' ? 'bad' : 'warn'}>{run.status}</Pill>
        </>
      }>
      {tab === 'sweeps' && <SweepsPanel runId={run.id} />}
      {tab === 'failures' && <FailuresPanel runId={run.id} />}
      {tab === 'summary' && (
        <div className="space-y-4">
          {run.error && <p className="font-mono text-xs text-red-400">{run.error}</p>}
          <AggregateTable aggregates={run.aggregates} k={run.k} />
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {errors.length > 0 && <Pill tone="bad"><AlertOctagon className="h-3 w-3" /> {errors.length} errored — excluded, not scored 0</Pill>}
            {run.skipped_unanswerable.length > 0 && <Pill tone="warn">{run.skipped_unanswerable.length} unanswerable skipped</Pill>}
            {judged !== undefined && (
              <Pill tone={judged >= 0.8 ? 'good' : judged >= 0.5 ? 'warn' : 'bad'}
                title="Share of top-k results whose document carries any judgement. The rest were scored non-relevant by assumption.">
                judged@{run.k} {Math.round(judged * 100)}%
              </Pill>
            )}
            {run.diagnostics?.mean_latency_ms !== undefined && <Pill>{run.diagnostics.mean_latency_ms.toFixed(0)} ms / query</Pill>}
          </div>
          {judged !== undefined && judged < 0.8 && (
            <p className="rounded-md border border-amber-500/20 bg-amber-500/[0.05] p-2 text-[11px] text-amber-200">
              Only {Math.round(judged * 100)}% of the top-{run.k} results were ever judged. Unjudged results count as non-relevant, so
              precision-type metrics here are a <strong>lower bound</strong>. Pool and judge in Dataset Construction.
            </p>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Per-query distribution</p>
                <SelectBox className="h-7 w-40 text-xs" value={metric} onChange={setMetric}
                  options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))} />
              </div>
              <ScoreHistogram series={[{ label: METRIC_INFO[metric].label, values: scored.map((r) => r.metrics[metric]), color: VIZ.baseline }]} />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Mass piled at 0 and 1 is the bimodal shape that makes a bare mean — and a t-interval — misleading.
              </p>
            </div>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1 pr-2">item</th><th className="pr-2">query</th><th className="pr-2 text-right">{METRIC_INFO[metric].short}</th></tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.item_id} className="border-t border-white/5">
                      <td className="py-1 pr-2 font-mono text-[10px]">{r.item_id}</td>
                      <td className="max-w-[260px] truncate pr-2" dir="auto" title={r.query}>{r.query}</td>
                      <td className={cn('pr-2 text-right font-mono tabular-nums', r.metrics[metric] === 0 && 'text-red-400')}>{fmt3(r.metrics[metric])}</td>
                    </tr>
                  ))}
                  {errors.map((r) => (
                    <tr key={r.item_id} className="border-t border-white/5 text-red-400">
                      <td className="py-1 pr-2 font-mono text-[10px]">{r.item_id}</td>
                      <td className="pr-2" colSpan={2}>{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function WarningList({ warnings }: { warnings: ReportWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-white/8 bg-card/30 p-2 text-xs">
          <SeverityBadge severity={w.severity} />
          <div>
            <p className="font-medium">{w.title}</p>
            <p className="text-muted-foreground">{w.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompareView({ report }: { report: CompareReport }) {
  const rows = METRIC_KEYS.filter((m) => report.metrics[m]).map((m) => {
    const d = report.metrics[m].delta;
    return { label: METRIC_INFO[m].label, mean: d.mean, low: d.low, high: d.high, clusterLow: d.cluster.low, clusterHigh: d.cluster.high };
  });
  return (
    <div className="space-y-4">
      <WarningList warnings={report.warnings} />
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-white/8 p-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.baseline }} /><strong>A</strong> {report.run_a}<p className="text-muted-foreground">{variantSummary(report.variant_a)}</p></div>
        <div className="rounded-lg border border-white/8 p-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.treatment }} /><strong>B</strong> {report.run_b}<p className="text-muted-foreground">{variantSummary(report.variant_b)}</p></div>
      </div>
      <ForestPlot rows={rows} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="py-1 pr-3">metric</th><th className="pr-3">A</th><th className="pr-3">B</th><th className="pr-3">Δ (B−A)</th><th className="pr-3">paired CI</th><th className="pr-3">d_z</th><th className="pr-3">p (shuffle)</th><th>W/L/T</th></tr>
          </thead>
          <tbody>
            {METRIC_KEYS.filter((m) => report.metrics[m]).map((m) => {
              const c = report.metrics[m];
              return (
                <tr key={m} className="border-t border-white/5">
                  <td className="py-1.5 pr-3">{METRIC_INFO[m].label}</td>
                  <td className="pr-3 font-mono">{fmt3(c.baseline.mean)}</td>
                  <td className="pr-3 font-mono">{fmt3(c.treatment.mean)}</td>
                  <td className={cn('pr-3 font-mono', c.delta.significant && (c.delta.mean > 0 ? 'text-emerald-400' : 'text-red-400'))}>{fmtSigned(c.delta.mean)}</td>
                  <td className="pr-3 font-mono text-muted-foreground">[{fmtSigned(c.delta.low)}, {fmtSigned(c.delta.high)}]</td>
                  <td className="pr-3 font-mono text-muted-foreground">{c.delta.effect_size_dz !== undefined ? c.delta.effect_size_dz.toFixed(2) : '—'}</td>
                  <td className="pr-3 font-mono text-muted-foreground">{c.delta.p_permutation.toFixed(3)}</td>
                  <td className="font-mono text-muted-foreground">{c.delta.wins}/{c.delta.losses}/{c.delta.ties}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Seven metrics compared at once: expect roughly one in three such comparisons to show a "significant" metric by chance
        alone. Exploratory comparisons suggest what to pre-register next — they do not establish anything.
      </p>
    </div>
  );
}

export function NoRuns({ children }: { children?: React.ReactNode }) {
  return <EmptyState icon={ListOrdered} title="No runs yet">{children}</EmptyState>;
}

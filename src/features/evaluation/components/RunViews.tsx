import { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Bug, LineChart as LineIcon, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRun } from '@/features/evaluation/hooks/useEval';
import { METRIC_INFO, METRIC_KEYS, fmt3, fmtSigned, fmtTime, shortHash } from '@/features/evaluation/lib/evalStats';
import { ForestPlot, ScoreHistogram, VIZ } from './charts';
import { EmptyState, Pager, Pill, SelectBox, SeverityBadge, Stat, SubTabs } from './EvalPrimitives';
import { FailuresPanel, SweepsPanel } from './RunAnalysis';
import type { Aggregate, CompareReport, ReportWarning, VariantSpec } from '@/types/eval';

const PAGE_SIZE = 5;

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
  const [page, setPage] = useState(1);
  const scored = useMemo(() => (run?.results ?? []).filter((r) => !r.error && r.metrics[metric] !== undefined), [run, metric]);

  useEffect(() => { setPage(1); }, [metric, runId]);

  if (isLoading || !run) {
    return <div className="h-48 animate-pulse rounded-2xl border border-white/8 bg-card/30" />;
  }

  const errors = run.results.filter((r) => r.error);
  const sorted = [...scored].sort((a, b) => a.metrics[metric] - b.metrics[metric]);
  const judged = run.diagnostics?.judged_at_k;
  const failedCount = sorted.filter((r) => (r.metrics[metric] ?? 1) < 1).length;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-sm font-semibold">
            <ListOrdered className="h-4 w-4 shrink-0 text-neon" /> {title ?? run.id}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {variantSummary(run.variant)} · split <strong className="text-foreground">{run.split}</strong> · k={run.k} · {fmtTime(run.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={run.dataset_status === 'frozen' ? 'info' : 'warn'} title={run.dataset_hash}>
            {run.dataset_status} {shortHash(run.dataset_hash)}
          </Pill>
          <Pill tone={run.status === 'done' ? 'good' : run.status === 'failed' ? 'bad' : 'warn'}>{run.status}</Pill>
        </div>
      </div>

      <SubTabs
        label="Run results"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'summary', label: 'Summary', icon: ListOrdered, count: scored.length },
          { id: 'sweeps', label: 'Sweeps', icon: LineIcon },
          { id: 'failures', label: 'Failures', icon: Bug, count: failedCount || undefined },
        ]}
      />

      <div key={tab} className="animate-fade-in p-4">
        {tab === 'sweeps' && <SweepsPanel runId={run.id} />}
        {tab === 'failures' && <FailuresPanel runId={run.id} />}
        {tab === 'summary' && (
          <div className="space-y-4">
            {run.error && (
              <p className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2 font-mono text-xs text-red-400">{run.error}</p>
            )}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="scored" value={scored.length} sub={errors.length ? `${errors.length} errored, excluded` : `${run.results.length} queries`} />
              <Stat
                label={METRIC_INFO['recall@k'].label}
                value={fmt3(run.aggregates['recall@k']?.mean)}
                sub={run.aggregates['recall@k'] ? `CI ${fmt3(run.aggregates['recall@k'].low)}–${fmt3(run.aggregates['recall@k'].high)}` : undefined}
              />
              <Stat
                label={METRIC_INFO.mrr.label}
                value={fmt3(run.aggregates.mrr?.mean)}
                sub={run.aggregates.mrr ? `CI ${fmt3(run.aggregates.mrr.low)}–${fmt3(run.aggregates.mrr.high)}` : undefined}
              />
              <Stat
                label={METRIC_INFO['ndcg@k'].label}
                value={fmt3(run.aggregates['ndcg@k']?.mean)}
                sub={run.diagnostics?.mean_latency_ms !== undefined ? `${run.diagnostics.mean_latency_ms.toFixed(0)} ms / query` : undefined}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {errors.length > 0 && <Pill tone="bad"><AlertOctagon className="h-3 w-3" /> {errors.length} errored — excluded, not scored 0</Pill>}
              {run.skipped_unanswerable.length > 0 && <Pill tone="warn">{run.skipped_unanswerable.length} unanswerable skipped</Pill>}
              {judged !== undefined && (
                <Pill tone={judged >= 0.8 ? 'good' : judged >= 0.5 ? 'warn' : 'bad'}
                  title="Share of top-k results whose document carries any judgement. The rest were scored non-relevant by assumption.">
                  judged@{run.k} {Math.round(judged * 100)}%
                </Pill>
              )}
            </div>

            {judged !== undefined && judged < 0.8 && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                Only {Math.round(judged * 100)}% of the top-{run.k} results were ever judged. Unjudged results count as non-relevant, so
                precision-type metrics here are a <strong>lower bound</strong>. Pool and judge in Golden Sets → Judge.
              </p>
            )}

            {errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-red-300">Errored queries</p>
                <ul className="space-y-1 font-mono text-[11px] text-red-300/90">
                  {errors.map((r) => (
                    <li key={r.item_id}><span className="text-red-200">{r.item_id}</span> · {r.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Means &amp; 95% bootstrap intervals</p>
              <AggregateTable aggregates={run.aggregates} k={run.k} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">Per-query distribution</p>
                  <SelectBox className="h-7 w-40 text-xs" value={metric} onChange={setMetric}
                    options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))} />
                </div>
                {scored.length ? (
                  <>
                    <ScoreHistogram series={[{ label: METRIC_INFO[metric].label, values: scored.map((r) => r.metrics[metric]), color: VIZ.baseline }]} />
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Mass piled at 0 and 1 is the bimodal shape that makes a bare mean — and a t-interval — misleading.
                    </p>
                  </>
                ) : (
                  <EmptyState icon={ListOrdered} title="No scored queries" />
                )}
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <p className="mb-2 text-xs font-medium">Per-query scores</p>
                {sorted.length ? (
                  <>
                    <table className="w-full text-xs">
                      <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-2">item</th>
                          <th className="pr-2">query</th>
                          <th className="text-right">{METRIC_INFO[metric].short}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slice.map((r) => (
                          <tr key={r.item_id} className="border-t border-white/5">
                            <td className="py-1.5 pr-2 font-mono text-[10px] text-muted-foreground">{r.item_id}</td>
                            <td className="max-w-[260px] truncate pr-2" dir="auto" title={r.query}>{r.query}</td>
                            <td className={cn('text-right font-mono tabular-nums', r.metrics[metric] === 0 && 'text-red-400')}>{fmt3(r.metrics[metric])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pager page={safePage} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} />
                  </>
                ) : (
                  <EmptyState icon={ListOrdered} title="Nothing to list" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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

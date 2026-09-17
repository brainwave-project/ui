import { useEffect, useMemo, useState } from 'react';
import { Activity, Dices, FlaskRound, Loader2, Play, Radar, Sigma, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useEvalMutation, useRuns } from '@/features/evaluation/hooks/useEval';
import {
  Field, Panel, Pill, PrincipalNote, Segmented, SelectBox, Stat, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { VIZ } from '@/features/evaluation/components/charts';
import { BinnedHistogram, IntervalLadder, LineChart, RateBars, SERIES } from '@/features/evaluation/components/statCharts';
import { METRIC_INFO, METRIC_KEYS, fmt3 } from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type {
  BootstrapDemo, CltResult, CoverageResult, IntervalMethodName, PhackingResult, PopulationSpec, PowerResult,
} from '@/types/eval';

type Section = 'bootstrap' | 'coverage' | 'clt' | 'power' | 'phacking';

const METHOD_LABEL: Record<IntervalMethodName, string> = { bootstrap: 'Percentile bootstrap', t: 'Student t', normal: 'Normal (z)' };
const METHOD_COLOR: Record<IntervalMethodName, string> = { bootstrap: SERIES[0], t: SERIES[1], normal: SERIES[2] };

export function StatsLabPage() {
  const [section, setSection] = useState<Section>('bootstrap');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={section} onChange={setSection}
          options={[
            { value: 'bootstrap', label: <><Dices className="h-3.5 w-3.5" /> Bootstrap</> },
            { value: 'coverage',  label: <><Radar className="h-3.5 w-3.5" /> CI coverage</> },
            { value: 'clt',       label: <><Activity className="h-3.5 w-3.5" /> CLT</> },
            { value: 'power',     label: <><Zap className="h-3.5 w-3.5" /> Power</> },
            { value: 'phacking',  label: <><FlaskRound className="h-3.5 w-3.5" /> P-hacking</> },
          ]} />
        <p className="text-xs text-muted-foreground">
          Every simulation draws from a population whose true mean is known — the one setting where "did the interval cover the truth?" has an answer.
        </p>
      </div>
      {section === 'bootstrap' && <BootstrapPanel />}
      {section === 'coverage' && <CoveragePanel />}
      {section === 'clt' && <CltPanel />}
      {section === 'power' && <PowerPanel />}
      {section === 'phacking' && <PhackingPanel />}
    </div>
  );
}

/* ── Shared: population picker ───────────────────────────────────────────── */

function usePopulationDefault(fallback: PopulationSpec): [PopulationSpec, (p: PopulationSpec) => void, { id: string; label: string }[]] {
  const { datasetId } = useEvalStore();
  const runs = useRuns(datasetId);
  const doneRuns = useMemo(
    () => (runs.data ?? []).filter((r) => r.status === 'done').map((r) => ({ id: r.id, label: `${r.id} · ${r.variant.name} · ${r.split}` })),
    [runs.data],
  );
  const [pop, setPop] = useState<PopulationSpec>(fallback);
  useEffect(() => {
    if (pop.kind === 'run' && !pop.run_id && doneRuns[0]) setPop({ ...pop, run_id: doneRuns[0].id });
  }, [doneRuns.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return [pop, setPop, doneRuns];
}

function PopulationPicker({ value, onChange, runs }: { value: PopulationSpec; onChange: (p: PopulationSpec) => void; runs: { id: string; label: string }[] }) {
  return (
    <div className="space-y-3 rounded-lg border border-white/8 p-3">
      <Field label="Population">
        <SelectBox value={value.kind} onChange={(kind) => onChange({ ...value, kind, run_id: kind === 'run' ? value.run_id ?? runs[0]?.id : value.run_id })}
          options={[
            { value: 'run', label: 'real per-query scores from a run' },
            { value: 'bimodal', label: 'bimodal (works / fails / in between)' },
            { value: 'bernoulli', label: 'Bernoulli (binary hit / miss)' },
            { value: 'skewed', label: 'right-skewed (most near 0)' },
          ]} />
      </Field>
      {value.kind === 'run' && (
        runs.length === 0
          ? <p className="text-xs text-amber-300">No completed runs on the selected dataset — run a split in Retrieval, or pick a synthetic population.</p>
          : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Run"><SelectBox className="text-xs" value={value.run_id ?? runs[0].id} onChange={(run_id) => onChange({ ...value, run_id })} options={runs.map((r) => ({ value: r.id, label: r.label }))} /></Field>
              <Field label="Metric"><SelectBox className="text-xs" value={value.metric ?? 'recall@k'} onChange={(metric) => onChange({ ...value, metric })} options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))} /></Field>
            </div>
          )
      )}
      {(value.kind === 'bernoulli' || value.kind === 'bimodal') && (
        <Field label={`${value.kind === 'bimodal' ? 'Share at 1.0' : 'Success rate p'} · ${(value.p ?? 0.7).toFixed(2)}`}>
          <input type="range" min={0} max={1} step={0.05} value={value.p ?? 0.7} onChange={(e) => onChange({ ...value, p: Number(e.target.value) })} className="w-full accent-[hsl(var(--neon))]" />
        </Field>
      )}
      {value.kind === 'bimodal' && (
        <Field label={`Share at 0.0 · ${(value.p_zero ?? 0.2).toFixed(2)}`}>
          <input type="range" min={0} max={Math.max(0, 1 - (value.p ?? 0.7))} step={0.05} value={Math.min(value.p_zero ?? 0.2, 1 - (value.p ?? 0.7))}
            onChange={(e) => onChange({ ...value, p_zero: Number(e.target.value) })} className="w-full accent-[hsl(var(--neon))]" />
        </Field>
      )}
    </div>
  );
}

function RunButton({ pending, onClick, disabled, label = 'Run simulation' }: { pending: boolean; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button className="w-full gap-1.5" disabled={pending || disabled} onClick={onClick}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {pending ? 'Simulating…' : label}
    </Button>
  );
}

function NumberSlider({ label, value, onChange, min, max, step, format = (v: number) => `${v}` }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string;
}) {
  return (
    <Field label={`${label} · ${format(value)}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
    </Field>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/* ── Bootstrap ───────────────────────────────────────────────────────────── */

function BootstrapPanel() {
  const [pop, setPop, runs] = usePopulationDefault({ kind: 'run', metric: 'mrr' });
  const [n, setN] = useState(20);
  const [resamples, setResamples] = useState(2000);
  const [confidence, setConfidence] = useState(0.95);
  const [result, setResult] = useState<BootstrapDemo | null>(null);
  const run = useEvalMutation(() => evalApi.statsBootstrap({
    population: pop, n: pop.kind === 'run' ? null : n, resamples, confidence, seed: 7,
  }), { onSuccess: setResult });

  const r = result;
  const b = r?.intervals.bootstrap;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Bootstrap one sample" icon={Dices}>
        <div className="space-y-3">
          <PopulationPicker value={pop} onChange={setPop} runs={runs} />
          {pop.kind !== 'run' && <NumberSlider label="Sample size n" value={n} onChange={setN} min={3} max={200} step={1} />}
          <NumberSlider label="Resamples" value={resamples} onChange={setResamples} min={200} max={20000} step={200} />
          <NumberSlider label="Confidence" value={confidence} onChange={setConfidence} min={0.5} max={0.99} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
          <RunButton pending={run.isPending} onClick={() => run.mutate(undefined)} disabled={pop.kind === 'run' && !runs.length} />
        </div>
      </Panel>

      <div className="space-y-4">
        {!r ? (
          <PrincipalNote title="Resampling">
            You have one sample. The bootstrap pretends that sample IS the population, draws thousands of same-size samples
            <strong> with replacement</strong> from it, and records each mean. The spread of those means estimates how much your
            real mean would vary across samples you never collected. The interval is two percentiles of that distribution —
            run it and look at the distribution itself.
          </PrincipalNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              <Stat label="n" value={r.n} sub={`${r.distinct_values} distinct scores`} />
              <Stat label="Mean" value={fmt3(r.mean)} sub={r.sampled ? `true ${fmt3(r.population_mean)}` : 'run mean'} />
              <Stat label="SD" value={fmt3(r.sd)} />
              <Stat label="SE = sd/√n" value={fmt3(r.se)} />
              <Stat label="Bootstrap SD" value={fmt3(r.bootstrap_sd)} sub="≈ SE, by resampling" />
              <Stat label="Distinct means" value={r.distinct_resample_means} sub={`of ${resamples} resamples`} />
            </div>
            <div className="grid gap-4 2xl:grid-cols-2">
              <Panel title="The sample" icon={Sigma} subtitle={r.population}>
                <BinnedHistogram bins={r.values_hist} color={VIZ.muted} markers={[{ x: r.mean, label: 'mean' }]} unit="queries" />
              </Panel>
              <Panel title="Bootstrap distribution of the mean" icon={Dices}
                subtitle="Shaded bands: t and normal intervals. Lines: percentile bootstrap bounds.">
                <BinnedHistogram bins={r.bootstrap_hist} unit="resamples"
                  markers={[
                    ...(b?.low != null ? [{ x: b.low, label: 'boot lo', color: METHOD_COLOR.bootstrap }] : []),
                    ...(b?.high != null ? [{ x: b.high, label: 'boot hi', color: METHOD_COLOR.bootstrap }] : []),
                    ...(r.sampled ? [{ x: r.population_mean, label: 'truth', color: VIZ.good }] : []),
                  ]}
                  bands={(['t', 'normal'] as const).filter((m) => r.intervals[m].low != null).map((m) => ({
                    lo: r.intervals[m].low!, hi: r.intervals[m].high!, label: METHOD_LABEL[m], color: METHOD_COLOR[m],
                  }))} />
              </Panel>
            </div>
            <Panel title="Three intervals, same data" icon={Sigma}>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1">method</th><th>low</th><th>high</th><th>width</th><th>stays in [0, 1]</th>{r.sampled && <th>covers truth</th>}</tr>
                </thead>
                <tbody>
                  {(Object.keys(METHOD_LABEL) as IntervalMethodName[]).map((m) => {
                    const iv = r.intervals[m];
                    const inRange = iv.low !== null && iv.high !== null && iv.low >= 0 && iv.high <= 1;
                    const covers = iv.low !== null && iv.high !== null && iv.low <= r.population_mean && r.population_mean <= iv.high;
                    return (
                      <tr key={m} className="border-t border-white/5">
                        <td className="py-1.5"><span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: METHOD_COLOR[m] }} />{METHOD_LABEL[m]}</td>
                        <td className="font-mono">{fmt3(iv.low)}</td>
                        <td className="font-mono">{fmt3(iv.high)}</td>
                        <td className="font-mono">{iv.low !== null && iv.high !== null ? fmt3(iv.high - iv.low) : '—'}</td>
                        <td>{inRange ? <Pill tone="good">yes</Pill> : <Pill tone="bad">no</Pill>}</td>
                        {r.sampled && <td>{covers ? <Pill tone="good">yes</Pill> : <Pill tone="bad">no</Pill>}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                <li>The bootstrap SD ({fmt3(r.bootstrap_sd)}) estimates the same quantity as the analytic SE ({fmt3(r.se)}) — without a formula.</li>
                {r.distinct_resample_means < 60 && <li>Only {r.distinct_resample_means} distinct resample means: with few distinct scores the distribution is lumpy, so its percentiles are coarse.</li>}
                {Math.abs(r.bootstrap_skew) > 0.3 && <li>The bootstrap distribution is skewed ({r.bootstrap_skew.toFixed(2)}): a symmetric t/normal interval cannot follow that shape.</li>}
                {!r.sampled && <li>This is a real run: there is no "truth" to check against. That is normal — it is why coverage can only be studied by simulation.</li>}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Coverage ────────────────────────────────────────────────────────────── */

function CoveragePanel() {
  const [pop, setPop, runs] = usePopulationDefault({ kind: 'bimodal', p: 0.8, p_zero: 0.15 });
  const [n, setN] = useState(10);
  const [sims, setSims] = useState(300);
  const [resamples, setResamples] = useState(500);
  const [confidence, setConfidence] = useState(0.95);
  const [method, setMethod] = useState<IntervalMethodName>('t');
  const [result, setResult] = useState<CoverageResult | null>(null);
  const work = sims * resamples * n;
  const run = useEvalMutation(() => evalApi.statsCoverage({ population: pop, n, sims, resamples, confidence, seed: 7 }), { onSuccess: setResult });

  const r = result;
  const worst = r ? (Object.keys(r.methods) as IntervalMethodName[]).reduce((a, m) => (r.methods[m].coverage < r.methods[a].coverage ? m : a), 'bootstrap' as IntervalMethodName) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="How often does a '95%' interval cover?" icon={Radar}>
        <div className="space-y-3">
          <PopulationPicker value={pop} onChange={setPop} runs={runs} />
          <NumberSlider label="Sample size n" value={n} onChange={setN} min={2} max={300} step={1} />
          <div className="flex gap-1.5">
            {[5, 10, 30, 100].map((v) => <Button key={v} size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => setN(v)}>n={v}</Button>)}
          </div>
          <NumberSlider label="Simulated samples" value={sims} onChange={setSims} min={50} max={2000} step={50} />
          <NumberSlider label="Bootstrap resamples" value={resamples} onChange={setResamples} min={100} max={5000} step={100} />
          <NumberSlider label="Confidence" value={confidence} onChange={setConfidence} min={0.5} max={0.99} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
          <p className={cn('text-[11px]', work > 40_000_000 ? 'text-red-400' : 'text-muted-foreground')}>work: {(work / 1e6).toFixed(1)}M draws (limit 40M)</p>
          <RunButton pending={run.isPending} onClick={() => run.mutate(undefined)} disabled={work > 40_000_000 || (pop.kind === 'run' && !runs.length)} />
        </div>
      </Panel>

      <div className="space-y-4">
        {!r ? (
          <PrincipalNote title="Confidence level vs confidence interval">
            "95%" is an <strong>input to the interval-building procedure</strong>: if you drew many samples and built an interval
            on each, about 95% of those intervals would contain the true mean. It is not "a 95% chance the truth is in this
            interval" — once built, an interval either covers or it does not. This panel draws hundreds of samples from a
            population with a known mean and counts. At small n on bounded, lopsided scores, the promise breaks.
          </PrincipalNote>
        ) : (
          <>
            <div className="grid gap-4 2xl:grid-cols-2">
              <Panel title={`Actual coverage at n = ${r.n}`} icon={Radar} subtitle={`${r.sims} samples from: ${r.population} · true mean ${fmt3(r.true_mean)}`}>
                <RateBars reference={{ value: r.confidence, label: 'nominal' }}
                  rows={(Object.keys(METHOD_LABEL) as IntervalMethodName[]).map((m) => ({ label: METHOD_LABEL[m], value: r.methods[m].coverage, color: METHOD_COLOR[m] }))} />
                <table className="mt-3 w-full text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="py-1">method</th><th>mean width</th><th>outside [0,1]</th><th>zero width</th><th>miss ↑ / ↓</th></tr>
                  </thead>
                  <tbody>
                    {(Object.keys(METHOD_LABEL) as IntervalMethodName[]).map((m) => {
                      const x = r.methods[m];
                      return (
                        <tr key={m} className="border-t border-white/5">
                          <td className="py-1.5">{METHOD_LABEL[m]}</td>
                          <td className="font-mono">{fmt3(x.mean_width)}</td>
                          <td className="font-mono">{pct(x.outside_range_share)}</td>
                          <td className="font-mono">{pct(x.zero_width_share)}</td>
                          <td className="font-mono">{pct(x.miss_above)} / {pct(x.miss_below)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
              <Panel title="The first 60 intervals" icon={Radar}
                actions={<Segmented size="xs" value={method} onChange={setMethod} options={(Object.keys(METHOD_LABEL) as IntervalMethodName[]).map((m) => ({ value: m, label: m }))} />}>
                <IntervalLadder examples={r.methods[method].examples} trueMean={r.true_mean} />
              </Panel>
            </div>
            <Panel title="Where the sample means fell" icon={Activity}>
              <BinnedHistogram bins={r.sample_means_hist} markers={[{ x: r.true_mean, label: 'true mean', color: VIZ.good }]} unit="samples" />
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {worst && <li>Furthest below nominal: <strong className="text-foreground">{METHOD_LABEL[worst]}</strong> at {pct(r.methods[worst].coverage)} (nominal {pct(r.confidence)}).</li>}
                {r.methods.t.zero_width_share > 0.05 && <li>{pct(r.methods.t.zero_width_share)} of samples had identical scores (e.g. all 1.0): every method returns a zero-width interval that cannot contain a true mean below 1.</li>}
                {r.methods.t.outside_range_share > 0.05 && <li>{pct(r.methods.t.outside_range_share)} of t-intervals extended outside [0, 1] — values a retrieval metric cannot take.</li>}
                <li>Re-run at n = 100: coverage converges toward nominal as the sampling distribution becomes normal (CLT).</li>
              </ul>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

/* ── CLT ─────────────────────────────────────────────────────────────────── */

function CltPanel() {
  const [pop, setPop, runs] = usePopulationDefault({ kind: 'skewed' });
  const [nsText, setNsText] = useState('2, 5, 30, 100');
  const [sims, setSims] = useState(2000);
  const [result, setResult] = useState<CltResult | null>(null);
  const ns = nsText.split(/[,\s]+/).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 2000).slice(0, 6);
  const run = useEvalMutation(() => evalApi.statsClt({ population: pop, ns, sims, seed: 7 }), { onSuccess: setResult });

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Sampling distribution of the mean" icon={Activity}>
        <div className="space-y-3">
          <PopulationPicker value={pop} onChange={setPop} runs={runs} />
          <Field label="Sample sizes (up to 6)"><TextField value={nsText} onChange={(e) => setNsText(e.target.value)} /></Field>
          <NumberSlider label="Samples per n" value={sims} onChange={setSims} min={200} max={10000} step={200} />
          <RunButton pending={run.isPending} onClick={() => run.mutate(undefined)} disabled={!ns.length || (pop.kind === 'run' && !runs.length)} />
        </div>
      </Panel>
      <div className="space-y-4">
        {!result ? (
          <PrincipalNote title="Central Limit Theorem">
            Whatever the shape of the per-query scores, the mean of n of them is approximately normal with SD σ/√n —
            <strong> for large enough n</strong>. The orange curve on each histogram is that normal approximation. Where bars and
            curve disagree, a normal/t interval is built on a shape the data does not have.
          </PrincipalNote>
        ) : (
          <>
            <Panel title="The population" icon={Sigma} subtitle={`${result.population} · mean ${fmt3(result.population_mean)} · sd ${fmt3(result.population_sd)} · skew ${result.population_skew.toFixed(2)}`}>
              <BinnedHistogram bins={result.population_hist} color={VIZ.muted} unit="values" />
            </Panel>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.distributions.map((d) => (
                <Panel key={d.n} title={`n = ${d.n}`} icon={Activity}
                  subtitle={`sd of means ${fmt3(d.sd)} vs σ/√n ${fmt3(d.theoretical_se)} · skew ${d.skew.toFixed(2)}${d.share_at_bounds > 0.01 ? ` · ${pct(d.share_at_bounds)} of means exactly 0 or 1` : ''}`}>
                  <BinnedHistogram bins={d.hist} unit="sample means"
                    normal={{ mean: result.population_mean, sd: d.theoretical_se, total: sims }}
                    markers={[{ x: result.population_mean, label: 'μ', color: VIZ.good }]} />
                </Panel>
              ))}
            </div>
            <PrincipalNote title="When is n large enough?">
              Watch skew fall toward 0 and the bars meet the curve. For binary or bimodal retrieval scores it takes far longer than
              the folk rule "n ≥ 30" — which is why the lab defaults to the bootstrap for reports.
            </PrincipalNote>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Power ───────────────────────────────────────────────────────────────── */

function PowerPanel() {
  const [n, setN] = useState(50);
  const [effect, setEffect] = useState(0.1);
  const [discordance, setDiscordance] = useState(0.3);
  const [sims, setSims] = useState(300);
  const [resamples, setResamples] = useState(500);
  const [confidence, setConfidence] = useState(0.95);
  const [result, setResult] = useState<PowerResult | null>(null);
  const valid = Math.abs(effect) <= discordance;
  const run = useEvalMutation(() => evalApi.statsPower({ n, effect, discordance, sims, resamples, confidence, seed: 7 }), { onSuccess: setResult });
  const r = result;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Will this experiment detect the effect?" icon={Zap}>
        <div className="space-y-3">
          <NumberSlider label="Questions n" value={n} onChange={setN} min={5} max={1000} step={5} />
          <NumberSlider label="True effect (Δ recall)" value={effect} onChange={setEffect} min={-0.5} max={0.5} step={0.01} format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))} />
          <NumberSlider label="Discordance (share of questions that change)" value={discordance} onChange={setDiscordance} min={0.02} max={1} step={0.02} format={(v) => `${Math.round(v * 100)}%`} />
          {!valid && <p className="text-xs text-red-400">|effect| cannot exceed discordance: a question can change by at most ±1.</p>}
          <NumberSlider label="Simulated experiments" value={sims} onChange={setSims} min={50} max={2000} step={50} />
          <NumberSlider label="Bootstrap resamples" value={resamples} onChange={setResamples} min={100} max={5000} step={100} />
          <NumberSlider label="Confidence" value={confidence} onChange={setConfidence} min={0.8} max={0.99} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
          <RunButton pending={run.isPending} onClick={() => run.mutate(undefined)} disabled={!valid || sims * resamples * n > 40_000_000} />
        </div>
      </Panel>
      <div className="space-y-4">
        {!r ? (
          <PrincipalNote title="Statistical power & the unit of analysis">
            Retrieval deltas are mostly exactly 0: a change fixes some questions (+1) and breaks others (−1). The effect is
            wins − losses; its noise comes from how many questions change at all (<strong>discordance</strong>). The unit of analysis
            is the <strong>question</strong> — more questions, not more runs, is what buys power. Simulate hundreds of experiments
            and count how many produce a paired CI that excludes zero.
          </PrincipalNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Stat label="Empirical power" value={pct(r.empirical_power)} sub={`± ${pct(2 * r.empirical_se)} (2 SE)`} />
              <Stat label="Analytic power" value={pct(r.analytic_power)} sub="normal approximation" />
              <Stat label="n for 80%" value={r.n_for_80 ?? '—'} />
              <Stat label="Wrong-sign 'wins'" value={pct(r.wrong_sign_rate)} sub="significant, wrong direction" />
              <Stat label="sd(Δ)" value={fmt3(r.sd_delta)} sub={`wins ${pct(r.p_win)} · losses ${pct(r.p_loss)}`} />
            </div>
            <div className="grid gap-4 2xl:grid-cols-2">
              <Panel title="Power vs number of questions" icon={Zap}>
                <LineChart logX formatX={(v) => `${v}`} formatY={(v) => `${Math.round(v * 100)}%`}
                  series={[{ name: 'analytic', color: SERIES[0], values: r.curve.map((p) => ({ x: p.n, y: p.power })) }]}
                  hlines={[{ y: 0.8, label: '80% power' }]}
                  points={[{ x: r.n, y: r.empirical_power, label: `empirical @ n=${r.n}`, color: SERIES[1] }]} />
              </Panel>
              <Panel title="Observed effects across simulated experiments" icon={Activity}
                subtitle="The same true effect, measured on different question samples.">
                <BinnedHistogram bins={r.observed_effect_hist} unit="experiments" formatX={(v) => v.toFixed(2)}
                  markers={[{ x: 0, label: '0' }, { x: r.effect, label: 'true effect', color: VIZ.good }]} />
              </Panel>
            </div>
            <PrincipalNote title="Reading this">
              {r.effect === 0
                ? <>With no true effect, "power" is the <strong>false positive rate</strong> — it should sit near α = {pct(r.alpha)}.</>
                : <>At n = {r.n}, a real {r.effect.toFixed(2)} improvement produces a significant result {pct(r.empirical_power)} of the
                  time. The other {pct(1 - r.empirical_power)} of experiments would report "no significant difference" about a change that
                  works — that is what an underpowered "no effect" means.</>}
              {' '}Where empirical and analytic power disagree, the normal approximation (not the simulation) is what is off.
            </PrincipalNote>
          </>
        )}
      </div>
    </div>
  );
}

/* ── P-hacking ───────────────────────────────────────────────────────────── */

function PhackingPanel() {
  const [n, setN] = useState(40);
  const [metrics, setMetrics] = useState(7);
  const [correlation, setCorrelation] = useState(0.5);
  const [discordance, setDiscordance] = useState(0.3);
  const [batch, setBatch] = useState(5);
  const [sims, setSims] = useState(500);
  const [result, setResult] = useState<PhackingResult | null>(null);
  const run = useEvalMutation(() => evalApi.statsPhacking({ n, metrics, sims, confidence: 0.95, discordance, correlation, batch, seed: 7 }), { onSuccess: setResult });
  const r = result;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Significance from pure noise" icon={FlaskRound} subtitle="Every simulated experiment has a true effect of exactly 0.">
        <div className="space-y-3">
          <NumberSlider label="Questions n" value={n} onChange={setN} min={10} max={400} step={5} />
          <NumberSlider label="Metrics tested" value={metrics} onChange={setMetrics} min={1} max={20} step={1} />
          <NumberSlider label="Correlation between metrics" value={correlation} onChange={setCorrelation} min={0} max={1} step={0.05} format={(v) => v.toFixed(2)} />
          <NumberSlider label="Discordance" value={discordance} onChange={setDiscordance} min={0.05} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} />
          <NumberSlider label="Peek every … questions" value={batch} onChange={setBatch} min={1} max={Math.max(1, Math.floor(n / 2))} step={1} />
          <NumberSlider label="Simulated experiments" value={sims} onChange={setSims} min={100} max={3000} step={100} />
          <RunButton pending={run.isPending} onClick={() => run.mutate(undefined)} />
        </div>
      </Panel>
      <div className="space-y-4">
        {!r ? (
          <PrincipalNote title="P-hacking & selective reporting">
            Nothing changed in these experiments. Yet test enough metrics, or peek at the result as questions accumulate and stop
            the moment it looks good, and "significant" results appear on schedule. Seeing them appear from noise is the best
            inoculation — and the reason the lab pre-registers one primary metric and a fixed question set.
          </PrincipalNote>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            <Panel title={`Test ${r.many_metrics.metrics} metrics, report any win`} icon={FlaskRound}
              subtitle={`correlation ${r.many_metrics.correlation.toFixed(2)} · ${r.sims} null experiments`}>
              <RateBars reference={{ value: r.alpha, label: 'α — what one test promises' }}
                rows={[
                  { label: 'Any metric p < α (raw)', value: r.many_metrics.raw_fwer, color: SERIES[1] },
                  { label: 'Independent formula', value: r.many_metrics.independent_formula, color: VIZ.muted },
                  { label: 'Bonferroni', value: r.many_metrics.bonferroni_fwer, color: SERIES[2] },
                  { label: 'Holm', value: r.many_metrics.holm_fwer, color: SERIES[0] },
                ]} />
              <p className="mt-3 text-xs font-medium">Smallest p-value per experiment</p>
              <BinnedHistogram bins={r.many_metrics.min_p_hist} color={SERIES[1]} unit="experiments" markers={[{ x: r.alpha, label: 'α' }]} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {pct(r.many_metrics.raw_fwer)} of experiments with zero effect had a "significant" metric. Correlated metrics inflate less
                than the independent formula ({pct(r.many_metrics.independent_formula)}) but never not at all. Holm brings the family back to ≈ α.
              </p>
            </Panel>
            <Panel title={`Peek every ${r.optional_stopping.batch} questions, stop when p < α`} icon={Zap}
              subtitle={`${r.optional_stopping.looks} looks at the data per experiment`}>
              <RateBars reference={{ value: r.alpha, label: 'α' }}
                rows={[
                  { label: 'Fixed n, one test', value: r.optional_stopping.fixed_n_fpr, color: SERIES[0] },
                  { label: 'Optional stopping', value: r.optional_stopping.peeking_fpr, color: SERIES[1] },
                ]} />
              {r.optional_stopping.stop_hist.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium">When the false "wins" stopped</p>
                  <BinnedHistogram bins={r.optional_stopping.stop_hist} color={SERIES[1]} unit="experiments" formatX={(v) => `${Math.round(v)}`} />
                </>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Each look is another chance to cross the line by luck. The false positive rate grows with the number of looks — the reason
                the question set and n are fixed before any run.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

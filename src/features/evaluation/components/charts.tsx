import { useState } from 'react';
import { cn } from '@/lib/utils';
import { fmt3, fmtSigned } from '@/features/evaluation/lib/evalStats';
import type { ArmSummary } from '@/types/eval';

/**
 * Hand-drawn SVG charts for the Evaluation pages. No chart library: each one is
 * small, and drawing the interval yourself is part of understanding it.
 *
 * Palette (validated categorical slots, dark steps): baseline = blue, treatment =
 * orange; dev = blue, holdout = aqua. Text never wears series colour; marks do.
 * Gridlines are 1px solid hairlines; interval lines 2px; points r=4 with a 2px
 * surface ring.
 */
export const VIZ = {
  baseline:  '#3987e5',
  treatment: '#d95926',
  dev:       '#3987e5',
  holdout:   '#199e70',
  good:      '#0ca30c',
  bad:       '#d03b3b',
  muted:     '#898781',
  grid:      'rgba(255,255,255,0.08)',
  axis:      'rgba(255,255,255,0.22)',
  surface:   '#0b1120',
} as const;

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 whitespace-pre rounded-md border border-white/10 bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground shadow-panel"
      style={{ left: tip.x + 12, top: tip.y + 8 }}
    >
      {tip.text}
    </div>
  ) : null;
  const bind = (text: string) => ({
    onMouseMove: (e: React.MouseEvent<SVGElement>) => {
      const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
    },
    onMouseLeave: () => setTip(null),
  });
  return { node, bind };
}

const niceTicks = (lo: number, hi: number, count = 5) => {
  const span = hi - lo;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
};

/* ── Forest plot: paired deltas against zero ─────────────────────────────── */

export interface ForestRow {
  label:        string;
  sublabel?:    string;
  mean:         number;
  low:          number | null;
  high:         number | null;
  clusterLow?:  number | null;
  clusterHigh?: number | null;
  emphasis?:    boolean;
}

export function ForestPlot({
  rows, minEffect, direction = 'increase', className,
}: {
  rows: ForestRow[]; minEffect?: number; direction?: 'increase' | 'decrease' | 'non_inferior'; className?: string;
}) {
  const { node, bind } = useTooltip();
  const values = rows.flatMap((r) => [r.mean, r.low, r.high, r.clusterLow, r.clusterHigh])
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  const extent = Math.max(0.05, ...(minEffect ? [minEffect * 1.4] : []), ...values.map(Math.abs)) * 1.15;
  const lo = -extent, hi = extent;

  const labelW = 150, valueW = 150, plotW = 360, rowH = 34, top = 22;
  const width = labelW + plotW + valueW;
  const height = top + rows.length * rowH + 22;
  const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * plotW;
  const ticks = niceTicks(lo, hi, 6);

  // Shaded band = the region the pre-registered minimum effect calls "worth acting on".
  const band = minEffect
    ? direction === 'decrease'
      ? [lo, -minEffect]
      : direction === 'non_inferior'
        ? [-minEffect, hi]
        : [minEffect, hi]
    : null;

  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full" role="img" aria-label="Paired delta forest plot">
        {band && (
          <rect x={x(band[0])} y={top - 8} width={Math.max(0, x(band[1]) - x(band[0]))}
            height={rows.length * rowH + 8} fill={VIZ.good} opacity={0.08} />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 8} y2={top + rows.length * rowH} stroke={VIZ.grid} />
            <text x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {t > 0 ? '+' : ''}{t.toFixed(2)}
            </text>
          </g>
        ))}
        {/* The zero line is the only reference that answers "is there an effect?" */}
        <line x1={x(0)} x2={x(0)} y1={top - 12} y2={top + rows.length * rowH} stroke={VIZ.axis} strokeWidth={1.5} />
        <text x={x(0)} y={top - 12} textAnchor="middle" className="fill-muted-foreground text-[9px]">no effect</text>
        {minEffect && direction !== 'non_inferior' && (
          <text x={x(direction === 'decrease' ? -minEffect : minEffect)} y={top - 12} textAnchor="middle"
            className="fill-emerald-400/80 text-[9px]">min effect</text>
        )}

        {rows.map((r, i) => {
          const cy = top + i * rowH + rowH / 2;
          const crosses = r.low !== null && r.high !== null && r.low <= 0 && r.high >= 0;
          const tip = `${r.label}\nΔ ${fmtSigned(r.mean)}\nbootstrap [${fmtSigned(r.low)}, ${fmtSigned(r.high)}]` +
            (r.clusterLow !== undefined ? `\ncluster   [${fmtSigned(r.clusterLow)}, ${fmtSigned(r.clusterHigh)}]` : '');
          return (
            <g key={r.label} {...bind(tip)}>
              <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
              <text x={8} y={cy - (r.sublabel ? 3 : -3)} className={cn('text-[11px]', r.emphasis ? 'fill-foreground font-semibold' : 'fill-muted-foreground')}>
                {r.label}
              </text>
              {r.sublabel && <text x={8} y={cy + 10} className="fill-muted-foreground text-[9px] uppercase tracking-wide">{r.sublabel}</text>}
              {r.clusterLow != null && r.clusterHigh != null && (
                <line x1={x(Math.max(lo, r.clusterLow))} x2={x(Math.min(hi, r.clusterHigh))} y1={cy + 6} y2={cy + 6}
                  stroke={VIZ.muted} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
              )}
              {r.low !== null && r.high !== null && (
                <line x1={x(Math.max(lo, r.low))} x2={x(Math.min(hi, r.high))} y1={cy} y2={cy}
                  stroke={crosses ? VIZ.muted : r.mean >= 0 ? VIZ.good : VIZ.bad} strokeWidth={2} strokeLinecap="round" />
              )}
              <circle cx={x(r.mean)} cy={cy} r={r.emphasis ? 5 : 4} fill={crosses ? VIZ.muted : r.mean >= 0 ? VIZ.good : VIZ.bad}
                stroke={VIZ.surface} strokeWidth={2} />
              <text x={labelW + plotW + 10} y={cy + 3} className="fill-foreground font-mono text-[10px]">
                {fmtSigned(r.mean)}
              </text>
              <text x={labelW + plotW + 58} y={cy + 3} className="fill-muted-foreground font-mono text-[10px]">
                [{fmtSigned(r.low)}, {fmtSigned(r.high)}]
              </text>
            </g>
          );
        })}
      </svg>
      {node}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIZ.good }} /> CI excludes 0 (improvement)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIZ.bad }} /> CI excludes 0 (regression)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIZ.muted }} /> crosses 0 · thin line = cluster bootstrap</span>
        {minEffect && <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: VIZ.good, opacity: 0.25 }} /> region meeting the minimum effect</span>}
      </div>
    </div>
  );
}

/* ── Arm intervals: bootstrap vs t vs cluster on the metric's own scale ──── */

export type IntervalMethod = 'bootstrap' | 't' | 'cluster';

export function ArmIntervals({
  baseline, treatment, method, labels = ['Baseline', 'Treatment'], className,
}: {
  baseline: ArmSummary; treatment: ArmSummary; method: IntervalMethod; labels?: [string, string]; className?: string;
}) {
  const { node, bind } = useTooltip();
  const lo = -0.15, hi = 1.15;
  const labelW = 90, plotW = 420, width = labelW + plotW + 20, rowH = 30, top = 12;
  const height = top + 2 * rowH + 20;
  const x = (v: number) => labelW + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * plotW;

  const arms: [string, ArmSummary, string][] = [
    [labels[0], baseline, VIZ.baseline],
    [labels[1], treatment, VIZ.treatment],
  ];

  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[480px] w-full" role="img" aria-label="Arm means with confidence intervals">
        {/* Values a retrieval metric can never take. A t-interval may still land here. */}
        <rect x={x(lo)} y={top - 6} width={x(0) - x(lo)} height={2 * rowH + 6} fill={VIZ.bad} opacity={0.07} />
        <rect x={x(1)} y={top - 6} width={x(hi) - x(1)} height={2 * rowH + 6} fill={VIZ.bad} opacity={0.07} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={top + 2 * rowH} stroke={t === 0 || t === 1 ? VIZ.axis : VIZ.grid} />
            <text x={x(t)} y={height - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">{t}</text>
          </g>
        ))}
        {arms.map(([label, arm, color], i) => {
          const cy = top + i * rowH + rowH / 2;
          const bounds = method === 'bootstrap' ? arm.bootstrap : method === 't' ? arm.t : arm.cluster;
          const low = bounds?.low ?? null, high = bounds?.high ?? null;
          const escapes = low !== null && high !== null && (low < 0 || high > 1);
          return (
            <g key={label} {...bind(`${label}\nmean ${fmt3(arm.mean)} · sd ${fmt3(arm.sd)}\n${method} [${fmt3(low)}, ${fmt3(high)}]\nn=${arm.n}${method === 'cluster' ? ` · ${arm.cluster?.clusters} clusters` : ''}`)}>
              <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
              <text x={6} y={cy + 4} className="fill-muted-foreground text-[11px]">{label}</text>
              {low !== null && high !== null && (
                <line x1={x(low)} x2={x(high)} y1={cy} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
              )}
              {escapes && <text x={x(high ?? 1) + 6} y={cy + 3} className="fill-red-400 text-[9px]">outside [0,1]</text>}
              {arm.mean !== undefined && <circle cx={x(arm.mean)} cy={cy} r={4.5} fill={color} stroke={VIZ.surface} strokeWidth={2} />}
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

/* ── Histogram: per-query score distributions (bimodality is the point) ─── */

export function ScoreHistogram({
  series, bins = 10, domain = [0, 1], className, zeroLine = false, height = 150,
}: {
  series: { label: string; values: number[]; color: string }[];
  bins?: number; domain?: [number, number]; className?: string; zeroLine?: boolean; height?: number;
}) {
  const { node, bind } = useTooltip();
  const [lo, hi] = domain;
  const width = 520, left = 34, bottom = 22, top = 8;
  const plotW = width - left - 8, plotH = height - top - bottom;
  const step = (hi - lo) / bins;
  const counts = series.map((s) =>
    Array.from({ length: bins }, (_, b) =>
      s.values.filter((v) => {
        const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)));
        return idx === b;
      }).length,
    ),
  );
  const maxCount = Math.max(1, ...counts.flat());
  const slot = plotW / bins;
  const barW = Math.min(24, (slot - 6) / series.length - 2);
  const y = (c: number) => top + plotH - (c / maxCount) * plotH;
  const x = (v: number) => left + ((v - lo) / (hi - lo)) * plotW;

  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Per-query score distribution">
        {niceTicks(0, maxCount, 4).map((t) => (
          <g key={t}>
            <line x1={left} x2={width - 8} y1={y(t)} y2={y(t)} stroke={VIZ.grid} />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">{t}</text>
          </g>
        ))}
        {counts.map((row, s) =>
          row.map((c, b) => {
            if (c === 0) return null;
            const bx = left + b * slot + (slot - series.length * (barW + 2)) / 2 + s * (barW + 2);
            const h = top + plotH - y(c);
            const r = Math.min(4, h / 2, barW / 2);
            const yTop = y(c);
            return (
              <path
                key={`${s}-${b}`}
                d={`M${bx},${top + plotH} V${yTop + r} Q${bx},${yTop} ${bx + r},${yTop} H${bx + barW - r} Q${bx + barW},${yTop} ${bx + barW},${yTop + r} V${top + plotH} Z`}
                fill={series[s].color}
                {...bind(`${series[s].label}\n[${(lo + b * step).toFixed(2)}, ${(lo + (b + 1) * step).toFixed(2)}${b === bins - 1 ? ']' : ')'}\n${c} quer${c === 1 ? 'y' : 'ies'}`)}
              />
            );
          }),
        )}
        <line x1={left} x2={width - 8} y1={top + plotH} y2={top + plotH} stroke={VIZ.axis} />
        {zeroLine && lo < 0 && hi > 0 && (
          <line x1={x(0)} x2={x(0)} y1={top} y2={top + plotH} stroke={VIZ.axis} strokeWidth={1.5} />
        )}
        {niceTicks(lo, hi, 5).map((t) => (
          <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            {zeroLine && t > 0 ? '+' : ''}{t.toFixed(2)}
          </text>
        ))}
      </svg>
      {node}
      {series.length > 1 && (
        <div className="mt-1 flex gap-4 text-[10px] text-muted-foreground">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Power curve: detectable effect vs n ─────────────────────────────────── */

export function PowerCurve({
  mdeAt, n, targetEffect, maxN = 600, className,
}: {
  mdeAt: (n: number) => number; n: number; targetEffect: number; maxN?: number; className?: string;
}) {
  const { node, bind } = useTooltip();
  const width = 520, height = 180, left = 40, bottom = 24, top = 10;
  const plotW = width - left - 10, plotH = height - top - bottom;
  const yMax = Math.max(0.3, Math.min(1, mdeAt(Math.max(5, Math.min(n, 10)))));
  const x = (v: number) => left + (Math.log(v) - Math.log(5)) / (Math.log(maxN) - Math.log(5)) * plotW;
  const y = (v: number) => top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const nn = Math.exp(Math.log(5) + (i / 80) * (Math.log(maxN) - Math.log(5)));
    pts.push(`${x(nn).toFixed(1)},${y(mdeAt(nn)).toFixed(1)}`);
  }
  const current = Math.max(5, Math.min(maxN, n));

  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Minimum detectable effect versus sample size">
        {niceTicks(0, yMax, 4).map((t) => (
          <g key={t}>
            <line x1={left} x2={width - 10} y1={y(t)} y2={y(t)} stroke={VIZ.grid} />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">{t.toFixed(2)}</text>
          </g>
        ))}
        {[5, 10, 25, 50, 100, 250, 500].filter((t) => t <= maxN).map((t) => (
          <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">{t}</text>
        ))}
        <line x1={left} x2={width - 10} y1={y(targetEffect)} y2={y(targetEffect)} stroke={VIZ.good} strokeWidth={1} opacity={0.7} />
        <text x={width - 12} y={y(targetEffect) - 4} textAnchor="end" className="fill-emerald-400/90 text-[9px]">target effect {targetEffect.toFixed(2)}</text>
        <polyline points={pts.join(' ')} fill="none" stroke={VIZ.baseline} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(current)} x2={x(current)} y1={top} y2={top + plotH} stroke={VIZ.axis} />
        <circle cx={x(current)} cy={y(mdeAt(current))} r={5} fill={VIZ.treatment} stroke={VIZ.surface} strokeWidth={2}
          {...bind(`n = ${n}\ndetectable effect ±${mdeAt(current).toFixed(3)}`)} />
        <line x1={left} x2={width - 10} y1={top + plotH} y2={top + plotH} stroke={VIZ.axis} />
      </svg>
      {node}
      <p className="mt-1 text-[10px] text-muted-foreground">x: questions (log scale) · y: smallest effect detectable at 80% power · dot: your split</p>
    </div>
  );
}

/* ── Split bars: dev vs holdout per stratum ──────────────────────────────── */

export function SplitBars({ strata, className }: { strata: Record<string, { dev: number; holdout: number }>; className?: string }) {
  const entries = Object.entries(strata).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...entries.map(([, s]) => s.dev + s.holdout));
  return (
    <div className={cn('space-y-1.5', className)}>
      {entries.map(([name, s]) => {
        const total = s.dev + s.holdout;
        return (
          <div key={name} className="grid grid-cols-[minmax(0,160px)_1fr_64px] items-center gap-2 text-[11px]">
            <span className="truncate font-mono text-muted-foreground" title={name}>{name}</span>
            <div className="flex h-3.5 gap-[2px]" style={{ width: `${(total / max) * 100}%` }}
              title={`${name}: ${s.dev} dev · ${s.holdout} holdout`}>
              {s.dev > 0 && <div className="h-full rounded-l-[4px] first:rounded-l-[4px] last:rounded-r-[4px]" style={{ flex: s.dev, background: VIZ.dev }} />}
              {s.holdout > 0 && <div className="h-full rounded-r-[4px] first:rounded-l-[4px]" style={{ flex: s.holdout, background: VIZ.holdout }} />}
            </div>
            <span className="text-right font-mono tabular-nums text-muted-foreground">
              {s.dev}/{s.holdout}
              <span className="ml-1 text-muted-foreground/60">{total ? Math.round((s.holdout / total) * 100) : 0}%</span>
            </span>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.dev }} /> dev</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.holdout }} /> holdout</span>
        <span>· counts dev/holdout · % holdout</span>
      </div>
    </div>
  );
}

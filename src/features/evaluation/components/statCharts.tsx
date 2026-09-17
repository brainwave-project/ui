import { useState } from 'react';
import { cn } from '@/lib/utils';
import { VIZ } from './charts';
import type { Bin } from '@/types/eval';

/**
 * Charts for pre-binned server data (Stats Lab, sweeps, audits). Same mark specs
 * as charts.tsx: 1px solid gridlines, 2px lines, r=4 points with a surface ring,
 * text in text tokens, colour on marks only.
 */

/** Categorical slots in fixed order (validated dark steps). */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 whitespace-pre rounded-md border border-white/10 bg-background/95 px-2 py-1 font-mono text-[10px] text-foreground shadow-panel"
      style={{ left: tip.x + 12, top: tip.y + 8 }}
    >
      {tip.text}
    </div>
  ) : null;
  const move = (e: React.MouseEvent<SVGElement>, text: string) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement ?? (e.currentTarget as SVGSVGElement);
    const box = svg.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
  };
  return { node, move, clear: () => setTip(null) };
}

function ticks(lo: number, hi: number, count = 5) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
}

export interface Marker { x: number; label: string; color?: string }
export interface Band { lo: number; hi: number; label?: string; color?: string }

/* ── Histogram of server-side bins ───────────────────────────────────────── */

export function BinnedHistogram({
  bins, markers = [], bands = [], color = VIZ.baseline, height = 160, className,
  normal, formatX = (x: number) => x.toFixed(2), unit = 'count',
}: {
  bins: Bin[]; markers?: Marker[]; bands?: Band[]; color?: string; height?: number; className?: string;
  normal?: { mean: number; sd: number; total: number }; formatX?: (x: number) => string; unit?: string;
}) {
  const { node, move, clear } = useTip();
  if (!bins.length) return <p className="py-6 text-center text-xs text-muted-foreground">No data.</p>;

  const width = 520, left = 34, right = 10, top = 20, bottom = 22;
  const plotW = width - left - right, plotH = height - top - bottom;
  let lo = bins[0].lo, hi = bins[bins.length - 1].hi;
  for (const v of [...markers.map((m) => m.x), ...bands.flatMap((b) => [b.lo, b.hi])]) {
    if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (hi <= lo) hi = lo + 1;
  const x = (v: number) => left + ((v - lo) / (hi - lo)) * plotW;
  const binWidth = bins[0].hi - bins[0].lo;
  const pdf = (v: number) => normal && normal.sd > 0
    ? Math.exp(-((v - normal.mean) ** 2) / (2 * normal.sd ** 2)) / (normal.sd * Math.sqrt(2 * Math.PI)) : 0;
  const curve = normal && normal.sd > 0
    ? Array.from({ length: 81 }, (_, i) => { const v = lo + (i / 80) * (hi - lo); return [v, normal.total * binWidth * pdf(v)] as const; })
    : [];
  const maxCount = Math.max(1, ...bins.map((b) => b.count), ...curve.map(([, c]) => c));
  const y = (c: number) => top + plotH - (c / maxCount) * plotH;

  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Histogram">
        {ticks(0, maxCount, 4).map((t) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={VIZ.grid} />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">{Math.round(t)}</text>
          </g>
        ))}
        {bands.map((b, i) => (
          <g key={`band-${i}`}>
            <rect x={x(b.lo)} y={top} width={Math.max(1, x(b.hi) - x(b.lo))} height={plotH} fill={b.color ?? VIZ.good} opacity={0.1} />
            {b.label && <text x={x(b.lo) + 3} y={top + 10 + i * 10} className="fill-muted-foreground text-[9px]">{b.label}</text>}
          </g>
        ))}
        {bins.map((b, i) => {
          if (!b.count) return null;
          const bx = x(b.lo) + 1, bw = Math.max(1, x(b.hi) - x(b.lo) - 2), yt = y(b.count), h = top + plotH - yt;
          const r = Math.min(4, bw / 2, h / 2);
          return (
            <path key={i} fill={color}
              d={`M${bx},${top + plotH} V${yt + r} Q${bx},${yt} ${bx + r},${yt} H${bx + bw - r} Q${bx + bw},${yt} ${bx + bw},${yt + r} V${top + plotH} Z`}
              onMouseMove={(e) => move(e, `[${formatX(b.lo)}, ${formatX(b.hi)})\n${b.count} ${unit}`)} onMouseLeave={clear} />
          );
        })}
        {curve.length > 0 && (
          <polyline points={curve.map(([v, c]) => `${x(v).toFixed(1)},${y(c).toFixed(1)}`).join(' ')}
            fill="none" stroke={VIZ.treatment} strokeWidth={2} strokeLinejoin="round" />
        )}
        <line x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} stroke={VIZ.axis} />
        {markers.map((m, i) => (
          <g key={`m-${i}`}>
            <line x1={x(m.x)} x2={x(m.x)} y1={top - 4} y2={top + plotH} stroke={m.color ?? VIZ.axis} strokeWidth={1.5} />
            <text x={x(m.x)} y={top - 7 - (i % 2) * 0} textAnchor="middle" className="fill-muted-foreground text-[9px]">{m.label}</text>
          </g>
        ))}
        {ticks(lo, hi, 6).map((t) => (
          <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">{formatX(t)}</text>
        ))}
      </svg>
      {node}
    </div>
  );
}

/* ── Line chart with a crosshair ─────────────────────────────────────────── */

export interface LineSeries { name: string; color: string; values: { x: number; y: number }[]; dashed?: boolean }

export function LineChart({
  series, yDomain = [0, 1], height = 220, logX = false, markers = [], hlines = [], points = [],
  formatX = (v: number) => `${v}`, formatY = (v: number) => v.toFixed(2), className,
}: {
  series: LineSeries[]; yDomain?: [number, number]; height?: number; logX?: boolean;
  markers?: Marker[]; hlines?: { y: number; label: string; color?: string }[];
  points?: { x: number; y: number; label: string; color: string }[];
  formatX?: (v: number) => string; formatY?: (v: number) => string; className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const xs = series[0]?.values.map((p) => p.x) ?? [];
  if (!xs.length) return null;
  const width = 560, left = 40, right = series.length <= 4 ? 96 : 14, top = 14, bottom = 24;
  const plotW = width - left - right, plotH = height - top - bottom;
  const allX = [...series.flatMap((s) => s.values.map((p) => p.x)), ...points.map((p) => p.x)];
  const xlo = Math.min(...allX), xhi = Math.max(...allX);
  const tx = (v: number) => (logX ? Math.log(Math.max(v, 1e-9)) : v);
  const x = (v: number) => left + ((tx(v) - tx(xlo)) / ((tx(xhi) - tx(xlo)) || 1)) * plotW;
  const [ylo, yhi] = yDomain;
  const y = (v: number) => top + plotH - ((Math.min(yhi, Math.max(ylo, v)) - ylo) / (yhi - ylo)) * plotH;
  const xTicks = logX ? xs.filter((_, i) => i % Math.ceil(xs.length / 7) === 0) : ticks(xlo, xhi, 7);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * width;
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(x(v) - px) < Math.abs(x(xs[best]) - px)) best = i; });
    setHover(best);
  }

  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Line chart">
        {ticks(ylo, yhi, 4).map((t) => (
          <g key={t}>
            <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke={VIZ.grid} />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">{formatY(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">{formatX(t)}</text>
        ))}
        {hlines.map((h) => (
          <g key={h.label}>
            <line x1={left} x2={left + plotW} y1={y(h.y)} y2={y(h.y)} stroke={h.color ?? VIZ.good} opacity={0.7} />
            <text x={left + 4} y={y(h.y) - 4} className="fill-muted-foreground text-[9px]">{h.label}</text>
          </g>
        ))}
        {markers.map((m) => (
          <g key={m.label}>
            <line x1={x(m.x)} x2={x(m.x)} y1={top} y2={top + plotH} stroke={m.color ?? VIZ.axis} strokeWidth={1.5} />
            <text x={x(m.x) + 3} y={top + 9} className="fill-muted-foreground text-[9px]">{m.label}</text>
          </g>
        ))}
        <line x1={left} x2={left + plotW} y1={top + plotH} y2={top + plotH} stroke={VIZ.axis} />
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 4' : undefined}
            points={s.values.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')} />
        ))}
        {series.length <= 4 && series.map((s) => {
          const last = s.values[s.values.length - 1];
          return (
            <g key={`end-${s.name}`}>
              <circle cx={x(last.x)} cy={y(last.y)} r={3.5} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />
              <text x={x(last.x) + 7} y={y(last.y) + 3} className="fill-foreground text-[10px]">{s.name}</text>
            </g>
          );
        })}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={x(p.x)} cy={y(p.y)} r={5} fill={p.color} stroke={VIZ.surface} strokeWidth={2} />
            <text x={x(p.x) + 8} y={y(p.y) - 6} className="fill-foreground text-[10px]">{p.label}</text>
          </g>
        ))}
        {hover !== null && (
          <line x1={x(xs[hover])} x2={x(xs[hover])} y1={top} y2={top + plotH} stroke={VIZ.axis} />
        )}
        {hover !== null && series.map((s) => (
          s.values[hover] && <circle key={`h-${s.name}`} cx={x(s.values[hover].x)} cy={y(s.values[hover].y)} r={4} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />
        ))}
        <rect x={left} y={top} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-white/10 bg-background/95 px-2 py-1 font-mono text-[10px] shadow-panel">
          <p className="text-muted-foreground">x = {formatX(xs[hover])}</p>
          {series.map((s) => s.values[hover] && (
            <p key={s.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} /> {s.name} {formatY(s.values[hover].y)}
            </p>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> {s.name}{s.dashed ? ' (dashed)' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Interval ladder: does each simulated interval cover the truth? ───────── */

export function IntervalLadder({
  examples, trueMean, domain = [-0.15, 1.15], height = 260,
}: {
  examples: { low: number | null; high: number | null; covers: boolean }[]; trueMean: number;
  domain?: [number, number]; height?: number;
}) {
  const width = 520, left = 12, right = 12, top = 14, bottom = 22;
  const plotW = width - left - right, plotH = height - top - bottom;
  const [lo, hi] = domain;
  const x = (v: number) => left + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * plotW;
  const rowH = plotH / Math.max(1, examples.length);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Simulated intervals">
        <rect x={x(lo)} y={top} width={x(0) - x(lo)} height={plotH} fill={VIZ.bad} opacity={0.06} />
        <rect x={x(1)} y={top} width={x(hi) - x(1)} height={plotH} fill={VIZ.bad} opacity={0.06} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={top + plotH} stroke={t === 0 || t === 1 ? VIZ.axis : VIZ.grid} />
            <text x={x(t)} y={height - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">{t}</text>
          </g>
        ))}
        {examples.map((e, i) => {
          const cy = top + i * rowH + rowH / 2;
          const l = e.low ?? lo, h = e.high ?? hi;
          return (
            <g key={i}>
              <line x1={x(l)} x2={Math.max(x(h), x(l) + 1.5)} y1={cy} y2={cy}
                stroke={e.covers ? VIZ.baseline : VIZ.bad} strokeWidth={Math.max(1.5, Math.min(2, rowH - 1))} strokeLinecap="round" />
            </g>
          );
        })}
        <line x1={x(trueMean)} x2={x(trueMean)} y1={top - 6} y2={top + plotH} stroke={VIZ.good} strokeWidth={1.5} />
        <text x={x(trueMean)} y={top - 4} textAnchor="middle" className="fill-emerald-400 text-[9px]">true mean {trueMean.toFixed(3)}</text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIZ.baseline }} /> covers the truth</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIZ.bad }} /> misses</span>
        <span>· a dot-width line is a zero-width interval · shaded: outside [0, 1]</span>
      </div>
    </div>
  );
}

/* ── Rate bars against a reference ──────────────────────────────────────── */

export function RateBars({
  rows, reference, max = 1,
}: {
  rows: { label: string; value: number; color?: string; sub?: string }[];
  reference?: { value: number; label: string };
  max?: number;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(1, v / max)) * 100}%`;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,150px)_1fr_64px] items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground" title={r.sub}>{r.label}</span>
          <div className="relative h-3.5 rounded-r-[4px] bg-white/[0.04]">
            <div className="h-full rounded-r-[4px]" style={{ width: pct(r.value), background: r.color ?? VIZ.baseline }} />
            {reference && (
              <div className="absolute top-[-3px] h-[calc(100%+6px)] w-px bg-white/60" style={{ left: pct(reference.value) }} />
            )}
          </div>
          <span className="text-right font-mono tabular-nums">{(r.value * 100).toFixed(1)}%</span>
        </div>
      ))}
      {reference && <p className="text-[10px] text-muted-foreground">white tick: {reference.label} ({(reference.value * 100).toFixed(1)}%)</p>}
    </div>
  );
}

/* ── Confusion grid ──────────────────────────────────────────────────────── */

export function ConfusionGrid({
  matrix, labels, rowTitle, colTitle,
}: {
  matrix: number[][]; labels: string[]; rowTitle: string; colTitle: string;
}) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-[10px] font-normal text-muted-foreground">{rowTitle} ↓ · {colTitle} →</th>
            {labels.map((l) => <th key={l} className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="px-2 py-1 text-left font-mono text-[10px] text-muted-foreground">{labels[i]}</th>
              {row.map((c, j) => {
                const alpha = c / max;
                return (
                  <td key={j} title={`${rowTitle} ${labels[i]} · ${colTitle} ${labels[j]}: ${c}`}
                    className={cn('h-9 w-12 rounded text-center font-mono tabular-nums', i === j && 'ring-1 ring-inset ring-white/20')}
                    style={{ background: `rgba(57,135,229,${0.08 + alpha * 0.8})`, color: alpha > 0.55 ? '#fff' : undefined }}>
                    {c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

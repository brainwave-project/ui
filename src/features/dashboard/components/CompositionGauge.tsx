import { useMemo } from 'react';

export interface GaugeSegment {
  label: string;
  value: number;
  color: string; // any CSS color, e.g. 'hsl(152 76% 50%)'
}

interface Props {
  segments: GaugeSegment[];
  /** 0–1 — drives the inner "searchable health" arc + center read-out. */
  health?:  number;
  healthLabel?: string;
}

/* Geometry (viewBox 0 0 220 220) */
const CX = 110;
const CY = 110;
const R_DONUT = 84;
const SW_DONUT = 13;
const R_HEALTH = 63;
const SW_HEALTH = 4;
const GAP = 7; // arc gap between segments, in path units

const C_DONUT = 2 * Math.PI * R_DONUT;
const C_HEALTH = 2 * Math.PI * R_HEALTH;
const TICKS = 48;

/**
 * Knowledge-base composition rendered as a glowing "reactor core":
 *  · rotating outer tick ring (HUD chrome)
 *  · segmented, gap-separated donut with per-state glow
 *  · inner arc = share of the base that is searchable (health)
 *  · center hub = total + health %
 * All geometry is derived from real counts; nothing is faked.
 */
export function CompositionGauge({ segments, health = 0, healthLabel = 'searchable' }: Props) {
  const total = useMemo(() => segments.reduce((s, x) => s + x.value, 0), [segments]);

  const arcs = useMemo(() => {
    const active = segments.filter((s) => s.value > 0);
    const usable = C_DONUT - active.length * GAP;
    let offset = 0;
    return active.map((seg) => {
      const len = total > 0 ? (seg.value / total) * usable : 0;
      const arc = { ...seg, len, offset };
      offset += len + GAP;
      return arc;
    });
  }, [segments, total]);

  const healthLen = Math.max(0, Math.min(1, health)) * C_HEALTH;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
      {/* Reactor */}
      <div className="relative mx-auto shrink-0" style={{ width: 220, height: 220 }}>
        <svg viewBox="0 0 220 220" className="h-full w-full">
          {/* rotating tick ring */}
          <g
            className="animate-spin-slow"
            style={{ transformOrigin: 'center', transformBox: 'fill-box' as const }}
          >
            {Array.from({ length: TICKS }).map((_, i) => {
              const a = (i / TICKS) * 2 * Math.PI;
              const r1 = 101;
              const r2 = i % 4 === 0 ? 95 : 98;
              return (
                <line
                  key={i}
                  x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1}
                  x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2}
                  stroke="hsl(var(--neon) / 0.18)"
                  strokeWidth={i % 4 === 0 ? 1.5 : 1}
                />
              );
            })}
          </g>

          {/* donut track */}
          <circle
            cx={CX} cy={CY} r={R_DONUT}
            fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth={SW_DONUT}
          />

          {/* segmented data arcs (rotated so 0 starts at top) */}
          <g transform={`rotate(-90 ${CX} ${CY})`}>
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx={CX} cy={CY} r={R_DONUT}
                fill="none"
                stroke={a.color}
                strokeWidth={SW_DONUT}
                strokeLinecap="round"
                strokeDasharray={`${a.len} ${C_DONUT - a.len}`}
                strokeDashoffset={-a.offset}
                style={{
                  filter: `drop-shadow(0 0 5px ${a.color})`,
                  transition: 'stroke-dasharray 0.7s ease, stroke-dashoffset 0.7s ease',
                }}
              />
            ))}

            {/* inner health arc */}
            <circle
              cx={CX} cy={CY} r={R_HEALTH}
              fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth={SW_HEALTH}
            />
            <circle
              cx={CX} cy={CY} r={R_HEALTH}
              fill="none"
              stroke="hsl(var(--neon))"
              strokeWidth={SW_HEALTH}
              strokeLinecap="round"
              strokeDasharray={`${healthLen} ${C_HEALTH - healthLen}`}
              style={{ filter: 'drop-shadow(0 0 6px hsl(var(--neon) / 0.8))', transition: 'stroke-dasharray 0.7s ease' }}
            />
          </g>

          {/* core hub */}
          <circle cx={CX} cy={CY} r={48} fill="hsl(var(--card) / 0.6)" className="animate-glow-pulse" />
        </svg>

        {/* center read-out */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold leading-none tabular-nums neon-text">{total}</span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">documents</span>
          <span className="mt-2 rounded-full bg-neon/10 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-neon">
            {Math.round((health || 0) * 100)}% {healthLabel}
          </span>
        </div>
      </div>

      {/* Legend with per-state meters */}
      <ul className="flex-1 space-y-3" style={{ minWidth: 200 }}>
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
                  />
                  {s.label}
                </span>
                <span className="font-mono tabular-nums">
                  <span className="text-foreground">{s.value}</span>
                  <span className="ml-1.5 text-muted-foreground/60">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: s.color,
                    boxShadow: `0 0 8px ${s.color}`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

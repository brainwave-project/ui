import { useMemo } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // any CSS color, e.g. 'hsl(var(--neon))'
}

interface Props {
  segments:    DonutSegment[];
  /** Big number rendered in the hole. Defaults to the summed total. */
  centerValue?: number | string;
  centerLabel?: string;
  size?:       number;
}

const RADIUS = 60;
const STROKE = 16;
const CIRC = 2 * Math.PI * RADIUS;

/** Lightweight dependency-free SVG donut with an inline legend. */
export function DonutChart({ segments, centerValue, centerLabel = 'total', size = 160 }: Props) {
  const total = useMemo(() => segments.reduce((s, x) => s + x.value, 0), [segments]);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const dash = frac * CIRC;
    const arc = { ...seg, dash, gap: CIRC - dash, offset };
    offset -= dash;
    return arc;
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx={80} cy={80} r={RADIUS} fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth={STROKE} />
          {total > 0 &&
            arcs.map((a) => (
              <circle
                key={a.label}
                cx={80} cy={80} r={RADIUS}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={`${a.dash} ${a.gap}`}
                strokeDashoffset={a.offset}
                strokeLinecap="butt"
                style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums">{centerValue ?? total}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-mono tabular-nums text-foreground">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

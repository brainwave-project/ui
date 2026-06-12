import { cn } from '@/lib/utils';

interface Props {
  label:    string;
  hint?:    string;
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  /** Render the numeric readout (e.g. percent, "tok"). */
  format?:  (v: number) => string;
  /** Server baseline marker — drawn as a tick + shown in the footer. */
  baseline?: number;
  accent?:  'neon' | 'plasma';
  onChange: (v: number) => void;
}

/**
 * A single governed RAG knob: labelled range slider with a live readout and an
 * optional "server default" baseline tick so the operator sees how far they've
 * drifted from the shipped configuration.
 */
export function GovernanceControl({
  label, hint, value, min, max, step, format = String, baseline, accent = 'neon', onChange,
}: Props) {
  const pct      = ((value - min) / (max - min)) * 100;
  const basePct  = baseline != null ? ((baseline - min) / (max - min)) * 100 : null;
  const drifted  = baseline != null && Math.abs(baseline - value) > 1e-9;
  const accentVar = accent === 'neon' ? 'var(--neon)' : 'var(--plasma)';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 font-mono text-xs tabular-nums',
            accent === 'neon' ? 'bg-neon/10 text-neon' : 'bg-plasma/10 text-plasma',
          )}
        >
          {format(value)}
        </span>
      </div>

      <div className="relative">
        {/* track fill */}
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, hsl(${accentVar} / 0.4), hsl(${accentVar}))` }}
          />
        </div>
        {/* baseline tick */}
        {basePct != null && (
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/40"
            style={{ left: `${basePct}%` }}
            title={`Server default: ${format(baseline!)}`}
          />
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative h-1.5 w-full cursor-pointer appearance-none bg-transparent accent-primary
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground
            [&::-webkit-slider-thumb]:shadow-glow-sm [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{hint}</span>
        {baseline != null && (
          <span className={cn('font-mono', drifted ? 'text-amber-400/80' : 'text-muted-foreground/60')}>
            {drifted ? `≠ default ${format(baseline)}` : 'default'}
          </span>
        )}
      </div>
    </div>
  );
}

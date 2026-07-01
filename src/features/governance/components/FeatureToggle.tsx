import { cn } from '@/lib/utils';

interface Props {
  label:     string;
  hint?:     string;
  icon:      React.ElementType;
  enabled:   boolean;
  disabled?: boolean;
  /** Server default — shows a subtle "drifted from default" marker. */
  baseline?: boolean;
  accent?:   'neon' | 'plasma';
  onChange:  (v: boolean) => void;
}

/**
 * A governed feature flag rendered as a glowing sci-fi switch. Used for the
 * boolean knobs (Cross-Encoder, grounding, query-rewrite). Purely presentational
 * — the parent owns draft state and persistence.
 */
export function FeatureToggle({
  label, hint, icon: Icon, enabled, disabled, baseline, accent = 'neon', onChange,
}: Props) {
  const drifted = baseline != null && baseline !== enabled;
  const onColor = accent === 'neon' ? 'bg-neon' : 'bg-plasma';
  const glow    = accent === 'neon' ? 'shadow-glow' : 'shadow-glow-plasma';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300',
        enabled ? 'border-neon/30 bg-neon/[0.04]' : 'border-white/8 bg-card/40',
        !disabled && 'hover:-translate-y-0.5 hover:border-neon/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          enabled ? 'bg-neon/15 text-neon' : 'bg-white/5 text-muted-foreground',
        )}
      >
        <Icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', enabled && 'drop-glow')} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {drifted && (
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-amber-400/90">
              modified
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>

      {/* Track */}
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300',
          enabled ? cn(onColor, 'border-transparent', glow) : 'border-white/15 bg-white/5',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all duration-300',
            'h-[18px] w-[18px]',
            enabled ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

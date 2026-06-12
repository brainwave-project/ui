import { Fragment } from 'react';
import { cn } from '@/lib/utils';

export interface PipelineStage {
  key:    string;
  label:  string;
  sub?:   string;
  icon:   React.ElementType;
  count?: number;
  /** Visual emphasis: 'active' nodes pulse, 'idle' are dim. */
  tone?:  'neon' | 'plasma' | 'amber' | 'muted';
}

const TONE: Record<NonNullable<PipelineStage['tone']>, { ring: string; text: string; glow: string }> = {
  neon:   { ring: 'border-neon/50 bg-neon/10',       text: 'text-neon',          glow: 'shadow-glow-inner' },
  plasma: { ring: 'border-plasma/50 bg-plasma/10',   text: 'text-plasma',        glow: 'shadow-glow-plasma' },
  amber:  { ring: 'border-amber-400/50 bg-amber-400/10', text: 'text-amber-300', glow: '' },
  muted:  { ring: 'border-white/10 bg-white/5',      text: 'text-muted-foreground', glow: '' },
};

/**
 * Horizontal ingestion pipeline — a live schematic of how a document flows from
 * upload to a concept-searchable vector. Connectors animate to convey motion.
 */
export function PipelineFlow({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex items-stretch overflow-x-auto pb-2">
      {stages.map((s, i) => {
        const tone = TONE[s.tone ?? 'muted'];
        const Icon = s.icon;
        return (
          <Fragment key={s.key}>
            <div className="flex min-w-[96px] flex-col items-center gap-2 text-center">
              <div
                className={cn(
                  'relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all',
                  tone.ring, tone.glow,
                )}
              >
                <Icon className={cn('h-6 w-6', tone.text)} />
                {s.count != null && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/10 bg-background px-1 font-mono text-[10px] font-semibold text-foreground">
                    {s.count}
                  </span>
                )}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                {s.sub && <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{s.sub}</p>}
              </div>
            </div>

            {i < stages.length - 1 && (
              <div className="relative mt-7 h-px min-w-[28px] flex-1 self-start bg-white/10">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-neon to-transparent animate-shimmer" />
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

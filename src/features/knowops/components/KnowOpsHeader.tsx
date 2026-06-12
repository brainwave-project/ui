import { cn } from '@/lib/utils';

interface Props {
  icon:    React.ElementType;
  title:   string;
  kicker:  string;
  desc?:   string;
  accent?: 'neon' | 'plasma' | 'aurora';
  actions?: React.ReactNode;
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  neon:   'text-neon',
  plasma: 'text-plasma',
  aurora: 'text-aurora',
};

/** Consistent page identity band across all Know Ops surfaces. */
export function KnowOpsHeader({ icon: Icon, title, kicker, desc, accent = 'neon', actions }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 shadow-glow-inner', ACCENT[accent])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Know Ops · <span className={ACCENT[accent]}>{kicker}</span>
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          {desc && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

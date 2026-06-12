import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  icon:    React.ElementType;
  label:   string;
  value?:  number | string;
  /** Small caption under the value (e.g. "of 128 total"). */
  caption?: string;
  to?:     string;
  loading?: boolean;
  accent?: 'neon' | 'plasma' | 'aurora' | 'emerald';
  delay?:  number;
}

const ACCENT: Record<NonNullable<Props['accent']>, { icon: string; bg: string }> = {
  neon:    { icon: 'text-neon',          bg: 'group-hover:bg-neon/15' },
  plasma:  { icon: 'text-plasma',        bg: 'group-hover:bg-plasma/15' },
  aurora:  { icon: 'text-aurora',        bg: 'group-hover:bg-aurora/15' },
  emerald: { icon: 'text-emerald-400',   bg: 'group-hover:bg-emerald-400/15' },
};

export function StatTile({
  icon: Icon, label, value, caption, to, loading, accent = 'neon', delay = 0,
}: Props) {
  const acc = ACCENT[accent];

  const body = (
    <Card className="group relative h-full overflow-hidden hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-neon/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 transition-colors', acc.icon, acc.bg)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
        ) : (
          <p className="font-display text-3xl font-bold tabular-nums">
            {value ?? <span className="text-muted-foreground/40">—</span>}
          </p>
        )}
        {caption && !loading && (
          <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>
        )}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
        {body}
      </Link>
    );
  }
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      {body}
    </div>
  );
}

import { useRef, useState, type ElementType, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  AlertOctagon, AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  GraduationCap, Info, Loader2, Lock, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useJob } from '@/features/evaluation/hooks/useEval';
import type { Severity } from '@/types/eval';

/* ── Layout ──────────────────────────────────────────────────────────────── */

export function Panel({
  title, icon: Icon, subtitle, actions, children, className, bodyClassName,
}: {
  title: ReactNode; icon?: React.ElementType; subtitle?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <Card className={cn('holo-border', className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-4 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-neon" />}
            {title}
          </CardTitle>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('p-4 pt-0', bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

/** "Principal's note" — the why behind a control, collapsed until you want the lecture. */
export function PrincipalNote({
  title, children, className, defaultOpen = false,
}: {
  title: string; children: ReactNode; className?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn(
      'overflow-hidden rounded-xl border transition-colors duration-300',
      open ? 'border-neon/35 bg-neon/[0.07]' : 'border-neon/15 bg-neon/[0.03] hover:border-neon/30',
      className,
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
          open ? 'bg-neon/20 text-neon' : 'bg-white/5 text-neon/80',
        )}>
          <GraduationCap className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-semibold text-neon">
          Principal’s note · {title}
        </span>
        <ChevronDown className={cn(
          'h-3.5 w-3.5 shrink-0 text-neon/70 transition-transform duration-300',
          open && 'rotate-180',
        )} />
      </button>
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground [&_strong]:text-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Numbered, collapsible workspace block. */
export function WorkSection({
  step, title, blurb, icon: Icon, badges, defaultOpen = false, children,
}: {
  step: number;
  title: string;
  blurb: string;
  icon: React.ElementType;
  badges?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn(
      'overflow-hidden rounded-2xl border transition-all duration-300',
      open ? 'border-neon/35 bg-card/50 shadow-glow-inner' : 'border-white/8 bg-card/20 hover:border-white/18',
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left"
        aria-expanded={open}
      >
        <span className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold transition-all duration-300',
          open ? 'bg-neon text-primary-foreground shadow-glow' : 'bg-white/5 text-muted-foreground',
        )}>
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('flex items-center gap-2 font-display text-base font-semibold', open ? 'text-neon' : 'text-foreground')}>
            <Icon className="h-4 w-4 shrink-0" /> {title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
        </div>
        {badges && <div className="hidden flex-wrap justify-end gap-1 sm:flex">{badges}</div>}
        <ChevronDown className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
          open && 'rotate-180 text-neon',
        )} />
      </button>
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-white/5 p-4">
            {badges && <div className="flex flex-wrap gap-1 sm:hidden">{badges}</div>}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Pager({
  page, pageSize, total, onPage, className,
}: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void; className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (total === 0) return null;
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 pt-3', className)}>
      <p className="text-[11px] text-muted-foreground">Showing {from}–{to} of {total}</p>
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={safePage <= 1}
            onClick={() => onPage(safePage - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === safePage ? 'default' : 'ghost'}
              className={cn('h-7 min-w-[28px] px-1.5 font-mono text-[11px]', n === safePage && 'shadow-glow-sm')}
              onClick={() => onPage(n)}
            >
              {n}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={safePage >= totalPages}
            onClick={() => onPage(safePage + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LockedBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
      <div>{children}</div>
    </div>
  );
}

/* ── Status ──────────────────────────────────────────────────────────────── */

const SEVERITY: Record<Severity, { icon: React.ElementType; label: string; cls: string }> = {
  blocker: { icon: AlertOctagon,  label: 'Blocker', cls: 'border-red-500/30 bg-red-500/10 text-red-400' },
  warning: { icon: AlertTriangle, label: 'Warning', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  info:    { icon: Info,          label: 'Info',    cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  pass:    { icon: CheckCircle2,  label: 'Pass',    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', s.cls, className)}>
      <s.icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY[severity];
  return <s.icon className={cn('h-4 w-4 shrink-0', s.cls.split(' ').find((c) => c.startsWith('text-')), className)} />;
}

type Tone = 'neutral' | 'neon' | 'good' | 'warn' | 'bad' | 'info';
const TONE: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/5 text-muted-foreground',
  neon:    'border-neon/30 bg-neon/10 text-neon',
  good:    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  warn:    'border-amber-500/30 bg-amber-500/10 text-amber-300',
  bad:     'border-red-500/30 bg-red-500/10 text-red-400',
  info:    'border-sky-500/30 bg-sky-500/10 text-sky-300',
};

export function Pill({ children, tone = 'neutral', className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium', TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-white/8 bg-card/40 px-3 py-2', className)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Form controls ───────────────────────────────────────────────────────── */

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('block space-y-1', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-snug text-muted-foreground/80">{hint}</span>}
    </div>
  );
}

const controlCls =
  'w-full rounded-md border border-input bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-neon/50 disabled:cursor-not-allowed disabled:opacity-60';

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlCls, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlCls, 'min-h-[80px] font-mono text-xs leading-relaxed', props.className)} />;
}

export function SelectBox<T extends string | number>({
  value, onChange, options, disabled, className, placeholder = 'Select…',
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
  disabled?: boolean; className?: string; placeholder?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuWidth, setMenuWidth] = useState<number>();
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > 8;
  const filtered = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const w = triggerRef.current?.getBoundingClientRect().width;
          if (w) setMenuWidth(w);
        } else {
          setQuery('');
        }
      }}
    >
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            controlCls,
            'flex h-9 items-center gap-2 py-0 text-left',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-neon',
          )} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          collisionPadding={10}
          style={{ width: menuWidth, minWidth: menuWidth }}
          className={cn(
            'z-[80] overflow-hidden rounded-xl border border-white/12 p-1 shadow-panel',
            'bg-[hsl(var(--popover)/0.96)] backdrop-blur-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
        >
          {searchable && (
            <div className="relative mb-1 px-0.5 pt-0.5" onKeyDown={(e) => e.stopPropagation()}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-neon/40"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-0.5">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches</p>
            )}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <DropdownMenu.Item
                  key={`${typeof o.value}:${String(o.value)}`}
                  title={o.label}
                  onSelect={() => onChange(o.value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none',
                    'data-[highlighted]:bg-neon/15 data-[highlighted]:text-foreground',
                    active ? 'text-neon' : 'text-muted-foreground',
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs text-muted-foreground disabled:opacity-50"
    >
      <span className={cn('relative h-4 w-7 rounded-full transition-colors', checked ? 'bg-neon/70' : 'bg-white/15')}>
        <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', checked ? 'left-3.5' : 'left-0.5')} />
      </span>
      <span className={checked ? 'text-foreground' : ''}>{label}</span>
    </button>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, className, size = 'sm',
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; disabled?: boolean }[];
  className?: string; size?: 'sm' | 'xs';
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-white/10 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[11px]',
            value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SubTabs<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; icon: ElementType; count?: ReactNode }[];
  label: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.id === value));
  const n = options.length;
  return (
    <div className="border-t border-white/5 px-3 py-2.5 sm:px-4" role="tablist" aria-label={label}>
      <div
        className="relative grid rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/30 p-1 shadow-inner"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-lg border border-neon/40 bg-neon/15 shadow-glow-inner transition-all duration-300 ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${n})`,
            left: `calc(0.25rem + ${i} * (100% - 0.5rem) / ${n})`,
          }}
        />
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.id)}
              className={cn(
                'relative z-10 flex min-h-[2.25rem] items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-200',
                active ? 'text-neon' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <o.icon className={cn('h-3.5 w-3.5 shrink-0', active && 'drop-glow')} />
              <span className="truncate">{o.label}</span>
              {o.count != null && o.count !== '' && (
                <span className={cn(
                  'rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums',
                  active ? 'bg-neon/20 text-neon' : 'bg-white/5 text-muted-foreground',
                )}>
                  {o.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Jobs ────────────────────────────────────────────────────────────────── */

export function JobBar({ jobId, className }: { jobId: string | null; className?: string }) {
  const { data: job } = useJob(jobId);
  if (!jobId || !job) return null;
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <div className={cn('rounded-lg border border-white/8 bg-card/40 p-2.5', className)}>
      <div className="flex items-center gap-2 text-xs">
        {job.status === 'running'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" />
          : job.status === 'done'
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            : <AlertOctagon className="h-3.5 w-3.5 text-red-400" />}
        <span className="font-medium">{job.label}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {job.status === 'running' ? `${job.done}/${job.total}` : job.status}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all', job.status === 'failed' ? 'bg-red-500' : 'bg-neon')}
          style={{ width: `${job.status === 'done' ? 100 : pct}%` }}
        />
      </div>
      {job.message && job.status === 'running' && (
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{job.message}</p>
      )}
      {job.error && <p className="mt-1 font-mono text-[10px] text-red-400">{job.error}</p>}
    </div>
  );
}

/** Download text through a Blob — keeps exports client-side. */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

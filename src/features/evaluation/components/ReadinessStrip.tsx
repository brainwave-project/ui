import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertOctagon, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from '@/components/ui/sheet';
import { Pill, PrincipalNote, SeverityBadge, SeverityIcon, Segmented, EmptyState } from '@/features/evaluation/components/EvalPrimitives';
import { resolveFix } from '@/features/evaluation/lib/fixTargets';
import type { DatasetBundle, ReadinessCheck, ReadinessReport, Severity } from '@/types/eval';

const VERDICT = {
  ready:              { label: 'Ready to evaluate',        tone: 'text-emerald-400', icon: CheckCircle2,  ring: 'border-emerald-500/30 bg-emerald-500/[0.05]' },
  ready_with_caveats: { label: 'Ready — with caveats',     tone: 'text-amber-300',   icon: AlertTriangle, ring: 'border-amber-500/30 bg-amber-500/[0.05]' },
  not_ready:          { label: 'Not ready — fix blockers', tone: 'text-red-400',     icon: AlertOctagon,  ring: 'border-red-500/30 bg-red-500/[0.05]' },
} as const;

const isProblem = (s: Severity) => s === 'blocker' || s === 'warning';

/**
 * The dataset's readiness, kept in view at all times.
 *
 * Readiness used to be a destination you navigated to, which meant the defect
 * and its repair were never on screen together. Here the verdict stays put and
 * the detail opens beside your work, so acting on a check never costs you your
 * place.
 */
export function ReadinessStrip({
  report, bundle, loading, className, onReview,
}: {
  report: ReadinessReport | undefined;
  bundle: DatasetBundle;
  loading?: boolean;
  className?: string;
  onReview?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const checks = report?.checks ?? [];
  const blockers = report?.counts.blocker ?? 0;
  const warnings = report?.counts.warning ?? 0;
  const problems = blockers + warnings;
  const verdict = report ? VERDICT[report.verdict] : null;
  const Icon = verdict?.icon ?? Loader2;

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2',
          verdict?.ring ?? 'border-white/10 bg-card/30',
          className,
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', verdict?.tone ?? 'animate-spin text-muted-foreground')} />
        <span className={cn('text-sm font-medium', verdict?.tone ?? 'text-muted-foreground')}>
          {verdict?.label ?? 'Assessing readiness…'}
        </span>

        {report && (
          <span className="flex flex-wrap items-center gap-1.5">
            {blockers > 0 && <Pill tone="bad">{blockers} blocker{blockers === 1 ? '' : 's'}</Pill>}
            {warnings > 0 && <Pill tone="warn">{warnings} warning{warnings === 1 ? '' : 's'}</Pill>}
            {problems === 0 && <Pill tone="good">nothing to fix</Pill>}
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1.5 text-xs"
          disabled={!report && !loading}
          onClick={() => onReview ? onReview() : setOpen(true)}
        >
          Review {problems > 0 && <span className="font-mono">{problems}</span>}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ReadinessDrawer
        open={open}
        onOpenChange={setOpen}
        checks={checks}
        bundle={bundle}
        loading={loading}
      />
    </>
  );
}

function ReadinessDrawer({
  open, onOpenChange, checks, bundle, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checks: ReadinessCheck[];
  bundle: DatasetBundle;
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<'problems' | 'all'>('problems');
  const shown = filter === 'problems' ? checks.filter((c) => isProblem(c.severity)) : checks;
  const problems = checks.filter((c) => isProblem(c.severity)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Readiness checks</SheetTitle>
          <SheetDescription>
            Each check names the specific way a number would mislead you.
          </SheetDescription>
          <div className="mt-3">
            <Segmented
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'problems', label: `Problems ${problems}` },
                { value: 'all', label: `All ${checks.length}` },
              ]}
            />
          </div>
        </SheetHeader>

        <SheetBody>
          {loading && checks.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-card/30" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={filter === 'problems' ? 'No blockers or warnings' : 'No checks'}>
              {filter === 'problems'
                ? 'Nothing is standing between this dataset and a defensible number.'
                : 'Run a readiness assessment to see checks here.'}
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {shown.map((check) => (
                <CheckRow key={check.id} check={check} bundle={bundle} onNavigate={() => onOpenChange(false)} />
              ))}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function CheckRow({
  check, bundle, onNavigate,
}: {
  check: ReadinessCheck;
  bundle: DatasetBundle;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const [openWhy, setOpenWhy] = useState(false);
  const fix = resolveFix(check, bundle);

  const go = (to: string) => {
    onNavigate();
    navigate(to);
  };

  return (
    <div className="rounded-xl border border-white/8 bg-card/30 p-3">
      <div className="flex items-start gap-2">
        <SeverityIcon severity={check.severity} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{check.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
        </div>
        <SeverityBadge severity={check.severity} className="shrink-0" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-5">
        {fix && (
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => go(fix.to)}>
            {fix.label} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {fix?.alt && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-neon hover:underline"
            onClick={() => go(fix.alt!.to)}
          >
            {fix.alt.label}
          </button>
        )}
        {check.learn && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-neon hover:underline"
            onClick={() => setOpenWhy((v) => !v)}
          >
            {openWhy ? 'hide why' : 'why it matters'}
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">{check.id}</span>
      </div>

      {openWhy && (
        <div className="mt-2 pl-5">
          <PrincipalNote title="why it matters" defaultOpen>{check.learn}</PrincipalNote>
        </div>
      )}

      {check.affected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-5">
          {check.affected.slice(0, 8).map((a) => <Pill key={a}>{a}</Pill>)}
          {check.affected.length > 8 && (
            <Pill tone="neutral">+{check.affected.length - 8} more</Pill>
          )}
        </div>
      )}
    </div>
  );
}

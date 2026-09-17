import { useEffect, useMemo, useState, type ElementType } from 'react';
import {
  Activity, AlertOctagon, AlertTriangle, ArrowLeft, BarChart3, CheckCircle2,
  ListChecks, Microscope, Scissors, Sigma,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import {
  useDatasetMutation, useReadiness, useRuns, useSelectedDataset,
} from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Pager, Panel, Pill, PrincipalNote, SelectBox, SeverityBadge, SeverityIcon,
  Stat, SubTabs, TextField, Toggle,
} from '@/features/evaluation/components/EvalPrimitives';
import { PowerCurve, SplitBars } from '@/features/evaluation/components/charts';
import { detectableEffect, minSampleSize, shortHash } from '@/features/evaluation/lib/evalStats';
import type { DatasetBundle, ReadinessCheck, ReadinessReport, Severity, SplitConfig, StratifyAttr } from '@/types/eval';

const PAGE_SIZE = 10;
const K_OPTIONS = [1, 3, 5, 10, 20, 50].map((n) => ({ value: n, label: `k = ${n}` }));

const VERDICT = {
  ready:              { label: 'Ready to evaluate',          tone: 'text-emerald-400', icon: CheckCircle2, ring: 'border-emerald-500/30 bg-emerald-500/[0.05]' },
  ready_with_caveats: { label: 'Ready — with caveats',       tone: 'text-amber-300',   icon: AlertTriangle, ring: 'border-amber-500/30 bg-amber-500/[0.05]' },
  not_ready:          { label: 'Not ready — fix blockers',   tone: 'text-red-400',     icon: AlertOctagon,  ring: 'border-red-500/30 bg-red-500/[0.05]' },
} as const;

const CATEGORY_ORDER = ['Integrity', 'Labels', 'Leakage', 'Coverage', 'Split', 'Power', 'Index'];

type LabTab = 'checks' | 'split' | 'power' | 'profile';
type CheckFilter = 'problems' | 'all';

export function DataLabPage() {
  const { data: bundle, datasetId } = useSelectedDataset();
  const [k, setK] = useState(5);
  const [sd, setSd] = useState<number | undefined>(undefined);
  const [tab, setTab] = useState<LabTab>('checks');
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('problems');
  const readiness = useReadiness(k, sd);
  const runs = useRuns(datasetId);

  const runSd = useMemo(() => {
    const run = (runs.data ?? []).find((r) => r.status === 'done' && r.aggregates['recall@k']);
    return run ? { sd: run.aggregates['recall@k'].sd, id: run.id } : null;
  }, [runs.data]);

  if (!datasetId || !bundle) {
    return (
      <EmptyState icon={Microscope} title="Select or create a dataset first">
        Use the dataset picker above, or create one under Dataset Construction.
      </EmptyState>
    );
  }

  const report = readiness.data;
  const checks = report?.checks ?? [];
  const problemCount = checks.filter((c) => c.severity === 'blocker' || c.severity === 'warning').length;
  const tabs: { id: LabTab; step: string; title: string; blurb: string; icon: ElementType }[] = [
    { id: 'checks',  step: '1', title: 'Checks',  blurb: 'Readiness before you run',     icon: ListChecks },
    { id: 'split',   step: '2', title: 'Split',   blurb: 'Dev vs holdout, no leakage',   icon: Scissors },
    { id: 'power',   step: '3', title: 'Power',   blurb: 'What this n can actually see', icon: Sigma },
    { id: 'profile', step: '4', title: 'Profile', blurb: 'Coverage per stratum',         icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
        <nav className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4" aria-label="Data Lab stages">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4',
                  active ? 'bg-card/80' : 'bg-card/20 hover:bg-white/[0.04]',
                )}
              >
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all',
                  active ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-white/5 text-muted-foreground',
                )}>
                  {t.step}
                </span>
                <span className="min-w-0">
                  <span className={cn('flex items-center gap-1.5 text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>
                    <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.title}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground md:block">{t.blurb}</span>
                </span>
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-neon shadow-glow-sm" />}
              </button>
            );
          })}
        </nav>
        {tab === 'checks' && (
          <SubTabs
            label="Checks"
            value={checkFilter}
            onChange={setCheckFilter}
            options={[
              { id: 'problems', label: 'Problems', icon: AlertOctagon, count: problemCount },
              { id: 'all', label: 'All checks', icon: ListChecks, count: checks.length },
            ]}
          />
        )}
      </div>

      <div key={tab} className="animate-fade-in space-y-4">
        {tab === 'checks' && (
          <>
            {report ? (
              <VerdictBanner
                verdict={report.verdict}
                counts={report.counts}
                stats={report.stats}
                checks={checks}
                name={bundle.meta.name}
                version={bundle.manifest.version}
                status={bundle.manifest.status}
              />
            ) : readiness.isFetching ? (
              <div className="h-28 animate-pulse rounded-xl border border-white/8 bg-card/30" />
            ) : null}
            <ChecksPanel
              checks={checks}
              loading={readiness.isFetching}
              filter={checkFilter}
              k={k}
              setK={setK}
            />
          </>
        )}
        {tab === 'split' && <SplitDesigner bundle={bundle} />}
        {tab === 'power' && (
          <PowerPanel
            devN={report?.stats.dev ?? 0}
            holdoutN={report?.stats.holdout ?? 0}
            sd={sd ?? report?.stats.score_sd ?? 0.35}
            runSd={runSd}
            onUseSd={setSd}
          />
        )}
        {tab === 'profile' && (report
          ? <ProfilePanel stats={report.stats} />
          : <Panel title="Dataset profile" icon={BarChart3}><EmptyState icon={BarChart3} title="Assessing profile…" /></Panel>
        )}
      </div>
    </div>
  );
}

/* ── Verdict (Checks only) ───────────────────────────────────────────────── */

const SEV_COLOR: Record<Severity, string> = {
  blocker: '#f87171',
  warning: '#fbbf24',
  info:    '#38bdf8',
  pass:    '#34d399',
};

const SEV_TONE: Record<Severity, 'bad' | 'warn' | 'info' | 'good'> = {
  blocker: 'bad', warning: 'warn', info: 'info', pass: 'good',
};

function useCountUp(value: number, ms = 800) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

function useDrawn(dep: unknown) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [dep]);
  return drawn;
}

function VerdictBanner({
  verdict, counts, stats, checks, name, version, status,
}: {
  verdict: keyof typeof VERDICT;
  counts: Partial<Record<Severity, number>>;
  stats: ReadinessReport['stats'];
  checks: ReadinessCheck[];
  name: string;
  version: number;
  status: string;
}) {
  const V = VERDICT[verdict];
  const blockers = counts.blocker ?? 0;
  const passShare = (() => {
    const total = (['blocker', 'warning', 'info', 'pass'] as const).reduce((s, k) => s + (counts[k] ?? 0), 0);
    return total > 0 ? (counts.pass ?? 0) / total : 0;
  })();
  const answerableShare = stats.items > 0 ? stats.answerable / stats.items : 0;
  const distractorShare = stats.documents > 0 ? stats.distractors / stats.documents : 0;
  const splitTotal = stats.dev + stats.holdout + (stats.split?.unassigned ?? 0);

  const byCategory = CATEGORY_ORDER
    .map((cat) => {
      const rows = checks.filter((c) => c.category === cat);
      return {
        cat,
        blocker: rows.filter((c) => c.severity === 'blocker').length,
        warning: rows.filter((c) => c.severity === 'warning').length,
        rest: rows.filter((c) => c.severity === 'info' || c.severity === 'pass').length,
        total: rows.length,
      };
    })
    .filter((r) => r.total > 0);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 sm:p-5', V.ring)}>
      <div aria-hidden className={cn(
        'pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl animate-aurora-drift',
        verdict === 'not_ready' ? 'bg-red-500/20' : verdict === 'ready_with_caveats' ? 'bg-amber-400/15' : 'bg-emerald-400/15',
      )} />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-white/[0.08] to-transparent animate-scan" />
      </div>

      <div className="relative flex flex-wrap items-start gap-4">
        <div className="relative">
          {blockers > 0 && <span className="absolute inset-0 animate-ripple rounded-2xl bg-red-500/25" />}
          <span className={cn(
            'relative flex h-12 w-12 items-center justify-center rounded-2xl border',
            verdict === 'not_ready' ? 'border-red-500/40 bg-red-500/15 shadow-glow' : V.ring,
          )}>
            <V.icon className={cn('h-6 w-6', V.tone, verdict === 'not_ready' && 'animate-glow-pulse')} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-display text-xl font-bold tracking-tight', V.tone)}>{V.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {name} · v{version} · {status} · hash {shortHash(stats.content_hash)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['blocker', 'warning', 'info', 'pass'] as const).map((s) => (
            <Pill key={s} tone={SEV_TONE[s]}>{counts[s] ?? 0} {s}</Pill>
          ))}
        </div>
      </div>

      <div className="relative mt-5 grid gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="animate-fade-in-up flex justify-center lg:justify-start" style={{ animationDelay: '40ms' }}>
          <SeverityRing counts={counts} verdict={verdict} passShare={passShare} />
        </div>

        <div className="animate-fade-in-up min-w-0" style={{ animationDelay: '120ms' }}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Problems by category</p>
          {byCategory.length === 0
            ? <p className="text-xs text-muted-foreground">No checks in this report yet.</p>
            : <CategoryBars rows={byCategory} />}
        </div>

        <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '200ms' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Split &amp; coverage</p>
          <StackMeter
            label="Dev / holdout"
            total={splitTotal}
            segments={[
              { label: 'dev', value: stats.dev, color: '#3987e5' },
              { label: 'holdout', value: stats.holdout, color: '#199e70' },
              { label: 'unassigned', value: stats.split?.unassigned ?? 0, color: 'rgba(255,255,255,0.22)' },
            ]}
          />
          <Meter label="Answerable" value={stats.answerable} of={stats.items} color="#34d399" share={answerableShare} />
          <Meter label="Distractors" value={stats.distractors} of={stats.documents} color="#fbbf24" share={distractorShare} />
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {([
          ['Items', stats.items],
          ['Answerable', stats.answerable],
          ['Docs', stats.documents],
          ['Distractors', stats.distractors],
          ['Dev', stats.dev],
          ['Holdout', stats.holdout],
        ] as const).map(([label, value], i) => (
          <div key={label} className="animate-fade-in-up rounded-lg border border-white/8 bg-black/20 px-3 py-2" style={{ animationDelay: `${240 + i * 50}ms` }}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground"><CountUp value={value} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

function SeverityRing({
  counts, verdict, passShare,
}: {
  counts: Partial<Record<Severity, number>>;
  verdict: keyof typeof VERDICT;
  passShare: number;
}) {
  const drawn = useDrawn(JSON.stringify(counts));
  const segs = (['blocker', 'warning', 'info', 'pass'] as const)
    .map((key) => ({ key, value: counts[key] ?? 0, color: SEV_COLOR[key] }))
    .filter((s) => s.value > 0);
  const total = segs.reduce((s, x) => s + x.value, 0);
  const blockers = counts.blocker ?? 0;
  const R = 52;
  const SW = 12;
  const C = 2 * Math.PI * R;
  const GAP = segs.length > 1 ? 5 : 0;
  const usable = C - segs.length * GAP;
  let cursor = 0;
  const arcs = segs.map((s) => {
    const len = total > 0 ? (s.value / total) * usable : 0;
    const arc = { ...s, len, offset: -cursor };
    cursor += len + GAP;
    return arc;
  });
  const innerR = 38;
  const innerC = 2 * Math.PI * innerR;
  const center = useCountUp(blockers > 0 ? blockers : Math.round(passShare * 100));

  return (
    <div className="relative h-[168px] w-[168px]">
      <svg viewBox="0 0 168 168" className="h-full w-full">
        <g className={verdict === 'not_ready' ? 'animate-spin-slow' : undefined} style={{ transformOrigin: '84px 84px' }}>
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * 2 * Math.PI - Math.PI / 2;
            const r1 = 80, r2 = i % 3 === 0 ? 74 : 77;
            return (
              <line key={i}
                x1={84 + Math.cos(a) * r1} y1={84 + Math.sin(a) * r1}
                x2={84 + Math.cos(a) * r2} y2={84 + Math.sin(a) * r2}
                stroke={verdict === 'not_ready' ? 'rgba(248,113,113,0.28)' : 'hsl(var(--neon) / 0.18)'}
                strokeWidth={i % 3 === 0 ? 1.5 : 1}
              />
            );
          })}
        </g>
        <circle cx={84} cy={84} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
        <g transform="rotate(-90 84 84)">
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={84} cy={84} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={SW}
              strokeDasharray={drawn ? `${a.len} ${C - a.len}` : `0 ${C}`}
              strokeDashoffset={a.offset}
              style={{
                transition: 'stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)',
                filter: `drop-shadow(0 0 6px ${a.color})`,
              }}
            />
          ))}
        </g>
        <circle cx={84} cy={84} r={innerR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <g transform="rotate(-90 84 84)">
          <circle
            cx={84} cy={84} r={innerR}
            fill="none"
            stroke={verdict === 'not_ready' ? SEV_COLOR.blocker : SEV_COLOR.pass}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={drawn ? `${passShare * innerC} ${innerC}` : `0 ${innerC}`}
            style={{ transition: 'stroke-dasharray 1s 0.15s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display text-3xl font-bold tabular-nums', VERDICT[verdict].tone)}>{center}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {blockers > 0 ? 'blockers' : 'pass %'}
        </span>
      </div>
    </div>
  );
}

function CategoryBars({
  rows,
}: {
  rows: { cat: string; blocker: number; warning: number; rest: number; total: number }[];
}) {
  const drawn = useDrawn(rows.map((r) => r.total).join(','));
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.cat} className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[11px]">
          <span className="truncate font-mono text-muted-foreground" title={r.cat}>{r.cat}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div className="flex h-full" style={{ width: drawn ? `${(r.total / max) * 100}%` : 0, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }}>
              {r.blocker > 0 && <div className="h-full" style={{ flex: r.blocker, background: SEV_COLOR.blocker }} />}
              {r.warning > 0 && <div className="h-full" style={{ flex: r.warning, background: SEV_COLOR.warning }} />}
              {r.rest > 0 && <div className="h-full" style={{ flex: r.rest, background: 'rgba(255,255,255,0.18)' }} />}
            </div>
          </div>
          <span className="text-right font-mono tabular-nums text-muted-foreground">{r.blocker + r.warning}/{r.total}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: SEV_COLOR.blocker }} /> blocker</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: SEV_COLOR.warning }} /> warning</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-white/20" /> other</span>
      </div>
    </div>
  );
}

function StackMeter({
  label, segments, total,
}: {
  label: string;
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const drawn = useDrawn(total);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{total}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {segments.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            style={{
              width: drawn && total > 0 ? `${(s.value / total) * 100}%` : 0,
              background: s.color,
              transition: 'width 0.85s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label} {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function Meter({ label, value, of, color, share }: { label: string; value: number; of: number; color: string; share: number }) {
  const drawn = useDrawn(`${value}/${of}`);
  const pct = Math.round(share * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{value}/{of} · {pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{
            width: drawn ? `${Math.min(100, pct)}%` : 0,
            background: color,
            boxShadow: `0 0 10px ${color}66`,
            transition: 'width 0.85s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  );
}

/* ── Checks ──────────────────────────────────────────────────────────────── */

function ChecksPanel({
  checks, loading, filter, k, setK,
}: {
  checks: ReadinessCheck[];
  loading: boolean;
  filter: CheckFilter;
  k: number;
  setK: (k: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSelectedId(null);
    setPage(1);
  }, [filter]);

  const shown = useMemo(
    () => checks.filter((c) => filter === 'all' || c.severity === 'blocker' || c.severity === 'warning'),
    [checks, filter],
  );
  const selected = shown.find((c) => c.id === selectedId) ?? null;

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const grouped = CATEGORY_ORDER
    .map((cat) => [cat, slice.filter((c) => c.category === cat)] as const)
    .filter(([, cs]) => cs.length);

  const kOptions = K_OPTIONS.some((o) => o.value === k) ? K_OPTIONS : [{ value: k, label: `k = ${k}` }, ...K_OPTIONS];

  return (
    <Panel
      title={selected ? selected.title : 'Readiness checks'}
      icon={Microscope}
      subtitle={selected
        ? selected.detail
        : loading ? 'assessing…' : 'Each check names the specific way a number would mislead you.'}
      actions={
        selected ? (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-3.5 w-3.5" /> List
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">@k</span>
            <SelectBox value={k} onChange={setK} options={kOptions} className="h-8 w-[7.75rem] text-xs" />
          </div>
        )
      }
    >
      {selected ? (
        <CheckDetail check={selected} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={filter === 'problems' ? 'No blockers or warnings' : 'No checks'} />
      ) : (
        <>
          <div className="space-y-4">
            {grouped.map(([cat, cs]) => (
              <div key={cat}>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{cat}</p>
                <div className="space-y-1.5">
                  {cs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-white/8 bg-card/30 p-2.5 text-left transition-colors hover:border-neon/35 hover:bg-white/[0.03]"
                    >
                      <SeverityIcon severity={c.severity} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{c.detail}</p>
                      </div>
                      <SeverityBadge severity={c.severity} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Pager page={safePage} pageSize={PAGE_SIZE} total={shown.length} onPage={(p) => { setPage(p); setSelectedId(null); }} />
        </>
      )}
    </Panel>
  );
}

function CheckDetail({ check }: { check: ReadinessCheck }) {
  const [page, setPage] = useState(1);
  const total = check.affected.length;
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const slice = check.affected.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div key={check.id} className="animate-fade-in space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={check.severity} />
        <Pill>{check.category}</Pill>
        <span className="font-mono text-[11px] text-muted-foreground">{check.id}</span>
      </div>
      <PrincipalNote title="why it matters" defaultOpen>{check.learn}</PrincipalNote>
      {total > 0 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Affected · {total}
          </p>
          <div className="flex flex-wrap gap-1">
            {slice.map((a) => <Pill key={a}>{a}</Pill>)}
          </div>
          <Pager page={safePage} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

/* ── Split designer ──────────────────────────────────────────────────────── */

function SplitDesigner({ bundle }: { bundle: DatasetBundle }) {
  const locked = bundle.manifest.status === 'frozen';
  const initial: SplitConfig = bundle.manifest.split_config ?? {
    holdout_fraction: 0.3, seed: 20260915, stratify_by: ['difficulty'], group_by: 'primary_doc',
  };
  const [config, setConfig] = useState<SplitConfig>(initial);
  const apply = useDatasetMutation(() => evalApi.split(bundle.meta.id, bundle.manifest.version, config).then((r) => r.bundle), 'Split assigned');
  const summary = bundle.split_summary;

  const toggleStrat = (attr: StratifyAttr, on: boolean) =>
    setConfig((c) => ({ ...c, stratify_by: on ? [...c.stratify_by, attr] : c.stratify_by.filter((a) => a !== attr) }));

  return (
    <Panel title="Dev / holdout split" icon={Scissors}
      subtitle={`${summary.dev} dev · ${summary.holdout} holdout · ${summary.pinned} pinned${summary.unassigned ? ` · ${summary.unassigned} unassigned` : ''}`}>
      <div className="space-y-4">
        <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
          <Field label={`Holdout fraction · ${Math.round(config.holdout_fraction * 100)}%`}>
            <input type="range" min={0.1} max={0.5} step={0.05} value={config.holdout_fraction}
              onChange={(e) => setConfig({ ...config, holdout_fraction: Number(e.target.value) })} className="w-full accent-[hsl(var(--neon))]" />
          </Field>
          <Field label="Seed" hint="Same seed + same items → same split, on any machine.">
            <TextField type="number" value={config.seed} onChange={(e) => setConfig({ ...config, seed: Number(e.target.value) })} />
          </Field>
          <Field label="Stratify by" hint="Each stratum is split separately.">
            <div className="flex flex-wrap gap-3 pt-1">
              {(['difficulty', 'trap', 'lang'] as StratifyAttr[]).map((a) => (
                <Toggle key={a} checked={config.stratify_by.includes(a)} onChange={(on) => toggleStrat(a, on)} label={a} disabled={locked} />
              ))}
            </div>
          </Field>
          <Field label="Group by" hint="primary_doc keeps every question about one document on one side.">
            <SelectBox value={config.group_by} disabled={locked} onChange={(v) => setConfig({ ...config, group_by: v })}
              options={[{ value: 'primary_doc', label: 'primary document (no leakage)' }, { value: 'none', label: 'none (per question)' }]} />
          </Field>
        </fieldset>
        {!locked ? (
          <Button size="sm" className="gap-1.5" disabled={!bundle.items.length || apply.isPending} onClick={() => apply.mutate(undefined)}>
            <Scissors className="h-3.5 w-3.5" /> Assign split
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Frozen — the split is part of the content hash. Fork to re-split.</p>
        )}

        {Object.keys(summary.strata).length > 0 && <SplitBars strata={summary.strata} />}
        {summary.straddling_groups.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-2 text-xs">
            <p className="font-medium text-amber-300">{summary.straddling_groups.length} document(s) have questions on both sides</p>
            <div className="mt-1 flex flex-wrap gap-1">{summary.straddling_groups.map((g) => <Pill key={g}>{g}</Pill>)}</div>
          </div>
        )}

        <PrincipalNote title="Dev set, held-out set, leakage">
          Tune on <strong>dev</strong> as much as you like — that is what it is for. The <strong>holdout</strong> answers one
          question, once: does the change generalise? Every look at it that informs a decision converts it into another dev
          set, which is why ad-hoc runs cannot touch it and experiments log each access. Leakage is rarely a duplicated
          question; it is three questions about the same document straddling the split. Grouping by primary document
          prevents that.
        </PrincipalNote>
      </div>
    </Panel>
  );
}

/* ── Power ───────────────────────────────────────────────────────────────── */

function PowerPanel({
  devN, holdoutN, sd, runSd, onUseSd,
}: {
  devN: number; holdoutN: number; sd: number; runSd: { sd: number; id: string } | null; onUseSd: (sd: number | undefined) => void;
}) {
  const [localSd, setLocalSd] = useState(sd);
  const [effect, setEffect] = useState(0.05);
  const [confidence, setConfidence] = useState(0.95);
  const [power, setPower] = useState(0.8);

  const needed = minSampleSize(effect, localSd, confidence, power);
  const mdeDev = detectableEffect(devN, localSd, confidence, power);
  const mdeHold = detectableEffect(holdoutN, localSd, confidence, power);

  return (
    <Panel title="Statistical power" icon={Sigma} subtitle="How big an effect can this split actually see?">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Per-query score sd · ${localSd.toFixed(2)}`}
            hint={runSd ? <button className="text-neon hover:underline" onClick={() => { setLocalSd(runSd.sd); onUseSd(runSd.sd); }}>use recall@k sd {runSd.sd.toFixed(2)} from {runSd.id}</button> : 'Assumed until you have a run. Binary metrics near 0.5 → sd ≈ 0.5.'}>
            <input type="range" min={0.05} max={0.5} step={0.01} value={localSd}
              onChange={(e) => { setLocalSd(Number(e.target.value)); onUseSd(Number(e.target.value)); }} className="w-full accent-[hsl(var(--neon))]" />
          </Field>
          <Field label={`Target effect · ${effect.toFixed(2)}`} hint="The smallest improvement worth acting on.">
            <input type="range" min={0.01} max={0.3} step={0.01} value={effect} onChange={(e) => setEffect(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
          </Field>
          <Field label={`Confidence · ${Math.round(confidence * 100)}%`} hint="The procedure's long-run coverage — not a probability about this interval.">
            <input type="range" min={0.8} max={0.99} step={0.01} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
          </Field>
          <Field label={`Power · ${Math.round(power * 100)}%`} hint="Chance of detecting the target effect if it is real.">
            <input type="range" min={0.5} max={0.95} step={0.05} value={power} onChange={(e) => setPower(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Questions needed" value={Number.isFinite(needed) ? needed : '—'} sub={`to detect ±${effect.toFixed(2)}`} />
          <Stat label="Dev detects" value={Number.isFinite(mdeDev) ? `±${mdeDev.toFixed(2)}` : '—'} sub={`n = ${devN}`} />
          <Stat label="Holdout detects" value={Number.isFinite(mdeHold) ? `±${mdeHold.toFixed(2)}` : '—'} sub={`n = ${holdoutN}`}
            className={mdeHold > effect ? 'border-amber-500/30' : 'border-emerald-500/30'} />
        </div>
        <PowerCurve mdeAt={(n) => detectableEffect(n, localSd, confidence, power)} n={Math.max(holdoutN, 1)} targetEffect={effect} />
        <PrincipalNote title="Power, n, and the importance of zero">
          The detectable effect shrinks with <strong>√n</strong>: quadrupling the questions only halves it. If the holdout can
          only see ±{Number.isFinite(mdeHold) ? mdeHold.toFixed(2) : '∞'}, a real {effect.toFixed(2)} improvement will usually
          produce an interval that <strong>crosses zero</strong> — and “not significant” will mean “too small to see”, not
          “no effect”. Decide this before running anything; afterwards it is tempting to call a miss “trending”.
        </PrincipalNote>
      </div>
    </Panel>
  );
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

function ProfilePanel({ stats }: { stats: NonNullable<ReturnType<typeof useReadiness>['data']>['stats'] }) {
  const groups: [string, Record<string, number>][] = [
    ['difficulty', stats.by_difficulty],
    ['trap', stats.by_trap],
    ['lang', stats.by_lang],
    ['|relevant|', stats.relevant_set_size.distribution],
  ];
  return (
    <Panel title="Dataset profile" icon={BarChart3} subtitle="Coverage per stratum — thin buckets are anecdotes, not measurements.">
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(([name, counts]) => {
          const max = Math.max(1, ...Object.values(counts));
          return (
            <div key={name}>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{name}</p>
              <div className="space-y-1">
                {Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => (
                  <div key={key} className="grid grid-cols-[minmax(0,110px)_1fr_28px] items-center gap-2 text-[11px]" title={`${key}: ${n}`}>
                    <span className="truncate font-mono text-muted-foreground">{key}</span>
                    <div className="h-2.5 rounded-r-[4px] bg-[#3987e5]" style={{ width: `${(n / max) * 100}%` }} />
                    <span className={cn('text-right tabular-nums', n < 5 ? 'text-amber-300' : 'text-muted-foreground')}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-neon" />
        mean relevant-set size {stats.relevant_set_size.mean.toFixed(2)} · amber counts are below 5
      </div>
    </Panel>
  );
}

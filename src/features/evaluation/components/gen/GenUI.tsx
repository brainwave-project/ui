import { type ElementType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CircleSlash, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill } from '@/features/evaluation/components/EvalPrimitives';
import { VIZ } from '@/features/evaluation/components/charts';
import type { MetricResult, StageStatus } from '@/types/evalGen';

/* ── Page chrome (same look as the Stats Lab) ────────────────────────────── */

export interface LabTab<T extends string> { id: T; title: string; blurb: string; icon: ElementType }

export function useUrlTab<T extends string>(tabs: LabTab<T>[]): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab = (tabs.some((t) => t.id === raw) ? raw : tabs[0].id) as T;
  const set = (next: T) => {
    const merged = new URLSearchParams(params);
    if (next === tabs[0].id) merged.delete('tab');
    else merged.set('tab', next);
    setParams(merged);
  };
  return [tab, set];
}

export function LabPage<T extends string>({
  kicker = 'Evaluation', title, blurb, tabs, tab, onTab, children,
}: {
  kicker?: string; title: string; blurb: ReactNode; tabs: LabTab<T>[]; tab: T; onTab: (t: T) => void; children: ReactNode;
}) {
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/40">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-neon/15 blur-3xl" />
        <div className="relative p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">{kicker}</p>
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h3>
          <div className="mt-1 max-w-3xl text-sm text-muted-foreground">{blurb}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
        <nav className={cn('grid gap-px bg-white/5', tabs.length >= 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} type="button" onClick={() => onTab(t.id)}
                className={cn('relative flex items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4', on ? 'bg-card/80' : 'bg-card/20 hover:bg-white/[0.04]')}>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all', on ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-white/5 text-muted-foreground')}>
                  <t.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-medium', on ? 'text-neon' : 'text-foreground')}>{t.title}</span>
                  <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground xl:block">{t.blurb}</span>
                </span>
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-neon shadow-glow-sm" />}
              </button>
            );
          })}
        </nav>
        <div key={tab} className="animate-fade-in p-4 sm:p-5">
          <p className="mb-4 text-xs text-muted-foreground">{active.blurb}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Well({ title, hint, actions, children, className }: {
  title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-white/8 bg-black/20 p-3', className)}>
      {(title || actions) && (
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h4 className="text-xs font-medium">{title}</h4>}
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bench({ controls, children, side = 'minmax(260px,340px)' }: { controls: ReactNode; children: ReactNode; side?: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[var(--side)_minmax(0,1fr)]" style={{ ['--side' as string]: side }}>
      <aside className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">{controls}</aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────────── */

export const pct = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;
export const f2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2));

export function ScoreBar({ value, className }: { value: number | null | undefined; className?: string }) {
  const v = value == null ? null : Math.max(0, Math.min(1, value));
  const color = v == null ? VIZ.muted : v >= 0.8 ? VIZ.good : v >= 0.5 ? '#c98500' : VIZ.bad;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        {v != null && <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color }} />}
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums">{f2(value)}</span>
    </div>
  );
}

/* ── Status chips ────────────────────────────────────────────────────────── */

const STAGE_TONE: Record<StageStatus, 'good' | 'warn' | 'bad' | 'neutral'> = { ok: 'good', warn: 'warn', fail: 'bad', skip: 'neutral' };
const STAGE_ICON: Record<StageStatus, ElementType> = { ok: Check, warn: AlertTriangle, fail: X, skip: CircleSlash };

export function StageChip({ stage, status, title }: { stage: string; status: StageStatus; title?: string }) {
  const Icon = STAGE_ICON[status];
  return <Pill tone={STAGE_TONE[status]} title={title}><Icon className="h-3 w-3" />{stage}</Pill>;
}

export const OUTCOME_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = {
  correct: 'good', correct_abstention: 'good', incorrect: 'bad', false_abstention: 'warn', answered_unanswerable: 'bad',
};

export function OutcomePill({ outcome }: { outcome: string }) {
  return <Pill tone={OUTCOME_TONE[outcome] ?? 'neutral'}>{outcome.replace(/_/g, ' ') || 'error'}</Pill>;
}

export const STAGE_COLOR: Record<string, string> = {
  none: '#0ca30c', ingestion: '#9085e9', retrieval: '#3987e5', rerank: '#199e70', grade: '#c98500', generation: '#d95926',
};

/** Horizontal stacked bar of counts by category. */
export function StackBar({ counts, colors, total }: { counts: Record<string, number>; colors: Record<string, string>; total?: number }) {
  const sum = total ?? Object.values(counts).reduce((a, b) => a + b, 0);
  if (!sum) return <div className="h-3 rounded bg-white/5" />;
  return (
    <div className="flex h-3 overflow-hidden rounded bg-white/5">
      {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
        <div key={k} title={`${k}: ${n}`} style={{ width: `${(n / sum) * 100}%`, background: colors[k] ?? VIZ.muted }} />
      ))}
    </div>
  );
}

/* ── Metric result with its working ─────────────────────────────────────── */

const LABELS: Record<string, string> = {
  faithfulness: 'Faithfulness',
  answer_relevance: 'Answer relevance (rubric)',
  answer_relevance_embedding: 'Answer relevance (embedding, RAGAS method)',
  context_precision: 'Context precision (LLM)',
  context_recall: 'Context recall (LLM)',
  answer_correctness: 'Answer correctness (claim F1)',
  answer_verdict: 'Answer verdict (binary)',
  context_precision_labels: 'Context precision (labels)',
  context_recall_labels: 'Context recall (labels)',
  retrieval_recall_labels: 'Retrieval recall (labels, candidates)',
  answer_ok: 'Answer OK',
  false_abstention: 'False abstention',
  answered_unanswerable: 'Answered unanswerable',
};
export const metricLabel = (m: string) => LABELS[m] ?? m;

function Tick({ ok }: { ok: boolean }) {
  return ok
    ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
    : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />;
}

function Steps({ name, steps }: { name: string; steps: Record<string, unknown>[] }) {
  if (!steps.length) return null;
  const s = steps as Record<string, never>[];
  const row = 'flex items-start gap-2 border-t border-white/5 py-1.5 text-[11px]';
  switch (name) {
    case 'faithfulness':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><Tick ok={st.supported} /><div><p className="text-foreground">{st.claim}</p><p className="text-muted-foreground">{st.reason}</p></div></div>
      ))}</div>;
    case 'context_recall':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><Tick ok={st.attributed} /><div><p className="text-foreground">{st.statement}</p><p className="text-muted-foreground">{st.reason}</p></div></div>
      ))}</div>;
    case 'context_precision':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><Tick ok={st.useful} /><div className="flex-1"><p className="text-foreground">rank {st.rank} · precision@{st.rank} = {f2(st.precision_at_k)}</p><p className="text-muted-foreground">{st.reason}</p></div></div>
      ))}</div>;
    case 'context_precision_labels':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><Tick ok={st.useful} /><p>rank {st.rank} · <span className="font-mono">{st.doc_id}</span> · precision@{st.rank} = {f2(st.precision_at_k)}</p></div>
      ))}</div>;
    case 'context_recall_labels':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><Tick ok={st.found} /><p><span className="font-mono">{st.doc_id}</span> — “{st.span}”</p></div>
      ))}</div>;
    case 'answer_correctness':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}>
          <Pill tone={st.label === 'TP' || st.label === 'covered' ? 'good' : 'bad'} className="mt-0.5">{st.label}</Pill>
          <div><p className="text-foreground"><span className="text-muted-foreground">{st.side}: </span>{st.text}</p><p className="text-muted-foreground">{st.reason}</p></div>
        </div>
      ))}</div>;
    case 'answer_relevance_embedding':
      return <div>{s.map((st, i) => (
        <div key={i} className={row}><span className="w-12 shrink-0 font-mono text-foreground">{f2(st.cosine)}</span><p>{st.generated_question}</p></div>
      ))}</div>;
    case 'answer_relevance':
      return <div>{s.map((st, i) => <div key={i} className={row}><span className="font-mono text-foreground">{st.rubric_score}/5</span><p className="text-muted-foreground">{st.reason}</p></div>)}</div>;
    case 'answer_verdict':
      return <div>{s.map((st, i) => <div key={i} className={row}><Tick ok={st.correct} /><p className="text-muted-foreground">{st.reason}</p></div>)}</div>;
    default:
      return <pre className="overflow-x-auto text-[10px] text-muted-foreground">{JSON.stringify(steps, null, 1)}</pre>;
  }
}

export function MetricCard({ result, failureMode, expect }: { result: MetricResult; failureMode?: string; expect?: string }) {
  const score = result.name === 'answer_verdict' ? null : result.score;
  return (
    <div className="rounded-xl border border-white/8 bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">{metricLabel(result.name)}</p>
        <div className="flex flex-wrap gap-1">
          {result.flags.map((f) => <Pill key={f} tone="warn">{f}</Pill>)}
          {result.calls != null && result.calls > 0 && <Pill>{result.calls} judge call{result.calls === 1 ? '' : 's'}</Pill>}
        </div>
      </div>
      {result.name === 'answer_verdict'
        ? <p className="mt-2 text-sm">{result.score == null ? '—' : result.score === 1 ? <span className="text-emerald-400">correct</span> : <span className="text-red-400">incorrect</span>}</p>
        : <ScoreBar value={score} className="mt-2" />}
      {expect && <p className="mt-1 text-[10px] text-muted-foreground">Expected: <span className="text-foreground">{expect}</span></p>}
      {result.error && <p className="mt-1 text-[11px] text-red-400">{result.error}</p>}
      {result.note && <p className="mt-1 text-[11px] text-muted-foreground">{result.note}</p>}
      <div className="mt-2"><Steps name={result.name} steps={result.steps ?? []} /></div>
      {failureMode && (
        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.05] px-2 py-1.5 text-[10px] leading-relaxed text-amber-200/90">
          <strong className="text-amber-300">How it lies: </strong>{failureMode}
        </p>
      )}
    </div>
  );
}

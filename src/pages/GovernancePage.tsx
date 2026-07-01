import { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal, Layers3, GitBranch, Thermometer, Sparkles, ShieldCheck,
  Save, RotateCcw, Undo2, Loader2, Lock, Zap, Search, Repeat2, BadgeCheck,
  Wand2, AlertTriangle, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GovernanceControl } from '@/features/knowops/components/GovernanceControl';
import { FeatureToggle } from '@/features/governance/components/FeatureToggle';
import {
  useGovernance, useUpdateGovernance, useResetGovernance,
} from '@/features/governance/hooks/useGovernance';
import { useAuthStore } from '@/store/auth.store';
import type { GovernanceSettings } from '@/types/governance';

const eq = (a: GovernanceSettings, b: GovernanceSettings) =>
  JSON.stringify(a) === JSON.stringify(b);

export function GovernancePage() {
  const isAdmin = useAuthStore((s) => s.user?.roles?.includes('ADMIN') ?? false);
  const { data, isLoading, isError } = useGovernance();
  const update = useUpdateGovernance();
  const reset  = useResetGovernance();

  const server   = data?.settings ?? null;
  const defaults = data?.defaults ?? null;
  const [draft, setDraft] = useState<GovernanceSettings | null>(null);

  // Re-sync the draft whenever the server profile changes (initial load, after
  // apply/reset). Editing only mutates local draft until "Apply".
  useEffect(() => {
    if (server) setDraft(server);
  }, [server]);

  const dirty = useMemo(
    () => (draft && server ? !eq(draft, server) : false),
    [draft, server],
  );
  const locked = !isAdmin || update.isPending || reset.isPending;

  function set<K extends keyof GovernanceSettings>(key: K, value: GovernanceSettings[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  if (isLoading || !draft || !defaults) return <Skeleton error={isError} />;

  const d = draft;

  return (
    <div className="space-y-6">
      <Hero isAdmin={isAdmin} />

      {/* Command bar */}
      <div
        className={cn(
          'sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md transition-colors',
          dirty ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'glass border-white/8',
        )}
      >
        <span className="relative flex h-2.5 w-2.5">
          {dirty && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dirty ? 'bg-amber-400' : 'bg-emerald-400')} />
        </span>
        <span className="text-sm font-medium">
          {dirty ? 'Unsaved changes' : 'In sync with runtime'}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Changes take effect on the next agent run — no redeploy.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost" size="sm" className="gap-1.5 text-xs"
            disabled={locked || !dirty}
            onClick={() => server && setDraft(server)}
          >
            <Undo2 className="h-3.5 w-3.5" /> Discard
          </Button>
          <Button
            variant="ghost" size="sm" className="gap-1.5 text-xs"
            disabled={locked}
            onClick={() => reset.mutate()}
          >
            {reset.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset defaults
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-neon-gradient text-xs font-semibold text-primary-foreground shadow-glow hover:brightness-110"
            disabled={locked || !dirty}
            onClick={() => update.mutate(d)}
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Apply changes
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-2.5 text-xs text-amber-300/90">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Read-only view — an <strong className="mx-1">ADMIN</strong> role is required to change governance.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Retrieval & reranking */}
        <Section
          icon={Layers3} title="Retrieval & Reranking" accent="neon" delay={0}
          desc="How much context the retriever pulls and how it is re-ranked before reasoning."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <GovernanceControl
              label="Top-K" hint="chunks fetched per query"
              value={d.top_k} min={1} max={50} step={1}
              baseline={defaults.top_k} format={(v) => `${v}`}
              onChange={locked ? noop : (v) => set('top_k', v)}
            />
            <GovernanceControl
              label="Min similarity" hint="floor for a chunk to qualify"
              value={d.min_score} min={0} max={0.95} step={0.05} accent="plasma"
              baseline={defaults.min_score} format={pct}
              onChange={locked ? noop : (v) => set('min_score', v)}
            />
          </div>

          <FeatureToggle
            icon={Sparkles} label="Cross-Encoder reranking"
            hint="Stage-2 joint (query, chunk) re-scoring for higher precision"
            enabled={d.cross_encoder_enabled} baseline={defaults.cross_encoder_enabled}
            disabled={locked} onChange={(v) => set('cross_encoder_enabled', v)}
          />

          {/* Sub-knobs — revealed only when the cross-encoder is on */}
          <div
            className={cn(
              'grid gap-5 overflow-hidden rounded-xl border border-dashed border-neon/15 bg-neon/[0.02] transition-all duration-500 sm:grid-cols-2',
              d.cross_encoder_enabled ? 'max-h-60 p-4 opacity-100' : 'max-h-0 border-transparent p-0 opacity-0',
            )}
          >
            <GovernanceControl
              label="Candidate pool" hint="stage-1 chunks fed to reranker"
              value={d.rerank_candidate_k} min={1} max={100} step={1}
              baseline={defaults.rerank_candidate_k} format={(v) => `${v}`}
              onChange={locked ? noop : (v) => set('rerank_candidate_k', v)}
            />
            <GovernanceControl
              label="Keep top-N" hint="chunks kept after re-scoring" accent="plasma"
              value={d.rerank_top_n} min={1} max={50} step={1}
              baseline={defaults.rerank_top_n} format={(v) => `${v}`}
              onChange={locked ? noop : (v) => set('rerank_top_n', v)}
            />
          </div>
        </Section>

        {/* CRAG reasoning loop */}
        <Section
          icon={GitBranch} title="CRAG Reasoning Loop" accent="plasma" delay={80}
          desc="The corrective self-checks that make retrieval-augmented answers trustworthy."
        >
          <div className="grid gap-4">
            <FeatureToggle
              icon={Repeat2} label="Corrective query rewrite"
              hint="Rewrite & retry when retrieved context is weak"
              enabled={d.query_rewrite_enabled} baseline={defaults.query_rewrite_enabled}
              disabled={locked} accent="plasma" onChange={(v) => set('query_rewrite_enabled', v)}
            />
            <FeatureToggle
              icon={BadgeCheck} label="Groundedness check"
              hint="Verify every claim is supported before answering"
              enabled={d.grounding_enabled} baseline={defaults.grounding_enabled}
              disabled={locked} accent="plasma" onChange={(v) => set('grounding_enabled', v)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <GovernanceControl
              label="Max rewrite loops" hint="corrective retries before abstaining"
              value={d.max_loops} min={0} max={6} step={1}
              baseline={defaults.max_loops} format={(v) => `${v}`}
              onChange={locked ? noop : (v) => set('max_loops', v)}
            />
            <GovernanceControl
              label="Max regenerations" hint="grounding retries before accepting" accent="plasma"
              value={d.max_regen} min={0} max={5} step={1}
              baseline={defaults.max_regen} format={(v) => `${v}`}
              onChange={locked ? noop : (v) => set('max_regen', v)}
            />
          </div>
        </Section>

        {/* Temperatures */}
        <Section
          icon={Thermometer} title="Model Temperatures" accent="neon" delay={160} span
          desc="Per-node sampling temperature — 0 is deterministic judgement, warmer is more creative. Judgement nodes should stay cold; only generation benefits from warmth."
        >
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <TempKnob label="Grade" icon={Search} v={d.grade_temperature}
              base={defaults.grade_temperature} locked={locked} onChange={(x) => set('grade_temperature', x)} />
            <TempKnob label="Rewrite" icon={Wand2} v={d.rewrite_temperature}
              base={defaults.rewrite_temperature} locked={locked} onChange={(x) => set('rewrite_temperature', x)} />
            <TempKnob label="Generate" icon={Zap} v={d.generate_temperature} accent="plasma"
              base={defaults.generate_temperature} locked={locked} onChange={(x) => set('generate_temperature', x)} />
            <TempKnob label="Grounding" icon={ShieldCheck} v={d.grounding_temperature}
              base={defaults.grounding_temperature} locked={locked} onChange={(x) => set('grounding_temperature', x)} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const noop = () => {};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const temp = (v: number) => v.toFixed(2);

function TempKnob({
  label, icon: Icon, v, base, locked, accent = 'neon', onChange,
}: {
  label: string; icon: React.ElementType; v: number; base: number;
  locked: boolean; accent?: 'neon' | 'plasma'; onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-card/40 p-3">
      <div className={cn('mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', accent === 'plasma' ? 'text-plasma/80' : 'text-neon/80')}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <GovernanceControl
        label={label} hint={v === 0 ? 'deterministic' : 'sampled'}
        value={v} min={0} max={1.5} step={0.05} accent={accent}
        baseline={base} format={temp}
        onChange={locked ? noop : onChange}
      />
    </div>
  );
}

function Hero({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neon/20 bg-gradient-to-br from-neon/10 via-plasma/[0.06] to-aurora/10 p-6">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-neon/15 blur-3xl animate-float-slow" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-plasma/10 blur-3xl animate-float" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_95%,hsl(var(--neon)/0.06)_95%)] bg-[length:100%_1.6rem] opacity-40" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon/15 text-neon shadow-glow-inner">
              <SlidersHorizontal className="h-5 w-5 animate-glow-pulse" />
            </span>
            <h1 className="bg-gradient-to-r from-neon via-plasma to-aurora bg-clip-text text-2xl font-bold text-transparent">
              Platform Governance
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The mission-control for Brainwave's reasoning engine. Tune retrieval depth, toggle the
            Cross-Encoder, shape the CRAG corrective loop, and dial per-node temperatures — all live,
            persisted server-side, applied on the very next run.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
            isAdmin
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-white/10 bg-white/5 text-muted-foreground',
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {isAdmin ? 'Admin control' : 'Read-only'}
        </span>
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, desc, accent, children, delay = 0, span = false,
}: {
  icon: React.ElementType; title: string; desc: string;
  accent: 'neon' | 'plasma'; children: React.ReactNode; delay?: number; span?: boolean;
}) {
  const text = accent === 'neon' ? 'text-neon' : 'text-plasma';
  const bg   = accent === 'neon' ? 'bg-neon/10' : 'bg-plasma/10';
  const brd  = accent === 'neon' ? 'border-neon/15' : 'border-plasma/15';
  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'animate-fade-in-up rounded-2xl border bg-card/50 backdrop-blur-sm', brd,
        span && 'xl:col-span-2',
      )}
    >
      <div className={cn('relative overflow-hidden border-b px-5 py-4', brd)}>
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-10 bg-gradient-to-r from-transparent via-current to-transparent bg-[length:200%_100%] animate-gradient-shift', text)} />
        <div className="relative flex items-center gap-3">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg, text)}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        </div>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Skeleton({ error }: { error: boolean }) {
  return (
    <div className="space-y-6">
      <Hero isAdmin={false} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-24">
        {error ? (
          <>
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Couldn't reach agent-hub. Governance is served by <span className="font-mono">/api/agent</span> —
              make sure the agent-hub container is up.
            </p>
          </>
        ) : (
          <>
            <Cpu className="h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading runtime configuration…</p>
          </>
        )}
      </div>
    </div>
  );
}

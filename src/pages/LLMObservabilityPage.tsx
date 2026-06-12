import {
  Telescope, ExternalLink, GitBranch, Search, Sparkles, ShieldCheck,
  Target, ListChecks, BadgeCheck, Gauge, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { env } from '@/config/env';

/**
 * LLM Observability — the Langfuse launcher + a teaching explainer of how a
 * chat turn maps to a trace (TDD §10). Langfuse is self-hosted so prompts and
 * completions (which contain document text) never leave the network.
 */
export function LLMObservabilityPage() {
  return (
    <div className="space-y-8">
      <Hero />
      <TraceModel />
      <EvalMetrics />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — Langfuse launcher
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-neon/5 to-aurora/10 p-6">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-neon/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Telescope className="h-6 w-6 text-plasma" />
            <h1 className="bg-gradient-to-r from-violet-400 via-neon to-aurora bg-clip-text text-2xl font-bold text-transparent">
              LLM Observability
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every chat turn becomes an inspectable, replayable trace in <strong className="text-foreground">Langfuse</strong> —
            the condensed query, retrieved chunks with scores, the final prompt, the completion,
            token counts, and latency. Self-hosted, so document text never leaves the network.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Pill icon={ShieldCheck} label="Self-hosted · air-gapped" accent="emerald" />
            <Pill icon={Sparkles} label="Traces · Scores · Datasets" accent="violet" />
          </div>
        </div>

        <a
          href={env.VITE_LANGFUSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-neon-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:shadow-glow-lg hover:brightness-110"
        >
          Open Langfuse
          <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>

      <p className="relative mt-4 rounded-lg border border-white/5 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        First run? Create a project at{' '}
        <span className="font-mono text-foreground/80">{env.VITE_LANGFUSE_URL}</span>, copy the public &
        secret keys into <span className="font-mono text-foreground/80">know-hub</span>'s env
        (<span className="font-mono">LANGFUSE_PUBLIC_KEY</span>,{' '}
        <span className="font-mono">LANGFUSE_SECRET_KEY</span>), set{' '}
        <span className="font-mono">LANGFUSE_ENABLED=true</span>, and restart. Tracing is best-effort —
        chat keeps working even when Langfuse is down.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trace model — Trace → Spans/Generation
// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: Search,
    name: 'Span · condense',
    desc: 'Rewrites a follow-up into a standalone query using chat history.',
    fields: 'original → standalone query',
    accent: 'cyan' as const,
  },
  {
    icon: GitBranch,
    name: 'Span · retrieve',
    desc: 'Ownership-filtered hybrid retrieval of the top-K chunks.',
    fields: 'query · chunk ids + scores · K · latency',
    accent: 'violet' as const,
  },
  {
    icon: Sparkles,
    name: 'Generation · generate',
    desc: 'The streamed local LLM call that produces the grounded answer.',
    fields: 'model · prompt · completion · tokens · TTFT',
    accent: 'aurora' as const,
  },
];

function TraceModel() {
  return (
    <section className="space-y-4">
      <SectionHeader title="Anatomy of a Trace" hint="One chat turn = one trace" />
      <div className="rounded-2xl border border-white/5 bg-card/50 p-5 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-neon/20 bg-neon/5 px-4 py-2.5">
          <Gauge className="h-4 w-4 text-neon" />
          <span className="text-sm font-semibold text-foreground">Trace · chat.turn</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            userId · sessionId · question → answer
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.name} className="relative">
              <StepCard step={s} />
              {i < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/40 md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ACCENTS = {
  cyan:   { text: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  aurora: { text: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20' },
  emerald:{ text: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20' },
};

function StepCard({ step }: { step: typeof STEPS[number] }) {
  const c = ACCENTS[step.accent];
  const Icon = step.icon;
  return (
    <div className={cn('h-full rounded-xl border bg-card/60 p-4 transition-all hover:-translate-y-0.5', c.border)}>
      <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg', c.bg)}>
        <Icon className={cn('h-4 w-4', c.text)} />
      </div>
      <p className="text-sm font-semibold text-foreground">{step.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
      <p className={cn('mt-2 font-mono text-[10px]', c.text)}>{step.fields}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eval metrics (RAGAS)
// ---------------------------------------------------------------------------

const METRICS = [
  { icon: Target,     name: 'Context Precision', q: 'Were the retrieved chunks actually relevant?', note: 'Measures the retriever.' },
  { icon: ListChecks, name: 'Context Recall',    q: 'Did we retrieve everything needed to answer?', note: 'Reveals missed chunks.' },
  { icon: BadgeCheck, name: 'Faithfulness',      q: 'Is the answer grounded, not hallucinated?',    note: 'LLM-as-judge over context.' },
  { icon: Sparkles,   name: 'Answer Relevance',  q: 'Does the answer address the question?',        note: 'LLM-as-judge over the question.' },
];

function EvalMetrics() {
  return (
    <section className="space-y-4">
      <SectionHeader title="Evaluation Dimensions" hint="Score retrieval and generation separately" />
      <div className="grid gap-3 sm:grid-cols-2">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.name}
              className="group flex items-start gap-3 rounded-xl border border-white/5 bg-card/50 p-4 transition-all hover:-translate-y-0.5 hover:border-neon/30 hover:shadow-glow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neon/10">
                <Icon className="h-4 w-4 text-neon" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{m.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.q}</p>
                <p className="mt-1 text-[11px] italic text-muted-foreground/70">{m.note}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="rounded-lg border border-white/5 bg-card/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        When an answer is wrong, ask in order: <strong className="text-foreground">(1)</strong> did retrieval surface the
        right chunk? If not, fix retrieval (chunking, K, thresholds, condensation).{' '}
        <strong className="text-foreground">(2)</strong> Was the chunk in context but ignored? If so, fix generation
        (prompt, model, ordering). Langfuse is what lets you answer (1) vs (2) in seconds.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="flex items-baseline justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </header>
  );
}

function Pill({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent: keyof typeof ACCENTS }) {
  const c = ACCENTS[accent];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', c.border, c.bg, c.text)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

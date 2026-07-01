import {
  Telescope, ExternalLink, Cpu, Sparkles, Binary, Layers, ShieldCheck,
  Boxes, Radar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { env } from '@/config/env';
import { usePlatformModels } from '@/features/governance/hooks/useGovernance';
import type { PlatformModel } from '@/types/governance';

/**
 * Observability → LLMs. A creative launcher into self-hosted Langfuse plus a live
 * catalog of every model the platform runs (reasoning, embedding, cross-encoder).
 * The catalog is served by agent-hub's /api/agent/models so it reflects real
 * config; a static fallback keeps the section rich if agent-hub is unreachable.
 */

const FALLBACK: PlatformModel[] = [
  {
    id: 'reasoning', name: 'llama3.1:8b-instruct-q4_K_M', provider: 'Ollama', role: 'Reasoning · LLM',
    purpose: 'CRAG grading, query rewrite, generation, grounding, and classification.',
    host: 'http://ollama:11434', params: '8B · Q4_K_M', modality: 'text → text', enabled: true, service: 'agent-hub',
  },
  {
    id: 'embedding', name: 'nomic-embed-text', provider: 'Ollama', role: 'Embedding',
    purpose: '768-dim document + query embeddings for pgvector semantic search.',
    host: 'http://ollama:11434', params: '768-dim', modality: 'text → vector', enabled: true, service: 'know-hub · agent-hub',
  },
  {
    id: 'cross-encoder', name: 'cross-encoder/ms-marco-MiniLM-L-6-v2', provider: 'sentence-transformers', role: 'Cross-Encoder · Reranker',
    purpose: 'Stage-2 joint (query, chunk) re-scoring for retrieval precision.',
    host: 'in-process', params: 'MiniLM-L6', modality: '(text, text) → score', enabled: false, service: 'agent-hub',
  },
];

const ROLE_STYLE: Record<string, { icon: React.ElementType; text: string; bg: string; border: string }> = {
  reasoning:       { icon: Cpu,     text: 'text-neon',    bg: 'bg-neon/10',    border: 'border-neon/20' },
  embedding:       { icon: Binary,  text: 'text-plasma',  bg: 'bg-plasma/10',  border: 'border-plasma/20' },
  'cross-encoder': { icon: Layers,  text: 'text-aurora',  bg: 'bg-aurora/10',  border: 'border-aurora/20' },
};

export function LLMCatalog() {
  const { data } = usePlatformModels();
  const models = data?.models ?? FALLBACK;

  return (
    <div className="space-y-4">
      {/* Langfuse launcher */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-neon/[0.05] to-aurora/10 p-6">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl animate-float-slow" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--neon)/0.08)_1px,transparent_1px)] bg-[length:22px_22px] opacity-40" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 shadow-glow-inner">
                <Telescope className="h-5 w-5 animate-glow-pulse" />
              </span>
              <h3 className="bg-gradient-to-r from-violet-300 via-neon to-aurora bg-clip-text text-xl font-bold text-transparent">
                LLM Observability · Langfuse
              </h3>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every chat turn and agent run becomes an inspectable, replayable trace — condensed query,
              retrieved chunks with scores, prompts, completions, tokens, and latency. Prompts are
              managed here too. Self-hosted, so document text never leaves the network.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Pill icon={ShieldCheck} label="Self-hosted · air-gapped" />
              <Pill icon={Sparkles} label="Traces · Prompts · Scores" />
              <Pill icon={Radar} label="RAGAS evals" />
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
      </div>

      {/* Model catalog */}
      <div className="flex items-center gap-2 px-1">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Models in Service</h4>
        <span className="ml-auto text-xs text-muted-foreground">{models.length} active</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {models.map((m, i) => (
          <ModelCard key={m.id} model={m} index={i} />
        ))}
      </div>
    </div>
  );
}

function ModelCard({ model, index }: { model: PlatformModel; index: number }) {
  const s = ROLE_STYLE[model.id] ?? ROLE_STYLE.reasoning;
  const Icon = s.icon;
  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className={cn(
        'group relative animate-fade-in-up overflow-hidden rounded-xl border bg-card/60 p-4 transition-all duration-300 hover:-translate-y-0.5',
        s.border,
      )}
    >
      <div aria-hidden className={cn('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-60', s.bg)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.bg, s.text)}>
            <Icon className="h-4 w-4" />
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              model.enabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', model.enabled ? 'bg-emerald-400 animate-pulse-dot' : 'bg-muted-foreground')} />
            {model.enabled ? 'Enabled' : 'Standby'}
          </span>
        </div>

        <p className={cn('mt-3 text-xs font-semibold uppercase tracking-wide', s.text)}>{model.role}</p>
        <p className="mt-1 break-all font-mono text-sm font-medium text-foreground">{model.name}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{model.purpose}</p>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3 font-mono text-[10px] text-muted-foreground">
          <Tag>{model.provider}</Tag>
          <Tag>{model.params}</Tag>
          <Tag>{model.modality}</Tag>
          <Tag>{model.service}</Tag>
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-white/5 px-1.5 py-0.5">{children}</span>;
}

function Pill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

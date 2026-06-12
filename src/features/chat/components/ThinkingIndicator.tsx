import { AICore } from '@/components/ai/AICore';

/**
 * Shown after the question is sent but before the first token arrives — the
 * condense + retrieve phase. Communicates that the system is grounding its
 * answer in real documents, not just "loading".
 */
export function ThinkingIndicator({ phase }: { phase: string }) {
  return (
    <div className="flex w-full items-center gap-3 animate-fade-in">
      <div className="mt-0.5 shrink-0">
        <AICore size={36} />
      </div>
      <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3">
        <span className="flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
        <span className="shimmer-text text-xs font-medium">{phase}</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-neon"
      style={{ animation: 'pulse-dot 1.2s ease-in-out infinite', animationDelay: delay }}
    />
  );
}

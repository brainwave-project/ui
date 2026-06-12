import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronDown, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Citation } from '@/types/chat';

/**
 * Verifiable provenance for an answer (TDD §5.5). Renders the chunks the answer
 * was grounded in as a collapsible list of [n] sources, each linking to the
 * real document — the user can check every claim.
 */
export function SourcesList({ sources }: { sources: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-neon"
      >
        <Quote className="h-3.5 w-3.5 text-neon/70" />
        <span>
          {sources.length} source{sources.length === 1 ? '' : 's'} grounded this answer
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-2 grid gap-1.5">
          {sources.map((s) => (
            <Link
              key={`${s.n}-${s.chunkId}`}
              to={`/documents/${s.documentId}`}
              className="group flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 transition-all hover:border-neon/40 hover:bg-neon/5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neon/15 font-mono text-[10px] font-bold text-neon">
                {s.n}
              </span>
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-neon" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
                {s.title || 'Untitled'}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {Math.round(s.score * 100)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

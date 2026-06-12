import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AICore } from '@/components/ai/AICore';
import { SourcesList } from './SourcesList';
import type { ChatMessage, Citation } from '@/types/chat';

interface Props {
  message: ChatMessage;
  /** True while this assistant message is actively streaming (renders a caret). */
  streaming?: boolean;
}

export function MessageBubble({ message, streaming = false }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex w-full gap-3 animate-fade-in-up', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <AICore size={36} ripples={false} />
        )}
      </div>

      {/* Bubble */}
      <div className={cn('min-w-0 max-w-[85%] space-y-1', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'holo-border bg-neon/[0.06] text-foreground'
              : 'glass text-foreground/95',
          )}
        >
          <AnswerText content={message.content} citations={message.citations} />
          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-[1px] animate-pulse bg-neon align-middle" />
          )}
          {!isUser && !streaming && !message.content && (
            <span className="text-muted-foreground">No answer was produced.</span>
          )}
        </div>

        {!isUser && message.citations && <SourcesList sources={message.citations} />}

        {!isUser && (message.model || message.completionTokens != null) && (
          <div className="flex items-center gap-2 px-1 font-mono text-[10px] text-muted-foreground/70">
            {message.model && <span>{message.model}</span>}
            {message.completionTokens != null && (
              <span>· {message.completionTokens} tok</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render answer text, turning inline [n] markers into clickable citation chips
 * that link to the cited document. This is what makes citations renderable.
 */
function AnswerText({ content, citations }: { content: string; citations?: Citation[] }) {
  if (!content) return null;
  const byN = new Map((citations ?? []).map((c) => [c.n, c]));
  const parts = content.split(/(\[\d+\])/g);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (match) {
          const n = Number(match[1]);
          const cite = byN.get(n);
          if (cite) {
            return (
              <Link
                key={i}
                to={`/documents/${cite.documentId}`}
                title={cite.title}
                className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-neon/20 px-1 align-text-top font-mono text-[10px] font-bold text-neon transition-colors hover:bg-neon/40"
              >
                {n}
              </Link>
            );
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}

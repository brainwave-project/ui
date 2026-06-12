import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Cpu, Activity, Loader2, MessageSquarePlus } from 'lucide-react';
import { AICore } from '@/components/ai/AICore';
import { chatApi } from '@/api/chat.api';
import { useUIStore } from '@/store/ui.store';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSessions, useMessages, useCreateSession, useDeleteSession, useRenameSession, chatKeys,
} from '@/features/chat/hooks/useChat';
import { SessionSidebar } from '@/features/chat/components/SessionSidebar';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { ThinkingIndicator } from '@/features/chat/components/ThinkingIndicator';
import { ChatComposer } from '@/features/chat/components/ChatComposer';
import type { Citation, ChatMessage } from '@/types/chat';

const SUGGESTIONS = [
  'Summarise our refund policy and cite the source.',
  'What are the key risks mentioned across my documents?',
  'How does the authentication flow work?',
  'Compare the enterprise and standard terms.',
];

interface LiveTurn {
  userText:      string;
  assistantText: string;
  citations:     Citation[];
  phase:         string;
  status:        'thinking' | 'streaming';
}

export function ChatPage() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const abortRef = useRef<null | (() => void)>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeId);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const renameSession = useRenameSession();

  const streaming = live !== null;

  // Auto-scroll to the newest content as it streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, live?.assistantText, live?.status]);

  // Abort any in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.(), []);

  function stopStream() {
    abortRef.current?.();
    abortRef.current = null;
    setLive(null);
  }

  function selectSession(id: string) {
    if (id === activeId) return;
    stopStream();
    setActiveId(id);
  }

  async function newConversation() {
    stopStream();
    try {
      const session = await createSession.mutateAsync(undefined);
      setActiveId(session.id);
    } catch {
      addToast({ type: 'error', message: 'Could not start a conversation.' });
    }
  }

  function handleDelete(id: string) {
    deleteSession.mutate(id);
    if (id === activeId) {
      stopStream();
      setActiveId(null);
    }
  }

  async function send(text: string) {
    let sessionId = activeId;

    // First message with no active session — create one on the fly.
    if (!sessionId) {
      try {
        const session = await createSession.mutateAsync(undefined);
        sessionId = session.id;
        setActiveId(session.id);
      } catch {
        addToast({ type: 'error', message: 'Could not start a conversation.' });
        return;
      }
    }

    const targetId = sessionId;
    setLive({
      userText: text,
      assistantText: '',
      citations: [],
      phase: 'Condensing & retrieving passages…',
      status: 'thinking',
    });

    abortRef.current = chatApi.streamMessage(targetId, text, {
      onToken: (tok) =>
        setLive((prev) => (prev ? { ...prev, assistantText: prev.assistantText + tok, status: 'streaming' } : prev)),
      onCitations: (sources) =>
        setLive((prev) => (prev ? { ...prev, citations: sources } : prev)),
      onDone: () => {
        abortRef.current = null;
        setLive(null);
        qc.invalidateQueries({ queryKey: chatKeys.messages(targetId) });
        qc.invalidateQueries({ queryKey: chatKeys.sessions() });
      },
      onError: (msg) => {
        abortRef.current = null;
        setLive(null);
        addToast({
          type: 'error',
          message:
            msg === 'embedding_unavailable'
              ? 'The embedding service is unavailable — try again shortly.'
              : 'Generation failed. The model may still be warming up.',
        });
      },
    });
  }

  const isEmpty = !activeId || (messages.length === 0 && !live && !messagesLoading);

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-white/5 glass">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        loading={sessionsLoading}
        creating={createSession.isPending}
        onSelect={selectSession}
        onCreate={newConversation}
        onDelete={handleDelete}
        onRename={(id, title) => renameSession.mutate({ id, title })}
      />

      {/* Conversation column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {isEmpty ? (
            <EmptyState onPick={send} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messagesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((m: ChatMessage) => <MessageBubble key={m.id} message={m} />)
              )}

              {/* In-flight turn */}
              {live && (
                <>
                  <MessageBubble
                    message={{
                      id: 'live-user',
                      sessionId: activeId ?? '',
                      role: 'user',
                      content: live.userText,
                      createdAt: new Date().toISOString(),
                    }}
                  />
                  {live.status === 'thinking' ? (
                    <ThinkingIndicator phase={live.phase} />
                  ) : (
                    <MessageBubble
                      streaming
                      message={{
                        id: 'live-assistant',
                        sessionId: activeId ?? '',
                        role: 'assistant',
                        content: live.assistantText,
                        citations: live.citations,
                        createdAt: new Date().toISOString(),
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-8">
          <ChatComposer onSend={send} onStop={stopStream} streaming={streaming} />
        </div>
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 md:px-8">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-base font-bold tracking-tight neon-text">Brainwave Chat</h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <ShieldCheck className="h-3 w-3" />
          Air-gapped
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="hidden items-center gap-1 sm:inline-flex">
          <Cpu className="h-3.5 w-3.5 text-neon/70" />
          Local RAG
        </span>
        <Link
          to="/llm-observability"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 transition-colors hover:border-neon/40 hover:text-neon"
        >
          <Activity className="h-3.5 w-3.5" />
          Traces
        </Link>
      </div>
    </header>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-5 pt-10 text-center">
      <AICore size={96} className="animate-float-slow" />
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-neon" />
          Retrieval-augmented, grounded in your documents
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight neon-text text-glow">
          Ask your knowledge base
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Every answer is generated locally and cites the exact passages it was grounded in.
          Ask a question to begin a new conversation.
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group flex items-center gap-2 rounded-xl border border-white/8 bg-card/40 px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-neon/40 hover:text-foreground hover:shadow-glow-sm"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-neon/60 group-hover:text-neon" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

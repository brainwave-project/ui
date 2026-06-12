import { useState } from 'react';
import { Plus, MessageSquare, Trash2, Loader2, Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatSession } from '@/types/chat';

interface Props {
  sessions:  ChatSession[];
  activeId:  string | null;
  loading:   boolean;
  creating:  boolean;
  onSelect:  (id: string) => void;
  onCreate:  () => void;
  onDelete:  (id: string) => void;
  onRename:  (id: string, title: string) => void;
}

/** Conversation rail — the user's session history, most-recent first. */
export function SessionSidebar({
  sessions, activeId, loading, creating, onSelect, onCreate, onDelete, onRename,
}: Props) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/5">
      <div className="p-3">
        <button
          onClick={onCreate}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon-gradient px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-sm transition-all hover:shadow-glow disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New conversation
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Conversations
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet. Start one above.
          </p>
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={() => onSelect(s.id)}
              onDelete={() => onDelete(s.id)}
              onRename={(title) => onRename(s.id, title)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SessionRow({
  session, active, onSelect, onDelete, onRename,
}: {
  session: ChatSession;
  active:  boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  function commit() {
    const value = draft.trim();
    if (value && value !== session.title) onRename(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground focus:outline-none"
        />
        <button onClick={commit} className="text-emerald-400 hover:text-emerald-300">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
        active ? 'bg-neon/10 text-neon shadow-glow-inner' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
      )}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <MessageSquare className={cn('h-4 w-4 shrink-0', active && 'drop-glow')} />
        <span className="truncate">{session.title}</span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => { setDraft(session.title); setEditing(true); }}
          className="rounded p-1 text-muted-foreground hover:text-neon"
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

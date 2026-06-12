import { FileText, RefreshCw, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmbeddingStatusBadge } from '@/features/semantic/components/EmbeddingStatusBadge';
import { useEmbeddingStatus, useReindexDocument } from '@/features/semantic/hooks/useSemantic';
import type { Document } from '@/types/document';

/**
 * One row in the reindex queue. Polls the live embedding status (so a row moves
 * Queued → Indexing → Searchable on its own) and exposes a per-document reindex
 * action — the only mutation the backend offers for the semantic layer.
 */
function ReindexRow({ doc, canManage }: { doc: Document; canManage: boolean }) {
  const { data, isLoading } = useEmbeddingStatus(doc.documentId, { poll: true });
  const reindex = useReindexDocument();
  const status  = data?.embeddingStatus;
  const busy    = reindex.isPending || status === 'INDEXING';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-card/40 p-3 transition-colors hover:border-neon/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neon">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={doc.title}>{doc.title}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{doc.documentId}</p>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : status ? (
        <EmbeddingStatusBadge status={status} />
      ) : (
        <span className="font-mono text-[10px] text-muted-foreground">—</span>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={!canManage || busy}
        title={canManage ? 'Re-run the embedding pipeline' : 'Requires ADMIN role'}
        onClick={() => reindex.mutate(doc.documentId)}
      >
        {!canManage ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
        )}
        Reindex
      </Button>
    </div>
  );
}

interface Props {
  documents: Document[];
  canManage: boolean;
  loading?:  boolean;
}

export function ReindexQueue({ documents, canManage, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-14">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading queue…</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-14 text-muted-foreground">
        <FileText className="h-8 w-8 opacity-50" />
        <p className="text-sm">No documents to index yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((d, i) => (
        <div key={d.documentId} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
          <ReindexRow doc={d} canManage={canManage} />
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileX, Loader2 } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { DocumentCard } from './DocumentCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Document } from '@/types/document';

const STATES = ['AVAILABLE', 'ARCHIVED', 'RECEIVED', 'PERSISTING', 'DELETED'] as const;
type StateFilter = (typeof STATES)[number] | 'ALL';

export function DocumentList() {
  const navigate                      = useNavigate();
  const [stateFilter, setStateFilter] = useState<StateFilter>('AVAILABLE');
  const [page, setPage]               = useState(1);
  const limit                         = 12;

  const { data, isLoading, isError, error } = useDocuments({
    state: stateFilter === 'ALL' ? undefined : stateFilter,
    page,
    limit,
  });

  function handleView(doc: Document) {
    navigate(`/documents/${doc.documentId}`);
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-4">
      {/* Segmented filter */}
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-card/40 p-1 backdrop-blur">
        {(['ALL', ...STATES] as StateFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => { setStateFilter(s); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all',
              stateFilter === s
                ? 'bg-neon/15 text-neon shadow-glow-inner'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-7 w-7 animate-spin text-neon" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading records…</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message ?? 'Failed to load documents.'}
        </div>
      )}

      {/* Empty */}
      {!isLoading && data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 py-20 text-muted-foreground">
          <FileX className="h-10 w-10 opacity-60" />
          <p className="text-sm">No documents in this state.</p>
        </div>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((doc, i) => (
            <div key={doc.documentId} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
              <DocumentCard document={doc} onView={handleView} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="font-mono text-xs text-muted-foreground">
            Page {page} / {totalPages} · {data?.total ?? 0} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

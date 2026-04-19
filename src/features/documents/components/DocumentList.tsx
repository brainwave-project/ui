import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileX, Loader2 } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { DocumentCard } from './DocumentCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Document } from '@/types/document';

const STATES = ['AVAILABLE', 'ARCHIVED', 'RECEIVED', 'PERSISTING', 'DELETED'] as const;
type StateFilter = (typeof STATES)[number] | 'ALL';

export function DocumentList() {
  const navigate                    = useNavigate();
  const [stateFilter, setStateFilter] = useState<StateFilter>('AVAILABLE');
  const [page, setPage]             = useState(1);
  const limit                       = 12;

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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {(['ALL', ...STATES] as StateFilter[]).map((s) => (
          <Badge
            key={s}
            variant={stateFilter === s ? 'default' : 'outline'}
            className="cursor-pointer select-none"
            onClick={() => { setStateFilter(s); setPage(1); }}
          >
            {s}
          </Badge>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message ?? 'Failed to load documents.'}
        </div>
      )}

      {/* Empty */}
      {!isLoading && data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <FileX className="h-10 w-10" />
          <p className="text-sm">No documents found.</p>
        </div>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((doc) => (
            <DocumentCard key={doc.documentId} document={doc} onView={handleView} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {data?.total ?? 0} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

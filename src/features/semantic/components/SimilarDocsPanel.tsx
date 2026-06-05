import { Link } from 'react-router-dom';
import { Sparkles, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimilarDocuments } from '../hooks/useSemantic';
import { cn } from '@/lib/utils';

interface Props {
  documentId: string;
}

/** Sidebar/section listing documents conceptually related to the current one. */
export function SimilarDocsPanel({ documentId }: Props) {
  const { data, isLoading } = useSimilarDocuments(documentId);
  const results = data?.results ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Related documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No related documents found yet. Related items appear once this and other
            documents are indexed.
          </p>
        ) : (
          <ul className="space-y-1">
            {results.map((hit) => {
              const pct = Math.round(hit.similarityScore * 100);
              return (
                <li key={hit.documentId}>
                  <Link
                    to={`/documents/${hit.documentId}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {hit.title || 'Untitled document'}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        pct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {pct}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

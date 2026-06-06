import { Link } from 'react-router-dom';
import { Sparkles, Loader2, FileText, Info } from 'lucide-react';
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
        <p
          className="flex cursor-help items-center gap-1 text-xs text-muted-foreground"
          title="Similarity = cosine distance between each candidate's chunk-embedding centroid and this document's centroid, computed in 768-dim nomic-embed-text space. Documents are chunked at 512 tokens / 64 overlap before embedding."
        >
          <Info className="h-3 w-3 shrink-0" />
          Ranked by cosine similarity to this document's embedding centroid
        </p>
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
                        'shrink-0 cursor-help rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        pct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground',
                      )}
                      title="Cosine similarity (0–100%). ≥ 70% = highly related; lower = loosely related."
                    >
                      {pct}% similarity
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

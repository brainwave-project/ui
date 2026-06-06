import { useNavigate } from 'react-router-dom';
import { FileText, Sparkles, ArrowUpRight, Layers, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmbeddingStatusBadge } from './EmbeddingStatusBadge';
import { cn } from '@/lib/utils';
import type { SearchHit } from '@/types/semantic';

/** Wrap query terms appearing in the excerpt with a subtle highlight. */
function highlight(excerpt: string, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length > 2);
  if (terms.length === 0) return excerpt;

  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  const parts = excerpt.split(re);
  return parts.map((part, i) =>
    terms.includes(part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-primary/15 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Map a 0–1 relevance into a color band. */
function relevanceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.65) return 'bg-lime-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-orange-500';
}

interface Props {
  hit: SearchHit;
  query: string;
  rank: number;
  onFindSimilar?: (documentId: string) => void;
}

export function SearchResultCard({ hit, query, rank, onFindSimilar }: Props) {
  const navigate = useNavigate();
  const pct = Math.round(hit.similarityScore * 100);

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      {/* Rank rail */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/60 to-primary/10" />

      <CardContent className="space-y-3 p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {rank}
            </span>
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <button
              onClick={() => navigate(`/documents/${hit.documentId}`)}
              className="truncate text-sm font-semibold hover:underline"
              title={hit.title}
            >
              {hit.title || 'Untitled document'}
            </button>
          </div>
          <EmbeddingStatusBadge status={hit.embeddingStatus} className="shrink-0" />
        </div>

        {/* Excerpt — the matched chunk, with query terms highlighted */}
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {highlight(hit.excerpt, query)}
        </p>

        {/* Relevance meter — the search explaining itself */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Relevance
            </span>
            <span
              className="flex cursor-help items-center gap-1 font-medium tabular-nums"
              title="Cosine similarity between your query vector and the closest matching chunk — measures conceptual closeness in 768-dim embedding space (nomic-embed-text model)"
            >
              {pct}% similarity
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', relevanceColor(hit.similarityScore))}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Transparency row + actions */}
        <div className="flex items-center justify-between pt-1">
          <span
            className="flex cursor-help items-center gap-1 text-xs text-muted-foreground"
            title="Hybrid RRF score — Reciprocal Rank Fusion (k=60) adds 1/(60+vector_rank) + 1/(60+keyword_rank). A document strong in both ANN similarity and exact keyword match rises to the top."
          >
            <Layers className="h-3 w-3" />
            RRF score {hit.rrfScore.toFixed(4)}
            <Info className="h-3 w-3" />
          </span>
          <div className="flex gap-1">
            {onFindSimilar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onFindSimilar(hit.documentId)}
              >
                <Sparkles className="h-3 w-3" />
                Similar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => navigate(`/documents/${hit.documentId}`)}
            >
              Open
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

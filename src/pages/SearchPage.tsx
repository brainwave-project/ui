import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles, Zap, Loader2, SearchX, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSemanticSearch } from '@/features/semantic/hooks/useSemantic';
import { SearchResultCard } from '@/features/semantic/components/SearchResultCard';

const EXAMPLES = [
  'How do we handle document retries?',
  'authentication token rotation',
  'embedding pipeline failures',
];

export function SearchPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [input, setInput]   = useState(urlParams.get('q') ?? '');
  const [query, setQuery]   = useState(urlParams.get('q') ?? '');
  const [hybrid, setHybrid] = useState(urlParams.get('hybrid') !== 'false');
  const [minScore, setMinScore] = useState(Number(urlParams.get('minScore') ?? 0.6));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const params = useMemo(
    () => ({ q: query, hybrid, minScore, limit: 20, offset: 0 }),
    [query, hybrid, minScore],
  );

  const { data, isFetching, isError } = useSemanticSearch(params);
  const results = data?.results ?? [];
  const hasSearched = query.trim().length > 0;

  // Keep the URL in sync so searches are shareable / bookmarkable.
  useEffect(() => {
    if (!hasSearched) return;
    setUrlParams(
      { q: query, hybrid: String(hybrid), minScore: String(minScore) },
      { replace: true },
    );
  }, [query, hybrid, minScore, hasSearched, setUrlParams]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  function runExample(ex: string) {
    setInput(ex);
    setQuery(ex);
  }

  function findSimilar(documentId: string) {
    // Navigate to the document; its detail page hosts the related-docs panel.
    window.location.assign(`/documents/${documentId}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero */}
      <div className="space-y-2 pt-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Search by meaning, not just keywords
        </div>
        <h1 className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Semantic Search
        </h1>
      </div>

      {/* Search bar */}
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything across your documents…"
            className="h-14 rounded-xl pl-12 pr-28 text-base shadow-sm"
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={!input.trim()}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border p-0.5">
            <ModeToggle active={hybrid} onClick={() => setHybrid(true)} icon={Sparkles} label="Hybrid (RRF)" />
            <ModeToggle active={!hybrid} onClick={() => setHybrid(false)} icon={Zap} label="Vector only" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Threshold {Math.round(minScore * 100)}%
          </Button>
        </div>

        {showAdvanced && (
          <div className="rounded-lg border bg-card p-3">
            <label className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">Min similarity</span>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right font-medium tabular-nums">{Math.round(minScore * 100)}%</span>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              {hybrid
                ? 'Hybrid mode fuses semantic (vector) ranking with exact keyword matches via Reciprocal Rank Fusion. A result strong in both signals rises to the top.'
                : 'Vector-only mode ranks purely by conceptual (cosine) similarity — best for fuzzy, meaning-based queries.'}
            </p>
          </div>
        )}
      </form>

      {/* Body */}
      {!hasSearched ? (
        <EmptyPrompt onPick={runExample} />
      ) : isError ? (
        <StateBox>
          <SearchX className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Search failed. The embedding service may still be warming up — try again shortly.
          </p>
        </StateBox>
      ) : isFetching && results.length === 0 ? (
        <StateBox>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Embedding your query and searching…</p>
        </StateBox>
      ) : results.length === 0 ? (
        <StateBox>
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No matches above {Math.round(minScore * 100)}% similarity. Try lowering the threshold or
            rephrasing.
          </p>
        </StateBox>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {data?.total ?? results.length} result{(data?.total ?? results.length) === 1 ? '' : 's'}
            {' · '}ranked by {hybrid ? 'fusion score' : 'similarity'}
          </p>
          {results.map((hit, i) => (
            <SearchResultCard
              key={hit.documentId}
              hit={hit}
              query={query}
              rank={i + 1}
              onFindSimilar={findSimilar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModeToggle({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Zap; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function EmptyPrompt({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">Try one of these:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function StateBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16">
      {children}
    </div>
  );
}

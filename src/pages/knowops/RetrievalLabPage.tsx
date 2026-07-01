import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, Search, Loader2, Sparkles, Zap, SearchX, Orbit, Info,
  Layers, SlidersHorizontal, ArrowRight, Check, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { KnowOpsHeader } from '@/features/knowops/components/KnowOpsHeader';
import { VectorSpace } from '@/features/knowops/components/VectorSpace';
import { SearchResultCard } from '@/features/semantic/components/SearchResultCard';
import { useSemanticSearch } from '@/features/semantic/hooks/useSemantic';
import { useGovernance } from '@/features/governance/hooks/useGovernance';
import { useKnowOpsStore, SERVER_DEFAULTS } from '@/store/knowops.store';

const EXAMPLES = [
  'document retry semantics',
  'token rotation policy',
  'embedding pipeline failures',
];

export function RetrievalLabPage() {
  const navigate = useNavigate();
  const { hybrid, setHybrid } = useKnowOpsStore();
  const { data: gov } = useGovernance();

  // Retrieval depth + threshold are governed centrally now (agent-hub). The Lab
  // reflects the live governed values instead of keeping its own editable copy.
  const topK         = gov?.settings.top_k                ?? SERVER_DEFAULTS.topK;
  const minScore     = gov?.settings.min_score            ?? SERVER_DEFAULTS.minScore;
  const crossEncoder = gov?.settings.cross_encoder_enabled ?? false;

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const params = useMemo(
    () => ({ q: query, hybrid, minScore, limit: topK, offset: 0 }),
    [query, hybrid, minScore, topK],
  );

  const { data, isFetching, isError } = useSemanticSearch(params);
  const results = data?.results ?? [];
  const hasSearched = query.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div className="space-y-6">
      <KnowOpsHeader
        icon={FlaskConical}
        kicker="Retrieval Lab"
        title="Tune & observe semantic retrieval"
        desc="Govern how the retriever ranks your knowledge base, then watch the result set resolve in vector space — live, on real similarity scores."
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/governance')}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Manage governance
          </Button>
        }
      />

      {/* Search bar */}
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Probe the index — ask by meaning…"
            className="h-14 rounded-xl pl-12 pr-28 text-base"
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={!input.trim()}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run'}
          </Button>
        </div>
        {!hasSearched && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setInput(ex); setQuery(ex); }}
                className="rounded-full border bg-card/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-neon/40 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Results */}
        <div className="space-y-3 lg:col-span-2">
          {!hasSearched ? (
            <StateBox>
              <FlaskConical className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Run a query to populate the lab.</p>
            </StateBox>
          ) : isError ? (
            <StateBox>
              <SearchX className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">Retrieval failed — the embedder may be warming up.</p>
            </StateBox>
          ) : isFetching && results.length === 0 ? (
            <StateBox>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Embedding query · scanning {topK} nearest chunks…</p>
            </StateBox>
          ) : results.length === 0 ? (
            <StateBox>
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nothing above {Math.round(minScore * 100)}% similarity. Lower the threshold or widen Top-K.
              </p>
            </StateBox>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {data?.total ?? results.length} hit{(data?.total ?? results.length) === 1 ? '' : 's'} · ranked by{' '}
                {hybrid ? 'fusion (RRF)' : 'cosine similarity'}
              </p>
              {results.map((hit, i) => (
                <SearchResultCard
                  key={hit.documentId}
                  hit={hit}
                  query={query}
                  rank={i + 1}
                  onFindSimilar={(id) => navigate(`/documents/${id}`)}
                />
              ))}
            </>
          )}
        </div>

        {/* Governance + vector space rail */}
        <div className="space-y-4">
          {/* Vector space */}
          <Card className="holo-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Orbit className="h-4 w-4 text-neon" /> Vector Space
              </CardTitle>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {SERVER_DEFAULTS.embedDims}-dim · {SERVER_DEFAULTS.metric}
              </span>
            </CardHeader>
            <CardContent>
              {results.length > 0 ? (
                <VectorSpace
                  hits={results}
                  query={query}
                  onSelect={(id) => navigate(`/documents/${id}`)}
                  className="aspect-square w-full"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-white/10">
                  <p className="text-center text-xs text-muted-foreground">
                    The constellation maps live results<br />by similarity to your query.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active configuration — read-only reflection of central governance */}
          <Card className="holo-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="h-4 w-4 text-neon" /> Active Configuration
              </CardTitle>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                governed
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cross-Encoder — the headline knob */}
              <div
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  crossEncoder ? 'border-neon/30 bg-neon/[0.05]' : 'border-white/8 bg-card/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers className={cn('h-4 w-4', crossEncoder ? 'text-neon drop-glow' : 'text-muted-foreground')} />
                  <span className="text-sm font-medium">Cross-Encoder</span>
                  <StatusBadge on={crossEncoder} className="ml-auto" />
                </div>
                {crossEncoder && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    pool {gov?.settings.rerank_candidate_k}
                    <ArrowRight className="h-3 w-3" />
                    keep top {gov?.settings.rerank_top_n}
                  </p>
                )}
              </div>

              {/* Governed retrieval values */}
              <div className="grid grid-cols-2 gap-2">
                <ConfigStat label="Top-K" value={`${topK}`} />
                <ConfigStat label="Min similarity" value={`${Math.round(minScore * 100)}%`} />
              </div>

              {/* Lab-only probe: retrieval method (not governed) */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Probe method · lab-only
                </p>
                <div className="inline-flex w-full rounded-lg border p-0.5">
                  <ModeToggle active={hybrid} onClick={() => setHybrid(true)} icon={Sparkles} label="Hybrid (RRF)" />
                  <ModeToggle active={!hybrid} onClick={() => setHybrid(false)} icon={Zap} label="Vector" />
                </div>
              </div>

              <p className="flex items-start gap-1.5 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-neon/60" />
                Top-K &amp; threshold mirror the central governance profile. The Cross-Encoder re-ranks the
                <strong className="mx-1 text-foreground">Agent (CRAG)</strong> retrieval path; this Lab probes the
                raw vector index directly, so reranking is not applied here.
              </p>

              <Button
                variant="ghost" size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => navigate('/governance')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Edit in Governance
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StateBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20">
      {children}
    </div>
  );
}

function ConfigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        on
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-white/10 bg-white/5 text-muted-foreground',
        className,
      )}
    >
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {on ? 'Enabled' : 'Disabled'}
    </span>
  );
}

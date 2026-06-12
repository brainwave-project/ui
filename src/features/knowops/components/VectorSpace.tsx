import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SearchHit, EmbeddingStatus } from '@/types/semantic';

/**
 * Vector Space — a similarity constellation built from REAL search scores.
 *
 * The query sits at the core; every hit is placed at a radius derived from its
 * cosine similarity (closer = more similar) and an angle spread by the golden
 * ratio so nodes rarely overlap. Node size ∝ score, colour = embedding status.
 * No coordinates are fabricated — the geometry is a faithful projection of the
 * scores the retriever actually returned.
 */

const CENTER = 200;
const OUTER_R = 158;
const SIM_FLOOR = 0.45; // similarity mapped to the rim
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.399 rad

const STATUS_COLOR: Record<EmbeddingStatus, string> = {
  INDEXED:  'var(--neon)',
  PENDING:  '38 92% 56%',   // amber
  INDEXING: '38 92% 56%',
  FAILED:   'var(--destructive)',
  SKIPPED:  'var(--muted-foreground)',
};

function hsl(token: string, alpha = 1): string {
  // Accept either a CSS var reference or a raw "h s% l%" triple.
  return token.startsWith('var(') ? `hsl(${token} / ${alpha})` : `hsl(${token} / ${alpha})`;
}

function radiusFor(sim: number): number {
  const t = Math.min(1, Math.max(0, (1 - sim) / (1 - SIM_FLOOR)));
  return t * OUTER_R;
}

interface Props {
  hits:      SearchHit[];
  query:     string;
  onSelect?: (documentId: string) => void;
  className?: string;
}

export function VectorSpace({ hits, query, onSelect, className }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const nodes = useMemo(() => {
    return hits.map((h, i) => {
      const r     = radiusFor(h.similarityScore);
      const angle = i * GOLDEN;
      const x     = CENTER + Math.cos(angle) * r;
      const y     = CENTER + Math.sin(angle) * r;
      const size  = 5 + h.similarityScore * 11;
      return { hit: h, x, y, size, rank: i + 1 };
    });
  }, [hits]);

  const rings = [0.9, 0.8, 0.7, 0.6];

  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 400 400" className="h-full w-full">
        <defs>
          <radialGradient id="vs-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={hsl('var(--neon)', 0.9)} />
            <stop offset="70%" stopColor={hsl('var(--plasma)', 0.5)} />
            <stop offset="100%" stopColor={hsl('var(--plasma)', 0)} />
          </radialGradient>
        </defs>

        {/* concentric similarity bands */}
        {rings.map((sim) => {
          const r = radiusFor(sim);
          return (
            <g key={sim}>
              <circle
                cx={CENTER} cy={CENTER} r={r}
                fill="none" stroke="hsl(0 0% 100% / 0.06)" strokeWidth={1} strokeDasharray="2 4"
              />
              <text
                x={CENTER + 3} y={CENTER - r - 2}
                className="fill-muted-foreground/40 font-mono"
                style={{ fontSize: 8 }}
              >
                {Math.round(sim * 100)}%
              </text>
            </g>
          );
        })}

        {/* edges */}
        {nodes.map((n) => (
          <line
            key={`e-${n.hit.documentId}`}
            x1={CENTER} y1={CENTER} x2={n.x} y2={n.y}
            stroke={hsl(STATUS_COLOR[n.hit.embeddingStatus], hover === n.hit.documentId ? 0.7 : 0.18)}
            strokeWidth={hover === n.hit.documentId ? 1.5 : 1}
          />
        ))}

        {/* core (query) */}
        <circle cx={CENTER} cy={CENTER} r={26} fill="url(#vs-core)" className="animate-pulse-dot" />
        <circle cx={CENTER} cy={CENTER} r={7} fill={hsl('var(--neon)')} />

        {/* hit nodes */}
        {nodes.map((n) => {
          const active = hover === n.hit.documentId;
          const color  = STATUS_COLOR[n.hit.embeddingStatus];
          return (
            <g
              key={n.hit.documentId}
              className="cursor-pointer"
              onMouseEnter={() => setHover(n.hit.documentId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(n.hit.documentId)}
            >
              <circle
                cx={n.x} cy={n.y} r={n.size + (active ? 5 : 0)}
                fill={hsl(color, active ? 0.35 : 0.18)}
                stroke={hsl(color, active ? 1 : 0.7)}
                strokeWidth={active ? 2 : 1.25}
                style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
              />
              <text
                x={n.x} y={n.y + 3}
                textAnchor="middle"
                className="pointer-events-none fill-foreground font-mono font-semibold"
                style={{ fontSize: 8 }}
              >
                {n.rank}
              </text>
            </g>
          );
        })}
      </svg>

      {/* core label */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-32 -translate-x-1/2 translate-y-7 text-center">
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-neon">query</p>
        <p className="truncate text-[10px] text-muted-foreground" title={query}>{query}</p>
      </div>

      {/* hover tooltip */}
      {hover && (() => {
        const n = nodes.find((x) => x.hit.documentId === hover);
        if (!n) return null;
        return (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-white/10 bg-popover/90 p-2 backdrop-blur">
            <p className="truncate text-xs font-semibold">{n.rank}. {n.hit.title || 'Untitled'}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              sim {Math.round(n.hit.similarityScore * 100)}% · rrf {n.hit.rrfScore.toFixed(3)} · {n.hit.embeddingStatus}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

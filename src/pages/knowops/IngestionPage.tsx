import { useState } from 'react';
import {
  Workflow, UploadCloud, Database, Scissors, Cpu, Layers,
  SlidersHorizontal, RotateCcw, Info, Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KnowOpsHeader } from '@/features/knowops/components/KnowOpsHeader';
import { GovernanceControl } from '@/features/knowops/components/GovernanceControl';
import { PipelineFlow, type PipelineStage } from '@/features/knowops/components/PipelineFlow';
import { ReindexQueue } from '@/features/knowops/components/ReindexQueue';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useKnowOpsStore, SERVER_DEFAULTS, type ChunkStrategy } from '@/store/knowops.store';
import { useAuthStore } from '@/store/auth.store';

const STRATEGIES: { value: ChunkStrategy; label: string; blurb: string }[] = [
  { value: 'fixed',     label: 'Fixed window', blurb: 'Uniform token windows — fast, predictable.' },
  { value: 'sentence',  label: 'Sentence',     blurb: 'Split on sentence boundaries — cleaner semantics.' },
  { value: 'recursive', label: 'Recursive',    blurb: 'Split by structure, then size — best coherence.' },
];

export function IngestionPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = !!user?.roles.includes('ADMIN');

  const {
    chunkStrategy, chunkSize, chunkOverlap,
    setChunkStrategy, setChunkSize, setChunkOverlap, resetIngestion,
  } = useKnowOpsStore();

  const [queueState, setQueueState] = useState<'AVAILABLE' | 'FAILED'>('AVAILABLE');

  const received   = useDocuments({ state: 'RECEIVED',   limit: 1 });
  const persisting = useDocuments({ state: 'PERSISTING', limit: 1 });
  const available  = useDocuments({ state: 'AVAILABLE',  limit: 50 });
  const failed     = useDocuments({ state: 'FAILED',     limit: 50 });

  const queue = queueState === 'AVAILABLE' ? available : failed;

  const stages: PipelineStage[] = [
    { key: 'upload',  label: 'Upload',  sub: 'received',  icon: UploadCloud, count: received.data?.total,   tone: (received.data?.total ?? 0) > 0 ? 'amber' : 'muted' },
    { key: 'persist', label: 'Persist', sub: 'mongo+minio', icon: Database,  count: persisting.data?.total, tone: (persisting.data?.total ?? 0) > 0 ? 'amber' : 'muted' },
    { key: 'chunk',   label: 'Chunk',   sub: `${chunkSize} tok`, icon: Scissors, tone: 'plasma' },
    { key: 'embed',   label: 'Embed',   sub: SERVER_DEFAULTS.embedModel, icon: Cpu, tone: 'plasma' },
    { key: 'index',   label: 'Index',   sub: 'pgvector', icon: Layers, count: available.data?.total, tone: 'neon' },
  ];

  return (
    <div className="space-y-6">
      <KnowOpsHeader
        icon={Workflow}
        kicker="Ingestion"
        title="Pipeline & chunking governance"
        desc="Watch documents flow from upload to a searchable vector, govern the chunking policy, and re-run the embedding pipeline on demand."
        accent="plasma"
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={resetIngestion}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset policy
          </Button>
        }
      />

      {/* Pipeline schematic */}
      <Card className="holo-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Live Ingestion Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineFlow stages={stages} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chunking console */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="h-4 w-4 text-plasma" /> Chunking Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* strategy */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Strategy</p>
              <div className="grid grid-cols-3 gap-1.5">
                {STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setChunkStrategy(s.value)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-[11px] font-medium transition-all',
                      chunkStrategy === s.value
                        ? 'border-plasma/50 bg-plasma/10 text-plasma shadow-glow-plasma'
                        : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {STRATEGIES.find((s) => s.value === chunkStrategy)?.blurb}
              </p>
            </div>

            <GovernanceControl
              label="Window size" hint="tokens per chunk"
              value={chunkSize} min={64} max={2048} step={64}
              baseline={SERVER_DEFAULTS.chunkSize} accent="plasma"
              format={(v) => `${v} tok`}
              onChange={setChunkSize}
            />
            <GovernanceControl
              label="Overlap" hint="shared tokens between windows"
              value={chunkOverlap} min={0} max={512} step={16}
              baseline={SERVER_DEFAULTS.chunkOverlap} accent="plasma"
              format={(v) => `${v} tok`}
              onChange={setChunkOverlap}
            />

            <p className="flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 text-[11px] text-amber-200/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              This is the <strong className="font-semibold">proposed policy</strong>. The know-hub worker owns the
              live split ({SERVER_DEFAULTS.chunkSize}-tok / {SERVER_DEFAULTS.chunkOverlap}-overlap default);
              changes take effect for documents (re)indexed after a backend rollout.
            </p>
          </CardContent>
        </Card>

        {/* Reindex queue */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">Reindex Queue</CardTitle>
            <div className="inline-flex rounded-lg border p-0.5">
              {(['AVAILABLE', 'FAILED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setQueueState(s)}
                  className={cn(
                    'rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
                    queueState === s ? 'bg-neon/15 text-neon' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s} {s === 'AVAILABLE' ? `· ${available.data?.total ?? 0}` : `· ${failed.data?.total ?? 0}`}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {!canManage && (
              <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Reindex requires the <strong className="text-foreground">ADMIN</strong> role — statuses are read-only for you.
              </p>
            )}
            <ReindexQueue
              documents={queue.data?.items ?? []}
              canManage={canManage}
              loading={queue.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

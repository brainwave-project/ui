import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation } from 'react-router-dom';
import { ServerCrash, Terminal } from 'lucide-react';
import { Pill } from '@/features/evaluation/components/EvalPrimitives';
import { DatasetPicker, preferredVersion } from '@/features/evaluation/components/DatasetPicker';
import { useDatasets, useEvalStatus } from '@/features/evaluation/hooks/useEval';
import { useEvalStore } from '@/store/eval.store';

const PAGE_INTRO: { prefix: string; title: string; blurb: string }[] = [
  {
    prefix: '/evaluation/retrieval',
    title: 'Retrieval',
    blurb: 'Probe one query, score a split, then compare A/B runs.',
  },
];

export function EvaluationLayout() {
  const { pathname } = useLocation();
  const status = useEvalStatus();
  const datasets = useDatasets();
  const { datasetId, version, select } = useEvalStore();
  const onGoldenSets = pathname.startsWith('/evaluation/dataset');
  const onExperiments = pathname.startsWith('/evaluation/experiments');
  const onNormalization = pathname.startsWith('/evaluation/normalization');
  const rows = datasets.data ?? [];
  const intro = PAGE_INTRO.find((p) => pathname.startsWith(p.prefix));

  useEffect(() => {
    if (!datasets.data) return;
    const currentOk = rows.some((d) => d.id === datasetId && d.versions.some((v) => v.version === version));
    if (currentOk) return;
    const first = rows[0];
    const preferred = first ? preferredVersion(first.versions) : undefined;
    if (first && preferred != null) select(first.id, preferred);
    else if (datasetId) select(null, null);
  }, [datasets.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const offline = status.isError;
  const showDatasetSelect = !onGoldenSets && !onExperiments && !onNormalization && rows.length > 0;

  return (
    <div>
      {(intro || showDatasetSelect) && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          {intro && (
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-semibold">{intro.title}</h3>
              <p className="text-sm text-muted-foreground">{intro.blurb}</p>
            </div>
          )}
          {showDatasetSelect && (
            <DatasetPicker
              datasets={rows}
              datasetId={datasetId}
              version={version}
              onChange={select}
            />
          )}
        </div>
      )}

      {offline && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 text-sm">
          <ServerCrash className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="space-y-1.5">
            <p className="font-medium">The Eval Lab API is not reachable.</p>
            <p className="text-xs text-muted-foreground">
              {onNormalization
                ? 'Arabic Norm only needs the Eval Lab API. Start it locally, then reload:'
                : 'It runs on the lean evaluation stack, not the dev stack. Start it, then reload:'}
            </p>
            <pre className="flex items-center gap-2 rounded-md bg-black/40 px-3 py-2 font-mono text-xs text-foreground">
              <Terminal className="h-3.5 w-3.5 text-neon" />
              {onNormalization ? 'cd agent-hub; uv run python -m agent_hub.eval.lab' : 'cd infra && make evals-lab'}
            </pre>
            <p className="text-xs text-muted-foreground">
              Vite proxies <code className="font-mono">/api/eval</code> to <code className="font-mono">localhost:3005</code>
              {' '}(override with <code className="font-mono">VITE_EVAL_API_URL</code>).
            </p>
          </div>
        </div>
      )}

      <Outlet />

      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-40">
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5 rounded-full border border-white/10 bg-[hsl(var(--card)/0.85)] px-2.5 py-1.5 shadow-panel backdrop-blur-md">
            <Pill tone={offline ? 'bad' : 'good'}>eval-api {offline ? 'offline' : 'up'}</Pill>
            {!onNormalization && <>
              <Pill tone={status.data?.know_hub ? 'good' : 'warn'}>know-hub {status.data?.know_hub ? 'up' : 'down'}</Pill>
              <Pill tone={status.data?.know_hub_grpc ? 'good' : 'warn'}>gRPC {status.data?.know_hub_grpc ? 'up' : 'down'}</Pill>
            </>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

import { useState } from 'react';
import { Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { evalApi } from '@/api/eval.api';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import { JobBar, Panel, Pill, PrincipalNote } from '@/features/evaluation/components/EvalPrimitives';
import { NORMALIZATION_INFO, shortHash } from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type { DatasetBundle, Job, Normalization } from '@/types/eval';

export function IndexSection({ bundle }: { bundle: DatasetBundle }) {
  const [jobs, setJobs] = useState<Partial<Record<Normalization, string>>>({});
  const trackJob = useEvalStore((s) => s.trackJob);
  const start = useEvalMutation(
    (norm: Normalization) => evalApi.index(bundle.meta.id, bundle.manifest.version, norm),
    { success: 'Indexing started' },
  );

  function run(norm: Normalization) {
    start.mutate(norm, {
      onSuccess: (job: Job) => { setJobs((j) => ({ ...j, [norm]: job.id })); trackJob(job.id); },
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {(['off', 'conservative', 'aggressive'] as Normalization[]).map((norm) => {
          const state = bundle.indexes[norm];
          const stale = state && state.corpus_hash !== bundle.corpus_hashes[norm];
          const tone = !state ? 'neutral' : state.current ? 'good' : stale ? 'bad' : 'warn';
          const label = !state ? 'not indexed' : state.current ? 'current' : stale ? 'stale' : 'incomplete';
          return (
            <Panel key={norm} title={`Index · ${norm}`} icon={Server} actions={<Pill tone={tone}>{label}</Pill>}>
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">{NORMALIZATION_INFO[norm]}</p>
                {state && (
                  <dl className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between"><dt className="text-muted-foreground">owner</dt><dd title={state.owner_id}>{state.owner_id.slice(0, 13)}…</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">indexed corpus</dt><dd>{shortHash(state.corpus_hash)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">current corpus</dt><dd className={stale ? 'text-red-400' : ''}>{shortHash(bundle.corpus_hashes[norm])}</dd></div>
                    <div className="flex flex-wrap justify-end gap-1 pt-1">
                      {Object.entries(state.statuses).map(([s, n]) => (
                        <Pill key={s} tone={s === 'INDEXED' ? 'good' : s === 'FAILED' || s === 'SKIPPED' ? 'bad' : 'warn'}>{s} {n}</Pill>
                      ))}
                    </div>
                  </dl>
                )}
                {state && !state.current && state.reason && <p className="text-amber-300">{state.reason}</p>}
                <Button size="sm" className="w-full gap-1.5" variant={state?.current ? 'outline' : 'default'}
                  disabled={!bundle.corpus.length || start.isPending}
                  onClick={() => run(norm)}>
                  <Server className="h-3.5 w-3.5" /> {state?.current ? 'Re-check' : stale ? 'Rebuild' : state ? 'Resume' : 'Index corpus'}
                </Button>
                <JobBar jobId={jobs[norm] ?? null} />
              </div>
            </Panel>
          );
        })}
      </div>
      <PrincipalNote title="Indexing is part of the experiment">
        Each (dataset, corpus hash, normalisation) gets its own synthetic know-hub owner, so its ranking can only contain
        its own documents. Change a document and the corpus hash changes — the old index turns <strong>stale</strong>
        instead of silently mixing versions. Normalising at <strong>ingestion</strong> is the “both-side” fix for Arabic
        orthography (it is the only way to fix diacritics in the document); normalising the <strong>query</strong> alone is
        the cheap one. Embedding is asynchronous: scoring before every document is INDEXED gives zeros that look like
        retrieval failures but are races.
      </PrincipalNote>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows } from 'lucide-react';
import { evalApi } from '@/api/eval.api';
import { useDatasets } from '@/features/evaluation/hooks/useEval';
import { EmptyState, Field, Panel, Pill, PrincipalNote, Stat } from '@/features/evaluation/components/EvalPrimitives';
import { VersionPicker } from '@/features/evaluation/components/construction/VersionPicker';
import { WarningList } from '@/features/evaluation/components/RunViews';
import { shortHash } from '@/features/evaluation/lib/evalStats';
import type { DatasetBundle } from '@/types/eval';

const show = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > 140 ? `${s.slice(0, 140)}…` : s ?? '—';
};

export function DiffSection({ bundle }: { bundle: DatasetBundle }) {
  const { id } = bundle.meta;
  const current = bundle.manifest.version;
  const datasets = useDatasets();
  const versionRows = useMemo(() => {
    const found = datasets.data?.find((d) => d.id === id)?.versions ?? [];
    return [...found].sort((a, b) => b.version - a.version);
  }, [datasets.data, id]);
  const versions = versionRows.map((v) => v.version);
  const [from, setFrom] = useState(bundle.manifest.parent_version ?? Math.max(1, current - 1));
  const [to, setTo] = useState(current);
  const diff = useQuery({
    queryKey: ['eval', 'diff', id, from, to],
    queryFn: () => evalApi.diff(id, from, to),
    enabled: from !== to && versions.includes(from) && versions.includes(to),
  });

  if (versions.length < 2) {
    return (
      <Panel title="Versions" icon={GitCompareArrows}>
        <EmptyState icon={GitCompareArrows} title="Only one version">Freeze this version and fork it to compare versions.</EmptyState>
      </Panel>
    );
  }
  const d = diff.data;

  return (
    <div className="space-y-4">
      <Panel title="Version diff" icon={GitCompareArrows}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <VersionPicker compact versions={versionRows} value={from} onChange={setFrom} />
          </Field>
          <Field label="To">
            <VersionPicker compact versions={versionRows} value={to} onChange={setTo} />
          </Field>
        </div>
        {from === to ? <p className="text-xs text-muted-foreground">Pick two different versions.</p> : !d ? <div className="h-20" /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <Pill>v{d.from_version} {shortHash(d.from_hash)}</Pill>→<Pill>v{d.to_version} {shortHash(d.to_hash)}</Pill>
              <Pill tone={d.comparable ? 'good' : 'bad'}>{d.comparable ? 'scores comparable' : 'scores NOT comparable'}</Pill>
            </div>
            <WarningList warnings={d.consequences} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              <Stat label="Docs added" value={d.docs.added.length} />
              <Stat label="Docs removed" value={d.docs.removed.length} />
              <Stat label="Docs changed" value={d.docs.changed.length} />
              <Stat label="Items added" value={d.items.added.length} />
              <Stat label="Items removed" value={d.items.removed.length} />
              <Stat label="Items changed" value={d.items.changed.length} sub={`${d.relabeled.length} relabelled`} />
            </div>
            {d.split_moves.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="text-muted-foreground">Split moves:</span>
                {d.split_moves.map((m) => (
                  <Pill key={m.id} tone={m.from === 'dev' && m.to === 'holdout' ? 'bad' : 'neutral'}>{m.id}: {m.from ?? '—'} → {m.to ?? '—'}</Pill>
                ))}
              </div>
            )}
            {(d.docs.added.length > 0 || d.docs.removed.length > 0 || d.items.added.length > 0 || d.items.removed.length > 0) && (
              <div className="grid gap-2 text-xs md:grid-cols-2">
                {[['+ docs', d.docs.added], ['− docs', d.docs.removed], ['+ items', d.items.added], ['− items', d.items.removed]].map(([label, list]) =>
                  (list as string[]).length > 0 && (
                    <p key={label as string}><span className="text-muted-foreground">{label as string}:</span> <span className="font-mono">{(list as string[]).join(', ')}</span></p>
                  ))}
              </div>
            )}
            {d.items.changed.length > 0 && (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="py-1 pr-2">item</th><th className="pr-2">field</th><th className="pr-2">before</th><th>after</th></tr>
                  </thead>
                  <tbody>
                    {d.items.changed.flatMap((c) => Object.entries(c.fields).map(([field, v], i) => (
                      <tr key={`${c.id}-${field}`} className="border-t border-white/5 align-top">
                        <td className="py-1 pr-2 font-mono text-[10px]">{i === 0 ? c.id : ''}</td>
                        <td className="pr-2 font-mono text-[10px] text-muted-foreground">{field}</td>
                        <td className="pr-2 font-mono text-[10px] text-red-300/80" dir="auto">{show(v.before)}</td>
                        <td className="font-mono text-[10px] text-emerald-300/90" dir="auto">{show(v.after)}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Panel>
      <PrincipalNote title="What a fork did to comparability">
        A corpus change makes every retrieval number incomparable (the thing searched changed). Added or removed questions
        change the <strong>population</strong> the mean describes. Relabels change the <strong>truth</strong> — a score can
        move with no system change. And a <strong>dev → holdout</strong> move is contamination: those questions were visible
        while you tuned, so the new holdout is optimistic by exactly how much you overfit to them.
      </PrincipalNote>
    </div>
  );
}

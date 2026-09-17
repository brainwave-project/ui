import { useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, CheckCheck, ChevronLeft, ChevronRight, Database, FilePlus2, FileText, GitCompareArrows,
  GitFork, Hammer, Layers, Layers3, ListChecks, Lock, Plus, Scale, Search, Server,
  Snowflake, Download, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import {
  useDatasetMutation, useDatasets, useSelectedDataset,
} from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, LockedBanner, Panel, Pill, PrincipalNote, SelectBox,
  Stat, SubTabs, TextField, downloadText,
} from '@/features/evaluation/components/EvalPrimitives';
import { CorpusSection } from '@/features/evaluation/components/construction/CorpusSection';
import { ItemsSection } from '@/features/evaluation/components/construction/ItemsSection';
import { SyntheticSection } from '@/features/evaluation/components/construction/SyntheticSection';
import { ChunkingSection } from '@/features/evaluation/components/construction/ChunkingSection';
import { IndexSection } from '@/features/evaluation/components/construction/IndexSection';
import { PoolingSection } from '@/features/evaluation/components/construction/PoolingSection';
import { AgreementSection } from '@/features/evaluation/components/construction/AgreementSection';
import { DiffSection } from '@/features/evaluation/components/construction/DiffSection';
import { VersionPicker } from '@/features/evaluation/components/construction/VersionPicker';
import { fmtTime, shortHash } from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type { DatasetBundle, DatasetSummary } from '@/types/eval';

const PAGE_SIZE = 8;

type DetailTab = 'build' | 'inspect' | 'label' | 'versions';
type BuildTab = 'corpus' | 'items' | 'synthetic';
type InspectTab = 'chunking' | 'index';
type LabelTab = 'pool' | 'audit';
type VersionsTab = 'lifecycle' | 'diff';

export function DatasetConstructionPage() {
  const { datasetId } = useParams<{ datasetId?: string }>();
  return datasetId ? <DatasetDetail datasetId={datasetId} /> : <DatasetList />;
}

/* ── Listing ─────────────────────────────────────────────────────────────── */

function DatasetList() {
  const datasets = useDatasets();
  const navigate = useNavigate();
  const select = useEvalStore((s) => s.select);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lang, setLang] = useState('en');

  const create = useDatasetMutation((vars: { name: string; lang: string }) => evalApi.createDataset(vars), 'Dataset created');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = datasets.data ?? [];
    if (!q) return rows;
    return rows.filter((d) => `${d.name} ${d.id} ${d.lang}`.toLowerCase().includes(q));
  }, [datasets.data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openDataset(d: DatasetSummary, version?: number) {
    const v = version ?? d.versions[d.versions.length - 1]?.version;
    if (v == null) return;
    select(d.id, v);
    navigate(`/evaluation/dataset/${encodeURIComponent(d.id)}`, { state: { version: v } });
  }

  function goCreated(bundle: DatasetBundle) {
    navigate(`/evaluation/dataset/${encodeURIComponent(bundle.meta.id)}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold">Datasets</h3>
          <p className="text-sm text-muted-foreground">
            Versioned golden sets. Open one to build the corpus, inspect chunking &amp; the index, then label.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-[180px] flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <TextField
              className="h-9 pl-8"
              placeholder="Search datasets…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New dataset
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setName(''); setLang('en'); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New dataset</DialogTitle>
            <DialogDescription>
              Create an empty versioned golden set. You can add documents and items after it opens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <TextField
                autoFocus
                placeholder="e.g. HR policies (en)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim() && !create.isPending) {
                    create.mutate({ name: name.trim(), lang }, {
                      onSuccess: (bundle) => { setName(''); setOpen(false); goCreated(bundle); },
                    });
                  }
                }}
              />
            </Field>
            <Field label="Language">
              <SelectBox value={lang} onChange={setLang}
                options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ name: name.trim(), lang }, {
                onSuccess: (bundle) => { setName(''); setOpen(false); goCreated(bundle); },
              })}>
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {datasets.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/8 bg-card/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Panel title="No datasets" icon={Database}>
          <EmptyState icon={Database} title={query ? 'No matches' : 'No dataset yet'}>
            {query
              ? 'Try a different search, or clear the filter.'
              : 'Create an empty dataset, then add documents and golden items.'}
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {slice.map((d) => {
              const latest = d.versions[d.versions.length - 1];
              const frozen = latest?.status === 'frozen';
              const items = latest?.items ?? 0;
              const docs = latest?.documents ?? 0;
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDataset(d)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDataset(d); } }}
                  className="group cursor-pointer rounded-2xl border border-white/8 bg-card/30 p-4 text-left transition-all hover:border-neon/35 hover:bg-card/50 hover:shadow-glow-inner"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neon transition-colors group-hover:bg-neon/15">
                      <Database className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-display text-sm font-semibold" title={d.name}>{d.name}</p>
                        <Pill>{d.lang}</Pill>
                        {latest && <Pill tone={frozen ? 'info' : 'warn'}>{latest.status}</Pill>}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={d.id}>{d.id}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat label="Versions" value={d.versions.length} />
                    <Stat label="Items" value={items} />
                    <Stat label="Docs" value={docs} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {[...d.versions].sort((a, b) => b.version - a.version).map((v) => (
                      <button
                        key={v.version}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDataset(d, v.version); }}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                          'border-white/10 text-muted-foreground hover:border-neon/40 hover:text-neon',
                        )}
                        title={`${v.items} items · ${v.documents} docs`}
                      >
                        {v.status === 'frozen' && <Lock className="h-2.5 w-2.5" />}v{v.version}
                      </button>
                    ))}
                    <span className="ml-auto text-[11px] text-muted-foreground">{fmtTime(d.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={n === safePage ? 'default' : 'ghost'}
                  className={cn('h-8 min-w-[32px] px-2 font-mono text-xs', n === safePage && 'shadow-glow-sm')}
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Detail ──────────────────────────────────────────────────────────────── */

function DatasetDetail({ datasetId }: { datasetId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const datasets = useDatasets();
  const { datasetId: selectedId, version, select } = useEvalStore();
  const summary = datasets.data?.find((d) => d.id === datasetId);
  const intendedVersion = (location.state as { version?: number } | null)?.version;

  useEffect(() => {
    if (!summary?.versions.length) return;
    const latest = summary.versions[summary.versions.length - 1].version;
    const fromNav = intendedVersion != null && summary.versions.some((v) => v.version === intendedVersion)
      ? intendedVersion
      : null;
    if (selectedId !== datasetId) {
      select(datasetId, fromNav ?? latest);
      return;
    }
    if (!summary.versions.some((v) => v.version === version)) select(datasetId, fromNav ?? latest);
  }, [datasetId, summary, selectedId, version, select, intendedVersion]);

  const { data: bundle, isLoading } = useSelectedDataset();
  const ready = bundle && bundle.meta.id === datasetId;
  const [tab, setTab] = useState<DetailTab>('build');
  const [buildTab, setBuildTab] = useState<BuildTab>('corpus');
  const [inspectTab, setInspectTab] = useState<InspectTab>('chunking');
  const [labelTab, setLabelTab] = useState<LabelTab>('pool');
  const [versionsTab, setVersionsTab] = useState<VersionsTab>('lifecycle');

  const indexReady = ready
    ? Object.values(bundle.indexes).some((idx) => idx?.current)
    : false;

  const tabs: {
    id: DetailTab;
    step: string;
    title: string;
    blurb: string;
    icon: ElementType;
  }[] = [
    { id: 'build',    step: '1', title: 'Build',    blurb: 'Corpus, golden items, synthetic', icon: Hammer },
    { id: 'inspect',  step: '2', title: 'Inspect',  blurb: 'Chunking, then index',            icon: Layers },
    { id: 'label',    step: '3', title: 'Label',    blurb: 'Pool, judge, audit',              icon: Scale },
    { id: 'versions', step: '4', title: 'Versions', blurb: 'Freeze, fork, compare',           icon: GitCompareArrows },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button size="sm" variant="ghost" className="mt-0.5 h-9 gap-1.5 text-xs"
            onClick={() => navigate('/evaluation/dataset')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Datasets
          </Button>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">
              {summary?.name ?? datasetId}
            </h3>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{datasetId}</p>
          </div>
        </div>
        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{summary.lang}</Pill>
            <VersionPicker
              compact
              align="end"
              className="w-[17.5rem]"
              versions={summary.versions}
              value={version ?? summary.versions[summary.versions.length - 1]?.version ?? 1}
              onChange={(v) => select(datasetId, v)}
            />
          </div>
        )}
      </div>

      {!summary && !datasets.isLoading && (
        <Panel title="Unknown dataset" icon={Database}>
          <EmptyState icon={Database} title="This dataset is not on the lab">
            It may have been removed, or the Eval Lab API is on a different stack.
          </EmptyState>
        </Panel>
      )}

      {(isLoading || (summary && !ready)) && (
        <div className="h-48 animate-pulse rounded-2xl border border-white/8 bg-card/30" />
      )}

      {ready && (
        <>
          {bundle.manifest.status === 'frozen' && (
            <LockedBanner>
              <strong className="text-foreground">v{bundle.manifest.version} is frozen</strong> — content is read-only. Label audits
              and pools remain available; fork a new version to change documents, items or labels.
            </LockedBanner>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
            <nav className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4" aria-label="Dataset stages">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4',
                      active ? 'bg-card/80' : 'bg-card/20 hover:bg-white/[0.04]',
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all',
                      active ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-white/5 text-muted-foreground',
                    )}>
                      {t.step}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('flex items-center gap-1.5 text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>
                        <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.title}
                      </span>
                      <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground md:block">{t.blurb}</span>
                    </span>
                    {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-neon shadow-glow-sm" />}
                  </button>
                );
              })}
            </nav>
            {tab === 'build' && (
              <SubTabs
                label="Build"
                value={buildTab}
                onChange={setBuildTab}
                options={[
                  { id: 'corpus', label: 'Corpus', icon: FileText, count: bundle.corpus.length },
                  { id: 'items', label: 'Golden items', icon: ListChecks, count: bundle.items.length },
                  { id: 'synthetic', label: 'Synthetic candidates', icon: Bot },
                ]}
              />
            )}
            {tab === 'inspect' && (
              <SubTabs
                label="Inspect"
                value={inspectTab}
                onChange={setInspectTab}
                options={[
                  { id: 'chunking', label: 'Chunking', icon: Layers },
                  { id: 'index', label: 'Index', icon: Server, count: indexReady ? 'ready' : 'pending' },
                ]}
              />
            )}
            {tab === 'label' && (
              <SubTabs
                label="Label"
                value={labelTab}
                onChange={setLabelTab}
                options={[
                  { id: 'pool', label: 'Judging pool', icon: Layers3 },
                  { id: 'audit', label: 'Label audit', icon: CheckCheck },
                ]}
              />
            )}
            {tab === 'versions' && (
              <SubTabs
                label="Versions"
                value={versionsTab}
                onChange={setVersionsTab}
                options={[
                  { id: 'lifecycle', label: 'Lifecycle', icon: Snowflake, count: bundle.manifest.status },
                  { id: 'diff', label: 'Version diff', icon: GitCompareArrows },
                ]}
              />
            )}
          </div>

          <div
            key={`${tab}-${{ build: buildTab, inspect: inspectTab, label: labelTab, versions: versionsTab }[tab]}`}
            className="animate-fade-in space-y-4"
          >
            {tab === 'build' && buildTab === 'corpus' && <CorpusSection bundle={bundle} />}
            {tab === 'build' && buildTab === 'items' && <ItemsSection bundle={bundle} />}
            {tab === 'build' && buildTab === 'synthetic' && <SyntheticSection bundle={bundle} />}
            {tab === 'inspect' && inspectTab === 'chunking' && <ChunkingSection bundle={bundle} />}
            {tab === 'inspect' && inspectTab === 'index' && <IndexSection bundle={bundle} />}
            {tab === 'label' && labelTab === 'pool' && <PoolingSection bundle={bundle} />}
            {tab === 'label' && labelTab === 'audit' && <AgreementSection bundle={bundle} />}
            {tab === 'versions' && versionsTab === 'lifecycle' && (
              <VersionPanel bundle={bundle} versions={summary?.versions ?? []} />
            )}
            {tab === 'versions' && versionsTab === 'diff' && <DiffSection bundle={bundle} />}
          </div>
        </>
      )}
    </div>
  );
}

function VersionPanel({ bundle, versions }: { bundle: DatasetBundle; versions: DatasetSummary['versions'] }) {
  const { meta, manifest } = bundle;
  const select = useEvalStore((s) => s.select);
  const frozen = manifest.status === 'frozen';
  const [changelog, setChangelog] = useState('');
  const freeze = useDatasetMutation(() => evalApi.freeze(meta.id, manifest.version), `v${manifest.version} frozen`);
  const fork = useDatasetMutation((c: string) => evalApi.fork(meta.id, manifest.version, c), 'New draft version created');
  const tampered = frozen && manifest.content_hash !== bundle.current_hash;
  const synthetic = bundle.items.filter((i) => i.origin === 'synthetic').length;
  const negatives = bundle.items.reduce((n, i) => n + i.judged_nonrelevant.length, 0);
  const rows = versions.length
    ? versions
    : [{ ...manifest, items: bundle.items.length, documents: bundle.corpus.length }];

  async function exportJsonl() {
    const out = await evalApi.export(meta.id, manifest.version);
    downloadText(`${meta.id}-v${manifest.version}-${shortHash(out.content_hash)}.jsonl`, out.golden_jsonl, 'application/x-ndjson');
  }

  return (
    <Panel
      title="Lifecycle"
      icon={frozen ? Snowflake : FilePlus2}
      subtitle="Choose a snapshot, then freeze it or fork a new draft."
      actions={<Pill tone={frozen ? 'info' : 'warn'}>{manifest.status}</Pill>}
    >
      <div className="space-y-4 text-xs">
        <Field label="Version">
          <VersionPicker
            versions={rows}
            value={manifest.version}
            onChange={(v) => select(meta.id, v)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Items" value={bundle.items.length} sub={synthetic ? `${synthetic} synthetic` : undefined} />
          <Stat label="Documents" value={bundle.corpus.length} sub={`${negatives} explicit 0-judgements`} />
          <Stat label="Content hash" value={shortHash(bundle.current_hash)} />
          <Stat label={frozen ? 'Frozen at' : 'Created'} value={fmtTime(frozen ? manifest.frozen_at : manifest.created_at)} />
        </div>
        <dl className="space-y-1 font-mono text-[11px]">
          {frozen && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">frozen hash</dt><dd className={tampered ? 'text-red-400' : ''}>{shortHash(manifest.content_hash)}</dd></div>}
          {manifest.parent_version && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">forked from</dt><dd>v{manifest.parent_version}</dd></div>}
        </dl>
        {manifest.changelog && <p className="rounded-md bg-white/5 p-2 text-muted-foreground">{manifest.changelog}</p>}

        {!frozen ? (
          <Button size="sm" variant="neon" className="gap-1.5" disabled={freeze.isPending} onClick={() => freeze.mutate(undefined)}>
            <Snowflake className="h-3.5 w-3.5" /> Freeze v{manifest.version}
          </Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Changelog" className="min-w-[240px] flex-1">
              <TextField placeholder="What changes in the new version?" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
            </Field>
            <Button size="sm" className="h-9 gap-1.5" disabled={fork.isPending} onClick={() => fork.mutate(changelog)}>
              <GitFork className="h-3.5 w-3.5" /> Fork to v{manifest.version + 1}
            </Button>
          </div>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={exportJsonl}>
          <Download className="h-3.5 w-3.5" /> Export golden JSONL
        </Button>

        <PrincipalNote title="Data versioning & immutability">
          A number is only meaningful as a pair: <strong>(system, dataset hash)</strong>. Freezing records the hash; every
          run stores the hash it scored. Changing a frozen set means <strong>forking</strong> — never editing history —
          so “v2 recall” always refers to the same questions. The Versions section shows what a fork did to comparability.
        </PrincipalNote>
      </div>
    </Panel>
  );
}

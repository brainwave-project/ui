import { useEffect, useMemo, useState, type ElementType } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BarChart3, CheckCheck, ChevronLeft, ChevronRight, Database, FilePlus2,
  FileText, GitCompareArrows, GitFork, Layers, Layers3, ListChecks, Lock, Plus, Scale, Scissors,
  Search, Server, ShieldCheck, Sigma, Snowflake, Download, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import {
  useDatasetMutation, useDatasets, useReadiness, useSelectedDataset,
} from '@/features/evaluation/hooks/useEval';
import { ReadinessStrip } from '@/features/evaluation/components/ReadinessStrip';
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
import { GateSection, type GateChapter } from '@/features/evaluation/components/GateSection';
import { preferredVersion } from '@/features/evaluation/components/DatasetPicker';
import { fmtTime, shortHash } from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type { DatasetBundle, DatasetSummary } from '@/types/eval';

const PAGE_SIZE = 8;

const LIST_SPINE = ['Collect', 'Ask', 'Index', 'Judge', 'Gate', 'Freeze'] as const;

function listingStep(docs: number, items: number, frozen: boolean) {
  if (docs === 0) return 0;
  if (items === 0) return 1;
  if (frozen) return 5;
  return 4;
}

type SpineTab = 'collect' | 'ask' | 'index' | 'judge' | 'gate' | 'freeze';
type AskTab = 'items' | 'synthetic';
type IndexTab = 'chunking' | 'index';
type JudgeTab = 'pool' | 'audit';
type FreezeTab = 'lifecycle' | 'diff';

const SPINE: SpineTab[] = ['collect', 'ask', 'index', 'judge', 'gate', 'freeze'];

const SUB_TABS: Record<SpineTab, string[]> = {
  collect: [],
  ask:     ['items', 'synthetic'],
  index:   ['chunking', 'index'],
  judge:   ['pool', 'audit'],
  gate:    ['checks', 'split', 'power', 'profile'],
  freeze:  ['lifecycle', 'diff'],
};

const SUB_DEFAULT: Record<SpineTab, string> = {
  collect: '',
  ask: 'items',
  index: 'chunking',
  judge: 'pool',
  gate: 'checks',
  freeze: 'lifecycle',
};

function resolveSpineTab(raw: string | null, sub: string | null): SpineTab {
  if (raw === 'build' && (sub === 'corpus' || !sub)) return 'collect';
  if (raw === 'build') return 'ask';
  if (raw === 'inspect') return 'index';
  if (raw === 'label') return 'judge';
  if (raw === 'versions') return 'freeze';
  if (raw && SPINE.includes(raw as SpineTab)) return raw as SpineTab;
  return 'collect';
}

function useSpineParams(): [SpineTab, string, (t: SpineTab, s?: string) => void, (s: string) => void] {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const rawSub = params.get('sub');
  const tab = resolveSpineTab(rawTab, rawSub);
  const allowed = SUB_TABS[tab];
  const sub = allowed.length === 0
    ? ''
    : (rawSub && allowed.includes(rawSub) ? rawSub : (rawTab === 'build' && rawSub === 'items' ? 'items' : rawTab === 'build' && rawSub === 'synthetic' ? 'synthetic' : SUB_DEFAULT[tab]));

  const setTab = (next: SpineTab, nextSub?: string) => {
    const merged = new URLSearchParams(params);
    merged.set('tab', next);
    const resolved = nextSub ?? SUB_DEFAULT[next];
    if (resolved) merged.set('sub', resolved);
    else merged.delete('sub');
    setParams(merged);
  };
  const setSub = (next: string) => {
    const merged = new URLSearchParams(params);
    merged.set('tab', tab);
    if (next) merged.set('sub', next);
    else merged.delete('sub');
    setParams(merged);
  };

  return [tab, sub, setTab, setSub];
}

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
  const frozenCount = (datasets.data ?? []).filter((d) => d.versions.some((v) => v.status === 'frozen')).length;

  function openDataset(d: DatasetSummary, version?: number) {
    const v = version ?? preferredVersion(d.versions);
    if (v == null) return;
    select(d.id, v);
    const row = d.versions.find((x) => x.version === v);
    const docs = row?.documents ?? 0;
    const items = row?.items ?? 0;
    const qs = docs === 0
      ? 'tab=collect'
      : items === 0
        ? 'tab=ask&sub=items'
        : 'tab=gate&sub=checks';
    navigate(`/evaluation/dataset/${encodeURIComponent(d.id)}?${qs}`, { state: { version: v } });
  }

  function goCreated(bundle: DatasetBundle) {
    navigate(`/evaluation/dataset/${encodeURIComponent(bundle.meta.id)}`);
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/40">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-neon/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-plasma/15 blur-3xl" />
        <div className="relative space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">Evaluation</p>
              <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">Golden Sets</h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                One corridor per set — collect, ask, index, judge, pass the Gate, freeze.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative min-w-[180px] flex-1 sm:w-72 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <TextField
                  className="h-10 rounded-xl bg-black/30 pl-9"
                  placeholder="Search by name, id, language…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
              </div>
              <Button size="sm" variant="neon" className="h-10 gap-1.5 px-4" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New dataset
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Stages">
              {LIST_SPINE.map((label, i) => (
                <li key={label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="hidden h-px w-4 bg-white/15 sm:block" />}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                    <span className="font-mono text-[10px] text-neon/80">{i + 1}</span>
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-1.5">
              <Pill>{datasets.data?.length ?? 0} sets</Pill>
              <Pill tone="good">{frozenCount} frozen</Pill>
            </div>
          </div>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-3xl border border-white/8 bg-card/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-card/20 px-6 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neon/10 text-neon">
            <Database className="h-7 w-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">{query ? 'No matches' : 'No golden set yet'}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {query
              ? 'Try a different search, or clear the filter.'
              : 'Create an empty versioned set, then walk Collect → Freeze.'}
          </p>
          {!query && (
            <Button size="sm" variant="neon" className="mt-5 h-10 gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New dataset
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {slice.map((d, i) => (
              <PassportCard
                key={d.id}
                dataset={d}
                index={i}
                onOpen={openDataset}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-card/20 px-3 py-2">
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

function PassportCard({
  dataset: d, index, onOpen,
}: {
  dataset: DatasetSummary;
  index: number;
  onOpen: (d: DatasetSummary, version?: number) => void;
}) {
  const ordered = [...d.versions].sort((a, b) => b.version - a.version);
  const preferred = ordered.find((v) => v.status === 'frozen') ?? ordered[0];
  const frozen = preferred?.status === 'frozen';
  const items = preferred?.items ?? 0;
  const docs = preferred?.documents ?? 0;
  const step = listingStep(docs, items, frozen);
  const cue = step === 0
    ? { next: 'Collect documents into the corpus', cta: 'Open Collect' }
    : step === 1
      ? { next: 'Ask questions the set must answer', cta: 'Open Ask' }
      : frozen
        ? { next: 'Frozen — ready to measure', cta: 'Open Gate' }
        : { next: 'Pass the Gate, then freeze', cta: 'Open Gate' };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(d)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(d); } }}
      style={{ animationDelay: `${index * 60}ms` }}
      className="group relative animate-fade-in-up cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-card/40 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-neon/40 hover:shadow-glow"
    >
      <span className={cn(
        'absolute inset-y-0 left-0 w-1 transition-colors',
        frozen ? 'bg-emerald-400 shadow-[0_0_12px_hsl(160_80%_50%/0.6)]' : 'bg-neon/80 group-hover:bg-neon',
      )} />
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-neon/10 blur-2xl transition-opacity group-hover:opacity-100" />

      <div className="relative p-5 pl-6">
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors',
            frozen
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-neon/20 bg-neon/10 text-neon group-hover:bg-neon/20',
          )}>
            {frozen ? <Lock className="h-5 w-5" /> : <Database className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display text-base font-semibold" title={d.name}>{d.name}</p>
              <Pill>{d.lang}</Pill>
              {preferred && (
                <Pill tone={frozen ? 'good' : 'warn'}>
                  {frozen ? `v${preferred.version} frozen` : `v${preferred.version} draft`}
                </Pill>
              )}
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{d.id}</p>
          </div>
        </div>

        <ol className="mt-4 flex items-center gap-1" aria-label="Progress">
          {LIST_SPINE.map((label, i) => {
            const done = i < step;
            const here = i === step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  title={label}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    here ? 'bg-neon shadow-glow-sm' : done ? 'bg-neon/50' : 'bg-white/10',
                  )}
                />
              </li>
            );
          })}
        </ol>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{LIST_SPINE[step]}</span>
          <span>{step + 1}/6</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Versions</p>
            <p className="font-display text-lg font-semibold tabular-nums">{d.versions.length}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Questions</p>
            <p className="font-display text-lg font-semibold tabular-nums">{items}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Docs</p>
            <p className="font-display text-lg font-semibold tabular-nums">{docs}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {ordered.map((v) => {
            const active = v.version === preferred?.version;
            return (
              <button
                key={v.version}
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpen(d, v.version); }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors',
                  active
                    ? (v.status === 'frozen'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-neon/40 bg-neon/10 text-neon')
                    : 'border-white/10 text-muted-foreground hover:border-neon/40 hover:text-neon',
                )}
                title={`${v.items} items · ${v.documents} docs`}
              >
                {v.status === 'frozen' && <Lock className="h-2.5 w-2.5" />}v{v.version}
              </button>
            );
          })}
          <span className="ml-auto text-[11px] text-muted-foreground">{fmtTime(d.created_at)}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <p className="text-xs text-muted-foreground">{cue.next}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neon">
            {cue.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function GateChapters({
  value, onChange, blockers, warnings,
}: {
  value: GateChapter;
  onChange: (id: string) => void;
  blockers?: number;
  warnings?: number;
}) {
  const assessed = blockers != null && warnings != null;
  const problems = (blockers ?? 0) + (warnings ?? 0);
  const chapters: {
    id: GateChapter;
    title: string;
    blurb: string;
    icon: ElementType;
    badge?: { text: string; tone: 'bad' | 'warn' | 'good' };
  }[] = [
    {
      id: 'checks',
      title: 'Checks',
      blurb: 'Ways a number would lie',
      icon: ShieldCheck,
      badge: assessed
        ? (problems > 0
          ? { text: String(problems), tone: (blockers ?? 0) > 0 ? 'bad' : 'warn' }
          : { text: 'clear', tone: 'good' })
        : undefined,
    },
    { id: 'split', title: 'Split', blurb: 'Dev iterates. Holdout waits.', icon: Scissors },
    { id: 'power', title: 'Power', blurb: 'Smallest effect you can see', icon: Sigma },
    { id: 'profile', title: 'Coverage', blurb: 'Thin strata are anecdotes', icon: BarChart3 },
  ];

  return (
    <nav className="border-t border-white/5 p-2.5 sm:p-3" aria-label="Gate">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {chapters.map((c) => {
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(c.id)}
              className={cn(
                'group relative overflow-hidden rounded-xl border px-3 py-3 text-left transition-all duration-300',
                active
                  ? 'border-neon/50 bg-neon/[0.08] shadow-glow-inner'
                  : 'border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]',
              )}
            >
              {active && <span className="absolute inset-x-0 top-0 h-px bg-neon-gradient" />}
              <span className="flex items-start gap-2.5">
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  active ? 'bg-neon/20 text-neon drop-glow' : 'bg-white/5 text-muted-foreground group-hover:text-foreground',
                )}>
                  <c.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>{c.title}</span>
                    {c.badge && <Pill tone={c.badge.tone}>{c.badge.text}</Pill>}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{c.blurb}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Detail ──────────────────────────────────────────────────────────────── */

function DatasetDetail({ datasetId }: { datasetId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const datasets = useDatasets();
  const { datasetId: selectedId, version, select } = useEvalStore();
  const summary = datasets.data?.find((d) => d.id === datasetId);
  const stateVersion = (location.state as { version?: number } | null)?.version;
  const queryVersion = Number(new URLSearchParams(location.search).get('v'));
  const intendedVersion = stateVersion
    ?? (Number.isFinite(queryVersion) && queryVersion > 0 ? queryVersion : undefined);

  useEffect(() => {
    if (!summary?.versions.length) return;
    const fallback = preferredVersion(summary.versions)
      ?? summary.versions[summary.versions.length - 1].version;
    const fromNav = intendedVersion != null && summary.versions.some((v) => v.version === intendedVersion)
      ? intendedVersion
      : null;
    if (selectedId !== datasetId) {
      select(datasetId, fromNav ?? fallback);
      return;
    }
    if (!summary.versions.some((v) => v.version === version)) select(datasetId, fromNav ?? fallback);
  }, [datasetId, summary, selectedId, version, select, intendedVersion]);

  const { data: bundle, isLoading } = useSelectedDataset();
  const readiness = useReadiness(5);
  const ready = bundle && bundle.meta.id === datasetId;

  const [tab, subtab, setTab, setSub] = useSpineParams();
  const askTab = (subtab as AskTab) || 'items';
  const indexTab = (subtab as IndexTab) || 'chunking';
  const judgeTab = (subtab as JudgeTab) || 'pool';
  const gateTab = (subtab as GateChapter) || 'checks';
  const freezeTab = (subtab as FreezeTab) || 'lifecycle';

  const indexReady = ready
    ? Object.values(bundle.indexes).some((idx) => idx?.current)
    : false;

  const tabs: {
    id: SpineTab;
    step: string;
    title: string;
    blurb: string;
    icon: ElementType;
  }[] = [
    { id: 'collect', step: '1', title: 'Collect', blurb: 'Documents in the corpus',     icon: FileText },
    { id: 'ask',     step: '2', title: 'Ask',     blurb: 'Questions and candidates',    icon: ListChecks },
    { id: 'index',   step: '3', title: 'Index',   blurb: 'Chunk, then index',           icon: Server },
    { id: 'judge',   step: '4', title: 'Judge',   blurb: 'Pool, then audit',            icon: Scale },
    { id: 'gate',    step: '5', title: 'Gate',    blurb: 'Can this freeze support a claim?', icon: ShieldCheck },
    { id: 'freeze',  step: '6', title: 'Freeze',  blurb: 'Lock, fork, diff',            icon: Snowflake },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button size="sm" variant="ghost" className="mt-0.5 h-9 gap-1.5 text-xs"
            onClick={() => navigate('/evaluation/dataset')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Golden Sets
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

          {tab !== 'gate' && (
            <ReadinessStrip
              report={readiness.data}
              bundle={bundle}
              loading={readiness.isFetching}
              onReview={() => setTab('gate', 'checks')}
            />
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
            <nav className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-3 lg:grid-cols-6" aria-label="Golden set stages">
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
                      <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground xl:block">{t.blurb}</span>
                    </span>
                    {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-neon shadow-glow-sm" />}
                  </button>
                );
              })}
            </nav>
            {tab === 'ask' && (
              <SubTabs
                label="Ask"
                value={askTab}
                onChange={setSub}
                options={[
                  { id: 'items', label: 'Questions', icon: ListChecks, count: bundle.items.length },
                  { id: 'synthetic', label: 'Candidates', icon: Bot },
                ]}
              />
            )}
            {tab === 'index' && (
              <SubTabs
                label="Index"
                value={indexTab}
                onChange={setSub}
                options={[
                  { id: 'chunking', label: 'Chunking', icon: Layers },
                  { id: 'index', label: 'Index', icon: Server, count: indexReady ? 'ready' : 'pending' },
                ]}
              />
            )}
            {tab === 'judge' && (
              <SubTabs
                label="Judge"
                value={judgeTab}
                onChange={setSub}
                options={[
                  { id: 'pool', label: 'Pool', icon: Layers3 },
                  { id: 'audit', label: 'Audit', icon: CheckCheck },
                ]}
              />
            )}
            {tab === 'gate' && (
              <GateChapters
                value={gateTab}
                onChange={setSub}
                blockers={readiness.data?.counts.blocker}
                warnings={readiness.data?.counts.warning}
              />
            )}
            {tab === 'freeze' && (
              <SubTabs
                label="Freeze"
                value={freezeTab}
                onChange={setSub}
                options={[
                  { id: 'lifecycle', label: 'Lifecycle', icon: Snowflake, count: bundle.manifest.status },
                  { id: 'diff', label: 'Diff', icon: GitCompareArrows },
                ]}
              />
            )}
          </div>

          <div
            key={`${tab}-${subtab}`}
            className="animate-fade-in space-y-4"
          >
            {tab === 'collect' && <CorpusSection bundle={bundle} />}
            {tab === 'ask' && askTab === 'items' && <ItemsSection bundle={bundle} />}
            {tab === 'ask' && askTab === 'synthetic' && <SyntheticSection bundle={bundle} />}
            {tab === 'index' && indexTab === 'chunking' && <ChunkingSection bundle={bundle} />}
            {tab === 'index' && indexTab === 'index' && <IndexSection bundle={bundle} />}
            {tab === 'judge' && judgeTab === 'pool' && <PoolingSection bundle={bundle} />}
            {tab === 'judge' && judgeTab === 'audit' && <AgreementSection bundle={bundle} />}
            {tab === 'gate' && <GateSection bundle={bundle} chapter={gateTab} />}
            {tab === 'freeze' && freezeTab === 'lifecycle' && (
              <VersionPanel bundle={bundle} versions={summary?.versions ?? []} />
            )}
            {tab === 'freeze' && freezeTab === 'diff' && <DiffSection bundle={bundle} />}
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
          so “v2 recall” always refers to the same questions. Freeze → Diff shows what a fork did to comparability.
        </PrincipalNote>
      </div>
    </Panel>
  );
}

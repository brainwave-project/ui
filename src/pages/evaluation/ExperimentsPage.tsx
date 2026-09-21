import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Download, FileBarChart, Flag, History, Lock, Play, Plus, Save,
  Scale, Search, ShieldAlert, Trash2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import {
  evalKeys, useDatasets, useEvalMutation, useExperimentReport, useExperiments, useJob, useRuns,
} from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, JobBar, LockedBanner, Panel, Pill, PrincipalNote, Segmented, SelectBox, Stat,
  SubTabs, TextArea, TextField, Toggle, downloadText,
} from '@/features/evaluation/components/EvalPrimitives';
import { preferredVersion } from '@/features/evaluation/components/DatasetPicker';
import { DEFAULT_VARIANT, VariantEditor } from '@/features/evaluation/components/VariantEditor';
import { ArmIntervals, ForestPlot, ScoreHistogram, VIZ, type IntervalMethod } from '@/features/evaluation/components/charts';
import { BinnedHistogram } from '@/features/evaluation/components/statCharts';
import { NoRuns, WarningList } from '@/features/evaluation/components/RunViews';
import {
  METRIC_INFO, METRIC_KEYS, detectableEffect, fmt3, fmtSigned, fmtTime, shortHash,
} from '@/features/evaluation/lib/evalStats';
import { useEvalStore } from '@/store/eval.store';
import type {
  Experiment, ExperimentInput, ExperimentReport, Job, Split, Verdict,
} from '@/types/eval';

const VERDICT: Record<Verdict, { label: string; tone: 'good' | 'bad' | 'warn' | 'info' | 'neutral'; cls: string }> = {
  success:              { label: 'Success',                 tone: 'good',    cls: 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' },
  detectable_but_small: { label: 'Real but below threshold', tone: 'info',   cls: 'border-sky-500/30 bg-sky-500/[0.06] text-sky-300' },
  no_meaningful_effect: { label: 'No meaningful effect',    tone: 'neutral', cls: 'border-white/15 bg-white/[0.04] text-foreground' },
  inconclusive:         { label: 'Inconclusive',            tone: 'warn',    cls: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-300' },
  harm:                 { label: 'Regression',              tone: 'bad',     cls: 'border-red-500/30 bg-red-500/[0.06] text-red-400' },
  guardrail_breach:     { label: 'Guardrail breach',        tone: 'bad',     cls: 'border-red-500/30 bg-red-500/[0.06] text-red-400' },
};

const blankExperiment = (datasetId: string, version: number): ExperimentInput => ({
  name: '', hypothesis: '', rationale: '', dataset_id: datasetId, dataset_version: version,
  baseline:  { ...DEFAULT_VARIANT, name: 'baseline' },
  treatment: { ...DEFAULT_VARIANT, name: 'treatment' },
  criteria:  { primary_metric: 'recall@k', k: 5, direction: 'increase', min_effect: 0.05, confidence: 0.95, guardrails: [] },
  secondary_metrics: ['mrr', 'ndcg@k'],
});

const PAGE_SIZE = 8;
const LIST_SPINE = ['Design', 'Register', 'Score', 'Report'] as const;

function listingStep(e: Experiment) {
  if (e.status === 'draft') return 0;
  if (e.status === 'concluded') return 3;
  if (e.runs.length === 0) return 1;
  return 2;
}

function statusTone(status: Experiment['status']): 'warn' | 'info' | 'good' {
  if (status === 'draft') return 'warn';
  if (status === 'registered') return 'info';
  return 'good';
}

export function ExperimentsPage() {
  return <ExperimentList />;
}

export function ExperimentCreatePage() {
  return <ExperimentCreate />;
}

export function ExperimentDetailPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  if (!experimentId) return null;
  return <ExperimentDetail experimentId={experimentId} />;
}

/* ── Listing ─────────────────────────────────────────────────────────────── */

function ExperimentList() {
  const experiments = useExperiments();
  const datasets = useDatasets();
  const navigate = useNavigate();
  const selectExperiment = useEvalStore((s) => s.selectExperiment);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const names = useMemo(
    () => Object.fromEntries((datasets.data ?? []).map((d) => [d.id, d.name])),
    [datasets.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [...(experiments.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!q) return rows;
    return rows.filter((e) =>
      `${e.name} ${e.id} ${e.dataset_id} ${e.hypothesis} ${e.status}`.toLowerCase().includes(q));
  }, [experiments.data, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const registeredCount = (experiments.data ?? []).filter((e) => e.status !== 'draft').length;
  const concludedCount = (experiments.data ?? []).filter((e) => e.status === 'concluded').length;

  function openExperiment(e: Experiment) {
    selectExperiment(e.id);
    const tab = e.status === 'draft' ? 'design' : 'report';
    navigate(`/evaluation/experiments/${encodeURIComponent(e.id)}?tab=${tab}`);
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
              <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">Experiments</h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Pre-register a comparison, score the arms, then read the report. Holdout access is logged.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative min-w-[180px] flex-1 sm:w-72 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <TextField
                  className="h-10 rounded-xl bg-black/30 pl-9"
                  placeholder="Search by name, dataset, status…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
              </div>
              <Button size="sm" variant="neon" className="h-10 gap-1.5 px-4"
                onClick={() => navigate('/evaluation/experiments/new')}>
                <Plus className="h-3.5 w-3.5" /> New experiment
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
              <Pill>{experiments.data?.length ?? 0} experiments</Pill>
              <Pill tone="info">{registeredCount} registered</Pill>
              <Pill tone="good">{concludedCount} concluded</Pill>
            </div>
          </div>
        </div>
      </div>

      {experiments.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-3xl border border-white/8 bg-card/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-card/20 px-6 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neon/10 text-neon">
            <Scale className="h-7 w-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">{query ? 'No matches' : 'No experiments yet'}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {query
              ? 'Try a different search, or clear the filter.'
              : 'Pre-register a baseline vs treatment on a frozen golden set, then score the arms.'}
          </p>
          {!query && (
            <Button size="sm" variant="neon" className="mt-5 h-10 gap-1.5"
              onClick={() => navigate('/evaluation/experiments/new')}>
              <Plus className="h-3.5 w-3.5" /> New experiment
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {slice.map((e, i) => (
              <ExperimentCard
                key={e.id}
                experiment={e}
                datasetName={names[e.dataset_id]}
                index={i}
                onOpen={openExperiment}
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

function ExperimentCard({
  experiment: e, datasetName, index, onOpen,
}: {
  experiment: Experiment;
  datasetName?: string;
  index: number;
  onOpen: (e: Experiment) => void;
}) {
  const step = listingStep(e);
  const verdict = e.conclusion?.decision ? VERDICT[e.conclusion.decision.verdict] : null;
  const cue = e.status === 'draft'
    ? { next: 'Write the hypothesis, then register before scoring', cta: 'Open design' }
    : e.status === 'concluded'
      ? { next: 'Decision is frozen in the record', cta: 'View report' }
      : e.runs.length === 0
        ? { next: 'Registered — score both arms on a split', cta: 'Open report' }
        : { next: 'Read the paired comparison against the criteria', cta: 'Open report' };
  const Icon = e.status === 'concluded' ? CheckCircle2 : e.status === 'registered' ? Lock : Scale;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(e)}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(e); } }}
      style={{ animationDelay: `${index * 60}ms` }}
      className="group relative animate-fade-in-up cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-card/40 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-neon/40 hover:shadow-glow"
    >
      <span className={cn(
        'absolute inset-y-0 left-0 w-1 transition-colors',
        e.status === 'concluded' ? 'bg-emerald-400 shadow-[0_0_12px_hsl(160_80%_50%/0.6)]'
          : e.status === 'registered' ? 'bg-sky-400/80' : 'bg-neon/80 group-hover:bg-neon',
      )} />
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-neon/10 blur-2xl transition-opacity group-hover:opacity-100" />

      <div className="relative p-5 pl-6">
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors',
            e.status === 'concluded'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : e.status === 'registered'
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                : 'border-neon/20 bg-neon/10 text-neon group-hover:bg-neon/20',
          )}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-display text-base font-semibold" title={e.name || e.id}>{e.name || 'Untitled experiment'}</p>
              <Pill tone={statusTone(e.status)}>
                {e.status !== 'draft' && <Lock className="h-2.5 w-2.5" />}{e.status}
              </Pill>
              {verdict && <Pill tone={verdict.tone}>{verdict.label}</Pill>}
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{e.id}</p>
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
          <span>{step + 1}/4</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dataset</p>
            <p className="truncate font-display text-sm font-semibold" title={datasetName ?? e.dataset_id}>
              {datasetName ?? e.dataset_id} <span className="font-mono text-xs font-normal text-muted-foreground">v{e.dataset_version}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary</p>
            <p className="truncate font-display text-sm font-semibold">{METRIC_INFO[e.criteria.primary_metric]?.short ?? e.criteria.primary_metric}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Runs</p>
            <p className="font-display text-lg font-semibold tabular-nums">{e.runs.length}</p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-xs text-muted-foreground" title={e.hypothesis}>
          {e.hypothesis || 'No hypothesis written yet.'}
        </p>

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

/* ── Create ──────────────────────────────────────────────────────────────── */

function ExperimentCreate() {
  const navigate = useNavigate();
  const datasets = useDatasets();
  const { datasetId, version, select, selectExperiment } = useEvalStore();

  const target = useMemo(() => {
    const rows = datasets.data ?? [];
    if (datasetId && version != null && rows.some((d) => d.id === datasetId && d.versions.some((v) => v.version === version))) {
      return { datasetId, version };
    }
    const first = rows[0];
    const v = first ? preferredVersion(first.versions) : undefined;
    return first && v != null ? { datasetId: first.id, version: v } : null;
  }, [datasets.data, datasetId, version]);

  useEffect(() => {
    if (target && (datasetId !== target.datasetId || version !== target.version)) {
      select(target.datasetId, target.version);
    }
  }, [target, datasetId, version, select]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Button size="sm" variant="ghost" className="mt-0.5 h-9 gap-1.5 text-xs"
          onClick={() => navigate('/evaluation/experiments')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Experiments
        </Button>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">New experiment</h3>
          <p className="text-sm text-muted-foreground">
            Write the hypothesis and lock the arms before any result exists.
          </p>
        </div>
      </div>

      {datasets.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-white/8 bg-card/30" />
      ) : !target ? (
        <Panel title="Need a golden set" icon={Scale}>
          <EmptyState icon={Scale} title="Create a golden set first">
            Experiments run against a versioned dataset. Open Golden Sets, then come back here.
            <div className="mt-4">
              <Button size="sm" variant="neon" className="gap-1.5" onClick={() => navigate('/evaluation/dataset')}>
                Go to Golden Sets
              </Button>
            </div>
          </EmptyState>
        </Panel>
      ) : (
        <ExperimentDesigner
          key={`${target.datasetId}@${target.version}`}
          initial={blankExperiment(target.datasetId, target.version)}
          onSaved={(e) => {
            selectExperiment(e.id);
            navigate(`/evaluation/experiments/${encodeURIComponent(e.id)}?tab=design`);
          }}
        />
      )}
    </div>
  );
}

/* ── Detail ──────────────────────────────────────────────────────────────── */

function ExperimentDetail({ experimentId }: { experimentId: string }) {
  const navigate = useNavigate();
  const experiments = useExperiments();
  const selectExperiment = useEvalStore((s) => s.selectExperiment);
  const selected = experiments.data?.find((e) => e.id === experimentId) ?? null;
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: 'design' | 'report' = raw === 'report' || raw === 'design'
    ? raw
    : (selected?.status === 'draft' ? 'design' : 'report');

  useEffect(() => { selectExperiment(experimentId); }, [experimentId, selectExperiment]);

  const setTab = (next: 'design' | 'report') => {
    const merged = new URLSearchParams(params);
    merged.set('tab', next);
    setParams(merged);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button size="sm" variant="ghost" className="mt-0.5 h-9 gap-1.5 text-xs"
            onClick={() => navigate('/evaluation/experiments')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Experiments
          </Button>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{selected?.name ?? experimentId}</h3>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {selected
                ? selected.status === 'draft'
                  ? 'draft — design is editable'
                  : `${selected.status} ${fmtTime(selected.registered_at)} · dataset ${shortHash(selected.dataset_hash)}`
                : experimentId}
            </p>
          </div>
        </div>
        {selected && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={statusTone(selected.status)}>
              {selected.status !== 'draft' && <Lock className="h-2.5 w-2.5" />}{selected.status}
            </Pill>
            {selected.conclusion?.decision && (
              <Pill tone={VERDICT[selected.conclusion.decision.verdict].tone}>
                {VERDICT[selected.conclusion.decision.verdict].label}
              </Pill>
            )}
          </div>
        )}
      </div>

      {experiments.isLoading && <div className="h-48 animate-pulse rounded-2xl border border-white/8 bg-card/30" />}

      {!experiments.isLoading && !selected && (
        <Panel title="Unknown experiment" icon={Scale}>
          <EmptyState icon={Scale} title="This experiment is not on the lab">
            It may have been removed, or the Eval Lab API is on a different stack.
          </EmptyState>
        </Panel>
      )}

      {selected && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30">
          <SubTabs
            label="Experiment"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'design', label: 'Design', icon: ClipboardCheck },
              { id: 'report', label: 'Report', icon: FileBarChart, count: selected.runs.length || undefined },
            ]}
          />
          <div key={tab} className="animate-fade-in p-4">
            {tab === 'design' && (
              <ExperimentDesigner
                key={selected.id + selected.status}
                initial={selected}
                experiment={selected}
                onSaved={() => {}}
                onDeleted={() => {
                  selectExperiment(null);
                  navigate('/evaluation/experiments');
                }}
              />
            )}
            {tab === 'report' && (
              <div className="space-y-4">
                <ExperimentRunPanel experiment={selected} />
                <ExperimentReportView experiment={selected} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Design & pre-registration ───────────────────────────────────────────── */

function ExperimentDesigner({ initial, experiment, onSaved, onDeleted }: {
  initial: ExperimentInput; experiment?: Experiment; onSaved: (e: Experiment) => void; onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<ExperimentInput>(initial);
  const locked = !!experiment && experiment.status !== 'draft';
  const datasets = useDatasets();
  const set = <K extends keyof ExperimentInput>(key: K, v: ExperimentInput[K]) => setDraft((d) => ({ ...d, [key]: v }));
  const setCriteria = (patch: Partial<ExperimentInput['criteria']>) => setDraft((d) => ({ ...d, criteria: { ...d.criteria, ...patch } }));

  const bundleQuery = useQuery({
    queryKey: evalKeys.version(draft.dataset_id, draft.dataset_version),
    queryFn: () => evalApi.version(draft.dataset_id, draft.dataset_version),
    enabled: !!draft.dataset_id,
  });
  const bundle = bundleQuery.data;

  const save = useEvalMutation(
    (body: ExperimentInput) => (experiment ? evalApi.updateExperiment(experiment.id, body) : evalApi.createExperiment(body)),
    { success: 'Experiment saved', invalidate: [evalKeys.experiments as unknown as unknown[]], onSuccess: onSaved },
  );
  const register = useEvalMutation((id: string) => evalApi.register(id),
    { success: 'Registered — the design is now locked', invalidate: [evalKeys.experiments as unknown as unknown[]] });
  const remove = useEvalMutation((id: string) => evalApi.deleteExperiment(id),
    { success: 'Experiment deleted', invalidate: [evalKeys.experiments as unknown as unknown[]], onSuccess: () => onDeleted?.() });

  const changed = (Object.keys(draft.baseline) as (keyof typeof draft.baseline)[])
    .filter((f) => f !== 'name' && draft.baseline[f] !== draft.treatment[f]);

  const holdoutN = bundle ? bundle.items.filter((i) => i.split === 'holdout' && Object.keys(i.relevant).length).length : 0;
  const mde = detectableEffect(holdoutN, 0.35, draft.criteria.confidence);
  const checklist: [boolean, string, string][] = [
    [draft.hypothesis.trim().length > 20, 'Hypothesis written down', 'State the change, the metric, the direction and why — before any result exists.'],
    [bundle?.manifest.status === 'frozen', 'Dataset version frozen', 'Results must be tied to a content hash.'],
    [!!bundle && bundle.split_summary.unassigned === 0 && holdoutN > 0, 'Split assigned with a holdout', 'Confirmatory numbers come from items you never tuned on.'],
    [changed.length === 1, 'Exactly one variable changed', changed.length === 0 ? 'Arms are identical.' : changed.length > 1 ? `Confounded: ${changed.join(', ')}.` : `Varies: ${changed[0]}.`],
    [draft.criteria.min_effect > 0, 'Minimum effect worth acting on', 'Separates “real” from “worth shipping”.'],
    [Number.isFinite(mde) && mde <= draft.criteria.min_effect * 1.5, 'Holdout can plausibly detect it',
      `Holdout n=${holdoutN} detects ±${Number.isFinite(mde) ? mde.toFixed(2) : '∞'} (assumed sd 0.35) vs min effect ${draft.criteria.min_effect}.`],
  ];

  const frozenVersions = (datasets.data ?? []).flatMap((d) => d.versions.map((v) => ({
    value: `${d.id}@${v.version}`, label: `${d.name} · v${v.version} · ${v.status}`,
  })));

  return (
    <div className="space-y-4">
      {locked && (
        <LockedBanner>
          <strong className="text-foreground">Pre-registered.</strong> Hypothesis, arms and success criteria were fixed on{' '}
          {fmtTime(experiment?.registered_at)} against dataset hash <span className="font-mono">{shortHash(experiment?.dataset_hash)}</span>.
          To test something else, create a new experiment — editing a registered design after seeing data is how p-hacking starts.
        </LockedBanner>
      )}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Hypothesis & success criteria" icon={Flag}>
          <fieldset disabled={locked} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name"><TextField value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Query normalisation on Arabic" /></Field>
              <Field label="Dataset version">
                <SelectBox value={`${draft.dataset_id}@${draft.dataset_version}`} disabled={locked}
                  options={frozenVersions.length ? frozenVersions : [{ value: `${draft.dataset_id}@${draft.dataset_version}`, label: `${draft.dataset_id} v${draft.dataset_version}` }]}
                  onChange={(v) => { const [id, ver] = v.split('@'); setDraft((d) => ({ ...d, dataset_id: id, dataset_version: Number(ver) })); }} />
              </Field>
            </div>
            <Field label="Hypothesis" hint="If we <change>, then <primary metric> will <increase> by at least <min effect>, because <mechanism>.">
              <TextArea className="min-h-[70px] font-sans text-sm" value={draft.hypothesis} onChange={(e) => set('hypothesis', e.target.value)}
                placeholder="If we normalise Arabic queries (conservative), recall@5 on the Arabic set will increase by ≥ 0.05, because alef/hamza and digit variants will match the document spelling." />
            </Field>
            <Field label="Rationale / prior evidence">
              <TextArea className="min-h-[44px] font-sans" value={draft.rationale} onChange={(e) => set('rationale', e.target.value)} />
            </Field>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Primary metric" hint="One metric decides. Everything else is secondary.">
                <SelectBox value={draft.criteria.primary_metric} onChange={(v) => setCriteria({ primary_metric: v })}
                  options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))} />
              </Field>
              <Field label="k"><TextField type="number" min={1} max={50} value={draft.criteria.k} onChange={(e) => setCriteria({ k: Math.max(1, Math.min(50, Number(e.target.value) || 5)) })} /></Field>
              <Field label="Minimum effect" hint={draft.criteria.direction === 'non_inferior' ? 'Non-inferiority margin.' : 'Smallest Δ worth acting on.'}>
                <TextField type="number" step={0.01} min={0.01} max={1} value={draft.criteria.min_effect} onChange={(e) => setCriteria({ min_effect: Math.max(0.01, Math.min(1, Number(e.target.value))) })} />
              </Field>
              <Field label="Confidence level" hint="An input to the interval procedure, not a probability about this result.">
                <SelectBox value={draft.criteria.confidence} onChange={(v) => setCriteria({ confidence: v })}
                  options={[{ value: 0.9, label: '90%' }, { value: 0.95, label: '95%' }, { value: 0.99, label: '99%' }]} />
              </Field>
            </div>
            <Field label="Direction">
              <Segmented value={draft.criteria.direction} onChange={(v) => setCriteria({ direction: v })}
                options={[
                  { value: 'increase', label: 'increase' },
                  { value: 'decrease', label: 'decrease' },
                  { value: 'non_inferior', label: 'non-inferior (not worse by > margin)' },
                ]} />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Secondary metrics (exploratory)" hint="Reported, never decisive. Each one adds a chance of a spurious “significant”.">
                <div className="flex flex-wrap gap-3 pt-1">
                  {METRIC_KEYS.filter((m) => m !== draft.criteria.primary_metric).map((m) => (
                    <Toggle key={m} checked={draft.secondary_metrics.includes(m)} disabled={locked} label={METRIC_INFO[m].short}
                      onChange={(on) => set('secondary_metrics', on ? [...draft.secondary_metrics, m] : draft.secondary_metrics.filter((x) => x !== m))} />
                  ))}
                </div>
              </Field>
              <Field label="Guardrails" hint="A metric that must not drop more than a tolerance, even if the primary improves.">
                <div className="space-y-1.5">
                  {draft.criteria.guardrails.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <SelectBox className="text-xs" value={g.metric} disabled={locked}
                        options={METRIC_KEYS.map((m) => ({ value: m, label: METRIC_INFO[m].label }))}
                        onChange={(v) => setCriteria({ guardrails: draft.criteria.guardrails.map((x, n) => (n === i ? { ...x, metric: v } : x)) })} />
                      <TextField type="number" step={0.01} className="w-20 text-xs" value={g.max_drop}
                        onChange={(e) => setCriteria({ guardrails: draft.criteria.guardrails.map((x, n) => (n === i ? { ...x, max_drop: Number(e.target.value) } : x)) })} />
                      <button type="button" className="text-muted-foreground hover:text-red-400" onClick={() => setCriteria({ guardrails: draft.criteria.guardrails.filter((_, n) => n !== i) })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => setCriteria({ guardrails: [...draft.criteria.guardrails, { metric: 'precision@k', max_drop: 0.05 }] })}>
                    <Plus className="mr-1 h-3 w-3" /> Guardrail
                  </Button>
                </div>
              </Field>
            </div>
          </fieldset>
        </Panel>

        <div className="space-y-4">
          <Panel title="Pre-registration checklist" icon={ClipboardCheck}>
            <div className="space-y-2">
              {checklist.map(([ok, title, detail]) => (
                <div key={title} className="flex items-start gap-2 text-xs">
                  {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
                  <div><p className="font-medium">{title}</p><p className="text-muted-foreground">{detail}</p></div>
                </div>
              ))}
            </div>
            {!locked && (
              <div className="mt-4 grid gap-2">
                <Button size="sm" className="gap-1.5" disabled={!draft.name.trim() || save.isPending} onClick={() => save.mutate(draft)}>
                  <Save className="h-3.5 w-3.5" /> Save draft
                </Button>
                {experiment && (
                  <>
                    <Button size="sm" variant="neon" className="gap-1.5" disabled={register.isPending}
                      onClick={() => save.mutate(draft, { onSuccess: () => register.mutate(experiment.id) })}>
                      <Lock className="h-3.5 w-3.5" /> Save &amp; register
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground hover:text-red-400" onClick={() => remove.mutate(experiment.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete draft
                    </Button>
                  </>
                )}
              </div>
            )}
          </Panel>
          <PrincipalNote title="P-hacking & selective reporting">
            With 7 metrics, 2 splits and a few variants, something will cross “significant” by chance. The defences are
            structural: <strong>one primary metric</strong>, a <strong>minimum effect</strong> and a <strong>holdout</strong>,
            all fixed <em>before</em> data; a report built from the <strong>latest</strong> run of each arm, listing
            <strong> every</strong> run ever made.
          </PrincipalNote>
        </div>
      </div>

      <Panel title="Arms" icon={Scale}
        actions={<Pill tone={changed.length === 1 ? 'good' : changed.length === 0 ? 'bad' : 'warn'}>
          {changed.length === 0 ? 'identical arms' : `varies: ${changed.join(', ')}`}
        </Pill>}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.baseline }} /> Baseline (control)</p>
            <VariantEditor value={draft.baseline} onChange={(v) => set('baseline', v)} disabled={locked}
              indexed={bundle ? { off: !!bundle.indexes.off?.current, conservative: !!bundle.indexes.conservative?.current, aggressive: !!bundle.indexes.aggressive?.current } : undefined} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VIZ.treatment }} /> Treatment <span className="text-muted-foreground">(amber = differs from baseline)</span></p>
            <VariantEditor value={draft.treatment} onChange={(v) => set('treatment', v)} disabled={locked} compareTo={draft.baseline}
              indexed={bundle ? { off: !!bundle.indexes.off?.current, conservative: !!bundle.indexes.conservative?.current, aggressive: !!bundle.indexes.aggressive?.current } : undefined} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

function ExperimentRunPanel({ experiment }: { experiment: Experiment }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const trackJob = useEvalStore((s) => s.trackJob);
  const { data: job } = useJob(jobId);
  const runs = useRuns(experiment.dataset_id);
  const mine = (runs.data ?? []).filter((r) => r.experiment_id === experiment.id);

  const start = useEvalMutation(
    (split: Split) => evalApi.runExperiment(experiment.id, split, reason),
    { success: 'Runs started', onSuccess: (j: Job) => { setJobId(j.id); trackJob(j.id); setAck(false); setReason(''); } },
  );

  const registered = experiment.status === 'registered';
  const peeks = experiment.holdout_access.length;
  const running = job?.status === 'running';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Dev split · exploratory" icon={Play} subtitle="Iterate freely. Numbers here guide the next change; they do not decide.">
          <Button className="gap-1.5" disabled={running || start.isPending || experiment.status === 'concluded'} onClick={() => start.mutate('dev')}>
            <Play className="h-4 w-4" /> Run both arms on dev
          </Button>
        </Panel>
        <Panel title="Holdout split · confirmatory" icon={ShieldAlert}
          subtitle={registered ? `Accessed ${peeks} time${peeks === 1 ? '' : 's'} so far.` : 'Register the experiment first.'}>
          <div className="space-y-2">
            {peeks > 0 && (
              <Field label="Why look again? (kept in the record)">
                <TextArea className="min-h-[50px] font-sans" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. first run failed: know-hub was still embedding" />
              </Field>
            )}
            <Toggle checked={ack} onChange={setAck} disabled={!registered}
              label="I will not change the system in response to this result before concluding." />
            <Button variant="neon" className="gap-1.5"
              disabled={!registered || !ack || running || start.isPending || (peeks > 0 && !reason.trim())}
              onClick={() => start.mutate('holdout')}>
              <ShieldAlert className="h-4 w-4" /> Evaluate on holdout
            </Button>
          </div>
        </Panel>
      </div>
      <JobBar jobId={jobId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Run history" icon={History} subtitle="Every run this experiment made. None are ever dropped.">
          {mine.length === 0 ? <NoRuns /> : (
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1 pr-2">run</th><th className="pr-2">arm</th><th className="pr-2">split</th><th className="pr-2">{METRIC_INFO[experiment.criteria.primary_metric]?.short}</th><th>status</th></tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-1 pr-2 font-mono text-[10px]">{r.id}</td>
                    <td className="pr-2"><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: r.arm === 'baseline' ? VIZ.baseline : VIZ.treatment }} />{r.arm}</td>
                    <td className="pr-2">{r.split === 'holdout' ? <Pill tone="info">holdout</Pill> : 'dev'}</td>
                    <td className="pr-2 font-mono">{fmt3(r.aggregates[experiment.criteria.primary_metric]?.mean)}</td>
                    <td><Pill tone={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Holdout access log" icon={ShieldAlert}>
          {experiment.holdout_access.length === 0 ? (
            <p className="text-xs text-muted-foreground">The holdout has not been evaluated.</p>
          ) : (
            <ol className="space-y-2 text-xs">
              {experiment.holdout_access.map((a, i) => (
                <li key={i} className="rounded-md border border-white/8 p-2">
                  <p className="font-mono text-[10px] text-muted-foreground">#{i + 1} · {fmtTime(a.at)} · {a.run_ids.length} run(s)</p>
                  <p>{a.reason || <span className="text-muted-foreground">first evaluation</span>}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── Report ──────────────────────────────────────────────────────────────── */

function ExperimentReportView({ experiment }: { experiment: Experiment }) {
  const [split, setSplit] = useState<Split>(experiment.holdout_access.length ? 'holdout' : 'dev');
  const [method, setMethod] = useState<IntervalMethod>('bootstrap');
  const [note, setNote] = useState('');
  const { data: report, isFetching, isError } = useExperimentReport(experiment.id, split, true);
  const conclude = useEvalMutation((n: string) => evalApi.conclude(experiment.id, n),
    { success: 'Experiment concluded', invalidate: [evalKeys.experiments as unknown as unknown[]] });

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented value={split} onChange={setSplit}
        options={[{ value: 'dev', label: 'dev · exploratory' }, { value: 'holdout', label: 'holdout · confirmatory' }]} />
      {isFetching && <span className="text-xs text-muted-foreground">bootstrapping…</span>}
      {report?.status === 'ok' && (
        <Button size="sm" variant="ghost" className="ml-auto gap-1.5 text-xs"
          onClick={() => downloadText(`${experiment.id}-${split}-report.json`, JSON.stringify(report, null, 2))}>
          <Download className="h-3.5 w-3.5" /> Export report
        </Button>
      )}
    </div>
  );

  if (isError || !report) return <div className="space-y-4">{header}<Panel title="Report" icon={FileBarChart}><div className="h-24" /></Panel></div>;
  if (report.status !== 'ok') {
    return (
      <div className="space-y-4">
        {header}
        <Panel title="Report" icon={FileBarChart}>
          <NoRuns>Missing runs on <strong>{split}</strong> for: {report.missing?.join(', ')}. Score both arms above.</NoRuns>
          <WarningList warnings={report.warnings} />
        </Panel>
      </div>
    );
  }

  const primaryKey = report.criteria.primary_metric;
  const primary = report.metrics![primaryKey];
  const verdict = VERDICT[report.decision!.verdict];

  return (
    <div className="space-y-4">
      {header}

      {/* Decision */}
      <div className={cn('rounded-xl border p-4', verdict.cls)}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-lg font-bold">{verdict.label}</p>
          <Pill tone={report.confirmatory ? 'good' : 'warn'}>{report.confirmatory ? 'confirmatory' : 'exploratory — not a decision'}</Pill>
          <Pill>{METRIC_INFO[primaryKey].label} @ k={report.criteria.k}</Pill>
          <Pill>{report.criteria.direction} · min effect {report.criteria.min_effect}</Pill>
        </div>
        <p className="mt-1.5 text-sm text-foreground">{report.decision!.headline}</p>
        {report.decision!.reasons.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{report.decision!.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        )}
      </div>

      <WarningList warnings={report.warnings} />

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title={`Primary · ${METRIC_INFO[primaryKey].label}`} icon={Flag}
          actions={<Segmented size="xs" value={method} onChange={setMethod}
            options={[{ value: 'bootstrap', label: 'bootstrap' }, { value: 't', label: 't-dist' }, { value: 'cluster', label: 'cluster' }]} />}>
          <div className="space-y-3">
            <ArmIntervals baseline={primary.baseline} treatment={primary.treatment} method={method}
              labels={[report.baseline_variant!.name, report.treatment_variant!.name]} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Δ mean (paired)" value={fmtSigned(primary.delta.mean)} sub={`n = ${primary.delta.n} pairs`} />
              <Stat label={`${Math.round(report.criteria.confidence * 100)}% CI`} value={<span className="text-sm">[{fmtSigned(primary.delta.low)}, {fmtSigned(primary.delta.high)}]</span>}
                sub={primary.delta.significant ? 'excludes 0' : 'crosses 0'} />
              <Stat label="Cluster CI" value={<span className="text-sm">[{fmtSigned(primary.delta.cluster.low)}, {fmtSigned(primary.delta.cluster.high)}]</span>}
                sub={`${primary.delta.cluster.clusters} document clusters`} />
              <Stat label="p (sign-flip shuffle)" value={primary.delta.p_permutation.toFixed(3)} sub={`W/L/T ${primary.delta.wins}/${primary.delta.losses}/${primary.delta.ties}`} />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Stat label="Effect size d_z" value={primary.delta.effect_size_dz !== undefined ? primary.delta.effect_size_dz.toFixed(2) : '—'}
                sub="mean Δ ÷ sd(Δ) — inflated when most Δ are 0" />
              <Stat label="p (paired t)" value={primary.delta.p_ttest !== undefined ? primary.delta.p_ttest.toFixed(3) : '—'}
                sub="assumes normal deltas — compare with shuffle" />
              <Stat label="p (Holm-adjusted)" value={primary.delta.p_holm !== undefined ? primary.delta.p_holm.toFixed(3) : '—'}
                sub={`family: primary + ${experiment.secondary_metrics.length} secondary`} />
            </div>
            {report.primary_bootstrap && report.primary_bootstrap.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Bootstrap distribution of the paired Δ — the interval is its two tails</p>
                <BinnedHistogram bins={report.primary_bootstrap} unit="resamples" formatX={(v) => v.toFixed(3)}
                  markers={[
                    { x: 0, label: '0' },
                    ...(primary.delta.low !== null ? [{ x: primary.delta.low, label: 'CI lo', color: VIZ.baseline }] : []),
                    ...(primary.delta.high !== null ? [{ x: primary.delta.high, label: 'CI hi', color: VIZ.baseline }] : []),
                    {
                      x: report.criteria.direction === 'increase' ? report.criteria.min_effect : -report.criteria.min_effect,
                      label: report.criteria.direction === 'non_inferior' ? 'margin' : 'min effect',
                      color: VIZ.good,
                    },
                  ]} />
              </div>
            )}
            <PrincipalNote title="Which interval to believe">
              <strong>Bootstrap</strong> resamples your questions, so it respects the bounded, often bimodal shape of the
              scores. The <strong>t-interval</strong> assumes normality (the CLT has not kicked in at small n) — watch it
              spill outside [0, 1]. The <strong>cluster</strong> bootstrap resamples whole answer documents: when questions
              share a document they fail together, the effective n is the number of clusters, and the honest interval is
              wider. A 95% confidence level describes the procedure — 95% of intervals built this way cover the truth —
              not a 95% chance that <em>this</em> one does.
            </PrincipalNote>
          </div>
        </Panel>

        <Panel title="All metrics · paired deltas" icon={Scale} subtitle="Shaded: region meeting the minimum effect. Only the primary decides.">
          <ForestPlot
            minEffect={report.criteria.min_effect}
            direction={report.criteria.direction}
            rows={METRIC_KEYS.filter((m) => report.metrics![m]).map((m) => {
              const c = report.metrics![m];
              return {
                label: METRIC_INFO[m].label, sublabel: c.role, emphasis: c.role === 'primary',
                mean: c.delta.mean, low: c.delta.low, high: c.delta.high,
                clusterLow: c.delta.cluster.low, clusterHigh: c.delta.cluster.high,
              };
            })}
          />
        </Panel>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title="Per-query distribution" icon={FileBarChart} subtitle="Where does the mean come from?">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium">Scores by arm</p>
              <ScoreHistogram height={140} series={[
                { label: report.baseline_variant!.name, values: report.per_query!.map((r) => r.baseline), color: VIZ.baseline },
                { label: report.treatment_variant!.name, values: report.per_query!.map((r) => r.treatment), color: VIZ.treatment },
              ]} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">Paired deltas (treatment − baseline)</p>
              <ScoreHistogram height={140} zeroLine bins={20} domain={[-1, 1]}
                series={[{ label: 'Δ', values: report.per_query!.map((r) => r.delta), color: VIZ.muted }]} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Most deltas are usually exactly 0 — pairing cancels per-question difficulty, so the comparison rests on the few
            questions that changed. That is why paired intervals are narrower than comparing two means.
          </p>
        </Panel>
        <Panel title="Biggest per-query changes" icon={AlertTriangle}>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1 pr-2">item</th><th className="pr-2">query</th><th className="pr-2">trap</th><th className="pr-2 text-right">base</th><th className="pr-2 text-right">treat</th><th className="text-right">Δ</th></tr>
              </thead>
              <tbody>
                {[...report.per_query!].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((r) => (
                  <tr key={r.item_id} className="border-t border-white/5">
                    <td className="py-1 pr-2 font-mono text-[10px]">{r.item_id}</td>
                    <td className="max-w-[220px] truncate pr-2" dir="auto" title={r.query}>{r.query}</td>
                    <td className="pr-2 text-muted-foreground">{r.trap}</td>
                    <td className="pr-2 text-right font-mono">{fmt3(r.baseline)}</td>
                    <td className="pr-2 text-right font-mono">{fmt3(r.treatment)}</td>
                    <td className={cn('text-right font-mono', r.delta > 0 ? 'text-emerald-400' : r.delta < 0 ? 'text-red-400' : 'text-muted-foreground')}>{fmtSigned(r.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 2xl:grid-cols-3">
        <StrataPanel report={report} />
        <Panel title="Power & guardrails" icon={ShieldAlert}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="sd(Δ)" value={fmt3(report.power!.sd_delta)} />
              <Stat label="Detectable" value={report.power!.mde !== null ? `±${report.power!.mde.toFixed(3)}` : '—'} sub={`n = ${report.power!.n}`} />
              <Stat label="n for min effect" value={report.power!.n_needed_for_min_effect ?? '—'} />
            </div>
            {report.guardrails!.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="py-1">guardrail</th><th>Δ</th><th>CI low</th><th>max drop</th><th /></tr></thead>
                <tbody>
                  {report.guardrails!.map((g) => (
                    <tr key={g.metric} className="border-t border-white/5">
                      <td className="py-1">{METRIC_INFO[g.metric]?.label ?? g.metric}</td>
                      <td className="font-mono">{fmtSigned(g.delta)}</td>
                      <td className="font-mono">{fmtSigned(g.low)}</td>
                      <td className="font-mono">−{g.max_drop}</td>
                      <td>{g.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-xs text-muted-foreground">No guardrails registered.</p>}
          </div>
        </Panel>
        <IntegrityPanel report={report} experiment={experiment} />
      </div>

      {split === 'holdout' && experiment.status === 'registered' && report.confirmatory && (
        <Panel title="Conclude" icon={Lock} subtitle="Freezes this decision into the experiment record. No more runs afterwards.">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Conclusion note" className="min-w-[280px] flex-1">
              <TextField value={note} onChange={(e) => setNote(e.target.value)} placeholder="What will you do with this result?" />
            </Field>
            <Button variant="neon" className="gap-1.5" disabled={conclude.isPending} onClick={() => conclude.mutate(note)}>
              <Lock className="h-4 w-4" /> Conclude experiment
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function StrataPanel({ report }: { report: ExperimentReport }) {
  const attrs = Object.keys(report.strata ?? {});
  const [attr, setAttr] = useState(attrs[0] ?? '');
  if (!attrs.length) {
    return <Panel title="Strata" icon={FileBarChart}><p className="text-xs text-muted-foreground">Only one stratum — nothing to break down.</p></Panel>;
  }
  const rows = report.strata![attr] ?? {};
  return (
    <Panel title="Stratified" icon={FileBarChart}
      actions={<SelectBox className="h-7 w-32 text-xs" value={attr} onChange={setAttr} options={attrs.map((a) => ({ value: a, label: a }))} />}>
      <table className="w-full text-xs">
        <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="py-1 pr-2">{attr}</th><th className="pr-2">n</th><th className="pr-2">base</th><th className="pr-2">treat</th><th>Δ</th></tr></thead>
        <tbody>
          {Object.entries(rows).map(([key, s]) => (
            <tr key={key} className="border-t border-white/5">
              <td className="py-1 pr-2 font-mono">{key}</td>
              <td className={cn('pr-2 font-mono', s.n < 5 && 'text-amber-300')} title={s.n < 5 ? 'Fewer than 5 — an anecdote, not a measurement' : ''}>{s.n}</td>
              <td className="pr-2 font-mono">{fmt3(s.baseline)}</td>
              <td className="pr-2 font-mono">{fmt3(s.treatment)}</td>
              <td className={cn('font-mono', s.delta > 0 ? 'text-emerald-400' : s.delta < 0 ? 'text-red-400' : '')}>{fmtSigned(s.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-muted-foreground">No intervals per stratum on purpose: at these sizes they would be too wide to read. Use strata to find where to look, not to claim.</p>
    </Panel>
  );
}

function IntegrityPanel({ report, experiment }: { report: ExperimentReport; experiment: Experiment }) {
  return (
    <Panel title="Integrity" icon={History} subtitle="Everything that could make this number less than it seems.">
      <div className="space-y-2 text-xs">
        <dl className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">registered hash</dt><dd>{shortHash(experiment.dataset_hash)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">holdout looks</dt><dd className={experiment.holdout_access.length > 1 ? 'text-amber-300' : ''}>{experiment.holdout_access.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">runs (all splits)</dt><dd>{report.all_runs.length}</dd></div>
        </dl>
        <div className="max-h-44 overflow-auto">
          {report.all_runs.map((r) => (
            <div key={r.id} className={cn('flex items-center gap-2 border-t border-white/5 py-1', r.used_in_report && 'text-foreground', !r.used_in_report && 'text-muted-foreground')}>
              <span className="h-2 w-2 rounded-sm" style={{ background: r.arm === 'baseline' ? VIZ.baseline : VIZ.treatment }} />
              <span className="truncate font-mono text-[10px]">{r.id}</span>
              <span className="text-[10px]">{r.split}</span>
              <span className="ml-auto font-mono text-[10px]">{fmt3(r.primary_mean)}</span>
              {r.used_in_report && <Pill tone="neon">in report</Pill>}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

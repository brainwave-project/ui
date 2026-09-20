/**
 * Where a readiness check gets fixed.
 *
 * A check names a defect; the repair almost always lives on a different screen.
 * Until now that destination existed only as prose inside `check.learn`
 * ("Inspect them in Golden Sets → Index → Chunking"), so the reader had to
 * remember it and navigate by hand. This table turns that prose into a link.
 *
 * `stage`/`panel` are the workbench vocabulary. `buildFixUrl` translates them to
 * whatever routes exist today, so the rest of the app can move to the workbench
 * without this table changing.
 */

import type { DatasetBundle, ReadinessCheck } from '@/types/eval';

export type StageId = 'corpus' | 'questions' | 'index' | 'judge' | 'split' | 'release';

export type PanelId =
  | 'docs'
  | 'items' | 'synthetic'
  | 'chunking' | 'build'
  | 'pool' | 'audit'
  | 'design' | 'power' | 'profile'
  | 'checks' | 'lifecycle' | 'diff';

/** Extra search params seeded from the check, so the target opens on the defect. */
type Seed = (check: ReadinessCheck, bundle: DatasetBundle) => Record<string, string>;

interface FixTarget {
  stage: StageId;
  panel: PanelId;
  seed?: Seed;
  /** A second, non-obvious repair. Rendered as a text link, never a menu. */
  alt?: { stage: StageId; panel: PanelId; label: string; seed?: Seed };
}

export interface ResolvedFix {
  to: string;
  /** `Fix` for a defect, `Show` for an info-severity observation. */
  label: string;
  stage: StageId;
  alt?: { to: string; label: string };
}

/* ── affected[] parsers ───────────────────────────────────────────────────── */
/* Shapes are fixed by readiness.py; each parser is paired with the emitter. */

/** `"q-003->refund"` → `{ item, doc }` */
const itemDoc = (s: string) => {
  const [item, doc] = s.split('->');
  return { item: item?.trim() ?? '', doc: doc?.trim() ?? '' };
};

/** `"q-001, q-014"` (a duplicate group) → `['q-001', 'q-014']` */
const group = (s: string) => s.split(',').map((p) => p.trim()).filter(Boolean);

/** `"q-001 ~ q-014"` (a near-duplicate pair) → `['q-001', 'q-014']` */
const pair = (s: string) => s.split('~').map((p) => p.trim()).filter(Boolean);

/** `"refund-policy: FAILED"`, or a bare doc id for a never-uploaded document. */
const docStatus = (s: string) => (s.includes(':') ? s.split(':')[0].trim() : s.trim());

const first = (check: ReadinessCheck): string | undefined => check.affected[0];

/* ── seeds ────────────────────────────────────────────────────────────────── */

type Params = Record<string, string>;

const seedItemFromPair: Seed = (c): Params => {
  const a = first(c);
  return a ? { item: itemDoc(a).item } : {};
};

const seedItemFocusEvidence: Seed = (c): Params => {
  const a = first(c);
  return a ? { item: itemDoc(a).item, focus: 'evidence' } : {};
};

const seedDocAndItem: Seed = (c): Params => {
  const a = first(c);
  if (!a) return {};
  const { item, doc } = itemDoc(a);
  return { doc, item };
};

const seedIds = (parse: (s: string) => string[]): Seed => (c): Params => {
  const a = first(c);
  const ids = a ? parse(a) : [];
  return ids.length ? { f: `ids:${ids.join(',')}` } : {};
};

const seedFacet = (facet: string): Seed => (): Params => ({ f: facet });

/** `coverage.strata_difficulty` + affected `"hard=3"` → `f=difficulty:hard` */
const seedStratum: Seed = (c): Params => {
  const attr = c.id.slice('coverage.strata_'.length);
  const value = first(c)?.split('=')[0]?.trim();
  return attr && value ? { f: `${attr}:${value}` } : {};
};

/** `index.stale_conservative` → `norm=conservative`, plus the first bad document. */
const seedNorm = (prefix: string): Seed => (c): Params => {
  const norm = c.id.slice(prefix.length);
  const a = first(c);
  return a ? { norm, doc: docStatus(a) } : { norm };
};

/* ── the table ────────────────────────────────────────────────────────────── */

const EXACT: Record<string, FixTarget> = {
  'integrity.hash':  { stage: 'release',   panel: 'lifecycle' },
  'integrity.draft': { stage: 'release',   panel: 'lifecycle' },

  'labels.empty':     { stage: 'questions', panel: 'items', seed: () => ({ new: '1' }) },
  'labels.no_corpus': { stage: 'corpus',    panel: 'docs',  seed: () => ({ new: '1' }) },

  'labels.unresolved': {
    stage: 'questions', panel: 'items', seed: seedItemFromPair,
    // Either the label is wrong, or the document is missing. Offer both.
    alt: {
      stage: 'corpus', panel: 'docs', label: 'Add the document',
      seed: (c): Params => { const a = first(c); return a ? { new: '1', doc: itemDoc(a).doc } : { new: '1' }; },
    },
  },
  'labels.unanswerable':      { stage: 'questions', panel: 'items', seed: seedFacet('answerable:no') },
  'labels.evidence_missing':  { stage: 'questions', panel: 'items', seed: seedItemFocusEvidence },
  'labels.evidence_stray':    { stage: 'questions', panel: 'items', seed: seedItemFocusEvidence },
  'labels.evidence_straddles': { stage: 'index',    panel: 'chunking', seed: seedDocAndItem },
  'labels.no_evidence':       { stage: 'questions', panel: 'items', seed: seedFacet('evidence:none') },
  'labels.synthetic_share':   { stage: 'split',     panel: 'design', seed: seedFacet('origin:synthetic') },

  'labels.no_negative_judgements': { stage: 'judge', panel: 'pool' },
  'labels.pool_coverage': {
    stage: 'judge', panel: 'pool',
    seed: (c): Params => { const a = first(c); return a ? { item: a } : {}; },
  },
  'labels.agreement': { stage: 'judge', panel: 'audit' },

  'leakage.duplicate_cross_split': {
    stage: 'split', panel: 'design', seed: seedIds(group),
    alt: { stage: 'questions', panel: 'items', label: 'Rewrite one', seed: seedIds(group) },
  },
  'leakage.near_duplicate_cross_split': {
    stage: 'split', panel: 'design', seed: seedIds(pair),
    alt: { stage: 'questions', panel: 'items', label: 'Rewrite one', seed: seedIds(pair) },
  },
  'leakage.duplicate':      { stage: 'questions', panel: 'items', seed: seedIds(group) },
  'leakage.near_duplicate': { stage: 'questions', panel: 'items', seed: seedIds(pair) },
  'leakage.query_copied': {
    stage: 'questions', panel: 'items',
    seed: (c): Params => { const a = first(c); return a ? { item: itemDoc(a).item, focus: 'query' } : {}; },
  },
  // Highlights the group-by control. Never mutate split config from a URL.
  'leakage.group_straddle': { stage: 'split', panel: 'design', seed: () => ({ hint: 'group_by' }) },

  'coverage.no_distractors': { stage: 'corpus',    panel: 'docs', seed: () => ({ new: '1' }) },
  // The offending documents appear only in `detail` prose, so nothing to seed.
  'coverage.concentration':  { stage: 'questions', panel: 'items' },

  'split.unassigned': { stage: 'split', panel: 'design', seed: seedFacet('split:none') },
  'split.imbalance':  { stage: 'split', panel: 'design', seed: () => ({ hint: 'stratify' }) },

  'power.dev':     { stage: 'split', panel: 'power' },
  'power.holdout': { stage: 'split', panel: 'power' },

  'index.none': { stage: 'index', panel: 'build' },
};

const PREFIXES: [string, FixTarget][] = [
  ['coverage.strata_',  { stage: 'questions', panel: 'items', seed: seedStratum }],
  ['index.stale_',      { stage: 'index', panel: 'build', seed: seedNorm('index.stale_') }],
  ['index.incomplete_', { stage: 'index', panel: 'build', seed: seedNorm('index.incomplete_') }],
];

/**
 * Checks that describe how to *read* a number rather than a defect to repair.
 * They are not failures, so sending the reader somewhere would be misleading.
 */
const NO_DESTINATION = new Set(['labels.binary_only', 'coverage.precision_cap']);

function lookup(id: string): FixTarget | null {
  if (NO_DESTINATION.has(id)) return null;
  if (EXACT[id]) return EXACT[id];
  const hit = PREFIXES.find(([prefix]) => id.startsWith(prefix));
  return hit ? hit[1] : null;
}

/** The stage a check belongs to — also drives the rail's per-stage counts. */
export function stageOfCheck(check: ReadinessCheck): StageId | null {
  return lookup(check.id)?.stage ?? null;
}

/* ── URL building ─────────────────────────────────────────────────────────── */

/**
 * Routes as they exist today. The workbench replaces this body; every caller
 * goes through here so that change lands in one place.
 */
const LEGACY: Record<StageId, Partial<Record<PanelId, Record<string, string>>>> = {
  corpus:    { docs:      { tab: 'collect' } },
  questions: { items:     { tab: 'ask',     sub: 'items' },
               synthetic: { tab: 'ask',     sub: 'synthetic' } },
  index:     { chunking:  { tab: 'index',   sub: 'chunking' },
               build:     { tab: 'index',   sub: 'index' } },
  judge:     { pool:      { tab: 'judge',   sub: 'pool' },
               audit:     { tab: 'judge',   sub: 'audit' } },
  split:     { design:    { tab: 'gate',    sub: 'split' },
               power:     { tab: 'gate',    sub: 'power' },
               profile:   { tab: 'gate',    sub: 'profile' } },
  release:   { checks:    { tab: 'gate',    sub: 'checks' },
               lifecycle: { tab: 'freeze',  sub: 'lifecycle' },
               diff:      { tab: 'freeze',  sub: 'diff' } },
};

export function buildFixUrl(
  stage: StageId,
  panel: PanelId,
  params: Record<string, string>,
  datasetId: string,
  version: number,
): string {
  const route = LEGACY[stage]?.[panel];
  if (!route) return '/evaluation/dataset';
  const search = new URLSearchParams({ ...route, v: String(version), ...params });
  return `/evaluation/dataset/${encodeURIComponent(datasetId)}?${search.toString()}`;
}

/**
 * The link for one check, or null when the check names no repairable defect.
 * A `pass` check is never actionable — several ids (integrity.hash,
 * labels.unresolved, labels.pool_coverage, labels.agreement) are emitted at both
 * pass and problem severity under the same id, so severity is checked first.
 */
export function resolveFix(
  check: ReadinessCheck,
  bundle: DatasetBundle,
): ResolvedFix | null {
  if (check.severity === 'pass') return null;
  const target = lookup(check.id);
  if (!target) return null;

  const { id: datasetId } = bundle.meta;
  const { version } = bundle.manifest;
  const url = (stage: StageId, panel: PanelId, seed?: Seed) =>
    buildFixUrl(stage, panel, seed?.(check, bundle) ?? {}, datasetId, version);

  return {
    to: url(target.stage, target.panel, target.seed),
    label: check.severity === 'info' ? 'Show' : 'Fix',
    stage: target.stage,
    alt: target.alt
      ? { to: url(target.alt.stage, target.alt.panel, target.alt.seed), label: target.alt.label }
      : undefined,
  };
}

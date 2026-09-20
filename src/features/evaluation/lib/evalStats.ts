/**
 * Client-side statistics for the interactive calculators, plus the metric glossary.
 *
 * The power arithmetic mirrors agent_hub.eval.stats.min_sample_size /
 * detectable_effect exactly (normal approximation, paired design). It lives here
 * only so the Gate sliders respond instantly; every number in a REPORT comes
 * from the server.
 */

/** Inverse standard-normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function invNormal(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const zSum = (confidence: number, power: number) =>
  invNormal(1 - (1 - confidence) / 2) + invNormal(power);

/** n = ((z_α/2 + z_β) · sd / effect)² — questions needed to detect `effect`. */
export function minSampleSize(effect: number, sd: number, confidence = 0.95, power = 0.8): number {
  if (effect <= 0) return Infinity;
  return Math.max(1, Math.ceil(((zSum(confidence, power) * sd) / effect) ** 2));
}

/** effect = (z_α/2 + z_β) · sd / √n — the smallest effect n questions can detect. */
export function detectableEffect(n: number, sd: number, confidence = 0.95, power = 0.8): number {
  if (n <= 0) return Infinity;
  return (zSum(confidence, power) * sd) / Math.sqrt(n);
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

export const fmt3 = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(3);

export const fmtSigned = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(3)}`;

export const shortHash = (h: string | null | undefined) => (h ? h.slice(0, 10) : '—');

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/* ── Metric glossary ─────────────────────────────────────────────────────── */

export interface MetricInfo {
  label:    string;
  short:    string;
  measures: string;
  misleads: string;
  cutoff:   'k' | 'deep';
}

/** Mirrors the "MISLEADS WHEN" docstrings in agent_hub/eval/retrieval_metrics.py. */
export const METRIC_INFO: Record<string, MetricInfo> = {
  'hit_rate': {
    label: 'Hit rate', short: 'Hit@k', cutoff: 'k',
    measures: '1 if any relevant result is in the top k, else 0.',
    misleads: 'Saturates. Rank 1 and rank k score the same, so it pins near 1.0 while ranking quality changes underneath. A floor check, never a tuning target.',
  },
  'recall@k': {
    label: 'Recall@k', short: 'R@k', cutoff: 'k',
    measures: 'Fraction of all relevant results found in the top k. The generator cannot cite what retrieval never returned.',
    misleads: 'Trivially approaches 1.0 as k approaches corpus size. Always report k, and keep it at what the generator consumes.',
  },
  'precision@k': {
    label: 'Precision@k', short: 'P@k', cutoff: 'k',
    measures: 'Fraction of the top k that is relevant.',
    misleads: 'Caps at |relevant|/k. With 1 relevant document and k=5, a perfect system reads 0.20. Read next to recall.',
  },
  'mrr': {
    label: 'MRR', short: 'MRR', cutoff: 'deep',
    measures: 'Reciprocal rank of the FIRST relevant result: 1, ½, ⅓…',
    misleads: 'Stops at the first hit — blind to recall. Finding 1 of 5 relevant documents at rank 1 scores a perfect 1.0.',
  },
  'ndcg@k': {
    label: 'NDCG (binary)', short: 'nDCG', cutoff: 'deep',
    measures: 'DCG = Σ 1/log₂(rank+1) over relevant hits, normalised by the ideal ranking (IDCG).',
    misleads: 'The log discount flattens deep ranks: rank 20 → 11 barely registers. Binary relevance ignores "answers" vs "related".',
  },
  'graded_ndcg@k': {
    label: 'NDCG (graded)', short: 'gnDCG', cutoff: 'deep',
    measures: 'Gain = 2^grade − 1, so a grade-3 answer is worth 7× a grade-1 mention. Rewards best-answer-first.',
    misleads: 'Amplifies labelling noise: one annotator’s 2 is another’s 3, and the gain jumps from 3 to 7. Only as good as the grading rubric.',
  },
  'map': {
    label: 'MAP', short: 'AP', cutoff: 'deep',
    measures: 'Mean of precision@i at each rank i holding a relevant result — rewards finding all of them, early.',
    misleads: 'Normalised per question, so single-relevant-document questions dominate the variance. Stratify before trusting it.',
  },
};

export const METRIC_KEYS = Object.keys(METRIC_INFO);

export const NORMALIZATION_INFO: Record<string, string> = {
  off:          'As typed. No transforms.',
  conservative: 'NFC · strip diacritics & tatweel · unify alef · digits · punctuation · whitespace. Near-lossless.',
  aggressive:   'Conservative + hamza carriers, bare hamza, taa marbuta → ha, alef maqsura → ya. Merges distinct words; measure the precision cost.',
};

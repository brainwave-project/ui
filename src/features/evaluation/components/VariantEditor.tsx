import { cn } from '@/lib/utils';
import { NORMALIZATION_INFO } from '@/features/evaluation/lib/evalStats';
import { Field, SelectBox, TextField, Toggle } from './EvalPrimitives';
import type { Normalization, VariantSpec } from '@/types/eval';

export const DEFAULT_VARIANT: VariantSpec = {
  name: 'baseline',
  level: 'document',
  hybrid: true,
  corpus_index: 'off',
  query_normalization: 'off',
  min_score: 0,
  fetch: 50,
};

const NORM_OPTIONS: { value: Normalization; label: string }[] = [
  { value: 'off', label: 'off' },
  { value: 'conservative', label: 'conservative' },
  { value: 'aggressive', label: 'aggressive' },
];

/**
 * Edits one retrieval configuration. When `compareTo` is given, fields that differ
 * from it are highlighted — an experiment should change exactly one of them.
 */
export function VariantEditor({
  value, onChange, disabled, compareTo, indexed, accent,
}: {
  value: VariantSpec;
  onChange: (v: VariantSpec) => void;
  disabled?: boolean;
  compareTo?: VariantSpec;
  indexed?: Partial<Record<Normalization, boolean>>;
  accent?: string;
}) {
  const set = <K extends keyof VariantSpec>(key: K, v: VariantSpec[K]) => onChange({ ...value, [key]: v });
  const changed = (key: keyof VariantSpec) => !!compareTo && compareTo[key] !== value[key];
  const ring = (key: keyof VariantSpec) => cn(changed(key) && 'rounded-md ring-1 ring-amber-400/60 ring-offset-2 ring-offset-background');

  return (
    <div className="space-y-3" style={accent ? { borderLeft: `2px solid ${accent}`, paddingLeft: 12 } : undefined}>
      <Field label="Name">
        <TextField value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Level" hint={value.level === 'chunk' ? 'gRPC SemanticSearch · vector-only · scored by evidence spans' : 'HTTP search · best chunk per document'}>
          <div className={ring('level')}>
            <SelectBox value={value.level} disabled={disabled} onChange={(v) => set('level', v)}
              options={[{ value: 'document', label: 'document' }, { value: 'chunk', label: 'chunk' }]} />
          </div>
        </Field>
        <Field label="Ranking" hint={value.level === 'chunk' ? 'Chunk path has no lexical half.' : value.hybrid ? 'Vector + full-text, RRF-fused' : 'Cosine similarity only'}>
          <div className={cn('pt-1.5', ring('hybrid'))}>
            <Toggle checked={value.hybrid && value.level === 'document'} disabled={disabled || value.level === 'chunk'}
              onChange={(v) => set('hybrid', v)} label="Hybrid (RRF)" />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Corpus index" hint={NORMALIZATION_INFO[value.corpus_index]}>
          <div className={ring('corpus_index')}>
            <SelectBox value={value.corpus_index} disabled={disabled} onChange={(v) => set('corpus_index', v)}
              options={NORM_OPTIONS.map((o) => ({ ...o, label: `${o.label}${indexed && !indexed[o.value] ? ' (not indexed)' : ''}` }))} />
          </div>
        </Field>
        <Field label="Query normalisation" hint={NORMALIZATION_INFO[value.query_normalization]}>
          <div className={ring('query_normalization')}>
            <SelectBox value={value.query_normalization} disabled={disabled} onChange={(v) => set('query_normalization', v)} options={NORM_OPTIONS} />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min similarity" hint="0 = no floor. A threshold truncates the ranking before metrics see it.">
          <div className={ring('min_score')}>
            <TextField type="number" step={0.05} min={0} max={1} value={value.min_score} disabled={disabled}
              onChange={(e) => set('min_score', Math.max(0, Math.min(1, Number(e.target.value))))} />
          </div>
        </Field>
        <Field label="Fetch depth" hint="Results requested (≤ 50). Rank-aware metrics read to max(k, 10).">
          <div className={ring('fetch')}>
            <TextField type="number" min={1} max={50} value={value.fetch} disabled={disabled}
              onChange={(e) => set('fetch', Math.max(1, Math.min(50, Math.round(Number(e.target.value)))))} />
          </div>
        </Field>
      </div>
    </div>
  );
}

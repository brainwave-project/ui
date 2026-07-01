/**
 * Governance contract — mirrors agent-hub's GovernanceSettings (§13.5). These are
 * the runtime-tunable retrieval + CRAG knobs, read by the reasoning path on every
 * run and edited (ADMIN only) from the Governance page.
 */
export interface GovernanceSettings {
  /* Retrieval */
  top_k:                 number;
  min_score:             number;
  cross_encoder_enabled: boolean;
  rerank_candidate_k:    number;
  rerank_top_n:          number;

  /* CRAG graph shape */
  max_loops:             number;
  max_regen:             number;
  query_rewrite_enabled: boolean;
  grounding_enabled:     boolean;

  /* Per-node temperatures */
  grade_temperature:     number;
  rewrite_temperature:   number;
  generate_temperature:  number;
  grounding_temperature: number;
}

export interface GovernanceResponse {
  settings: GovernanceSettings;
  defaults: GovernanceSettings;
  schema:   Record<string, unknown>;
}

export type GovernancePatch = Partial<GovernanceSettings>;

/** One entry in the platform's model catalog (Observability → LLMs). */
export interface PlatformModel {
  id:       string;
  name:     string;
  provider: string;
  role:     string;
  purpose:  string;
  host:     string;
  params:   string;
  modality: string;
  enabled:  boolean;
  service:  string;
}

export interface ModelsResponse {
  models: PlatformModel[];
}

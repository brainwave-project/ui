import { apiClient } from './client';
import type {
  GovernancePatch,
  GovernanceResponse,
  GovernanceSettings,
  ModelsResponse,
} from '@/types/governance';

/**
 * Governance client — talks to agent-hub via Kong (/api/agent/*). GET is open to
 * any authenticated user (read-only view); PUT/reset are ADMIN-gated server-side
 * (403 otherwise), and the UI mirrors that by disabling edits for non-admins.
 */
export const governanceApi = {
  get(): Promise<GovernanceResponse> {
    return apiClient.get<GovernanceResponse>('/agent/governance').then((r) => r.data);
  },

  update(patch: GovernancePatch): Promise<{ settings: GovernanceSettings }> {
    return apiClient.put<{ settings: GovernanceSettings }>('/agent/governance', patch).then((r) => r.data);
  },

  reset(): Promise<{ settings: GovernanceSettings }> {
    return apiClient.post<{ settings: GovernanceSettings }>('/agent/governance/reset').then((r) => r.data);
  },

  models(): Promise<ModelsResponse> {
    return apiClient.get<ModelsResponse>('/agent/models').then((r) => r.data);
  },
};

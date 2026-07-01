import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { governanceApi } from '@/api/governance.api';
import { useUIStore } from '@/store/ui.store';
import type { GovernancePatch } from '@/types/governance';

export const governanceKeys = {
  all:     ['governance'] as const,
  config:  ['governance', 'config'] as const,
  models:  ['governance', 'models'] as const,
};

export function useGovernance() {
  return useQuery({
    queryKey: governanceKeys.config,
    queryFn:  governanceApi.get,
    staleTime: 30_000,
  });
}

export function useUpdateGovernance() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: (patch: GovernancePatch) => governanceApi.update(patch),
    onSuccess() {
      qc.invalidateQueries({ queryKey: governanceKeys.config });
      qc.invalidateQueries({ queryKey: governanceKeys.models });
      addToast({ type: 'success', message: 'Governance profile applied — live on the next run.' });
    },
    onError(err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      addToast({
        type: 'error',
        message: status === 403 ? 'ADMIN role required to change governance.' : 'Failed to apply changes.',
      });
    },
  });
}

export function useResetGovernance() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: () => governanceApi.reset(),
    onSuccess() {
      qc.invalidateQueries({ queryKey: governanceKeys.config });
      qc.invalidateQueries({ queryKey: governanceKeys.models });
      addToast({ type: 'success', message: 'Governance reset to shipped defaults.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Reset failed.' });
    },
  });
}

export function usePlatformModels() {
  return useQuery({
    queryKey: governanceKeys.models,
    queryFn:  governanceApi.models,
    staleTime: 60_000,
  });
}

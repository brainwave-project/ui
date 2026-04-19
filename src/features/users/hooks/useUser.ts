import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { useUIStore } from '@/store/ui.store';
import type { AccountStatus } from '@/types/user';

export const userKeys = {
  all:    ['users'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

export function useUser(userId: string) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn:  () => usersApi.get(userId),
    enabled:  !!userId,
  });
}

export function useUpdateStatus(userId: string) {
  const qc       = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (status: AccountStatus) => usersApi.updateStatus(userId, status),
    onSuccess() {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      addToast({ type: 'success', message: 'Account status updated.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Failed to update status.' });
    },
  });
}

export function useAssignRoles(userId: string) {
  const qc       = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (roles: string[]) => usersApi.assignRoles(userId, roles),
    onSuccess() {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      addToast({ type: 'success', message: 'Roles updated.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Failed to update roles.' });
    },
  });
}

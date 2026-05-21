import { apiClient } from './client';
import type { User, AccountStatus, UserListResult, AdminCreateUserPayload } from '@/types/user';

export const usersApi = {
  list(params?: { limit?: number; offset?: number; status?: AccountStatus }): Promise<UserListResult> {
    return apiClient
      .get<UserListResult>('/users', { params })
      .then((r) => r.data);
  },

  get(userId: string): Promise<User> {
    return apiClient
      .get<User>(`/users/${userId}`)
      .then((r) => r.data);
  },

  adminCreate(payload: AdminCreateUserPayload): Promise<User> {
    return apiClient
      .post<User>('/users/admin', payload)
      .then((r) => r.data);
  },

  updateStatus(userId: string, status: AccountStatus): Promise<User> {
    return apiClient
      .patch<User>(`/users/${userId}/status`, { status })
      .then((r) => r.data);
  },

  assignRoles(userId: string, roles: string[]): Promise<User> {
    return apiClient
      .patch<User>(`/users/${userId}/roles`, { roles })
      .then((r) => r.data);
  },

  delete(userId: string): Promise<User> {
    return apiClient
      .delete<User>(`/users/${userId}`)
      .then((r) => r.data);
  },
};

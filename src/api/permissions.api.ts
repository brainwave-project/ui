import { apiClient } from './client';
import type { Permission, RoleWithPermissions } from '@/types/permission';

export const permissionsApi = {
  listPermissions(): Promise<Permission[]> {
    return apiClient.get<Permission[]>('/users/permissions').then((r) => r.data);
  },

  listRoles(): Promise<RoleWithPermissions[]> {
    return apiClient.get<RoleWithPermissions[]>('/users/roles').then((r) => r.data);
  },

  getRole(roleId: string): Promise<RoleWithPermissions> {
    return apiClient.get<RoleWithPermissions>(`/users/roles/${roleId}`).then((r) => r.data);
  },

  setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    return apiClient
      .put<RoleWithPermissions>(`/users/roles/${roleId}/permissions`, { permissionIds })
      .then((r) => r.data);
  },

  grantPermission(roleId: string, permId: string): Promise<void> {
    return apiClient
      .post(`/users/roles/${roleId}/permissions/${permId}`)
      .then(() => undefined);
  },

  revokePermission(roleId: string, permId: string): Promise<void> {
    return apiClient
      .delete(`/users/roles/${roleId}/permissions/${permId}`)
      .then(() => undefined);
  },
};

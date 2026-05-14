import { apiClient } from './client';
import type { AuditPage, AuditQuery } from '@/types/audit';

function buildParams(query: AuditQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.limit   !== undefined) params['limit']   = String(query.limit);
  if (query.offset  !== undefined) params['offset']  = String(query.offset);
  if (query.action)                params['action']  = query.action;
  if (query.service)               params['service'] = query.service;
  if (query.outcome)               params['outcome'] = query.outcome;
  if (query.from)                  params['from']    = query.from;
  if (query.to)                    params['to']      = query.to;
  if (query.userId)                params['userId']  = query.userId;
  return params;
}

export const auditApi = {
  /** GET /api/audit/activity/me — signed-in user's own events */
  myActivity: async (query: AuditQuery = {}): Promise<AuditPage> => {
    const res = await apiClient.get<AuditPage>('/audit/activity/me', {
      params: buildParams(query),
    });
    return res.data;
  },

  /** GET /api/audit/activity — all events (admin) */
  allActivity: async (query: AuditQuery = {}): Promise<AuditPage> => {
    const res = await apiClient.get<AuditPage>('/audit/activity', {
      params: buildParams(query),
    });
    return res.data;
  },
};

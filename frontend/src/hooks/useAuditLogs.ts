import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    company?: { id: string; name: string } | null;
  };
  projectId?: string;
  folderId?: string;
  documentId?: string;
  details?: any;
  createdAt: string;
}

export function useAuditLogs(params: {
  userId?: string;
  action?: string;
  projectId?: string;
  folderId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
  });

  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () =>
      apiFetch<{ status: string; data: AuditLog[]; total: number }>(
        `/api/audit-logs?${queryParams.toString()}`
      ),
  });
}

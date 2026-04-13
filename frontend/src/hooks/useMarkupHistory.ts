import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface HistoryAuthor {
  id: string;
  name?: string;
  email: string;
}

export interface MarkupHistoryItem {
  id: string;
  action: 'ADD' | 'MODIFY' | 'DELETE';
  documentId: string;
  markupId: string;
  authorId: string;
  author: HistoryAuthor;
  snapshot: any;
  createdAt: string;
}

export interface HistoryResponse {
  total: number;
  page: number;
  limit: number;
  items: MarkupHistoryItem[];
}

export interface HistoryFilters {
  authorId?: string;
  action?: string;
  pageNumber?: number | '';
  dateFrom?: string;
  dateTo?: string;
}

export function useMarkupHistory(documentId: string, enabled = true, filters?: HistoryFilters) {
  const params = new URLSearchParams({ limit: '100' });
  if (filters?.authorId) params.set('authorId', filters.authorId);
  if (filters?.action) params.set('action', filters.action);
  if (filters?.pageNumber !== undefined && filters.pageNumber !== '') params.set('pageNumber', String(filters.pageNumber));
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);

  return useQuery<HistoryResponse>({
    queryKey: ['markup-history', documentId, filters],
    queryFn: () => apiFetch(`/api/documents/${documentId}/markup-history?${params.toString()}`),
    enabled: !!documentId && enabled,
    staleTime: 10_000,
  });
}

export function useMarkupHistoryAuthors(documentId: string, enabled = true) {
  return useQuery<HistoryAuthor[]>({
    queryKey: ['markup-history-authors', documentId],
    queryFn: () => apiFetch(`/api/documents/${documentId}/markup-history/authors`),
    enabled: !!documentId && enabled,
    staleTime: 60_000,
  });
}

export function useRestoreMarkupHistory(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (timestamp: string) =>
      apiFetch(`/api/documents/${documentId}/markup-history/restore`, {
        method: 'POST',
        body: JSON.stringify({ timestamp }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['markup-history', documentId] });
    },
  });
}

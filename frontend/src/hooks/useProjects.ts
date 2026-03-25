import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProjectsResponse {
  status: string;
  data: any[];
  pagination: PaginationMeta;
}

export function useProjects(page = 1, limit = 20, companyId?: string) {
  const url = `/api/projects?page=${page}&limit=${limit}${companyId && companyId !== 'ALL' ? `&companyId=${companyId}` : ''}`;
  return useQuery({
    queryKey: ['projects', page, limit, companyId],
    queryFn: () => apiFetch<ProjectsResponse>(url),
    select: (res) => ({ projects: res.data, pagination: res.pagination }),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () =>
      apiFetch<{ status: string; data: any }>(`/api/projects/${projectId}`).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; companyId: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      apiFetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useBulkDeleteProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectIds: string[]) =>
      apiFetch('/api/projects/bulk/delete', { method: 'POST', body: JSON.stringify({ projectIds }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

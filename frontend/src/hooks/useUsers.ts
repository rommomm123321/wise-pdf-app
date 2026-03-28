import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsersResponse {
  status: string;
  data: any[];
  pagination: PaginationMeta;
}

// Hook to get all users in the company (paginated)
export function useUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['users', page, limit],
    queryFn: () => apiFetch<UsersResponse>(`/api/users?page=${page}&limit=${limit}`),
    select: (res) => ({ users: res.data, pagination: res.pagination }),
    staleTime: 0,          // always re-fetch on mount
    refetchOnMount: true,
  });
}

// Hook to get a specific user profile (read-only)
export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => apiFetch<{ status: string; data: any }>(`/api/users/${userId}/profile`).then(res => res.data),
    enabled: !!userId,
  });
}

// Hook to search users across the platform
export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['users-search', query],
    queryFn: () => apiFetch<{ status: string; data: any[] }>(`/api/users/search?q=${query}`).then((r) => r.data),
    enabled: query.length >= 2,
  });
}

// Hook to add a registered user to the current company
export function useAddToCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId?: string }) =>
      apiFetch(`/api/users/${userId}/add-to-company`, { method: 'POST', body: JSON.stringify({ roleId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, systemRole, companyId }: { userId: string; roleId?: string | null; systemRole?: string; companyId?: string | null }) =>
      apiFetch(`/api/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ roleId, systemRole, companyId }) }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

export function useAssignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectId, permissions }: { userId: string; projectId: string; permissions: any }) =>
      apiFetch(`/api/users/${userId}/projects/${projectId}`, { method: 'POST', body: JSON.stringify(permissions) }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

export function useUnassignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectId }: { userId: string; projectId: string }) =>
      apiFetch(`/api/users/${userId}/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

export function useUpdateProjectPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, projectId, permissions }: { userId: string; projectId: string; permissions: any }) =>
      apiFetch(`/api/users/${userId}/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(permissions) }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// --- BULK HOOKS ---

export function useBulkDeleteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => apiFetch('/api/users/bulk/delete', { method: 'POST', body: JSON.stringify({ userIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useBulkUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, roleId }: { userIds: string[]; roleId: string }) =>
      apiFetch('/api/users/bulk/role', { method: 'POST', body: JSON.stringify({ userIds, roleId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useBulkAssignProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, projectIds, permissions }: { userIds: string[]; projectIds: string[]; permissions: any }) =>
      apiFetch('/api/users/bulk/assign-projects', { method: 'POST', body: JSON.stringify({ userIds, projectIds, permissions }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

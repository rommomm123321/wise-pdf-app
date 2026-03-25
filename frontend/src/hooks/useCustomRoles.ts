import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface CustomRole {
  id: string;
  name: string;
  color: string | null;
  companyId: string;
  isSystem: boolean;
  defaultCanView: boolean;
  defaultCanEdit: boolean;
  defaultCanDelete: boolean;
  defaultCanDownload: boolean;
  defaultCanMarkup: boolean;
  defaultCanManage: boolean;
  _count?: { users: number };
}

export interface CompanyTag {
  id: string;
  text: string;
  color: string;
  companyId: string;
}

export function useCustomRoles() {
  return useQuery({
    queryKey: ['custom-roles'],
    queryFn: () =>
      apiFetch<{ status: string; data: CustomRole[] }>('/api/custom-roles').then((r) => r.data),
  });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CustomRole> & { name: string }) =>
      apiFetch('/api/custom-roles', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-roles'] }),
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CustomRole>) =>
      apiFetch(`/api/custom-roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-roles'] }),
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/custom-roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-roles'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAssignCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string | null }) =>
      apiFetch(`/api/users/${userId}/custom-role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleId }),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

// --- TAGS ---

export function useCompanyTags() {
  return useQuery({
    queryKey: ['company-tags'],
    queryFn: () =>
      apiFetch<{ status: string; data: CompanyTag[] }>('/api/users/tags').then((r) => r.data),
  });
}

export function useCreateCompanyTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { text: string; color?: string }) =>
      apiFetch('/api/users/tags', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-tags'] }),
  });
}

export function useDeleteCompanyTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      apiFetch(`/api/users/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-tags'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, tagIds }: { userId: string; tagIds: string[] }) =>
      apiFetch(`/api/users/${userId}/tags`, {
        method: 'PATCH',
        body: JSON.stringify({ tagIds }),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
}

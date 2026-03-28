import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: () =>
      apiFetch<{ status: string; data: any[] }>('/api/invitations').then((r) => r.data),
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; roleId: string; projectIds: string[]; companyId?: string }) =>
      apiFetch<{ status: string; data: any }>('/api/invitations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
    },
  });
}

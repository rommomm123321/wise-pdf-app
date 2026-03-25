import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useItemPermissions(type: 'project' | 'folder' | 'document', id: string | undefined) {
  const queryKey = ['permissions', type, id];

  const query = useQuery({
    queryKey,
    queryFn: () => {
      let url = '';
      if (type === 'project') url = `/api/projects/${id}/permissions`;
      if (type === 'folder') url = `/api/permissions/folders/${id}/permissions`;
      if (type === 'document') url = `/api/permissions/documents/${id}/permissions`;

      return apiFetch<{ status: string; data: any[] }>(url).then((r) => r.data);
    },
    enabled: !!id,
  });

  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: any }) => {
      let url = '';
      let method = 'PUT';
      if (type === 'project') {
        url = `/api/users/${userId}/projects/${id}`;
        method = 'PATCH';
      }
      if (type === 'folder') url = `/api/permissions/folders/${id}/permissions/${userId}`;
      if (type === 'document') url = `/api/permissions/documents/${id}/permissions/${userId}`;

      return apiFetch(url, { method, body: JSON.stringify(permissions) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => {
      let url = '';
      if (type === 'project') url = `/api/users/${userId}/projects/${id}`;
      if (type === 'folder') url = `/api/permissions/folders/${id}/permissions/${userId}`;
      if (type === 'document') url = `/api/permissions/documents/${id}/permissions/${userId}`;

      return apiFetch(url, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const addMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: any }) => {
      let url = '';
      let method = 'POST';
      if (type === 'project') {
        url = `/api/users/${userId}/projects/${id}`;
        method = 'POST';
      } else {
        // For folders and documents we use the same PUT as update
        return updateMutation.mutateAsync({ userId, permissions });
      }

      return apiFetch(url, { method, body: JSON.stringify(permissions) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    permissions: query.data || [],
    isLoading: query.isLoading,
    updatePermission: updateMutation.mutate,
    removePermission: removeMutation.mutate,
    addUserPermission: addMutation.mutate,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export interface UserPreferences {
  projectOrder?: string[];
  folderOrder?: Record<string, string[]>; // projectId -> folderIds
  documentOrder?: Record<string, string[]>; // folderId -> documentIds
  columnVisibility?: Record<string, string[]>; // pageKey -> visible column keys
}

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => apiFetch<{ status: string; user: any }>('/api/auth/me').then(r => r.user?.preferences || {}),
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (newPrefs: UserPreferences) => 
      apiFetch('/api/users/preferences', { method: 'PATCH', body: JSON.stringify(newPrefs) }),
    onSuccess: (res) => {
      queryClient.setQueryData(['user-preferences'], res.data);
      // Also update auth-me to keep it consistent
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    }
  });

  return {
    preferences: query.data || {},
    isLoading: query.isLoading,
    updatePreferences: mutation.mutate,
  };
}

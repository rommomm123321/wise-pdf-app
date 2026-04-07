import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useOneDriveStatus() {
  return useQuery({
    queryKey: ['onedrive-status'],
    queryFn: () => apiFetch('/api/onedrive/status').then(r => r.data),
    refetchInterval: 30000,
  });
}

export function useOneDriveSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/api/onedrive/sync', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onedrive-status'] }),
  });
}

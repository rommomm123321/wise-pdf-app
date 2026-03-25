import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface PresetField {
  key: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  defaultValue?: string;
}

export interface MarkupPropertyPreset {
  id: string;
  name: string;
  fields: PresetField[];
  companyId: string;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export function useMarkupPresets() {
  return useQuery({
    queryKey: ['markupPresets'],
    queryFn: () => apiFetch<{ status: string; data: MarkupPropertyPreset[] }>('/api/presets'),
    select: (res) => res.data,
    staleTime: 60_000,
  });
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; fields: PresetField[] }) =>
      apiFetch('/api/presets', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markupPresets'] }),
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; fields?: PresetField[] }) =>
      apiFetch(`/api/presets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markupPresets'] }),
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/presets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markupPresets'] }),
  });
}

export function useApplyPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presetId, documentId }: { presetId: string; documentId: string }) =>
      apiFetch(`/api/presets/${presetId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ documentId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markups'] }),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useState } from 'react';

interface FolderContents {
  folders: any[];
  documents: any[];
  noAccess?: boolean;
}

interface FolderPagination {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

interface FolderContentsResponse {
  status: string;
  data: FolderContents;
  pagination: FolderPagination;
}

export function useFolderContents(folderId: string | undefined, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['folder-contents', folderId, page, limit],
    queryFn: () =>
      apiFetch<FolderContentsResponse>(`/api/folders/${folderId}/contents?page=${page}&limit=${limit}`),
    select: (res) => ({ ...res.data, pagination: res.pagination }),
    enabled: !!folderId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; projectId: string; parentId?: string }) =>
      apiFetch('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export function useUploadDocument() {
  const qc = useQueryClient();
  const [uploads, setUploads] = useState<Record<string, UploadStatus>>({});

  const uploadMutation = useMutation({
    mutationFn: async ({ folderId, files }: { folderId: string; files: File[] }) => {
      const token = localStorage.getItem('token');
      
      const uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadId = `${file.name}-${Date.now()}`;
          setUploads(prev => ({ 
            ...prev, 
            [uploadId]: { fileName: file.name, progress: 0, status: 'uploading' } 
          }));

          const formData = new FormData();
          formData.append('file', file);
          formData.append('folderId', folderId);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/documents', true);
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded * 100) / event.total);
              setUploads(prev => ({
                ...prev,
                [uploadId]: { ...prev[uploadId], progress }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploads(prev => ({
                ...prev,
                [uploadId]: { ...prev[uploadId], status: 'completed', progress: 100 }
              }));
              
              setTimeout(() => {
                setUploads(prev => {
                  const next = { ...prev };
                  delete next[uploadId];
                  return next;
                });
              }, 3000);
              resolve(JSON.parse(xhr.responseText));
            } else {
              let errMsg = 'Upload failed';
              try { errMsg = JSON.parse(xhr.responseText)?.error || xhr.statusText; } catch {}
              setUploads(prev => ({
                ...prev,
                [uploadId]: { ...prev[uploadId], status: 'error', errorMessage: errMsg }
              }));
              reject(new Error(errMsg));
            }
          };

          xhr.onerror = () => {
            setUploads(prev => ({
              ...prev,
              [uploadId]: { ...prev[uploadId], status: 'error', errorMessage: 'Network error' }
            }));
            reject(new Error('Network error'));
          };

          xhr.send(formData);
        });
      });

      return Promise.all(uploadPromises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });

  return { ...uploadMutation, uploads: Object.values(uploads) };
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useReplaceDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, file }: { documentId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch(`/api/documents/${documentId}/replace`, { method: 'PUT', body: formData });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

// --- BULK ---

export function useBulkDeleteFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folderIds: string[]) => 
      apiFetch('/api/folders/bulk/delete', { method: 'POST', body: JSON.stringify({ folderIds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useBulkDeleteDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) => 
      apiFetch('/api/documents/bulk/delete', { method: 'POST', body: JSON.stringify({ documentIds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, parentId }: { folderId: string; parentId: string }) =>
      apiFetch(`/api/folders/${folderId}/move`, { method: 'PATCH', body: JSON.stringify({ parentId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useBulkMoveFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderIds, targetFolderId }: { folderIds: string[]; targetFolderId: string }) =>
      apiFetch('/api/folders/bulk/move', { method: 'POST', body: JSON.stringify({ folderIds, targetFolderId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useBulkMoveDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentIds, targetFolderId }: { documentIds: string[]; targetFolderId: string }) => 
      apiFetch('/api/documents/bulk/move', { method: 'POST', body: JSON.stringify({ documentIds, targetFolderId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folder-contents'] });
      qc.invalidateQueries({ queryKey: ['folder-tree'] });
    },
  });
}

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: () => apiFetch<{ status: string; data: any[] }>(`/api/documents/${documentId}/versions`),
    select: (res) => res.data,
    enabled: !!documentId,
  });
}

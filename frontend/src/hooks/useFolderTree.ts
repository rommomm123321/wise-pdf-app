import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  projectId: string;
  children: FolderNode[];
  files?: any[];
  _count?: { files: number; children: number };
}

function buildTree(flatFolders: any[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  // Create nodes
  for (const f of flatFolders) {
    map.set(f.id, { ...f, children: [] });
  }

  // Build hierarchy
  for (const f of flatFolders) {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function useFolderTree(projectId: string | undefined) {
  return useQuery({
    queryKey: ['folder-tree', projectId],
    queryFn: () =>
      apiFetch<{ status: string; data: any[] }>(`/api/folders/tree?projectId=${projectId}`).then(
        (r) => buildTree(r.data)
      ),
    enabled: !!projectId,
  });
}

export function useRootFolder(projectId: string | undefined) {
  return useQuery({
    queryKey: ['root-folder', projectId],
    queryFn: () =>
      apiFetch<{ status: string; data: any }>(`/api/folders/root/${projectId}`).then(r => r.data),
    enabled: !!projectId,
  });
}

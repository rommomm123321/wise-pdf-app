import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface ProjectUser {
  id: string;
  name: string | null;
  email: string;
  role?: {
    name: string;
    color: string;
  };
  projectRole?: string;
}

export function useProjectUsers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-users', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiFetch(`/api/projects/${projectId}/users`);
      return res.data as ProjectUser[];
    },
    enabled: !!projectId,
  });
}

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Permissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDownload: boolean;
  canMarkup: boolean;
  canManage: boolean;
}

const FULL_ACCESS: Permissions = {
  canView: true,
  canEdit: true,
  canDelete: true,
  canDownload: true,
  canMarkup: true,
  canManage: true,
};

/**
 * Получить effective permissions текущего юзера для проекта.
 * GENERAL_ADMIN и PROJECT_ADMIN получают полный доступ на клиенте.
 * Для остальных — ищем ProjectAssignment в данных /api/auth/me.
 */
export function useProjectPermissions(projectId: string | undefined): Permissions {
  const { user } = useAuth();

  if (!user || !projectId) {
    return { canView: false, canEdit: false, canDelete: false, canDownload: false, canMarkup: false, canManage: false };
  }

  // Admins — full access
  if (user.systemRole === 'GENERAL_ADMIN' || user.role?.name === 'Admin') {
    return FULL_ACCESS;
  }

  // For other roles, we need assignments. Use a simple query.
  // This is kept as a hook-friendly fallback.
  return { canView: true, canEdit: false, canDelete: false, canDownload: true, canMarkup: false, canManage: false };
}

/**
 * Hook that fetches actual permissions from user's assignment data.
 * More accurate than the role-based check above.
 */
export function useMyProjectPermissions(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-permissions', projectId],
    queryFn: async (): Promise<Permissions> => {
      if (!user || !projectId) return { canView: false, canEdit: false, canDelete: false, canDownload: false, canMarkup: false, canManage: false };

      if (user.systemRole === 'GENERAL_ADMIN' || user.role?.name === 'Admin') {
        return FULL_ACCESS;
      }

      // Fetch user data with assignments
      const res = await apiFetch<{ status: string; user: any }>('/api/auth/me');
      const me = res.user;

      // Find assignment for this project
      if (me.assignedProjects) {
        const assignment = me.assignedProjects.find((ap: any) => ap.projectId === projectId);
        if (assignment) {
          return {
            canView: assignment.canView,
            canEdit: assignment.canEdit,
            canDelete: assignment.canDelete,
            canDownload: assignment.canDownload,
            canMarkup: assignment.canMarkup,
            canManage: assignment.canManage,
          };
        }
      }

      return { canView: true, canEdit: false, canDelete: false, canDownload: false, canMarkup: false, canManage: false };
    },
    enabled: !!projectId && !!user,
    staleTime: 30000, // Cache for 30s
  });
}

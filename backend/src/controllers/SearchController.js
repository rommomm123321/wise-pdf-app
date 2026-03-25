const prisma = require('../prismaClient');

class SearchController {
  static async globalSearch(req, res) {
    try {
      const { q, scope } = req.query;
      if (!q || q.length < 2) {
        return res.json({ status: 'ok', data: { projects: [], folders: [], documents: [], users: [] } });
      }

      const userId = req.user.userId;
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      const systemRole = currentUser.systemRole;

      // Build project filter based on role
      let projectFilter = {};
      let callerRole = null;
      if (currentUser.roleId) {
        callerRole = await prisma.role.findUnique({ where: { id: currentUser.roleId } });
      }
      const isCompanyAdmin = callerRole?.name === 'Admin';

      if (systemRole === 'GENERAL_ADMIN') {
        // No filter — sees everything
      } else if (isCompanyAdmin && currentUser.companyId) {
        // Company Admin sees everything in their company
        projectFilter = { companyId: currentUser.companyId };
      } else {
        // Non-admin (or user without company) — only assigned projects
        const assignments = await prisma.projectAssignment.findMany({
          where: { userId },
          select: { projectId: true },
        });
        const projectIds = assignments.map((a) => a.projectId);
        projectFilter = { id: { in: projectIds } };
      }

      const searchMode = { contains: q, mode: 'insensitive' };
      const results = { projects: [], folders: [], documents: [], users: [] };

      // 1. Projects
      if (!scope || scope === 'all' || scope === 'projects') {
        results.projects = await prisma.project.findMany({
          where: {
            ...projectFilter,
            OR: [{ name: searchMode }, { description: searchMode }],
          },
          take: 10,
          select: { id: true, name: true, description: true },
        });
      }

      // 2. Folders
      if (!scope || scope === 'all' || scope === 'folders') {
        const folderWhere = { name: searchMode };
        if (projectFilter.id) folderWhere.projectId = projectFilter.id;
        else if (projectFilter.companyId) folderWhere.project = { companyId: projectFilter.companyId };
        else {
          // If neither, then user has no assigned projects and is not company admin
          folderWhere.id = '__none__';
        }

        results.folders = await prisma.folder.findMany({
          where: folderWhere,
          take: 10,
          select: { id: true, name: true, projectId: true },
        });
      }

      // 3. Documents
      if (!scope || scope === 'all' || scope === 'documents') {
        const docWhere = { name: searchMode, isLatest: true };
        if (projectFilter.id) docWhere.folder = { projectId: projectFilter.id };
        else if (projectFilter.companyId) docWhere.folder = { project: { companyId: projectFilter.companyId } };
        else {
          docWhere.id = '__none__';
        }

        results.documents = await prisma.document.findMany({
          where: docWhere,
          take: 10,
          select: {
            id: true,
            name: true,
            folderId: true,
            folder: { select: { projectId: true } },
          },
        });
        results.documents = results.documents.map((d) => ({
          id: d.id,
          name: d.name,
          folderId: d.folderId,
          projectId: d.folder?.projectId,
        }));
      }

      // 4. Users — visibility by hierarchy
      if (!scope || scope === 'all' || scope === 'users') {
        const userWhere = {
          OR: [{ name: searchMode }, { email: searchMode }],
        };

        if (systemRole === 'GENERAL_ADMIN') {
          // sees everyone
        } else if (currentUser.companyId) {
          // Company users see only their company
          userWhere.companyId = currentUser.companyId;
        } else {
          // No company — sees nobody
          userWhere.id = '__none__';
        }

        const userSelect = {
          id: true,
          name: true,
          email: true,
          systemRole: true,
          role: { select: { name: true, color: true } },
          company: { select: { id: true, name: true } },
          tags: { select: { id: true, text: true, color: true } },
          assignedProjects: {
            select: {
              project: { select: { id: true, name: true } },
            },
          },
        };

        const rawUsers = await prisma.user.findMany({
          where: userWhere,
          take: 10,
          select: userSelect,
        });

        // For non-admins, simplify the data (no permission booleans)
        results.users = rawUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          systemRole: (systemRole === 'GENERAL_ADMIN' || isCompanyAdmin) ? u.systemRole : undefined,
          role: u.role,
          company: u.company,
          tags: u.tags,
          projects: u.assignedProjects?.map(ap => ({ id: ap.project.id, name: ap.project.name })) || [],
        }));
      }

      res.json({ status: 'ok', ...results });
    } catch (error) {
      console.error('[SearchController] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = SearchController;

const prisma = require('../prismaClient');

class ProjectController {
  // Получить проекты (с пагинацией)
  static async getProjects(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const userId = req.user.userId;
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (!currentUser) return res.status(404).json({ error: 'User not found' });

      let where = { isDeleted: false };
      let useAssignments = false;

      if (currentUser.systemRole === 'GENERAL_ADMIN') {
        where.company = { isArchived: (req.query.includeArchived === 'true') };
        if (req.query.companyId) {
          where.companyId = req.query.companyId;
          delete where.company; 
        }
      } else if (currentUser.companyId) {
        where.company = { isArchived: false };
        if (currentUser.role?.name === 'Admin') {
          where.companyId = currentUser.companyId;
        } else {
          useAssignments = true;
        }
      } else {
        return res.json({ status: 'ok', data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }

      const { search } = req.query;

      if (useAssignments) {
        let assignmentWhere = { 
          userId,
          project: { isDeleted: false, company: { isArchived: false } }
        };
        if (search) {
          assignmentWhere.project.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ];
        }

        const [assignments, total] = await Promise.all([
          prisma.projectAssignment.findMany({
            where: assignmentWhere,
            include: { project: { include: { company: { select: { id: true, name: true } } } } },
            skip,
            take: limit,
            orderBy: { project: { createdAt: 'desc' } },
          }),
          prisma.projectAssignment.count({ 
            where: assignmentWhere 
          }),
        ]);
        const projects = assignments.map(a => ({
          ...a.project,
          permissions: {
            canView: a.canView,
            canEdit: a.canEdit,
            canDelete: a.canDelete,
            canDownload: a.canDownload,
            canMarkup: a.canMarkup,
            canManage: a.canManage,
            scope: a.scope
          }
        }));
        return res.json({ status: 'ok', data: projects, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          include: { company: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);

      res.json({ status: 'ok', data: projects, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('[ProjectController] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Создать проект
  static async createProject(req, res) {
    try {
      const { name, description, companyId } = req.body;
      if (!name || !companyId) return res.status(400).json({ error: 'Missing name or companyId' });

      const project = await prisma.project.create({
        data: { name, description, companyId },
      });

      // Авто-создаем корневую папку для проекта
      await prisma.folder.create({
        data: { name: 'Root', projectId: project.id },
      });

      const { logAction } = require('../services/auditService');
      await logAction({
        action: 'CREATE',
        userId: req.user.userId,
        projectId: project.id,
        details: { name },
      });

      res.status(201).json({ status: 'ok', data: project });

      // OneDrive sync in background
      setImmediate(async () => {
        try {
          const company = await prisma.company.findUnique({ where: { id: companyId } });
          if (company?.oneDriveConnected && company?.oneDriveRootItemId) {
            const StorageFactory = require('../services/storage/StorageFactory');
            const storage = await StorageFactory.getProviderForCompany(companyId);
            const externalId = await storage.createFolder(project.name, company.oneDriveRootItemId);
            if (externalId) await prisma.project.update({ where: { id: project.id }, data: { externalId } });
          }
        } catch (syncErr) { console.error('[OneDrive] createProject sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get a single project by ID
  static async getProjectById(req, res) {
    try {
      const { projectId } = req.params;
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          folders: {
            where: { parentId: null, isDeleted: false },
            select: { id: true, name: true },
          },
          company: { select: { name: true, isArchived: true, oneDriveConnected: true } },
        },
      });

      if (!project || project.isDeleted) return res.status(404).json({ error: 'Project not found' });

      res.json({ status: 'ok', data: project });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getProjectUsers(req, res) {
    try {
      const { projectId } = req.params;
      const assignments = await prisma.projectAssignment.findMany({
        where: { projectId },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: { select: { name: true, color: true } } }
          }
        }
      });
      const users = assignments.map(a => ({
        ...a.user,
        projectRole: a.roleId
      }));
      res.json({ status: 'ok', data: users });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Удалить проекты (массово)
  static async bulkDelete(req, res) {
    try {
      const { projectIds } = req.body;
      if (!Array.isArray(projectIds)) return res.status(400).json({ error: 'Invalid data' });

      await prisma.project.updateMany({
        where: { id: { in: projectIds } },
        data: { isDeleted: true }
      });

      const { logAction } = require('../services/auditService');
      for (const id of projectIds) {
        await logAction({ action: 'DELETE', userId: req.user.userId, projectId: id, details: { action: 'bulk_soft_delete' } });
      }

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          const projectsToDelete = await prisma.project.findMany({ where: { id: { in: projectIds } }, include: { company: true } });
          for (const p of projectsToDelete) {
            if (p.externalId && p.company?.oneDriveConnected) {
              const StorageFactory = require('../services/storage/StorageFactory');
              const storage = await StorageFactory.getProviderForCompany(p.companyId);
              await storage.deleteFolder(p.externalId).catch(e => console.warn('Failed to delete project in OD:', e.message));
            }
          }
        } catch (syncErr) { console.error('[OneDrive] bulkDelete projects sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateProject(req, res) {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;
      const existing = await prisma.project.findUnique({ where: { id: projectId }, include: { company: true } });
      
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { name, description }
      });
      
      const { logAction } = require('../services/auditService');
      await logAction({ action: 'UPDATE', userId: req.user.userId, projectId, details: { action: 'rename', name, description } });
      
      res.json({ status: 'ok', data: updated });

      setImmediate(async () => {
        try {
          if (existing?.externalId && existing?.company?.oneDriveConnected) {
            const StorageFactory = require('../services/storage/StorageFactory');
            const storage = await StorageFactory.getProviderForCompany(existing.companyId);
            if (name && name !== existing.name) {
              await storage.renameItem(existing.externalId, name);
            }
          }
        } catch (syncErr) { console.error('[OneDrive] updateProject sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteProject(req, res) {
    try {
      const { projectId } = req.params;
      const existing = await prisma.project.findUnique({ where: { id: projectId }, include: { company: true } });

      await prisma.project.update({
        where: { id: projectId },
        data: { isDeleted: true }
      });

      const { logAction } = require('../services/auditService');
      await logAction({ action: 'DELETE', userId: req.user.userId, projectId });

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          if (existing?.externalId && existing?.company?.oneDriveConnected) {
            const StorageFactory = require('../services/storage/StorageFactory');
            const storage = await StorageFactory.getProviderForCompany(existing.companyId);
            await storage.deleteFolder(existing.externalId);
          }
        } catch (syncErr) { console.error('[OneDrive] deleteProject sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getProjectPermissions(req, res) {
    try {
      const { projectId } = req.params;
      const assignments = await prisma.projectAssignment.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, systemRole: true } },
        },
      });
      res.json({ status: 'ok', data: assignments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ProjectController;

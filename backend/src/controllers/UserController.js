const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');

class UserController {
  // GET /api/users — список юзеров (с пагинацией, только для админов)
  static async getUsers(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      if (!currentUser) return res.status(404).json({ error: 'Current user not found' });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      
      let where = { isDeleted: false };

      if (isGeneralAdmin) {
        // where stays { isDeleted: false }
      } else if (currentUser.companyId) {
        where.companyId = currentUser.companyId;
      } else {
        return res.json({ status: 'ok', data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            systemRole: true,
            roleId: true,
            role: { select: { id: true, name: true, color: true, isSystem: true } },
            tags: { select: { id: true, text: true, color: true } },
            companyId: true,
            company: { select: { id: true, name: true } },
            createdAt: true,
            assignedProjects: {
              select: {
                id: true,
                projectId: true,
                roleId: true,
                role: { select: { id: true, name: true, color: true } },
                scope: true,
                project: { select: { id: true, name: true } },
                canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true,
              },
            },
            folderPermissions: {
              select: {
                id: true, folderId: true, roleId: true,
                role: { select: { id: true, name: true, color: true } },
                folder: { select: { id: true, name: true, projectId: true } },
                canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      res.json({ status: 'ok', data: users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('[UserController] getUsers error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/users/:userId/profile — получить профиль (read-only) для коллег по компании
  static async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });
      if (!currentUser) return res.status(404).json({ error: 'User not found' });

      // Target user lookup
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true }
      });
      if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

      // Admin or same-company check
      if (currentUser.systemRole !== 'GENERAL_ADMIN' && currentUser.companyId !== targetUser.companyId) {
        return res.status(403).json({ error: 'Access denied. You can only view profiles within your own company.' });
      }

      // Admin or same-company check
      const isAdmin = currentUser.systemRole === 'GENERAL_ADMIN' || (currentUser.role?.name === 'Admin' && currentUser.companyId === targetUser.companyId);

      let selectFields = {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        roleId: true,
        role: { select: { id: true, name: true, color: true, isSystem: true } },
        companyId: true,
        company: { select: { id: true, name: true } },
        tags: { select: { id: true, text: true, color: true } },
        assignedProjects: {
          select: {
            id: true,
            projectId: true,
            roleId: true,
            role: { select: { name: true, color: true } },
            scope: true,
            project: { select: { id: true, name: true } },
            canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true,
          }
        }
      };

      if (isAdmin) {
        selectFields.folderPermissions = {
          select: {
            id: true, folderId: true, roleId: true,
            role: { select: { id: true, name: true, color: true } },
            folder: { select: { id: true, name: true, projectId: true } },
            canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true,
          }
        };
      }

      const userProfile = await prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: selectFields,
      });

      res.json({ status: 'ok', data: userProfile });
    } catch (error) {
      console.error('[UserController] getUserProfile error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/users/:userId/role
  static async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { roleId, systemRole, companyId } = req.body;
      
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });
      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';

      const targetUser = await prisma.user.findUnique({ where: { id: userId, isDeleted: false } });
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      let dataToUpdate = { roleId, systemRole };

      // Only GENERAL_ADMIN can change a user's company
      if (isGeneralAdmin && companyId !== undefined && companyId !== targetUser.companyId) {
        dataToUpdate.companyId = companyId;
        dataToUpdate.roleId = null; // Clear role, as it might belong to the old company
        
        // Wipe old company permissions
        await prisma.$transaction([
          prisma.projectAssignment.deleteMany({ where: { userId } }),
          prisma.folderPermission.deleteMany({ where: { userId } }),
          prisma.user.update({
            where: { id: userId },
            data: { ...dataToUpdate, tags: { set: [] } }
          })
        ]);
        return res.json({ status: 'ok' });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
      });
      res.json({ status: 'ok', data: updated });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  // POST /api/users/:userId/add-to-company — добавить зарегистрированного юзера в свою компанию
  static async addToCompany(req, res) {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isAdmin = isGeneralAdmin || currentUser.role?.name === 'Admin';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!currentUser.companyId) {
        return res.status(400).json({ error: 'You must belong to a company' });
      }

      const targetUser = await prisma.user.findUnique({ where: { id: userId, isDeleted: false } });
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      if (targetUser.companyId === currentUser.companyId) {
        return res.status(400).json({ error: 'User already in your company' });
      }

      // Determine roleId: if provided use it, else assign default Manager role
      let assignRoleId = roleId;
      if (!assignRoleId) {
        const defaultRole = await prisma.role.findFirst({
          where: { isSystem: true, name: 'BIM Engineer' }
        });
        assignRoleId = defaultRole?.id || null;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { companyId: currentUser.companyId, roleId: assignRoleId },
        select: { id: true, email: true, name: true, systemRole: true, roleId: true, companyId: true },
      });

      await logAction({
        action: 'ASSIGN',
        userId: currentUser.id,
        targetUserId: userId,
        details: { action: 'added_to_company', companyId: currentUser.companyId, roleId: assignRoleId },
      });

      res.json({ status: 'ok', data: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- BULK ---
  static async bulkUpdateRoles(req, res) {
    try {
      const { userIds, roleId } = req.body;
      await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { roleId } });
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async bulkDeleteUsers(req, res) {
    try {
      const { userIds } = req.body;
      await prisma.$transaction([
        prisma.projectAssignment.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.folderPermission.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.user.updateMany({ where: { id: { in: userIds } }, data: { isDeleted: true, companyId: null, roleId: null } })
      ]);
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async bulkAssignProjects(req, res) {
    try {
      const { userIds, projectIds, permissions } = req.body;
      for (const userId of userIds) {
        for (const projectId of projectIds) {
          await prisma.projectAssignment.upsert({
            where: { userId_projectId: { userId, projectId } },
            create: { userId, projectId, ...permissions },
            update: permissions
          });
        }
      }
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  // --- PROJECT ASSIGNMENTS ---
  static async assignToProject(req, res) {
    try {
      const { userId, projectId } = req.params;
      const { roleId, canView = true, canEdit = false, canDelete = false, canDownload = true, canMarkup = false, canManage = false, scope = 'FULL' } = req.body;
      const assignment = await prisma.projectAssignment.upsert({
        where: { userId_projectId: { userId, projectId } },
        create: { userId, projectId, roleId, canView, canEdit, canDelete, canDownload, canMarkup, canManage, scope },
        update: { roleId, canView, canEdit, canDelete, canDownload, canMarkup, canManage, scope },
      });
      res.json({ status: 'ok', data: assignment });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async unassignFromProject(req, res) {
    try {
      const { userId, projectId } = req.params;
      await prisma.projectAssignment.delete({ where: { userId_projectId: { userId, projectId } } });
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async updateProjectPermissions(req, res) {
    try {
      const { userId, projectId } = req.params;
      const assignment = await prisma.projectAssignment.update({
        where: { userId_projectId: { userId, projectId } },
        data: req.body,
      });
      res.json({ status: 'ok', data: assignment });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  // --- PREFERENCES ---
  static async updatePreferences(req, res) {
    try {
      const userId = req.user.userId;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
      const currentPrefs = user.preferences || {};
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { preferences: { ...currentPrefs, ...req.body } }
      });
      res.json({ status: 'ok', data: updatedUser.preferences });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  // --- OTHERS ---
  static async searchUsers(req, res) {
    try {
      const { q } = req.query;
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const searchMode = { contains: q, mode: 'insensitive' };
      const users = await prisma.user.findMany({
        where: {
          OR: [{ email: searchMode }, { name: searchMode }],
          NOT: currentUser.companyId ? { companyId: currentUser.companyId } : undefined,
        },
        select: {
          id: true, email: true, name: true, systemRole: true,
          role: { select: { id: true, name: true, color: true } },
          company: { select: { id: true, name: true } },
          companyId: true,
        },
        take: 20,
      });
      res.json({ status: 'ok', data: users });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async getCompanyTags(req, res) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const tags = await prisma.companyTag.findMany({
        where: user.systemRole === 'GENERAL_ADMIN' ? {} : { companyId: user.companyId },
        orderBy: { text: 'asc' }
      });
      res.json({ status: 'ok', data: tags });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async createCompanyTag(req, res) {
    try {
      const { text, color } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const tag = await prisma.companyTag.create({ data: { text, color: color || '#9E9E9E', companyId: user.companyId } });
      res.status(201).json({ status: 'ok', data: tag });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async deleteCompanyTag(req, res) {
    try {
      const { tagId } = req.params;
      await prisma.companyTag.delete({ where: { id: tagId } });
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async updateUserTags(req, res) {
    try {
      const { userId } = req.params;
      const { tagIds } = req.body;
      const user = await prisma.user.update({
        where: { id: userId },
        data: { tags: { set: tagIds.map(id => ({ id })) } },
        include: { tags: true }
      });
      res.json({ status: 'ok', data: user.tags });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }

  static async removeUser(req, res) {
    try {
      const { userId } = req.params;
      await prisma.$transaction([
        prisma.projectAssignment.deleteMany({ where: { userId } }),
        prisma.folderPermission.deleteMany({ where: { userId } }),
        prisma.documentPermission.deleteMany({ where: { userId } }),
        prisma.user.update({ where: { id: userId }, data: { companyId: null, roleId: null, tags: { set: [] } } }),
      ]);
      res.json({ status: 'ok' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  }
}

module.exports = UserController;

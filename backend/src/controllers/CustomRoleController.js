const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');

class CustomRoleController {
  // GET /api/custom-roles — получить кастомные роли моей компании
  static async getRoles(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ 
        where: { id: req.user.userId },
        include: { role: true }
      });

      if (!currentUser) return res.status(404).json({ error: 'User not found' });

      let where = { isSystem: false }; // По умолчанию только кастомные

      if (currentUser.systemRole === 'GENERAL_ADMIN') {
        // Видит все роли, если нужно, или только кастомные
      } else if (currentUser.companyId) {
        where.companyId = currentUser.companyId;
      } else {
        return res.json({ status: 'ok', data: [] });
      }

      const roles = await prisma.role.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { name: 'asc' },
      });

      res.json({ status: 'ok', data: roles });
    } catch (error) {
      console.error('[CustomRoleController] getRoles error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/custom-roles — создать кастомную роль
  static async createRole(req, res) {
    try {
      const { name, color, companyId, projectId, defaultCanView, defaultCanEdit, defaultCanDelete, defaultCanDownload, defaultCanMarkup, defaultCanManage } = req.body;

      const currentUser = await prisma.user.findUnique({ 
        where: { id: req.user.userId },
        include: { role: true }
      });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isCompanyAdmin = currentUser.role?.name === 'Admin';

      if (!isGeneralAdmin && !isCompanyAdmin) {
        return res.status(403).json({ error: 'Only admins can create roles' });
      }

      const targetCompanyId = isGeneralAdmin ? (companyId || currentUser.companyId) : currentUser.companyId;
      
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      if (!name) return res.status(400).json({ error: 'Role name is required' });

      const role = await prisma.role.create({
        data: {
          name,
          color: color || null,
          companyId: targetCompanyId,
          projectId: projectId || null,
          isSystem: false,
          defaultCanView: defaultCanView ?? true,
          defaultCanEdit: defaultCanEdit ?? false,
          defaultCanDelete: defaultCanDelete ?? false,
          defaultCanDownload: defaultCanDownload ?? true,
          defaultCanMarkup: defaultCanMarkup ?? false,
          defaultCanManage: defaultCanManage ?? false,
        },
      });

      await logAction({
        action: 'CREATE',
        userId: currentUser.id,
        details: { type: 'role', roleName: name, companyId: targetCompanyId },
      });

      res.status(201).json({ status: 'ok', data: role });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Role with this name already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/custom-roles/:id — обновить роль
  static async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, color, defaultCanView, defaultCanEdit, defaultCanDelete, defaultCanDownload, defaultCanMarkup, defaultCanManage } = req.body;

      const data = {};
      if (name !== undefined) data.name = name;
      if (color !== undefined) data.color = color;
      if (defaultCanView !== undefined) data.defaultCanView = defaultCanView;
      if (defaultCanEdit !== undefined) data.defaultCanEdit = defaultCanEdit;
      if (defaultCanDelete !== undefined) data.defaultCanDelete = defaultCanDelete;
      if (defaultCanDownload !== undefined) data.defaultCanDownload = defaultCanDownload;
      if (defaultCanMarkup !== undefined) data.defaultCanMarkup = defaultCanMarkup;
      if (defaultCanManage !== undefined) data.defaultCanManage = defaultCanManage;

      const role = await prisma.role.update({ where: { id }, data });

      res.json({ status: 'ok', data: role });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/custom-roles/:id — удалить роль
  static async deleteRole(req, res) {
    try {
      const { id } = req.params;

      // Проверяем, не системная ли это роль
      const role = await prisma.role.findUnique({ where: { id } });
      if (role?.isSystem) return res.status(400).json({ error: 'Cannot delete system roles' });

      // Снимаем роль с юзеров (в Prisma это roleId в User)
      await prisma.user.updateMany({
        where: { roleId: id },
        data: { roleId: null },
      });

      await prisma.role.delete({ where: { id } });

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CustomRoleController;

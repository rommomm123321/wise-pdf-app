const prisma = require('../prismaClient');

class RoleController {
  // GET /api/custom-roles — список ролей (системные + кастомные компании или проекта)
  static async getRoles(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });

      let OR_conditions = [{ isSystem: true }];

      if (req.query.projectId) {
        OR_conditions.push({ projectId: req.query.projectId });
      } else if (req.query.companyId) {
        OR_conditions.push({ companyId: req.query.companyId });
      } else if (currentUser.companyId) {
        OR_conditions.push({ companyId: currentUser.companyId });
      }

      const roles = await prisma.role.findMany({
        where: { OR: OR_conditions },
        include: { _count: { select: { users: true } } },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
      });

      res.json({ status: 'ok', data: roles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/custom-roles — создать новую роль
  static async createRole(req, res) {
    try {
      const { name, color, projectId, ...perms } = req.body;
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });

      const role = await prisma.role.create({
        data: {
          name,
          color,
          companyId: projectId ? null : currentUser.companyId,
          projectId: projectId || null,
          isSystem: false,
          ...perms
        }
      });

      res.status(201).json({ status: 'ok', data: role });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Role with this name already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/custom-roles/:id — обновить роль
  static async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, color, ...perms } = req.body;

      const updated = await prisma.role.update({
        where: { id },
        data: { name, color, ...perms }
      });

      res.json({ status: 'ok', data: updated });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Role with this name already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/custom-roles/:id — удалить роль
  static async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const role = await prisma.role.findUnique({ where: { id } });

      if (role.isSystem) return res.status(400).json({ error: 'Cannot delete system roles' });

      await prisma.role.delete({ where: { id } });
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/users/:userId/custom-role — назначить роль юзеру
  static async assignRole(req, res) {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { roleId },
        select: { id: true, roleId: true }
      });

      res.json({ status: 'ok', data: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = RoleController;

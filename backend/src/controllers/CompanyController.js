const prisma = require("../prismaClient");

class CompanyController {
  // Получить все компании (доступно только для GENERAL_ADMIN)
  static async getAllCompanies(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (currentUser.systemRole !== "GENERAL_ADMIN") {
        return res.status(403).json({ error: "Access denied. General Admin only." });
      }

      const companies = await prisma.company.findMany({
        include: {
          _count: { select: { users: true, projects: true } },
        },
      });
      res.json({ status: "ok", data: companies });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Создать новую компанию (GENERAL_ADMIN или Admin-роль, или юзер без компании)
  static async createCompany(req, res) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Company name is required" });

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isCompanyAdmin = currentUser.role?.name === 'Admin';

      // GENERAL_ADMIN может создавать компании всегда
      // Юзер без компании тоже может создать (станет первым юзером)
      if (!isGeneralAdmin && currentUser.companyId) {
        return res.status(400).json({ error: "You are already assigned to a company." });
      }

      const newCompany = await prisma.company.create({
        data: { name },
      });

      // Если не GENERAL_ADMIN — привязываем к компании и даём роль Admin
      if (!isGeneralAdmin) {
        const adminRole = await prisma.role.findFirst({ where: { name: 'Admin', isSystem: true } });
        await prisma.user.update({
          where: { id: req.user.userId },
          data: { companyId: newCompany.id, roleId: adminRole?.id }
        });
      }

      res.status(201).json({ status: "ok", data: newCompany });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Получить данные своей компании
  static async getMyCompany(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { company: true, role: true },
      });

      if (!user.company) {
        return res.status(404).json({ error: "You are not assigned to any company." });
      }

      const isAdmin = user.systemRole === 'GENERAL_ADMIN' || user.role?.name === 'Admin';

      const companyData = await prisma.company.findUnique({
        where: { id: user.company.id },
        include: {
          projects: true,
          users: isAdmin
            ? { select: { id: true, name: true, email: true, systemRole: true, roleId: true, role: { select: { name: true, color: true } } } }
            : false,
        },
      });

      res.json({ status: "ok", data: companyData });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Получить подробную статистику по всем компаниям (только GENERAL_ADMIN)
  static async getCompanyStats(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (currentUser.systemRole !== "GENERAL_ADMIN") {
        return res.status(403).json({ error: "Access denied. General Admin only." });
      }

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const { search } = req.query;

      let where = {};
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          include: {
            _count: { select: { users: true, projects: true, roles: true, tags: true } },
            projects: {
              include: {
                _count: { select: { folders: true } },
                folders: {
                  include: {
                    _count: { select: { files: true } }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.company.count({ where })
      ]);

      const stats = companies.map(c => {
        const foldersCount = c.projects.reduce((sum, p) => sum + p._count.folders, 0);
        const documentsCount = c.projects.reduce((sum, p) => {
          return sum + p.folders.reduce((fSum, f) => fSum + f._count.files, 0);
        }, 0);

        return {
          id: c.id,
          name: c.name,
          createdAt: c.createdAt,
          isArchived: c.isArchived,
          updatedAt: c.updatedAt,
          stats: {
            users: c._count.users,
            projects: c._count.projects,
            roles: c._count.roles,
            tags: c._count.tags,
            folders: foldersCount,
            documents: documentsCount
          }
        };
      });

      res.json({ status: "ok", data: stats, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('[CompanyController] getCompanyStats error', error);
      res.status(500).json({ error: error.message });
    }
  }
  // Обновить компанию (rename)
  static async updateCompany(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (currentUser.systemRole !== "GENERAL_ADMIN") {
        return res.status(403).json({ error: "Access denied. General Admin only." });
      }

      const { id } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Company name is required" });

      const updated = await prisma.company.update({
        where: { id },
        data: { name: name.trim() },
      });
      res.json({ status: "ok", data: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Удалить (архивировать) компанию
  static async deleteCompany(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (currentUser.systemRole !== "GENERAL_ADMIN") {
        return res.status(403).json({ error: "Access denied. General Admin only." });
      }

      const { id } = req.params;

      // Soft-archive only — keep users attached so restore works
      await prisma.company.update({
        where: { id },
        data: { isArchived: true },
      });

      res.json({ status: "ok", message: "Company archived" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Восстановить компанию из архива
  static async restoreCompany(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (currentUser.systemRole !== "GENERAL_ADMIN") {
        return res.status(403).json({ error: "Access denied. General Admin only." });
      }

      const { id } = req.params;
      await prisma.company.update({
        where: { id },
        data: { isArchived: false },
      });

      res.json({ status: "ok", message: "Company restored" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CompanyController;

const prisma = require('../prismaClient');

class AuditController {
  // GET /api/audit-logs
  static async getLogs(req, res) {
    try {
      const { userId, projectId, folderId, companyId, action, startDate, endDate, q, limit = 50, offset = 0 } = req.query;
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      // Access check: only GENERAL_ADMIN or company Admin
      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isCompanyAdmin = currentUser.role?.name === 'Admin';

      if (!isGeneralAdmin && !isCompanyAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      const where = {};

      // 1. Permissions check
      if (!isGeneralAdmin) {
        if (!currentUser.companyId) return res.status(403).json({ error: 'Access denied' });
        // Company Admin sees only logs from their company
        where.user = { companyId: currentUser.companyId };
      }

      // 2. Filters
      if (userId) where.userId = userId;
      if (projectId) where.projectId = projectId;
      if (folderId) where.folderId = folderId;
      if (companyId && isGeneralAdmin) {
        // Only GENERAL_ADMIN can filter by arbitrary company
        where.user = { ...where.user, companyId };
      }
      if (action) where.action = action;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (q) {
        where.OR = [
          { details: { path: ['name'], string_contains: q } },
          { details: { path: ['email'], string_contains: q } }
        ];
      }

      const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, company: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset),
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({ status: 'ok', data: logs, total });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AuditController;

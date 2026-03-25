const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');

class FolderPermissionController {
  // GET /api/folders/:folderId/permissions — получить все права на папку
  static async getFolderPermissions(req, res) {
    try {
      const { folderId } = req.params;
      const permissions = await prisma.folderPermission.findMany({
        where: { folderId },
        include: {
          user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        },
      });
      res.json({ status: 'ok', data: permissions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/folders/:folderId/permissions/:userId
  static async setFolderPermission(req, res) {
    try {
      const { folderId, userId } = req.params;
      const data = req.body;
      const permission = await prisma.folderPermission.upsert({
        where: { userId_folderId: { userId, folderId } },
        create: { userId, folderId, ...data },
        update: data,
      });
      res.json({ status: 'ok', data: permission });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/folders/:folderId/permissions/:userId
  static async deleteFolderPermission(req, res) {
    try {
      const { folderId, userId } = req.params;
      await prisma.folderPermission.deleteMany({ where: { userId, folderId } });
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteFolderPermissionById(req, res) {
    try {
      const { id } = req.params;
      await prisma.folderPermission.delete({ where: { id } });
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // === DOCUMENTS ===

  static async getDocumentPermissions(req, res) {
    try {
      const { documentId } = req.params;
      const permissions = await prisma.documentPermission.findMany({
        where: { documentId },
        include: {
          user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        },
      });
      res.json({ status: 'ok', data: permissions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async setDocumentPermission(req, res) {
    try {
      const { documentId, userId } = req.params;
      const data = req.body;
      const permission = await prisma.documentPermission.upsert({
        where: { userId_documentId: { userId, documentId } },
        create: { userId, documentId, ...data },
        update: data,
      });
      res.json({ status: 'ok', data: permission });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteDocumentPermissionById(req, res) {
    try {
      const { id } = req.params;
      await prisma.documentPermission.delete({ where: { id } });
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = FolderPermissionController;

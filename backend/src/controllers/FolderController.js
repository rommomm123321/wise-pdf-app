const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');
const { getFolderPermissions } = require('../middlewares/permissionMiddleware');

class FolderController {
  // Get all folders for a project (с учетом прав и Ghost Path)
  static async getFolderTree(req, res) {
    try {
      const { projectId } = req.query;
      const userId = req.user.userId;

      // Получаем ВСЕ папки проекта
      const allFolders = await prisma.folder.findMany({
        where: { projectId, isDeleted: false },
        include: { 
          files: { where: { isLatest: true, isDeleted: false } },
          _count: { select: { files: true, children: true } } 
        },
      });

      // Фильтруем те, на которые у юзера есть canView (включая Ghost Path)
      const visibleFolders = [];
      for (const folder of allFolders) {
        const perms = await getFolderPermissions(userId, folder.id);
        if (perms && perms.canView) {
          // If the folder is Ghost, it means user only has access to a descendant folder,
          // so files in this intermediate folder should be hidden.
          // Otherwise, folder access grants full file access.
          visibleFolders.push({
            ...folder,
            files: perms.isGhost ? [] : folder.files,
            isGhost: perms.isGhost || false
          });
        }
      }

      res.json({ status: 'ok', data: visibleFolders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get contents of a specific folder
  static async getFolderContents(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.userId;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const skip = (page - 1) * limit;

      const perms = await getFolderPermissions(userId, folderId);
      
      if (!perms || !perms.canView) {
        return res.json({ status: 'ok', data: { folders: [], documents: [], noAccess: true }, pagination: { page, limit, total: 0, totalPages: 0 } });
      }

      const isGhost = perms?.isGhost || false;

      // 1. Get ALL potentially visible folders
      const allFolders = await prisma.folder.findMany({
        where: { parentId: folderId, isDeleted: false },
        include: { _count: { select: { files: { where: { isDeleted: false } }, children: { where: { isDeleted: false } } } } },
        orderBy: { name: 'asc' }
      });

      const visibleSubFolders = [];
      for (const f of allFolders) {
        const p = await getFolderPermissions(userId, f.id);
        if (p && p.canView) visibleSubFolders.push(f);
      }

      // 2. Get ALL potentially visible documents
      let documents = [];
      if (!isGhost) {
        documents = await prisma.document.findMany({
          where: { folderId, isLatest: true, isDeleted: false },
          include: { _count: { select: { markups: true } } },
          orderBy: { name: 'asc' }
        });
      }

      // 3. Combined pagination logic
      const totalItems = visibleSubFolders.length + documents.length;

      const paginatedFolders = visibleSubFolders.slice(skip, skip + limit);
      const remainingLimit = Math.max(0, limit - paginatedFolders.length);
      const docSkip = Math.max(0, skip - visibleSubFolders.length);
      let paginatedDocs = documents.slice(docSkip, docSkip + remainingLimit);

      // 4. Enrich docs with total markup count across ALL versions (for replace dialog)
      if (paginatedDocs.length > 0) {
        const docNames = paginatedDocs.map(d => d.name);
        const allVersionDocs = await prisma.document.findMany({
          where: { folderId, isDeleted: false, name: { in: docNames } },
          include: { _count: { select: { markups: true } } },
        });
        const markupsByName = {};
        for (const d of allVersionDocs) {
          markupsByName[d.name] = (markupsByName[d.name] || 0) + d._count.markups;
        }
        paginatedDocs = paginatedDocs.map(d => ({
          ...d,
          allVersionMarkupsCount: markupsByName[d.name] || 0,
        }));
      }

      res.json({ 
        status: 'ok', 
        data: { 
          folders: paginatedFolders, 
          documents: paginatedDocs 
        },
        pagination: {
          page,
          limit,
          total: totalItems,
          totalPages: Math.ceil(totalItems / limit)
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get root folder
  static async getRootFolder(req, res) {
    try {
      const { projectId } = req.params;
      let root = await prisma.folder.findFirst({
        where: { projectId, parentId: null, isDeleted: false }
      });
      if (!root) {
        root = await prisma.folder.create({ data: { name: 'Root', projectId } });
      }
      res.json({ status: 'ok', data: root });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Create folder
  static async createFolder(req, res) {
    try {
      const { name, projectId, parentId } = req.body;
      const folder = await prisma.folder.create({
        data: { name, projectId, parentId: parentId || null },
      });
      await logAction({ action: 'CREATE', userId: req.user.userId, folderId: folder.id, projectId, details: { name } });
      res.status(201).json({ status: 'ok', data: folder });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Bulk Delete
  static async bulkDelete(req, res) {
    try {
      const { folderIds } = req.body;
      await prisma.folder.updateMany({ 
        where: { id: { in: folderIds } },
        data: { isDeleted: true }
      });
      
      for (const id of folderIds) {
        await logAction({ action: 'DELETE', userId: req.user.userId, folderId: id, details: { action: 'bulk_soft_delete' } });
      }
      
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Rename
  static async renameFolder(req, res) {
    try {
      const { folderId } = req.params;
      const { name } = req.body;
      const folder = await prisma.folder.update({ where: { id: folderId }, data: { name } });
      
      await logAction({ action: 'RENAME', userId: req.user.userId, folderId, projectId: folder.projectId, details: { name } });
      
      res.json({ status: 'ok', data: folder });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Delete
  static async deleteFolder(req, res) {
    try {
      const { folderId } = req.params;
      await prisma.folder.update({ 
        where: { id: folderId },
        data: { isDeleted: true }
      });
      
      await logAction({ action: 'DELETE', userId: req.user.userId, folderId });
      
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Move Folder
  static async moveFolder(req, res) {
    try {
      const { folderId } = req.params;
      const { parentId } = req.body;
      const folder = await prisma.folder.update({
        where: { id: folderId },
        data: { parentId: parentId || null }
      });
      
      await logAction({ action: 'MOVE', userId: req.user.userId, folderId, projectId: folder.projectId, details: { newParentId: parentId } });
      
      res.json({ status: 'ok', data: folder });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Bulk Move Folders
  static async bulkMove(req, res) {
    try {
      const { folderIds, targetFolderId } = req.body;
      if (!Array.isArray(folderIds) || !targetFolderId) return res.status(400).json({ error: 'Invalid data' });

      await prisma.folder.updateMany({
        where: { id: { in: folderIds } },
        data: { parentId: targetFolderId }
      });

      for (const id of folderIds) {
        await logAction({ action: 'MOVE', userId: req.user.userId, folderId: id, details: { action: 'bulk_move', newParentId: targetFolderId } });
      }

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = FolderController;

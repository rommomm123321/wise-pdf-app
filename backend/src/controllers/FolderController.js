const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');
const { getFolderPermissions } = require('../middlewares/permissionMiddleware');

class FolderController {
  // Get all folders for a project (с учетом прав и Ghost Path)
  static async getFolderTree(req, res) {
    try {
      const { projectId } = req.query;
      const userId = req.user.userId;

      // 1. Get project-level permissions
      const { getProjectPermissions } = require('../middlewares/permissionMiddleware');
      const projPerms = await getProjectPermissions(userId, projectId);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isAdmin = user?.systemRole === 'GENERAL_ADMIN' || (projPerms && projPerms.scope === 'FULL');

      // Block access if company is archived
      const proj = await prisma.project.findUnique({ where: { id: projectId }, include: { company: { select: { isArchived: true } } } });
      if (proj?.company?.isArchived) return res.status(403).json({ error: 'Company is archived' });

      // 2. Get ALL folders of the project
      const allFolders = await prisma.folder.findMany({
        where: { projectId, isDeleted: false },
        include: {
          files: { where: { isLatest: true, isDeleted: false } },
          _count: { select: { files: true, children: true } }
        },
      });

      if (isAdmin) {
        return res.json({ 
          status: 'ok', 
          data: allFolders.map(f => ({ ...f, isGhost: false })) 
        });
      }

      // 3. Optimized filtering for non-admins
      // Get all specific folder permissions for this user
      const folderPerms = await prisma.folderPermission.findMany({
        where: { userId, folder: { projectId } }
      });
      const allowedFolderIds = new Set(folderPerms.map(p => p.folderId));

      const folderMap = new Map(allFolders.map(f => [f.id, f]));

      // Inherit access to all descendants of explicitly allowed folders
      const inheritedIds = new Set(allowedFolderIds);
      for (const startId of allowedFolderIds) {
        const stack = [startId];
        while (stack.length > 0) {
          const pid = stack.pop();
          for (const f of allFolders) {
            if (f.parentId === pid && !inheritedIds.has(f.id)) {
              inheritedIds.add(f.id);
              stack.push(f.id);
            }
          }
        }
      }

      // Calculate Ghost Paths (ancestors of directly allowed folders only)
      const visibleIds = new Set(inheritedIds);
      const ghostIds = new Set();

      for (const startId of allowedFolderIds) {
        let curr = folderMap.get(startId);
        while (curr && curr.parentId) {
          if (!visibleIds.has(curr.parentId)) {
            visibleIds.add(curr.parentId);
            ghostIds.add(curr.parentId);
          }
          curr = folderMap.get(curr.parentId);
        }
      }

      const visibleFolders = allFolders
        .filter(f => visibleIds.has(f.id))
        .map(f => ({
          ...f,
          files: ghostIds.has(f.id) ? [] : f.files, // Hide files in ghost folders
          isGhost: ghostIds.has(f.id)
        }));

      res.json({ status: 'ok', data: visibleFolders });
    } catch (error) {
      console.error('[getFolderTree] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  // Get contents of a specific folder
  static async getFolderContents(req, res) {
    try {
      const { folderId } = req.params;
      const userId = req.user.userId;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const skip = (page - 1) * limit;
      const search = (req.query.search || '').trim();

      const perms = await getFolderPermissions(userId, folderId);

      if (!perms || !perms.canView) {
        return res.json({ status: 'ok', data: { folders: [], documents: [], noAccess: true }, pagination: { page, limit, total: 0, totalPages: 0 } });
      }

      const isGhost = perms?.isGhost || false;

      // Fetch current folder to get its projectId reliably (fixes crash when folder has no sub-folders)
      const currentFolder = await prisma.folder.findUnique({ where: { id: folderId }, include: { project: { include: { company: { select: { isArchived: true } } } } } });
      if (!currentFolder) return res.status(404).json({ error: 'Folder not found' });
      if (currentFolder.project?.company?.isArchived) return res.status(403).json({ error: 'Company is archived' });
      const projectId = currentFolder.projectId;

      // 1. Get ALL potentially visible sub-folders
      // If searching, search across the entire project recursively, otherwise just child items
      const searchWhere = search ? {
        projectId: currentFolder.projectId,
        isDeleted: false,
        name: { contains: search, mode: 'insensitive' }
      } : {
        parentId: folderId,
        isDeleted: false
      };

      const allFolders = await prisma.folder.findMany({
        where: searchWhere,
        include: { _count: { select: { files: { where: { isDeleted: false } }, children: { where: { isDeleted: false } } } } },
        orderBy: { name: 'asc' }
      });

      // Avoid N+1 permission checks
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isAdmin = user?.systemRole === 'GENERAL_ADMIN';

      let visibleSubFolders = [];
      let accessibleFolderIds = new Set();

      if (isAdmin) {
        visibleSubFolders = allFolders;
      } else {
        const { getProjectPermissions } = require('../middlewares/permissionMiddleware');
        const projPerms = await getProjectPermissions(userId, projectId);
        const hasFullProjectAccess = projPerms && projPerms.scope === 'FULL';

        if (hasFullProjectAccess) {
          visibleSubFolders = allFolders;
        } else {
          // Complex permission check for partial access
          const userFolderPerms = await prisma.folderPermission.findMany({
            where: { userId, folder: { projectId } }
          });
          const directAllowedIds = new Set(userFolderPerms.map(p => p.folderId));

          const allProjectFolders = await prisma.folder.findMany({
            where: { projectId, isDeleted: false },
            select: { id: true, parentId: true }
          });
          const folderMap = new Map(allProjectFolders.map(f => [f.id, f]));

          // 1. Find all descendants of directAllowedIds (Inherited access)
          const inheritedAllowedIds = new Set();
          for (const startId of directAllowedIds) {
            inheritedAllowedIds.add(startId);
            // Recursive find children (simplified via full map)
            const stack = [startId];
            while (stack.length > 0) {
              const pid = stack.pop();
              for (const f of allProjectFolders) {
                if (f.parentId === pid) {
                  if (!inheritedAllowedIds.has(f.id)) {
                    inheritedAllowedIds.add(f.id);
                    stack.push(f.id);
                  }
                }
              }
            }
          }

          // 2. Find all ancestors of directAllowedIds (Ghost path)
          const ghostVisibleIds = new Set();
          for (const startId of directAllowedIds) {
            let curr = folderMap.get(startId);
            while (curr && curr.parentId) {
              ghostVisibleIds.add(curr.parentId);
              curr = folderMap.get(curr.parentId);
            }
          }

          accessibleFolderIds = new Set([...inheritedAllowedIds, ...ghostVisibleIds]);

          for (const f of allFolders) {
            if (accessibleFolderIds.has(f.id)) {
              visibleSubFolders.push(f);
            }
          }
        }
      }

      // 2. Get ALL potentially visible documents
      let documents = [];
      if (!isGhost) {
        const docWhere = search ? {
          folder: { projectId, isDeleted: false },
          isLatest: true,
          isDeleted: false,
          name: { contains: search, mode: 'insensitive' }
        } : {
          folderId,
          isLatest: true,
          isDeleted: false
        };

        const allPotentialDocs = await prisma.document.findMany({
          where: docWhere,
          include: { _count: { select: { markups: true } } },
          orderBy: { name: 'asc' }
        });

        // Filter documents by accessible folders
        if (isAdmin || accessibleFolderIds.size === 0) {
          // If accessibleFolderIds is empty, it means user has FULL access (projPerms.scope === 'FULL') or is admin
          documents = allPotentialDocs;
        } else {
          // For partial access, user can see docs in folders they have direct or inherited access to
          // Note: isGhost check at the top handles the current folderId access
          documents = allPotentialDocs.filter(d => accessibleFolderIds.has(d.folderId) || d.folderId === folderId);
        }
      }

      // 3. Combined pagination logic
      const totalItems = visibleSubFolders.length + documents.length;

      const paginatedFolders = visibleSubFolders.slice(skip, skip + limit);
      const remainingLimit = Math.max(0, limit - paginatedFolders.length);
      const docSkip = Math.max(0, skip - visibleSubFolders.length);
      let paginatedDocs = documents.slice(docSkip, docSkip + remainingLimit);

      // 4. Enrich docs with total markup count across ALL versions
      if (paginatedDocs.length > 0) {
        const docNames = paginatedDocs.map(d => d.name);
        const folderIds = Array.from(new Set(paginatedDocs.map(d => d.folderId)));
        
        const allVersionDocs = await prisma.document.findMany({
          where: { 
            folderId: { in: folderIds }, 
            isDeleted: false, 
            name: { in: docNames } 
          },
          include: { _count: { select: { markups: true } } },
        });
        
        const markupsByName = {};
        for (const d of allVersionDocs) {
          const key = `${d.folderId}-${d.name}`;
          markupsByName[key] = (markupsByName[key] || 0) + d._count.markups;
        }
        paginatedDocs = paginatedDocs.map(d => ({
          ...d,
          allVersionMarkupsCount: markupsByName[`${d.folderId}-${d.name}`] || 0,
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
      console.error('[getFolderContents] Error:', error);
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

      // Respond immediately — OneDrive sync runs in background
      res.status(201).json({ status: 'ok', data: folder });

      setImmediate(async () => {
        try {
          const project = await prisma.project.findUnique({ where: { id: projectId }, include: { company: true } });
          if (project?.company?.oneDriveConnected) {
            const StorageFactory = require('../services/storage/StorageFactory');
            const storage = await StorageFactory.getProviderForCompany(project.companyId);
            let parentExternalId;
            if (parentId) {
              const parent = await prisma.folder.findUnique({ where: { id: parentId } });
              parentExternalId = parent?.externalId;
              if (!parentExternalId && parent?.name === 'Root' && !parent?.parentId) {
                parentExternalId = project.externalId;
              }
            } else {
              parentExternalId = project.externalId;
            }
            if (parentExternalId) {
              const externalId = await storage.createFolder(folder.name, parentExternalId);
              if (externalId) {
                await prisma.folder.update({ where: { id: folder.id }, data: { externalId, syncSource: 'wise' } });
              }
            }
          }
        } catch (syncErr) { console.error('[OneDrive] createFolder sync failed:', syncErr.message); }
      });
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

      setImmediate(async () => {
        try {
          const foldersToDelete = await prisma.folder.findMany({ where: { id: { in: folderIds } }, include: { project: { include: { company: true } } } });
          for (const f of foldersToDelete) {
            if (f.externalId && f.project?.company?.oneDriveConnected) {
              const StorageFactory = require('../services/storage/StorageFactory');
              const storage = await StorageFactory.getProviderForCompany(f.project.companyId);
              await storage.deleteFolder(f.externalId).catch(e => console.warn('Failed to delete in OD:', e.message));
            }
          }
        } catch (syncErr) { console.error('[OneDrive] bulkDelete folders sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Rename
  static async renameFolder(req, res) {
    try {
      const { folderId } = req.params;
      const { name } = req.body;
      const existing = await prisma.folder.findUnique({ where: { id: folderId } });
      const folder = await prisma.folder.update({ where: { id: folderId }, data: { name } });

      await logAction({ action: 'UPDATE', userId: req.user.userId, folderId, projectId: folder.projectId, details: { action: 'rename', name } });

      res.json({ status: 'ok', data: folder });

      setImmediate(async () => {
        try {
          if (existing?.externalId) {
            const proj = await prisma.project.findUnique({ where: { id: existing.projectId }, include: { company: true } });
            if (proj?.company?.oneDriveConnected) {
              const StorageFactory = require('../services/storage/StorageFactory');
              const storage = await StorageFactory.getProviderForCompany(proj.companyId);
              await storage.renameItem(existing.externalId, name);
            }
          }
        } catch (syncErr) { console.error('[OneDrive] renameFolder sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Delete
  static async deleteFolder(req, res) {
    try {
      const { folderId } = req.params;
      const toDelete = await prisma.folder.findUnique({ where: { id: folderId }, include: { project: { include: { company: true } } } });

      await prisma.folder.update({ where: { id: folderId }, data: { isDeleted: true } });
      await logAction({ action: 'DELETE', userId: req.user.userId, folderId });

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          if (toDelete?.externalId && toDelete?.project?.company?.oneDriveConnected) {
            const StorageFactory = require('../services/storage/StorageFactory');
            const storage = await StorageFactory.getProviderForCompany(toDelete.project.companyId);
            await storage.deleteFolder(toDelete.externalId);
          }
        } catch (syncErr) { console.error('[OneDrive] deleteFolder sync failed:', syncErr.message); }
      });
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

      setImmediate(async () => {
        try {
          const moved = await prisma.folder.findUnique({ where: { id: folderId }, include: { project: { include: { company: true } } } });
          if (moved?.externalId && moved?.project?.company?.oneDriveConnected && parentId) {
            const newParent = await prisma.folder.findUnique({ where: { id: parentId } });
            let targetExternalId = newParent?.externalId;
            if (!targetExternalId && newParent?.name === 'Root' && !newParent?.parentId) {
              targetExternalId = moved.project.externalId;
            }
            if (targetExternalId) {
              const StorageFactory = require('../services/storage/StorageFactory');
              const storage = await StorageFactory.getProviderForCompany(moved.project.companyId);
              await storage.moveItem(moved.externalId, targetExternalId);
            }
          }
        } catch (syncErr) { console.error('[OneDrive] moveFolder sync failed:', syncErr.message); }
      });
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

      setImmediate(async () => {
        try {
          const targetFolder = await prisma.folder.findUnique({ where: { id: targetFolderId }, include: { project: { include: { company: true } } } });
          if (targetFolder?.project?.company?.oneDriveConnected) {
            let targetExternalId = targetFolder.externalId;
            if (!targetExternalId && targetFolder.name === 'Root' && !targetFolder.parentId) {
              targetExternalId = targetFolder.project.externalId;
            }
            if (targetExternalId) {
              const StorageFactory = require('../services/storage/StorageFactory');
              const storage = await StorageFactory.getProviderForCompany(targetFolder.project.companyId);
              const foldersToMove = await prisma.folder.findMany({ where: { id: { in: folderIds } } });
              for (const f of foldersToMove) {
                if (f.externalId) await storage.moveItem(f.externalId, targetExternalId).catch(e => console.warn('Failed to move in OD:', e.message));
              }
            }
          }
        } catch (syncErr) { console.error('[OneDrive] bulkMove folders sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = FolderController;

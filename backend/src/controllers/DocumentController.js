const prisma = require('../prismaClient');
const StorageFactory = require('../services/storage/StorageFactory');
const { logAction } = require('../services/auditService');
const { getDocumentPermissions } = require('../middlewares/permissionMiddleware');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

class DocumentController {
  /**
   * Prewarm the tile-server cache asynchronously after upload.
   * Steps:
   *   1. POST /prepare/:docId  — loads PDF into pool, builds DocInfo (page sizes)
   *   2. GET  /thumbnail/:docId/:page  — pre-renders zoom-0 thumbnails for ALL pages
   *   3. GET  /tiles/:docId/:page/1/tx/ty — pre-renders zoom-1 tiles for first 4 pages
   *
   * Results go to L2 disk cache (/data/tile-cache) which is a persistent Docker volume.
   * Any subsequent user opening this document gets all tiles instantly from disk.
   */
  static async _prewarmTileServer(documentId, userId) {
    try {
      const jwtTokenStr = jwt.sign(
        { userId: userId || 'system', role: 'GENERAL_ADMIN' },
        process.env.JWT_SECRET || 'super_secret_jwt_key_for_redlines',
        { expiresIn: '2h' }
      );
      const BASE = process.env.TILE_SERVER_URL || 'http://tile-server:8080';
      const tok = encodeURIComponent(jwtTokenStr);

      console.log(`[Prewarm] Starting for doc ${documentId}…`);

      // Step 1: prepare — get DocInfo with page count
      const prepRes = await fetch(`${BASE}/prepare/${documentId}?token=${tok}`, { method: 'POST' });
      if (!prepRes.ok) { console.warn('[Prewarm] prepare failed:', prepRes.status); return; }
      const docInfo = await prepRes.json();
      const pageCount = docInfo.pageCount || 0;
      console.log(`[Prewarm] ${documentId}: ${pageCount} pages — prefetching thumbnails…`);

      // Step 2: thumbnails for all pages (zoom=0) — lightweight, ~5-20KB each
      const CONCURRENCY = 4;
      const thumbQueue = Array.from({ length: pageCount }, (_, i) => i);
      const fetchThumb = async (page) => {
        try {
          await fetch(`${BASE}/thumbnail/${documentId}/${page}?token=${tok}`);
        } catch { /* ignore individual failures */ }
      };
      // Process in batches of CONCURRENCY
      for (let i = 0; i < thumbQueue.length; i += CONCURRENCY) {
        await Promise.all(thumbQueue.slice(i, i + CONCURRENCY).map(fetchThumb));
      }

      // Step 3: zoom-1 tiles for first 6 pages (the ones users see first)
      const EAGER_PAGES = Math.min(6, pageCount);
      for (let pg = 0; pg < EAGER_PAGES; pg++) {
        const page = docInfo.pages?.[pg];
        if (!page) continue;
        const tileScale = 0.5; // zoom level 1
        const tileSize = 512;
        const cols = Math.ceil(page.w / (tileSize / tileScale));
        const rows = Math.ceil(page.h / (tileSize / tileScale));
        const tileFetches = [];
        for (let tx = 0; tx < cols; tx++) {
          for (let ty = 0; ty < rows; ty++) {
            tileFetches.push(fetch(`${BASE}/tiles/${documentId}/${pg}/1/${tx}/${ty}?token=${tok}`).catch(() => {}));
          }
        }
        await Promise.all(tileFetches);
      }

      console.log(`[Prewarm] ${documentId}: done — ${pageCount} thumbnails + ${EAGER_PAGES} pages zoom-1 cached.`);
    } catch (e) {
      console.warn('[Prewarm] error (non-fatal):', e.message);
    }
  }
  // Upload a new PDF (auto-versioning)
  static async uploadDocument(req, res) {
    try {
      const { folderId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // Find folder and project to get companyId and externalId
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { project: { include: { company: true } } }
      });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      // Check canUpload permission
      const { getFolderPermissions } = require('../middlewares/permissionMiddleware');
      const perms = await getFolderPermissions(req.user.userId, folderId);
      if (perms && perms.canUpload === false) {
        return res.status(403).json({ error: 'Upload permission denied' });
      }
      const companyId = folder.project.companyId;

      // Find existing doc with same name in this folder to increment version (exclude soft-deleted)
      const existingDoc = await prisma.document.findFirst({
        where: { folderId, name: file.originalname, isLatest: true, isDeleted: false },
      });

      const version = existingDoc ? existingDoc.version + 1 : 1;

      // Select storage provider for this company
      const storage = await StorageFactory.getProviderForCompany(companyId);
      
      let storageUrl;
      let externalId = null;

      // Determine target folder in OneDrive
      let targetExternalId = folder.externalId;
      if (!targetExternalId && folder.name === 'Root' && !folder.parentId) {
        targetExternalId = folder.project.externalId;
      }

      // Check if it's OneDrive to use versioned naming and folder ID
      const OneDriveProvider = require('../services/storage/OneDriveProvider');
      if (storage instanceof OneDriveProvider && targetExternalId) {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const versionedName = `${baseName}_v${version}${ext}`;
        externalId = await storage.uploadFile(file.buffer, versionedName, file.mimetype, targetExternalId);
        storageUrl = externalId;
      } else {
        const fileId = await storage.uploadFile(file.buffer, file.originalname, file.mimetype);
        storageUrl = await storage.getFileUrl(fileId);
      }

      // If updating, mark old as not latest
      if (existingDoc) {
        await prisma.document.update({
          where: { id: existingDoc.id },
          data: { isLatest: false },
        });
      }

      const document = await prisma.document.create({
        data: {
          name: file.originalname,
          storageUrl,
          version,
          isLatest: true,
          folderId,
          externalId,
          syncSource: 'wise',
        },
      });

      await logAction({
        action: 'UPLOAD',
        userId: req.user.userId,
        documentId: document.id,
        details: { name: document.name, version: document.version },
      });

      // Fire and forget: Prewarm tile server for 0-second loader on open
      DocumentController._prewarmTileServer(document.id, req.user.userId);

      res.status(201).json({ status: 'ok', data: { ...document, markups: [] } });
    } catch (error) {
      console.error('[uploadDocument] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Replace document with a new version
  static async replaceDocument(req, res) {
    try {
      const { documentId } = req.params;
      const file = req.file;

      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const oldDoc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { folder: { include: { project: { include: { company: true } } } } }
      });
      if (!oldDoc) return res.status(404).json({ error: 'Document not found' });

      // Check canUpload permission
      const { getFolderPermissions } = require('../middlewares/permissionMiddleware');
      const perms = await getFolderPermissions(req.user.userId, oldDoc.folderId);
      if (perms && perms.canUpload === false) {
        return res.status(403).json({ error: 'Upload permission denied' });
      }

      // Mark old as not latest
      await prisma.document.update({
        where: { id: documentId },
        data: { isLatest: false }
      });

      const companyId = oldDoc.folder.project.companyId;
      const folder = oldDoc.folder;
      const newVersion = oldDoc.version + 1;

      // Select storage provider for this company
      const storage = await StorageFactory.getProviderForCompany(companyId);
      
      let storageUrl;
      let externalId = null;

      // Determine target folder in OneDrive
      let targetExternalId = folder.externalId;
      if (!targetExternalId && folder.name === 'Root' && !folder.parentId) {
        targetExternalId = folder.project.externalId;
      }

      // Check if it's OneDrive to use versioned naming and folder ID
      const OneDriveProvider = require('../services/storage/OneDriveProvider');
      if (storage instanceof OneDriveProvider && targetExternalId) {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const versionedName = `${baseName}_v${newVersion}${ext}`;
        externalId = await storage.uploadFile(file.buffer, versionedName, file.mimetype, targetExternalId);
        storageUrl = externalId;
      } else {
        const fileId = await storage.uploadFile(file.buffer, file.originalname, file.mimetype);
        storageUrl = await storage.getFileUrl(fileId);
      }

      const newDoc = await prisma.document.create({
        data: {
          name: oldDoc.name,
          storageUrl,
          version: newVersion,
          isLatest: true,
          folderId: oldDoc.folderId,
          externalId,
          syncSource: 'wise',
        }
      });

      await logAction({ action: 'UPDATE', userId: req.user.userId, documentId: newDoc.id, details: { action: 'replaced_version' } });

      // Fire and forget: Prewarm tile server for the new version
      DocumentController._prewarmTileServer(newDoc.id, req.user.userId);

      res.json({ status: 'ok', data: { ...newDoc, markups: [] } });
    } catch (error) {
      console.error('[replaceDocument] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Copy markups from ALL previous versions to this document.
  // Finds siblings by name+folderId, deduplicates by type+page+coordinates.
  static async copyMarkupsFromDocument(req, res) {
    try {
      const { documentId } = req.params;

      const targetDoc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!targetDoc) return res.status(404).json({ error: 'Target document not found' });

      // All other versions of the same document (same name + folder)
      const siblingDocs = await prisma.document.findMany({
        where: {
          name: targetDoc.name,
          folderId: targetDoc.folderId,
          isDeleted: false,
          id: { not: documentId },
        },
        orderBy: { version: 'asc' },
      });

      if (siblingDocs.length === 0) return res.json({ status: 'ok', count: 0 });

      const allMarkups = await prisma.markup.findMany({
        where: { documentId: { in: siblingDocs.map(d => d.id) } },
      });

      // Deduplicate: same type + page + coordinates (catches markups already transferred in prior upgrades)
      const seen = new Set();
      const unique = allMarkups.filter(m => {
        const key = `${m.type}|${m.pageNumber}|${JSON.stringify(m.coordinates)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const created = await Promise.all(unique.map(m =>
        prisma.markup.create({
          data: {
            documentId,
            authorId: m.authorId,
            type: m.type,
            pageNumber: m.pageNumber,
            coordinates: m.coordinates,
            properties: m.properties,
            allowedEditUserIds: m.allowedEditUserIds,
          },
        })
      ));

      await logAction({
        action: 'UPDATE',
        userId: req.user.userId,
        documentId,
        details: { action: 'copy_markups_all_versions', count: created.length },
      });

      res.json({ status: 'ok', count: created.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- BULK OPERATIONS ---

  static async bulkDelete(req, res) {
    try {
      const { documentIds } = req.body;
      if (!Array.isArray(documentIds)) return res.status(400).json({ error: 'Invalid data' });

      await prisma.document.updateMany({ where: { id: { in: documentIds } }, data: { isDeleted: true } });
      for (const id of documentIds) {
        await logAction({ action: 'DELETE', userId: req.user.userId, documentId: id, details: { action: 'bulk_soft_delete' } });
      }

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          const docsToDelete = await prisma.document.findMany({ where: { id: { in: documentIds } }, include: { folder: { include: { project: { include: { company: true } } } } } });
          for (const d of docsToDelete) {
            if (d.externalId && d.folder?.project?.company?.oneDriveConnected) {
              const storage = await StorageFactory.getProviderForCompany(d.folder.project.companyId);
              await storage.deleteFile(d.externalId).catch(e => console.warn('Failed to delete in OD:', e.message));
            }
          }
        } catch (syncErr) { console.error('[OneDrive] bulkDelete docs sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkMove(req, res) {
    try {
      const { documentIds, targetFolderId } = req.body;
      if (!Array.isArray(documentIds) || !targetFolderId) return res.status(400).json({ error: 'Invalid data' });

      await prisma.document.updateMany({ where: { id: { in: documentIds } }, data: { folderId: targetFolderId } });
      for (const id of documentIds) {
        await logAction({ action: 'MOVE', userId: req.user.userId, documentId: id, details: { action: 'bulk_move', targetFolderId } });
      }

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          const targetFolder = await prisma.folder.findUnique({ where: { id: targetFolderId }, include: { project: { include: { company: true } } } });
          if (targetFolder?.externalId && targetFolder?.project?.company?.oneDriveConnected) {
            const storage = await StorageFactory.getProviderForCompany(targetFolder.project.companyId);
            const docsToMove = await prisma.document.findMany({ where: { id: { in: documentIds } } });
            for (const d of docsToMove) {
              if (d.externalId) await storage.moveItem(d.externalId, targetFolder.externalId).catch(e => console.warn('Failed to move in OD:', e.message));
            }
          }
        } catch (syncErr) { console.error('[OneDrive] bulkMove docs sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- OTHERS ---

  static async downloadDocument(req, res) {
    try {
      const { documentId } = req.params;
      const doc = await prisma.document.findUnique({ where: { id: documentId, isDeleted: false } });
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      await logAction({ action: 'DOWNLOAD', userId: req.user.userId, documentId });
      res.json({ status: 'ok', url: doc.storageUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;
      const d = await prisma.document.findUnique({ where: { id: documentId }, include: { folder: { include: { project: { include: { company: true } } } } } });

      const doc = await prisma.document.update({ where: { id: documentId }, data: { isDeleted: true } });
      await logAction({ action: 'DELETE', userId: req.user.userId, documentId, details: { name: doc.name } });

      res.json({ status: 'ok' });

      setImmediate(async () => {
        try {
          if (d?.externalId && d?.folder?.project?.company?.oneDriveConnected) {
            const storage = await StorageFactory.getProviderForCompany(d.folder.project.companyId);
            await storage.deleteFile(d.externalId).catch(e => console.warn('Failed to delete single doc in OD:', e.message));
          }
        } catch (syncErr) { console.error('[OneDrive] deleteDocument sync failed:', syncErr.message); }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateDocumentScale(req, res) {
    try {
      const { documentId } = req.params;
      const { scale } = req.body;

      await prisma.document.update({
        where: { id: documentId },
        data: { scale }
      });

      await logAction({ 
        action: 'UPDATE', 
        userId: req.user.userId, 
        documentId, 
        details: { action: 'update_scale', scale } 
      });

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDocumentVersions(req, res) {
    try {
      const { documentId } = req.params;
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      const versions = await prisma.document.findMany({
        where: { folderId: doc.folderId, name: doc.name, isDeleted: false },
        orderBy: { version: 'desc' },
      });

      res.json({ status: 'ok', data: versions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDocumentById(req, res) {
    try {
      const { documentId } = req.params;
      console.log(`[DocumentController] Fetching document: ${documentId} for user: ${req.user.userId}`);
      
      const doc = await prisma.document.findUnique({
        where: { id: documentId, isDeleted: false },
        include: { 
          markups: {
            include: { author: { select: { id: true, name: true } } }
          },
          folder: { 
            include: { 
              permissions: {
                include: { user: { select: { id: true, name: true, email: true } }, role: true }
              },
              project: {
                include: { 
                  company: true,
                  assignments: {
                    include: { user: { select: { id: true, name: true, email: true } }, role: true }
                  }
                }
              } 
            } 
          } 
        }
      });
      if (!doc) {
        console.error(`[DocumentController] Document not found: ${documentId}`);
        return res.status(404).json({ error: 'Document not found' });
      }

      // Get versions as well
      const versions = await prisma.document.findMany({
        where: { folderId: doc.folderId, name: doc.name, isDeleted: false },
        orderBy: { version: 'desc' },
      });

      // Build breadcrumbs path
      const breadcrumbs = [];
      let currentFolder = await prisma.folder.findUnique({
        where: { id: doc.folderId },
        include: { parent: true }
      });

      while (currentFolder) {
        breadcrumbs.unshift({ id: currentFolder.id, name: currentFolder.name, type: 'folder' });
        if (currentFolder.parentId) {
          currentFolder = await prisma.folder.findUnique({
            where: { id: currentFolder.parentId },
            include: { parent: true }
          });
        } else {
          currentFolder = null;
        }
      }

      // Add project and company to breadcrumbs
      if (doc.folder?.project) {
        breadcrumbs.unshift({ 
          id: doc.folder.project.id, 
          name: doc.folder.project.name, 
          type: 'project',
          companyName: doc.folder.project.company?.name 
        });
      }

      const permissions = await getDocumentPermissions(req.user.userId, documentId);

      console.log(`[DocumentController] Returning doc: ${doc.name}, markups: ${doc.markups?.length}, versions: ${versions?.length}, breadcrumbs: ${breadcrumbs?.length}`);

      res.json({ status: 'ok', data: { ...doc, versions, breadcrumbs, permissions } });
    } catch (error) {
      console.error(`[DocumentController] Error in getDocumentById:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  // Proxy for file content (fixes CORS and Google Drive access issues)
  static async proxyDocument(req, res) {
    try {
      const { documentId } = req.params;
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { folder: { include: { project: { include: { company: true } } } } }
      });
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      // If OneDrive connected for this company, stream from OneDrive
      if (doc.externalId && doc.folder?.project?.company?.oneDriveConnected) {
        const companyId = doc.folder.project.companyId;
        const storage = await StorageFactory.getProviderForCompany(companyId);
        const stream = await storage.downloadFile(doc.externalId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
        stream.pipe(res);
        return;
      }

      // Serve local file directly with auth
      // storageUrl can be "/uploads/filename" or "/api/documents/file/filename" (Revit upload)
      const isLocalFile = doc.storageUrl.startsWith('/uploads/') || doc.storageUrl.startsWith('/api/documents/file/');
      if (isLocalFile || process.env.STORAGE_TYPE === 'local' || !process.env.STORAGE_TYPE) {
        const fileName = doc.storageUrl
          .replace(/^\/uploads\//, '')
          .replace(/^\/api\/documents\/file\//, '');
        // Try multiple possible locations
        const candidates = [
          path.resolve(process.cwd(), 'uploads', fileName),
          path.resolve(process.cwd(), 'uploads', 'revit', fileName),
        ];
        const filePath = candidates.find(p => fs.existsSync(p));

        if (!filePath) {
          return res.status(404).json({ error: 'File not found on disk', candidates });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
        return res.sendFile(filePath);
      }

      // For cloud providers stream content
      const storage = StorageFactory.getProvider();
      if (storage.downloadFile) {
        const stream = await storage.downloadFile(doc.storageUrl);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
        stream.pipe(res);
      } else {
        // Fallback if streaming not implemented
        const url = await storage.getFileUrl(doc.storageUrl);
        res.redirect(url);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DocumentController;

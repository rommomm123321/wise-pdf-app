const prisma = require('../prismaClient');
const StorageFactory = require('../services/storage/StorageFactory');
const { logAction } = require('../services/auditService');
const { getDocumentPermissions } = require('../middlewares/permissionMiddleware');
const path = require('path');
const fs = require('fs');

class DocumentController {
  // Upload a new PDF (auto-versioning)
  static async uploadDocument(req, res) {
    try {
      const { folderId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // Find existing doc with same name in this folder to increment version
      const existingDoc = await prisma.document.findFirst({
        where: { folderId, name: file.originalname, isLatest: true },
      });

      const version = existingDoc ? existingDoc.version + 1 : 1;

      // Get provider from factory (reads process.env.STORAGE_TYPE)
      const storage = StorageFactory.getProvider();
      const fileId = await storage.uploadFile(file.buffer, file.originalname, file.mimetype);
      const storageUrl = await storage.getFileUrl(fileId);

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
        },
      });

      await logAction({
        action: 'UPLOAD',
        userId: req.user.userId,
        documentId: document.id,
        details: { name: document.name, version: document.version },
      });

      res.status(201).json({ status: 'ok', data: { ...document, markups: [] } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Replace document with a new version
  static async replaceDocument(req, res) {
    try {
      const { documentId } = req.params;
      const file = req.file;

      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const oldDoc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!oldDoc) return res.status(404).json({ error: 'Document not found' });

      // Set old version to not latest
      await prisma.document.update({
        where: { id: documentId },
        data: { isLatest: false }
      });

      const storage = StorageFactory.getProvider();
      const fileId = await storage.uploadFile(file.buffer, file.originalname, file.mimetype);
      const storageUrl = await storage.getFileUrl(fileId);

      const newDoc = await prisma.document.create({
        data: {
          name: oldDoc.name,
          storageUrl,
          version: oldDoc.version + 1,
          isLatest: true,
          folderId: oldDoc.folderId
        }
      });

      await logAction({ action: 'UPDATE', userId: req.user.userId, documentId: newDoc.id, details: { action: 'replaced_version' } });

      res.json({ status: 'ok', data: { ...newDoc, markups: [] } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- BULK OPERATIONS ---

  static async bulkDelete(req, res) {
    try {
      const { documentIds } = req.body;
      if (!Array.isArray(documentIds)) return res.status(400).json({ error: 'Invalid data' });

      await prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: { isDeleted: true }
      });

      for (const id of documentIds) {
        await logAction({ action: 'DELETE', userId: req.user.userId, documentId: id, details: { action: 'bulk_soft_delete' } });
      }

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkMove(req, res) {
    try {
      const { documentIds, targetFolderId } = req.body;
      if (!Array.isArray(documentIds) || !targetFolderId) return res.status(400).json({ error: 'Invalid data' });

      await prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: { folderId: targetFolderId }
      });

      for (const id of documentIds) {
        await logAction({ action: 'MOVE', userId: req.user.userId, documentId: id, details: { action: 'bulk_move', targetFolderId } });
      }

      res.json({ status: 'ok' });
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
      const doc = await prisma.document.update({ 
        where: { id: documentId },
        data: { isDeleted: true }
      });
      await logAction({ action: 'DELETE', userId: req.user.userId, documentId, details: { name: doc.name } });
      res.json({ status: 'ok' });
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
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) return res.status(404).json({ error: 'Document not found' });

      const storage = StorageFactory.getProvider();
      
      // Serve local file directly with auth (avoiding redirects which break in proxy scenarios)
      if (process.env.STORAGE_TYPE === 'local' || !process.env.STORAGE_TYPE) {
        const fileName = doc.storageUrl.replace(/^\/uploads\//, '');
        const filePath = path.resolve(process.cwd(), 'uploads', fileName);
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'File not found on disk' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
        return res.sendFile(filePath);
      }

      // Для облачных провайдеров стримим контент
      if (storage.downloadFile) {
        const stream = await storage.downloadFile(doc.storageUrl);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
        stream.pipe(res);
      } else {
        // Fallback если стриминг не реализован
        const url = await storage.getFileUrl(doc.storageUrl);
        res.redirect(url);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DocumentController;

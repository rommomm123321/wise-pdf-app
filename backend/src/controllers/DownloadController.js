const archiver = require('archiver');
const prisma = require('../prismaClient');
const { getDocumentPermissions, getFolderPermissions } = require('../middlewares/permissionMiddleware');
const StorageFactory = require('../services/storage/StorageFactory');

class DownloadController {
  static async bulkDownload(req, res) {
    try {
      const userId = req.user.userId;
      const { folderIds = [], documentIds = [], onlyLatest = true } = req.body;

      if (!folderIds.length && !documentIds.length) {
        return res.status(400).json({ error: 'No items selected for download' });
      }

      // We will collect all files to download into an array: { document, path }
      const filesToDownload = [];
      const storageProvider = StorageFactory.getProvider();

      // Recursive function to collect documents from a folder
      const collectFolderDocuments = async (folderId, currentPath) => {
        const perms = await getFolderPermissions(userId, folderId);
        if (!perms || perms.isGhost) return; // Cannot download ghost folder contents directly, or no access

        const folder = await prisma.folder.findUnique({
          where: { id: folderId },
          include: {
            files: onlyLatest ? { where: { isLatest: true } } : true,
            children: true
          }
        });

        if (!folder) return;

        // Process files
        for (const file of folder.files) {
          const docPerms = await getDocumentPermissions(userId, file.id);
          if (docPerms && docPerms.canDownload) {
            let fileName = file.name;
            if (!onlyLatest) {
               const ext = fileName.split('.').pop();
               const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
               fileName = `${nameWithoutExt}_v${file.version}.${ext}`;
            }
            filesToDownload.push({ file, path: `${currentPath}/${fileName}` });
          }
        }

        // Process subfolders
        for (const child of folder.children) {
          await collectFolderDocuments(child.id, `${currentPath}/${child.name}`);
        }
      };

      // 1. Process specifically requested folders
      for (const folderId of folderIds) {
        const folder = await prisma.folder.findUnique({ where: { id: folderId } });
        if (folder) {
          await collectFolderDocuments(folderId, folder.name);
        }
      }

      // 2. Process specifically requested documents
      for (const docId of documentIds) {
        const file = await prisma.document.findUnique({ where: { id: docId } });
        if (file) {
          const docPerms = await getDocumentPermissions(userId, file.id);
          if (docPerms && docPerms.canDownload) {
            let fileName = file.name;
            if (!onlyLatest) {
               const ext = fileName.split('.').pop();
               const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
               fileName = `${nameWithoutExt}_v${file.version}.${ext}`;
            }
            filesToDownload.push({ file, path: fileName });
          }
        }
      }

      if (filesToDownload.length === 0) {
        return res.status(403).json({ error: 'No downloadable files found or access denied' });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="download_${Date.now()}.zip"`);

      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.pipe(res);

      archive.on('error', function(err) {
        console.error('[DownloadController] Archive error:', err);
        throw err;
      });

      for (const item of filesToDownload) {
        try {
          const stream = await storageProvider.downloadFile(item.file.storageUrl);
          archive.append(stream, { name: item.path });
        } catch (err) {
          console.error(`[DownloadController] Failed to append file ${item.file.id}:`, err);
        }
      }

      await archive.finalize();

      const { logAction } = require('../services/auditService');
      await logAction({
        action: 'DOWNLOAD',
        userId,
        details: { action: 'bulk_download', count: filesToDownload.length }
      });

    } catch (error) {
      console.error('[DownloadController] Bulk download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  }
}

module.exports = DownloadController;
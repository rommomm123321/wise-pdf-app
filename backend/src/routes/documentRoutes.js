const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/DocumentController');
const authMiddleware = require('../middlewares/authMiddleware');
const { checkFolderAccess, checkDocumentAccess } = require('../middlewares/permissionMiddleware');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

router.use(authMiddleware);

// Bulk
router.post('/bulk/delete', DocumentController.bulkDelete);
router.post('/bulk/move', DocumentController.bulkMove);

// Individual
router.post('/', upload.single('file'), (req, res, next) => {
  return checkFolderAccess('canEdit')(req, res, next);
}, DocumentController.uploadDocument);

router.put('/:documentId/replace', upload.single('file'), checkDocumentAccess('canEdit'), DocumentController.replaceDocument);

// Scale update
router.patch('/:documentId/scale', checkDocumentAccess('canEdit'), DocumentController.updateDocumentScale);

// Download — нужен canDownload
router.get('/:documentId/download', checkDocumentAccess('canDownload'), DocumentController.downloadDocument);

// Get info — нужен canView
router.get('/:documentId/info', checkDocumentAccess('canView'), DocumentController.getDocumentById);

// Proxy — стриминг контента (фикс CORS/Google Drive)
router.get('/:documentId/proxy', checkDocumentAccess('canView'), DocumentController.proxyDocument);

// Version history — нужен canView
router.get('/:documentId/versions', checkDocumentAccess('canView'), DocumentController.getDocumentVersions);

// Delete
router.delete('/:documentId', checkDocumentAccess('canDelete'), DocumentController.deleteDocument);

module.exports = router;

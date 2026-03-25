const express = require('express');
const router = express.Router();
const FolderController = require('../controllers/FolderController');
const DownloadController = require('../controllers/DownloadController');
const authMiddleware = require('../middlewares/authMiddleware');
const { checkProjectAccess, checkFolderAccess } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

// Bulk
router.post('/bulk/delete', (req, res) => FolderController.bulkDelete(req, res));
router.post('/bulk/move', (req, res) => FolderController.bulkMove(req, res));
router.post('/bulk/download', (req, res) => DownloadController.bulkDownload(req, res));

// Tree
router.get('/tree', (req, res) => FolderController.getFolderTree(req, res));
router.get('/root/:projectId', (req, res) => FolderController.getRootFolder(req, res));

// Get folder contents — нужен canView на папке
router.get('/:folderId/contents', checkFolderAccess('canView'), (req, res) => FolderController.getFolderContents(req, res));

// Create folder — нужен canEdit (parentId или projectId)
router.post('/', (req, res, next) => {
  if (req.body.parentId) {
    return checkFolderAccess('canEdit')(req, res, next);
  } else {
    return checkProjectAccess('canEdit')(req, res, next);
  }
}, (req, res) => FolderController.createFolder(req, res));

// Rename folder — нужен canEdit
router.patch('/:folderId', checkFolderAccess('canEdit'), (req, res) => FolderController.renameFolder(req, res));

// Move folder — нужен canEdit
router.patch('/:folderId/move', checkFolderAccess('canEdit'), (req, res) => FolderController.moveFolder(req, res));

// Delete folder — нужен canDelete
router.delete('/:folderId', checkFolderAccess('canDelete'), (req, res) => FolderController.deleteFolder(req, res));

module.exports = router;

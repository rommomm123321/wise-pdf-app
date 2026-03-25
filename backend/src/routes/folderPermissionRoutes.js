const express = require('express');
const router = express.Router();
const FolderPermissionController = require('../controllers/FolderPermissionController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Folder permissions
router.get('/folders/:folderId/permissions', FolderPermissionController.getFolderPermissions);
router.put('/folders/:folderId/permissions/:userId', FolderPermissionController.setFolderPermission);
// Delete folder permission override
router.delete('/folders/:folderId/permissions/:userId', FolderPermissionController.deleteFolderPermission);
router.delete('/folders/id/:id', FolderPermissionController.deleteFolderPermissionById);

// Document permissions
router.get('/documents/:documentId/permissions', FolderPermissionController.getDocumentPermissions);
router.put('/documents/:documentId/permissions/:userId', FolderPermissionController.setDocumentPermission);
router.delete('/documents/id/:id', FolderPermissionController.deleteDocumentPermissionById);

module.exports = router;

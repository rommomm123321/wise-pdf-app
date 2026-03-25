const express = require('express');
const router = express.Router();
const ProjectController = require('../controllers/ProjectController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', ProjectController.getProjects);
router.post('/', ProjectController.createProject);

// Bulk
router.post('/bulk/delete', ProjectController.bulkDelete);

// Individual
router.get('/:projectId', ProjectController.getProjectById);
router.get('/:projectId/users', ProjectController.getProjectUsers);
router.patch('/:projectId', ProjectController.updateProject);
router.delete('/:projectId', ProjectController.deleteProject);
router.get('/:projectId/permissions', ProjectController.getProjectPermissions);

module.exports = router;

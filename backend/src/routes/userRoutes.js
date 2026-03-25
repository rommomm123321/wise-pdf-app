const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// Ленивый импорт контроллеров, чтобы избежать циклических зависимостей
const getUserController = () => require('../controllers/UserController');
const getRoleController = () => require('../controllers/RoleController');

router.use(authMiddleware);

// Вспомогательная функция для ленивого вызова
const lazy = (controllerGetter, method) => (req, res) => {
  const controller = controllerGetter();
  if (typeof controller[method] !== 'function') {
    console.error(`[LazyRoute] Method ${method} not found on controller`);
    return res.status(500).json({ error: `Method ${method} missing` });
  }
  return controller[method](req, res);
};

// Core User listing & Search
router.get('/', lazy(getUserController, 'getUsers'));
router.get('/search', lazy(getUserController, 'searchUsers'));
router.get('/:userId/profile', lazy(getUserController, 'getUserProfile'));

// Tags
router.get('/tags', lazy(getUserController, 'getCompanyTags'));
router.post('/tags', lazy(getUserController, 'createCompanyTag'));
router.delete('/tags/:tagId', lazy(getUserController, 'deleteCompanyTag'));

// Profile & Preferences
router.patch('/preferences', lazy(getUserController, 'updatePreferences'));

// Bulk Operations
router.post('/bulk/delete', lazy(getUserController, 'bulkDeleteUsers'));
router.post('/bulk/role', lazy(getUserController, 'bulkUpdateRoles'));
router.post('/bulk/assign-projects', lazy(getUserController, 'bulkAssignProjects'));

// User Actions
router.post('/:userId/add-to-company', lazy(getUserController, 'addToCompany'));
router.patch('/:userId/role', lazy(getUserController, 'updateUserRole'));
router.patch('/:userId/tags', lazy(getUserController, 'updateUserTags'));
router.patch('/:userId/custom-role', lazy(getRoleController, 'assignRole'));
router.delete('/:userId', lazy(getUserController, 'removeUser'));

// Project assignments
router.post('/:userId/projects/:projectId', lazy(getUserController, 'assignToProject'));
router.delete('/:userId/projects/:projectId', lazy(getUserController, 'unassignFromProject'));
router.patch('/:userId/projects/:projectId', lazy(getUserController, 'updateProjectPermissions'));

module.exports = router;

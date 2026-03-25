const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/RoleController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', RoleController.getRoles);
router.post('/', RoleController.createRole);
router.patch('/:id', RoleController.updateRole);
router.delete('/:id', RoleController.deleteRole);

module.exports = router;

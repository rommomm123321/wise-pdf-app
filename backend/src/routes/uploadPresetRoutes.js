const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/UploadPresetController');

router.get('/', authMiddleware, ctrl.list);
router.post('/', authMiddleware, ctrl.create);
router.put('/:id', authMiddleware, ctrl.update);
router.delete('/:id', authMiddleware, ctrl.remove);

module.exports = router;

const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/MarkupHistoryController');

router.get('/', authMiddleware, ctrl.getHistory);
router.get('/authors', authMiddleware, ctrl.getAuthors);
router.post('/restore', authMiddleware, ctrl.restore);

module.exports = router;

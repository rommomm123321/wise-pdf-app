const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/AuditController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', (req, res) => AuditController.getLogs(req, res));

module.exports = router;

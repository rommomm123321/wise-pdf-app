const express = require('express');
const router = express.Router();
const InvitationController = require('../controllers/InvitationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Публичные роуты (без авторизации)
router.get('/info/:token', InvitationController.getInvitationInfo);
router.post('/accept/:token', InvitationController.acceptInvitation);

// Защищённые роуты
router.use(authMiddleware);
router.post('/', InvitationController.createInvitation);
router.get('/', InvitationController.getInvitations);
router.delete('/:id', InvitationController.cancelInvitation);

module.exports = router;

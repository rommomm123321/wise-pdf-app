const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/ReviewAssignmentController');

// Document-scoped
router.post('/documents/:documentId/assign-review', authMiddleware, ctrl.assignReview);
router.get('/documents/:documentId/assignments', authMiddleware, ctrl.getForDocument);

// Assignment actions
router.get('/review-assignments/my', authMiddleware, ctrl.getMyAssignments);
router.patch('/review-assignments/:id/respond', authMiddleware, ctrl.respond);

module.exports = router;

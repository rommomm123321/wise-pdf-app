const router = require('express').Router();
const ReviewController = require('../controllers/ReviewController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/checklist-templates', ReviewController.getTemplates);
router.post('/checklist-templates', ReviewController.createTemplate);
router.delete('/checklist-templates/:id', ReviewController.deleteTemplate);
router.post('/reviews', ReviewController.startReview);
router.get('/reviews', ReviewController.listReviews);
router.get('/reviews/:id', ReviewController.getReview);
router.delete('/reviews/:id', ReviewController.deleteReview);
router.patch('/reviews/:id', ReviewController.updateReview);
router.patch('/reviews/:id/items/:itemId', ReviewController.updateItem);
router.patch('/reviews/:id/items/:itemId/fix', ReviewController.fixItem);

module.exports = router;

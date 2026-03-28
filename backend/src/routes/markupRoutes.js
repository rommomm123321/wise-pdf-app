const express = require('express');
const router = express.Router();
const MarkupController = require('../controllers/MarkupController');
const authMiddleware = require('../middlewares/authMiddleware');
const { checkDocumentAccess } = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

// Get markups — нужен canView на документе
router.get('/document/:documentId', checkDocumentAccess('canView'), MarkupController.getMarkupsByDocument);

// Batch create markups (PDF/Bluebeam import) — нужен canMarkup на документе
router.post('/batch', (req, res, next) => {
  req.params.documentId = req.body.documentId;
  return checkDocumentAccess('canMarkup')(req, res, next);
}, MarkupController.batchCreateMarkups);

// Create markup — нужен canMarkup на документе
router.post('/', (req, res, next) => {
  req.params.documentId = req.body.documentId; // Передаем ID для мидлвары
  return checkDocumentAccess('canMarkup')(req, res, next);
}, MarkupController.createMarkup);

// Update markup — нужен canMarkup на документе
router.patch('/:markupId', async (req, res, next) => {
  const { markupId } = req.params;
  const prisma = require('../prismaClient');
  const markup = await prisma.markup.findUnique({ where: { id: markupId } });
  if (!markup) return res.status(404).json({ error: 'Markup not found' });
  
  req.params.documentId = markup.documentId;
  return checkDocumentAccess('canMarkup')(req, res, next);
}, MarkupController.updateMarkup);

// Delete markup — нужен canMarkup на документе
router.delete('/:markupId', async (req, res, next) => {
  const { markupId } = req.params;
  const prisma = require('../prismaClient');
  const markup = await prisma.markup.findUnique({ where: { id: markupId } });
  if (!markup) return res.status(404).json({ error: 'Markup not found' });
  
  req.params.documentId = markup.documentId;
  return checkDocumentAccess('canMarkup')(req, res, next);
}, MarkupController.deleteMarkup);

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const prisma = require('../prismaClient');

router.use(authMiddleware);

// GET /api/notifications — list for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    // Attach document name
    const docIds = [...new Set(notifications.map(n => n.documentId))];
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, name: true },
    });
    const docMap = Object.fromEntries(docs.map(d => [d.id, d.name]));
    const result = notifications.map(n => ({ ...n, documentName: docMap[n.documentId] || '' }));
    res.json({ status: 'ok', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read (must be before /:id)
router.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.userId }, data: { read: true } });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.userId },
      data: { read: true },
    });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications — delete all
router.delete('/', async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user.userId } });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — delete one
router.delete('/:id', async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.userId },
    });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

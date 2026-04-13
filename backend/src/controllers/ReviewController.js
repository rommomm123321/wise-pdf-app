const prisma = require('../prismaClient');

// ── Checklist Templates ──────────────────────────────────────────────────────

exports.getTemplates = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { companyId: true, systemRole: true } });
    const isAdmin = user?.systemRole === 'GENERAL_ADMIN';
    if (!isAdmin && !user?.companyId) return res.status(400).json({ error: 'User has no company' });

    const templates = await prisma.checklistTemplate.findMany({
      where: isAdmin && !user.companyId ? {} : { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    res.json(templates);
  } catch (err) {
    console.error('[ReviewController.getTemplates]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const allowedRoles = ['GENERAL_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'TEAM_LEAD'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admin, manager or team lead can create templates' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { companyId: true, systemRole: true } });
    let companyId = user?.companyId;
    if (!companyId) {
      if (user?.systemRole === 'GENERAL_ADMIN') {
        const first = await prisma.company.findFirst({ select: { id: true } });
        if (!first) return res.status(400).json({ error: 'No companies exist yet' });
        companyId = first.id;
      } else {
        return res.status(400).json({ error: 'User has no company' });
      }
    }

    const { name, category, items } = req.body;
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'name and items[] are required' });
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        category: category || null,
        items,
        companyId: companyId,
        createdById: req.user.userId,
      },
    });
    res.status(201).json(template);
  } catch (err) {
    console.error('[ReviewController.createTemplate]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { companyId: true, systemRole: true } });
    const isAdmin = user?.systemRole === 'GENERAL_ADMIN';
    if (!isAdmin && !user?.companyId) return res.status(400).json({ error: 'User has no company' });

    const allowedRoles = ['GENERAL_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'TEAM_LEAD'];
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Only admin, manager or team lead can delete templates' });
    const template = await prisma.checklistTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!isAdmin && template.companyId !== user.companyId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.checklistTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[ReviewController.deleteTemplate]', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Review Sessions ──────────────────────────────────────────────────────────

exports.startReview = async (req, res) => {
  try {
    const { documentId, templateId, templateName, items } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Get template items — from DB template or from request body
    let resolvedTemplateId = templateId || null;
    let templateItems = [];

    if (templateId) {
      const template = await prisma.checklistTemplate.findUnique({ where: { id: templateId } });
      if (template) {
        templateItems = Array.isArray(template.items) ? template.items : [];
      }
    }

    // If no DB template found, use items from request body (default templates)
    if (templateItems.length === 0 && Array.isArray(items)) {
      templateItems = items;
    }

    // Create the session (templateId is optional)
    const session = await prisma.reviewSession.create({
      data: {
        documentId,
        ...(resolvedTemplateId ? { templateId: resolvedTemplateId } : {}),
        inspectorId: req.user.userId,
        status: 'in_progress',
        summary: templateName || null, // store template name in summary as fallback
      },
    });

    // Pre-create ReviewItem rows
    if (templateItems.length > 0) {
      await prisma.reviewItem.createMany({
        data: templateItems.map((ti, idx) => ({
          sessionId: session.id,
          templateItemId: ti.id || `item-${idx}`,
          title: ti.title || `Item ${idx + 1}`,
          groupName: ti.group || null,
        })),
      });
    }

    // Return full session with items
    const full = await prisma.reviewSession.findUnique({
      where: { id: session.id },
      include: {
        items: true,
        template: true,
        inspector: { select: { id: true, name: true, email: true } },
      },
    });
    res.status(201).json(full);
  } catch (err) {
    console.error('[ReviewController.startReview]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.listReviews = async (req, res) => {
  try {
    const { documentId } = req.query;
    const where = {};
    if (documentId) where.documentId = documentId;

    const reviews = await prisma.reviewSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, category: true } },
        inspector: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
    });
    res.json(reviews);
  } catch (err) {
    console.error('[ReviewController.listReviews]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getReview = async (req, res) => {
  try {
    const review = await prisma.reviewSession.findUnique({
      where: { id: req.params.id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        template: true,
        inspector: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, name: true } },
      },
    });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (err) {
    console.error('[ReviewController.getReview]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await prisma.reviewSession.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const data = {};
    if (req.body.status !== undefined) {
      data.status = req.body.status;
      if (req.body.status === 'completed' && !review.completedAt) {
        data.completedAt = new Date();
      }
    }
    if (req.body.assigneeId !== undefined) data.assigneeId = req.body.assigneeId || null;
    if (req.body.summary !== undefined) data.summary = req.body.summary;

    const updated = await prisma.reviewSession.update({
      where: { id: req.params.id },
      data,
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        template: true,
        inspector: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('[ReviewController.updateReview]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await prisma.reviewSession.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    // Admin/manager/team lead can delete any review; inspector can delete their own in_progress reviews
    const allowedRoles = ['GENERAL_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'TEAM_LEAD'];
    const isAllowed = allowedRoles.includes(req.user.role);
    const isOwner = review.inspectorId === req.user.userId;
    const isInProgress = review.status === 'in_progress';
    if (!isAllowed && !(isOwner && isInProgress)) {
      return res.status(403).json({ error: 'Only admin/manager/team lead can delete completed reviews' });
    }
    await prisma.reviewItem.deleteMany({ where: { sessionId: id } });
    await prisma.reviewSession.delete({ where: { id } });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[ReviewController.deleteReview]', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Review Items ─────────────────────────────────────────────────────────────

exports.updateItem = async (req, res) => {
  try {
    const { id: sessionId, itemId } = req.params;

    const item = await prisma.reviewItem.findFirst({
      where: { id: itemId, sessionId },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const data = {};
    if (req.body.result !== undefined) data.result = req.body.result;
    if (req.body.comment !== undefined) data.comment = req.body.comment;
    if (req.body.photoUrl !== undefined) data.photoUrl = req.body.photoUrl;
    if (req.body.pageNumber !== undefined) data.pageNumber = req.body.pageNumber;
    if (req.body.pinX !== undefined) data.pinX = req.body.pinX;
    if (req.body.pinY !== undefined) data.pinY = req.body.pinY;

    const updated = await prisma.reviewItem.update({
      where: { id: itemId },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('[ReviewController.updateItem]', err);
    res.status(500).json({ error: err.message });
  }
};

exports.fixItem = async (req, res) => {
  try {
    const { id: sessionId, itemId } = req.params;

    const item = await prisma.reviewItem.findFirst({
      where: { id: itemId, sessionId },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const updated = await prisma.reviewItem.update({
      where: { id: itemId },
      data: {
        fixedAt: new Date(),
        fixedById: req.body.fixedById || req.user.userId,
        fixedComment: req.body.fixedComment || null,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('[ReviewController.fixItem]', err);
    res.status(500).json({ error: err.message });
  }
};

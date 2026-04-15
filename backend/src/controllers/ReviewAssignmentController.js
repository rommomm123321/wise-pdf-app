const prisma = require('../prismaClient');
const { sendNotification } = require('../services/notificationService');

// POST /api/documents/:documentId/assign-review
// Body: { reviewerId, comment?, source? }
exports.assignReview = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { reviewerId, comment, source } = req.body;
    const requesterId = req.user.userId;

    if (!reviewerId) return res.status(400).json({ error: 'reviewerId is required' });
    if (reviewerId === requesterId) return res.status(400).json({ error: 'Cannot assign to yourself' });

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { folder: { include: { project: true } } },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const assignment = await prisma.reviewAssignment.create({
      data: {
        documentId,
        requesterId,
        reviewerId,
        comment: comment || null,
        source: source || 'web',
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, name: true } },
      },
    });

    // Send notification via all channels (site + Teams + Revit)
    await sendNotification({
      userId: reviewerId,
      actorId: requesterId,
      type: 'review_request',
      documentId,
      projectId: doc.folder?.project?.id || doc.folder?.projectId || '',
      assignmentId: assignment.id,
      message: comment || `Please review "${doc.name}"`,
      io: req.app.get('io'),
    });

    res.json(assignment);
  } catch (err) {
    console.error('[ReviewAssignment] assign error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/review-assignments/:id/respond
// Body: { action: "has_markups" | "approved", comment? }
exports.respond = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;
    const userId = req.user.userId || req.user.userId;

    if (!['has_markups', 'approved'].includes(action)) {
      return res.status(400).json({ error: 'action must be "has_markups" or "approved"' });
    }

    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id },
      include: {
        document: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.reviewerId !== userId) return res.status(403).json({ error: 'Not your assignment' });

    const updated = await prisma.reviewAssignment.update({
      where: { id },
      data: { status: action, comment: comment || assignment.comment },
    });

    const notifType = action === 'approved' ? 'review_approved' : 'review_rejected';
    const notifMessage = action === 'approved'
      ? `"${assignment.document.name}" approved — ready to print`
      : `"${assignment.document.name}" has markups — needs corrections`;

    // Get projectId from document's folder
    const docWithFolder = await prisma.document.findUnique({
      where: { id: assignment.documentId },
      select: { folder: { select: { projectId: true } } },
    });

    await sendNotification({
      userId: assignment.requesterId,
      actorId: userId,
      type: notifType,
      documentId: assignment.documentId,
      projectId: docWithFolder?.folder?.projectId || '',
      assignmentId: id,
      message: comment || notifMessage,
      io: req.app.get('io'),
    });

    res.json(updated);
  } catch (err) {
    console.error('[ReviewAssignment] respond error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/documents/:documentId/assignments
exports.getForDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const assignments = await prisma.reviewAssignment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/review-assignments/my
exports.getMyAssignments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        OR: [{ reviewerId: userId }, { requesterId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, name: true, folderId: true } },
      },
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

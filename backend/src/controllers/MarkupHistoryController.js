const prisma = require('../prismaClient');

// GET /api/documents/:documentId/markup-history
// Query params: page, limit, markupId, action, authorId, pageNumber, dateFrom, dateTo
exports.getHistory = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { page = 1, limit = 100, markupId, action, authorId, pageNumber, dateFrom, dateTo } = req.query;

    const where = { documentId };
    if (markupId) where.markupId = markupId;
    if (action) where.action = action;
    if (authorId) where.authorId = authorId;

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        // dateTo is inclusive — set to end of day
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Page number filter — stored inside snapshot JSON
    // We filter client-side after fetch since Prisma can't filter JSON deeply
    // BUT we can use raw query for performance. For now, over-fetch and filter.
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const pageFilter = pageNumber !== undefined && pageNumber !== '' ? parseInt(pageNumber) : null;

    // If filtering by page, fetch more and filter in JS
    const fetchLimit = pageFilter !== null ? parsedLimit * 5 : parsedLimit;

    const [total, rawItems] = await Promise.all([
      prisma.markupHistory.count({ where }),
      prisma.markupHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageFilter !== null ? 0 : (parsedPage - 1) * parsedLimit,
        take: pageFilter !== null ? fetchLimit : parsedLimit,
        include: { author: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    let items = rawItems;
    let filteredTotal = total;

    // Apply page number filter on snapshot
    if (pageFilter !== null) {
      items = rawItems.filter(h => {
        const snap = h.snapshot;
        return snap && snap.pageNumber === pageFilter;
      });
      filteredTotal = items.length;
      // Apply pagination on filtered results
      items = items.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);
    }

    res.json({ total: filteredTotal, page: parsedPage, limit: parsedLimit, items });
  } catch (err) {
    console.error('[MarkupHistory] getHistory error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/documents/:documentId/markup-history/authors
// Returns distinct authors who have history entries for this document
exports.getAuthors = async (req, res) => {
  try {
    const { documentId } = req.params;
    const authors = await prisma.markupHistory.findMany({
      where: { documentId },
      select: { author: { select: { id: true, name: true, email: true } } },
      distinct: ['authorId'],
    });
    res.json(authors.map(a => a.author));
  } catch (err) {
    console.error('[MarkupHistory] getAuthors error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/documents/:documentId/markup-history/restore
// Body: { timestamp } — admin only, restores all markups to their state at timestamp
exports.restore = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { timestamp } = req.body;

    if (req.user.role !== 'GENERAL_ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const targetDate = new Date(timestamp);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Get all history events for this document up to target timestamp
    const historyItems = await prisma.markupHistory.findMany({
      where: { documentId, createdAt: { lte: targetDate } },
      orderBy: { createdAt: 'asc' },
    });

    // Build the final state per markup at target time:
    // replay events in order, last event wins
    const stateMap = new Map(); // markupId → { action, snapshot }
    for (const h of historyItems) {
      stateMap.set(h.markupId, { action: h.action, snapshot: h.snapshot });
    }

    // Current markups in DB
    const currentMarkups = await prisma.markup.findMany({ where: { documentId } });
    const currentIds = new Set(currentMarkups.map(m => m.id));

    // Markups that should exist at target time
    const toUpsert = [];
    const toDelete = [];

    for (const [markupId, { action, snapshot }] of stateMap) {
      if (action === 'DELETE') {
        // Was deleted before target — should not exist
        if (currentIds.has(markupId)) toDelete.push(markupId);
      } else {
        // ADD or MODIFY — should exist with snapshot data
        toUpsert.push({ markupId, snapshot });
      }
    }

    // Also delete markups that were ADDED after the target timestamp
    const createdAfter = await prisma.markupHistory.findMany({
      where: {
        documentId,
        action: 'ADD',
        createdAt: { gt: targetDate },
      },
      select: { markupId: true },
    });
    for (const h of createdAfter) {
      if (currentIds.has(h.markupId)) toDelete.push(h.markupId);
    }

    // Execute restore in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete markups that shouldn't exist
      if (toDelete.length > 0) {
        await tx.markup.deleteMany({ where: { id: { in: toDelete } } });
      }
      // Upsert markups to their snapshot state
      for (const { markupId, snapshot } of toUpsert) {
        const s = snapshot;
        await tx.markup.upsert({
          where: { id: markupId },
          update: {
            type: s.type,
            pageNumber: s.pageNumber,
            coordinates: s.coordinates || {},
            properties: s.properties || {},
            allowedEditUserIds: s.allowedEditUserIds || [],
            allowedDeleteUserIds: s.allowedDeleteUserIds || [],
          },
          create: {
            id: markupId,
            documentId,
            type: s.type,
            pageNumber: s.pageNumber,
            coordinates: s.coordinates || {},
            properties: s.properties || {},
            authorId: s.authorId,
            allowedEditUserIds: s.allowedEditUserIds || [],
            allowedDeleteUserIds: s.allowedDeleteUserIds || [],
          },
        });
      }
    });

    res.json({ ok: true, upserted: toUpsert.length, deleted: toDelete.length });
  } catch (err) {
    console.error('[MarkupHistory] restore error:', err);
    res.status(500).json({ error: err.message });
  }
};

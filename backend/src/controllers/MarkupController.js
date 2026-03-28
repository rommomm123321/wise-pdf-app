const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');

class MarkupController {
  // Get all markups for a document
  static async getMarkupsByDocument(req, res) {
    try {
      const { documentId } = req.params;
      const markups = await prisma.markup.findMany({
        where: { documentId },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ status: 'ok', data: markups });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Create a new markup
  static async createMarkup(req, res) {
    try {
      const { documentId, type, pageNumber, coordinates, properties } = req.body;
      const userId = req.user.userId;

      if (!documentId || !type || pageNumber === undefined || !coordinates) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const markup = await prisma.markup.create({
        data: {
          documentId,
          type,
          pageNumber,
          coordinates,
          properties: properties || {},
          authorId: userId,
        },
      });

      await logAction({
        action: 'MARKUP_CREATE',
        userId,
        documentId,
        markupId: markup.id,
        details: { type, pageNumber },
      });

      res.status(201).json({ status: 'ok', data: markup });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Update a markup
  static async updateMarkup(req, res) {
    try {
      const { markupId } = req.params;
      const { coordinates, properties } = req.body;

      const before = await prisma.markup.findUnique({ where: { id: markupId } });

      const markup = await prisma.markup.update({
        where: { id: markupId },
        data: { coordinates, properties },
      });

      // Compute property diff for audit log
      let diff = null;
      if (properties && before?.properties) {
        const allKeys = [...new Set([...Object.keys(before.properties), ...Object.keys(properties)])];
        const changed = {};
        for (const k of allKeys) {
          const bv = before.properties[k];
          const av = properties[k];
          if (JSON.stringify(bv) !== JSON.stringify(av)) {
            changed[k] = { before: bv, after: av };
          }
        }
        if (Object.keys(changed).length > 0) diff = changed;
      }

      await logAction({
        action: 'MARKUP_UPDATE',
        userId: req.user.userId,
        documentId: markup.documentId,
        markupId,
        details: { type: before?.type, ...(diff ? { diff } : {}) },
      });

      res.json({ status: 'ok', data: markup });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Batch create markups (used for importing annotations from PDF / Bluebeam import)
  static async batchCreateMarkups(req, res) {
    try {
      const { documentId, markups } = req.body;
      const userId = req.user.userId;

      if (!documentId || !Array.isArray(markups) || markups.length === 0) {
        return res.status(400).json({ error: 'Missing documentId or markups array' });
      }

      const created = await Promise.all(
        markups.map(m =>
          prisma.markup.create({
            data: {
              documentId,
              type: m.type,
              pageNumber: m.pageNumber ?? 0,
              coordinates: m.coordinates ?? {},
              properties: m.properties ?? {},
              authorId: userId,
            },
          })
        )
      );

      await logAction({
        action: 'MARKUP_CREATE',
        userId,
        documentId,
        details: { action: 'batch_import', count: created.length },
      });

      res.status(201).json({ status: 'ok', data: created });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Delete a markup
  static async deleteMarkup(req, res) {
    try {
      const { markupId } = req.params;
      const markup = await prisma.markup.findUnique({ where: { id: markupId } });
      if (!markup) return res.status(404).json({ error: 'Markup not found' });

      await prisma.markup.delete({ where: { id: markupId } });

      await logAction({
        action: 'MARKUP_DELETE',
        userId: req.user.userId,
        documentId: markup.documentId,
        markupId,
      });

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = MarkupController;

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

      const markup = await prisma.markup.update({
        where: { id: markupId },
        data: { coordinates, properties },
      });

      await logAction({
        action: 'MARKUP_UPDATE',
        userId: req.user.userId,
        documentId: markup.documentId,
        markupId,
        details: { propertiesChanged: !!properties },
      });

      res.json({ status: 'ok', data: markup });
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

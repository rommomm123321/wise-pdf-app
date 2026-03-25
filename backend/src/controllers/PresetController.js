const prisma = require('../prismaClient');

class PresetController {
  // List presets for user's company
  static async getPresets(req, res) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { companyId: true } });
      
      if (!user?.companyId) {
        return res.json({ status: 'ok', data: [] });
      }

      const presets = await prisma.markupPropertyPreset.findMany({
        where: { companyId: user.companyId },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ status: 'ok', data: presets });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Create preset
  static async createPreset(req, res) {
    try {
      const { name, fields } = req.body;
      if (!name || !fields || !Array.isArray(fields)) {
        return res.status(400).json({ error: 'name and fields[] are required' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { companyId: true } });
      if (!user?.companyId) return res.status(400).json({ error: 'No company' });

      const preset = await prisma.markupPropertyPreset.create({
        data: {
          name,
          fields,
          companyId: user.companyId,
          createdById: req.user.userId,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      res.status(201).json({ status: 'ok', data: preset });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'Preset with this name already exists' });
      res.status(500).json({ error: error.message });
    }
  }

  // Update preset
  static async updatePreset(req, res) {
    try {
      const { id } = req.params;
      const { name, fields } = req.body;

      const preset = await prisma.markupPropertyPreset.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(fields !== undefined && { fields }),
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      res.json({ status: 'ok', data: preset });
    } catch (error) {
      if (error.code === 'P2025') return res.status(404).json({ error: 'Preset not found' });
      if (error.code === 'P2002') return res.status(409).json({ error: 'Preset with this name already exists' });
      res.status(500).json({ error: error.message });
    }
  }

  // Delete preset
  static async deletePreset(req, res) {
    try {
      const { id } = req.params;
      await prisma.markupPropertyPreset.delete({ where: { id } });
      res.json({ status: 'ok' });
    } catch (error) {
      if (error.code === 'P2025') return res.status(404).json({ error: 'Preset not found' });
      res.status(500).json({ error: error.message });
    }
  }

  // Apply preset fields to all markups in a document
  static async applyPreset(req, res) {
    try {
      const { id } = req.params;
      const { documentId } = req.body;
      if (!documentId) return res.status(400).json({ error: 'documentId is required' });

      const preset = await prisma.markupPropertyPreset.findUnique({ where: { id } });
      if (!preset) return res.status(404).json({ error: 'Preset not found' });

      const markups = await prisma.markup.findMany({ where: { documentId } });

      // Build default values from preset fields
      const presetDefaults = {};
      for (const field of preset.fields) {
        presetDefaults[field.key] = field.defaultValue ?? '';
      }

      // Batch update — merge preset customProperties into each markup
      const updates = markups.map((m) => {
        const existing = m.properties || {};
        const existingCustom = existing.customProperties || {};
        return prisma.markup.update({
          where: { id: m.id },
          data: {
            properties: {
              ...existing,
              customProperties: { ...presetDefaults, ...existingCustom },
              presetId: id,
            },
          },
        });
      });

      await prisma.$transaction(updates);
      res.json({ status: 'ok', data: { updated: markups.length } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = PresetController;

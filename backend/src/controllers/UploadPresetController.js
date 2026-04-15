const prisma = require('../prismaClient');

// GET /api/upload-presets
exports.list = async (req, res) => {
  try {
    const presets = await prisma.uploadPreset.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(presets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/upload-presets
// Body: { name, projectId, folderId, assignToId?, isDefault? }
exports.create = async (req, res) => {
  try {
    const { name, projectId, folderId, assignToId, isDefault } = req.body;
    if (!name || !projectId || !folderId) {
      return res.status(400).json({ error: 'name, projectId, folderId required' });
    }
    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.uploadPreset.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    const preset = await prisma.uploadPreset.create({
      data: {
        userId: req.user.id,
        name,
        projectId,
        folderId,
        assignToId: assignToId || null,
        isDefault: isDefault || false,
      },
    });
    res.json(preset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/upload-presets/:id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.uploadPreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    const { name, projectId, folderId, assignToId, isDefault } = req.body;
    if (isDefault) {
      await prisma.uploadPreset.updateMany({
        where: { userId: req.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.uploadPreset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(projectId !== undefined && { projectId }),
        ...(folderId !== undefined && { folderId }),
        ...(assignToId !== undefined && { assignToId: assignToId || null }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/upload-presets/:id
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.uploadPreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    await prisma.uploadPreset.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

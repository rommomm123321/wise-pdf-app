const prisma = require("../prismaClient");

exports.getFields = async (req, res) => {
  try {
    const { projectId } = req.params;
    const fields = await prisma.projectMarkupField.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    res.json(fields);
  } catch (error) {
    console.error("Error fetching markup fields:", error);
    res.status(500).json({ error: "Failed to fetch markup fields" });
  }
};

exports.createField = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { key, type, options } = req.body;

    const exists = await prisma.projectMarkupField.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (exists) {
      return res.status(400).json({ error: "Field with this key already exists in the project." });
    }

    const field = await prisma.projectMarkupField.create({
      data: {
        projectId,
        key,
        type: type || "text",
        options: options || [],
      },
    });
    res.status(201).json(field);
  } catch (error) {
    console.error("Error creating markup field:", error);
    res.status(500).json({ error: "Failed to create markup field" });
  }
};

exports.updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, type, options } = req.body;

    const field = await prisma.projectMarkupField.update({
      where: { id },
      data: { key, type, options },
    });
    res.json(field);
  } catch (error) {
    console.error("Error updating markup field:", error);
    res.status(500).json({ error: "Failed to update markup field" });
  }
};

exports.deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.projectMarkupField.delete({ where: { id } });
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Error deleting markup field:", error);
    res.status(500).json({ error: "Failed to delete markup field" });
  }
};

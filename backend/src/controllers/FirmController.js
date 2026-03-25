const prisma = require("../prismaClient");

class FirmController {
  // Получить все компании (доступно только для GENERAL_ADMIN)
  static async getAllFirms(req, res) {
    try {
      if (req.user.role !== "GENERAL_ADMIN") {
        return res
          .status(403)
          .json({ error: "Access denied. General Admin only." });
      }

      const firms = await prisma.firm.findMany({
        include: {
          _count: {
            select: { users: true, projects: true },
          },
        },
      });
      res.json({ status: "ok", data: firms });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Создать новую компанию (доступно для GENERAL_ADMIN)
  static async createFirm(req, res) {
    try {
      if (req.user.role !== "GENERAL_ADMIN") {
        return res
          .status(403)
          .json({ error: "Access denied. General Admin only." });
      }

      const { name } = req.body;
      if (!name)
        return res.status(400).json({ error: "Firm name is required" });

      const newFirm = await prisma.firm.create({
        data: { name },
      });

      res.status(201).json({ status: "ok", data: newFirm });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Получить данные своей компании (для обычных юзеров и PROJECT_ADMIN)
  static async getMyFirm(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { firm: true },
      });

      if (!user.firm) {
        return res
          .status(404)
          .json({ error: "You are not assigned to any firm." });
      }

      // Если это Project Admin, отдаем ему список юзеров его фирмы
      const isProjectAdmin =
        req.user.role === "PROJECT_ADMIN" || req.user.role === "GENERAL_ADMIN";

      const firmData = await prisma.firm.findUnique({
        where: { id: user.firm.id },
        include: {
          projects: true,
          users: isProjectAdmin
            ? {
                select: { id: true, name: true, email: true, role: true },
              }
            : false,
        },
      });

      res.json({ status: "ok", data: firmData });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = FirmController;

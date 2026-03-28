const jwt = require("jsonwebtoken");
const prisma = require("./prismaClient");
const { logAction } = require("./services/auditService");
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_for_redlines";

module.exports = function setupSocketHandlers(io) {
  // Middleware для аутентификации сокетов
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded; // { userId, email, role }
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected to socket: ${socket.id}, userId: ${socket.user.userId}`);
    // Join personal room for direct notifications
    socket.join(`user:${socket.user.userId}`);

    // Join room for specific document
    socket.on("markup:join", (documentId) => {
      socket.join(`doc:${documentId}`);
      console.log(`User ${socket.user.userId} joined doc:${documentId}`);
    });

    socket.on("markup:leave", (documentId) => {
      socket.leave(`doc:${documentId}`);
    });

    socket.on("markup:get", async (documentId, callback) => {
      try {
        const markups = await prisma.markup.findMany({
          where: { documentId },
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        });
        if (typeof callback === 'function') callback({ status: "ok", data: markups });
      } catch (err) {
        if (typeof callback === 'function') callback({ status: "error", message: err.message });
      }
    });

    socket.on("markup:create", async (data, callback) => {
      try {
        const { documentId, type, pageNumber, coordinates, properties } = data;
        const markup = await prisma.markup.create({
          data: {
            documentId,
            type,
            pageNumber,
            coordinates,
            properties: properties || {},
            authorId: socket.user.userId,
            // ['*'] = unrestricted (everyone), null/undefined → unrestricted
            allowedEditUserIds: data.allowedEditUserIds != null ? data.allowedEditUserIds : ['*'],
            allowedDeleteUserIds: data.allowedDeleteUserIds != null ? data.allowedDeleteUserIds : ['*'],
          },
          include: { author: { select: { id: true, name: true } } },
        });

        await logAction({
          action: 'MARKUP_CREATE',
          userId: socket.user.userId,
          documentId,
          markupId: markup.id,
          details: { type, pageNumber },
        });

        // Broadcast to everyone else in the room
        socket.to(`doc:${documentId}`).emit("markup:created", markup);
        // Reply to sender via callback
        if (typeof callback === 'function') callback({ status: "ok", data: markup });
      } catch (err) {
        if (typeof callback === 'function') callback({ status: "error", message: err.message });
      }
    });

    socket.on("markup:update", async (data, callback) => {
      try {
        const { id, coordinates, properties } = data;
        const markup = await prisma.markup.update({
          where: { id },
          data: { coordinates, properties },
          include: { author: { select: { id: true, name: true } } },
        });

        await logAction({
          action: 'MARKUP_UPDATE',
          userId: socket.user.userId,
          documentId: markup.documentId,
          markupId: id,
          details: { propertiesChanged: !!properties },
        });

        socket.to(`doc:${markup.documentId}`).emit("markup:updated", markup);
        if (typeof callback === 'function') callback({ status: "ok", data: markup });
      } catch (err) {
        if (typeof callback === 'function') callback({ status: "error", message: err.message });
      }
    });

    socket.on("markup:delete", async (data, callback) => {
      try {
        const { id } = data;
        let documentId = data.documentId;
        
        if (!documentId) {
          const markup = await prisma.markup.findUnique({ where: { id } });
          if (!markup) throw new Error("Markup not found");
          documentId = markup.documentId;
        }

        await prisma.markup.delete({ where: { id } });

        await logAction({
          action: 'MARKUP_DELETE',
          userId: socket.user.userId,
          documentId: documentId,
          markupId: id,
        });

        socket.to(`doc:${documentId}`).emit("markup:deleted", { id });
        if (typeof callback === 'function') callback({ status: "ok", data: { id } });
      } catch (err) {
        if (typeof callback === 'function') callback({ status: "error", message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected from socket: ${socket.id}`);
    });
  });
};

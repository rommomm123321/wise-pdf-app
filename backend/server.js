const express = require('express');

const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });
const { createServer } = require("http");
const { Server } = require("socket.io");

// Импортируем наш настроенный инстанс Prisma
const prisma = require("./src/prismaClient");

const app = express();
const httpServer = createServer(app);

// Настройка Socket.io для real-time взаимодействия (маркапы, курсоры)
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./src/middlewares/authMiddleware");

// Инициализация Google клиента
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_jwt_key_for_redlines";

// Базовый API роут (для проверки работоспособности бэкенда)
app.get("/api/health", async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    res.json({
      status: "ok",
      message: "Redlines API is running!",
      dbConnected: true,
      totalUsers: usersCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        status: "error",
        message: "Database connection failed!",
        error: error.message,
      });
  }
});

// Отдаем конфигурацию на фронтенд (чтобы не зашивать ключи в React билд)
app.get("/api/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
});

// Роут для получения данных текущего пользователя по JWT токену (Восстановление сессии)
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    // req.user берется из токена, который расшифровал authMiddleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        company: true,
        tags: { select: { id: true, text: true, color: true } },
        role: { select: { id: true, name: true, color: true } },
        assignedProjects: {
          select: {
            projectId: true,
            canView: true,
            canEdit: true,
            canDelete: true,
            canDownload: true,
            canMarkup: true,
            canManage: true,
          },
        },
      },
    });

    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });

    // Also return the current token from cookies (which is valid since authMiddleware passed)
    const token = req.cookies.token;

    res.json({ status: "ok", user, token });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Роут авторизации Google
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential)
    return res
      .status(400)
      .json({ status: "error", message: "No credential provided" });

  try {
    // 1. Проверяем подлинность токена от Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // 2. Ищем пользователя в БД или создаем нового
    if (!process.env.DATABASE_URL) {
      console.error('CRITICAL: DATABASE_URL is not defined in server.js before query!');
    }

    const userSelect = {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      googleId: true,
      companyId: true,
      roleId: true,
    };

    console.log('Attempting DB query for email:', email);
    let user = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });

    // Super admin email always gets GENERAL_ADMIN
    const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS 
      ? process.env.SUPER_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) 
      : [];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

    if (!user) {
      user = await prisma.user.create({
        data: { email, name, googleId, systemRole: isSuperAdmin ? 'GENERAL_ADMIN' : 'USER' },
        select: userSelect,
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { email },
        data: { googleId, name, ...(isSuperAdmin ? { systemRole: 'GENERAL_ADMIN' } : {}) },
        select: userSelect,
      });
    } else if (isSuperAdmin && user.systemRole !== 'GENERAL_ADMIN') {
      // Ensure super admin always has GENERAL_ADMIN
      user = await prisma.user.update({
        where: { email },
        data: { systemRole: 'GENERAL_ADMIN' },
        select: userSelect,
      });
    }

    // 3. Создаем сессионный токен (JWT) для нашего приложения
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.systemRole },
      JWT_SECRET,
      { expiresIn: "7d" }, // Сессия живет 7 дней
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ status: "ok", user, token });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ status: "error", message: "Invalid Google token" });
  }
});

// Роут логаута
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ status: "ok" });
});

// Impersonate user (GENERAL_ADMIN only)
app.post("/api/auth/impersonate/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!currentUser || currentUser.systemRole !== 'GENERAL_ADMIN') {
      return res.status(403).json({ status: 'error', message: 'Only GENERAL_ADMIN can impersonate' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        company: true,
        role: { select: { id: true, name: true, color: true } },
        assignedProjects: {
          select: {
            projectId: true,
            canView: true, canEdit: true, canDelete: true,
            canDownload: true, canMarkup: true, canManage: true,
          },
        },
      },
    });

    if (!targetUser) return res.status(404).json({ status: 'error', message: 'User not found' });

    const token = jwt.sign(
      { userId: targetUser.id, email: targetUser.email, role: targetUser.systemRole },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Save the original token if not already impersonating
    if (!req.cookies.originalToken) {
      res.cookie("originalToken", req.cookies.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    res.json({ status: 'ok', user: targetUser });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Stop impersonating
app.post("/api/auth/stop-impersonating", (req, res) => {
  const originalToken = req.cookies.originalToken;
  if (originalToken) {
    res.cookie("token", originalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.clearCookie("originalToken");
    res.json({ status: "ok" });
  } else {
    res.status(400).json({ status: "error", message: "Not impersonating" });
  }
});

// Подключаем роуты
const companyRoutes = require("./src/routes/companyRoutes");
const projectRoutes = require("./src/routes/projectRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const folderRoutes = require("./src/routes/folderRoutes");
const searchRoutes = require("./src/routes/searchRoutes");
const userRoutes = require("./src/routes/userRoutes");
const invitationRoutes = require("./src/routes/invitationRoutes");
const folderPermissionRoutes = require("./src/routes/folderPermissionRoutes");
const customRoleRoutes = require("./src/routes/customRoleRoutes");
const markupRoutes = require("./src/routes/markupRoutes");
const auditRoutes = require("./src/routes/auditRoutes");
const presetRoutes = require("./src/routes/presetRoutes");
const projectMarkupFieldRoutes = require("./src/routes/projectMarkupFieldRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");

app.use("/api/companies", companyRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/permissions", folderPermissionRoutes);
app.use("/api/custom-roles", customRoleRoutes);
app.use("/api/markups", markupRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/presets", presetRoutes);
app.use("/api/project-markup-fields", projectMarkupFieldRoutes);
app.use("/api/notifications", notificationRoutes);

// Настройка Socket.io подключений
const setupSocketHandlers = require("./src/socketHandlers");
setupSocketHandlers(io);

// Раздача статических файлов (сбилженный React)
// Папка public будет создана Docker'ом на этапе копирования билда из frontend
app.use(express.static(path.join(__dirname, "public")));

// Раздача файлов, загруженных в локальное хранилище
const uploadDir = path.join(__dirname, "uploads");
const fs = require("fs");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

// Любой другой роут перенаправляем на index.html (для работы React Router / SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;

// Setup Yjs WebSocket server
const WebSocket = require('ws');
const setupYjsWebSocket = require('./src/yjsServer');
const wss = new WebSocket.Server({ noServer: true });

setupYjsWebSocket(wss, io);

httpServer.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/yjs/')) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      request.user = decoded; // Attach user to request
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

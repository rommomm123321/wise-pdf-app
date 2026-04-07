/**
 * Revit Plugin API Routes
 *
 * Base URL: /api/revit
 *
 * Authentication: Bearer token in Authorization header
 *   Authorization: Bearer <token>
 *
 * Tokens are obtained via POST /api/revit/auth/token (see below).
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../prismaClient');
const authMiddleware = require('../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_redlines';

// Multer storage for Revit uploads
const uploadDir = path.join(__dirname, '../../uploads/revit');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.rvt', '.dwg', '.ifc', '.nwd'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${ext}`));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/revit/auth/token
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Exchange a short-lived session token for a long-lived API token (30 days).
 * The user copies their session token from the web app settings and pastes it
 * into the Revit plugin once. After that they use the returned api_token.
 *
 * Request body: { "token": "<session_jwt>" }
 * Response:     { "api_token": "<30d_jwt>", "user": { id, email, name } }
 */
/**
 * Method 1: Exchange session JWT for 30-day API token.
 * Body: { "token": "<session_jwt>" }
 */
router.post('/auth/token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, systemRole: true, companyId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const apiToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.systemRole },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ api_token: apiToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

/**
 * Method 2: Login with email + API password (for Revit plugin / scripts).
 * Body: { "email": "user@example.com", "password": "<api_password>" }
 * Response: { "api_token": "<30d_jwt>", "user": { id, email, name } }
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, name: true, systemRole: true, companyId: true, apiPassword: true, isDeleted: true },
    });
    if (!user || user.isDeleted) return res.status(404).json({ error: 'User not found' });
    if (!user.apiPassword || user.apiPassword !== password) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    const apiToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.systemRole },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ api_token: apiToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/revit/me
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verify token and return current user info. Use this for "ping" / auth check.
 * Response: { id, email, name, companyId }
 */
router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { id: true, email: true, name: true, companyId: true, systemRole: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ status: 'ok', data: user });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/revit/projects
// ─────────────────────────────────────────────────────────────────────────────
/**
 * List projects accessible to the authenticated user.
 * Response: { status: 'ok', data: [{ id, name, description }] }
 */
router.get('/projects', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let projects;

    if (user.systemRole === 'GENERAL_ADMIN') {
      projects = await prisma.project.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, description: true, companyId: true },
        orderBy: { name: 'asc' },
      });
    } else if (user.role?.name === 'Admin' && user.companyId) {
      projects = await prisma.project.findMany({
        where: { companyId: user.companyId, isDeleted: false },
        select: { id: true, name: true, description: true, companyId: true },
        orderBy: { name: 'asc' },
      });
    } else {
      // Regular user — only assigned projects
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId, project: { isDeleted: false } },
        include: { project: { select: { id: true, name: true, description: true, companyId: true } } },
      });
      projects = assignments.map(a => a.project);
    }

    res.json({ status: 'ok', data: projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/revit/projects/:projectId/folders
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get the full folder tree for a project (respects user permissions).
 * Response: { status: 'ok', data: [{ id, name, parentId, isGhost }] }
 */
router.get('/projects/:projectId/folders', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    const { getProjectPermissions } = require('../middlewares/permissionMiddleware');
    const projPerms = await getProjectPermissions(userId, projectId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.systemRole === 'GENERAL_ADMIN' || projPerms?.scope === 'FULL';

    const allFolders = await prisma.folder.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true, parentId: true, projectId: true },
      orderBy: { name: 'asc' },
    });

    if (isAdmin) {
      return res.json({ status: 'ok', data: allFolders.map(f => ({ ...f, isGhost: false })) });
    }

    const folderPerms = await prisma.folderPermission.findMany({
      where: { userId, folder: { projectId } },
    });
    const allowedFolderIds = new Set(folderPerms.map(p => p.folderId));
    const folderMap = new Map(allFolders.map(f => [f.id, f]));

    // Inherit to descendants
    const inheritedIds = new Set(allowedFolderIds);
    for (const startId of allowedFolderIds) {
      const stack = [startId];
      while (stack.length > 0) {
        const pid = stack.pop();
        for (const f of allFolders) {
          if (f.parentId === pid && !inheritedIds.has(f.id)) {
            inheritedIds.add(f.id);
            stack.push(f.id);
          }
        }
      }
    }

    // Ghost ancestor paths
    const visibleIds = new Set(inheritedIds);
    const ghostIds = new Set();
    for (const startId of allowedFolderIds) {
      let curr = folderMap.get(startId);
      while (curr && curr.parentId) {
        if (!visibleIds.has(curr.parentId)) {
          visibleIds.add(curr.parentId);
          ghostIds.add(curr.parentId);
        }
        curr = folderMap.get(curr.parentId);
      }
    }

    const data = allFolders
      .filter(f => visibleIds.has(f.id))
      .map(f => ({ ...f, isGhost: ghostIds.has(f.id) }));

    res.json({ status: 'ok', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/revit/folders/:folderId/upload
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Upload a file to the specified folder.
 *
 * Multipart form-data fields:
 *   file      — the file to upload (required)
 *   version   — version number, integer (optional, defaults to 1 or auto-increments)
 *   comment   — version comment / description (optional)
 *
 * Response: { status: 'ok', data: { id, name, version, folderId } }
 */
router.post('/folders/:folderId/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.userId;

    // Check folder exists and user can view it (upload = canView + canMarkup or project-level write)
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.isDeleted) return res.status(404).json({ error: 'Folder not found' });

    const { getFolderPermissions } = require('../middlewares/permissionMiddleware');
    const perms = await getFolderPermissions(userId, folderId);
    if (!perms || !perms.canView) return res.status(403).json({ error: 'Access denied' });
    // Check canUpload permission (default true for all roles)
    if (perms.canUpload === false) return res.status(403).json({ error: 'Upload permission denied' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const originalName = req.file.originalname;
    const baseName = path.basename(originalName, path.extname(originalName)) + path.extname(originalName);

    // Auto-version: mark previous versions as not latest
    const existing = await prisma.document.findFirst({
      where: { folderId, name: baseName, isDeleted: false, isLatest: true },
      orderBy: { version: 'desc' },
    });

    const newVersion = existing ? existing.version + 1 : (parseInt(req.body.version) || 1);

    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data: { isLatest: false } });
    }

    const storageUrl = `/api/documents/file/${req.file.filename}`;
    const doc = await prisma.document.create({
      data: {
        name: baseName,
        storageUrl,
        version: newVersion,
        isLatest: true,
        folderId,
        syncSource: null,
      },
      select: { id: true, name: true, version: true, folderId: true, storageUrl: true },
    });

    res.status(201).json({ status: 'ok', data: doc });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

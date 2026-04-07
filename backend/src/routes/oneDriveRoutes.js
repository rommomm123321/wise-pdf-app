const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const authMiddleware = require('../middlewares/authMiddleware');
const OneDriveProvider = require('../services/storage/OneDriveProvider');
const OneDriveSyncService = require('../services/OneDriveSyncService');

// Helper to get companyId from the request (admins can pass explicit companyId)
async function getCompanyId(req) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { companyId: true, systemRole: true }
  });
  // GENERAL_ADMINs can pass an explicit companyId in body or query
  const explicitId = req.body?.companyId || req.query?.companyId;
  if (user?.systemRole === 'GENERAL_ADMIN' && explicitId) return explicitId;
  if (!user?.companyId) throw new Error('User has no company');
  return user.companyId;
}

// GET /api/onedrive/auth/url — generate Microsoft OAuth URL
router.get('/auth/url', authMiddleware, async (req, res) => {
  try {
    // Allow passing companyId as query param for admins
    const companyId = await getCompanyId(req);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3030';
    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${backendUrl}/api/onedrive/auth/callback`,
      scope: 'Files.ReadWrite.All Sites.ReadWrite.All offline_access User.Read',
      state: companyId,
      response_mode: 'query',
    });
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
    res.json({ url: authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/onedrive/auth/callback — Microsoft redirects here after auth
router.get('/auth/callback', async (req, res) => {
  const { code, state: companyId, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendUrl}/dashboard?onedrive=error&message=${encodeURIComponent(error)}`);
  }

  try {
    const tokens = await OneDriveProvider.exchangeCodeForTokens(code);
    if (tokens.error || !tokens.access_token) {
      throw new Error(tokens.error_description || tokens.error || 'Failed to get access token');
    }
    const { email, driveId } = await OneDriveProvider.getUserInfo(tokens.access_token);

    let company = await prisma.company.update({
      where: { id: companyId },
      data: {
        oneDriveDriveId: driveId,
        oneDriveOwnerEmail: email,
        oneDriveAccessToken: tokens.access_token,
        oneDriveRefreshToken: tokens.refresh_token,
        oneDriveTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      }
    });

    // Auto-create company root folder in OneDrive
    const provider = new OneDriveProvider(companyId);
    let finalRootItemId = 'root';
    try {
      // Clean company name: remove invalid characters and leading/trailing dots/spaces
      let safeName = company.name.replace(/[<>:"\/\\|?*]/g, '_').trim().replace(/\.+$/, '');
      if (!safeName) safeName = `Redlines_${company.id.slice(0, 8)}`;
      
      finalRootItemId = await provider.findOrCreateFolder(safeName, 'root');
    } catch (e) {
      console.warn('[OneDrive AutoConnect] Failed to create company folder:', e.message);
      // Rollback tokens if folder creation fails (e.g. no SPO license)
      await prisma.company.update({
        where: { id: companyId },
        data: {
          oneDriveDriveId: null,
          oneDriveOwnerEmail: null,
          oneDriveAccessToken: null,
          oneDriveRefreshToken: null,
          oneDriveTokenExpiry: null,
          oneDriveConnected: false,
        }
      });
      throw new Error(`Failed to initialize OneDrive folder: ${e.message}`);
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { oneDriveRootItemId: finalRootItemId, oneDriveConnected: true }
    });

    // Start initial sync async
    OneDriveSyncService.syncCompany(companyId).catch(console.error);

    res.redirect(`${frontendUrl}/companies?onedrive=connected&companyId=${companyId}`);
  } catch (err) {
    console.error('[OneDrive OAuth]', err.message);
    res.redirect(`${frontendUrl}/companies?onedrive=error&message=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/onedrive/browse — list folders in OneDrive for folder picker
router.post('/browse', authMiddleware, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    const { folderId = 'root' } = req.body;
    const provider = new OneDriveProvider(companyId);
    const folders = await provider.listFolder(folderId);
    res.json({ folders: folders.map(f => ({ id: f.id, name: f.name })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onedrive/connect — set root folder for company
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    const { rootItemId } = req.body;
    if (!rootItemId) return res.status(400).json({ error: 'rootItemId required' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const provider = new OneDriveProvider(companyId);
    let finalRootItemId = rootItemId;

    try {
      // Clean company name to be a valid folder name
      const safeName = company.name.replace(/[<>:"\/\\|?*]/g, '_');
      finalRootItemId = await provider.findOrCreateFolder(safeName, rootItemId);
    } catch (e) {
      console.warn('[OneDrive Connect] Failed to create company folder, using selected root:', e.message);
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { oneDriveRootItemId: finalRootItemId, oneDriveConnected: true }
    });

    // Start initial sync async
    OneDriveSyncService.syncCompany(companyId).catch(console.error);

    res.json({ status: 'ok', message: 'OneDrive connected successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/onedrive/status — connection status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    let companyId;
    try { companyId = await getCompanyId(req); } catch { return res.json({ status: 'ok', data: null }); }
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        oneDriveConnected: true,
        oneDriveOwnerEmail: true,
        oneDriveRootItemId: true,
        oneDriveLastSync: true,
      }
    });
    res.json({ status: 'ok', data: company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onedrive/disconnect — disconnect OneDrive
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    await prisma.company.update({
      where: { id: companyId },
      data: {
        oneDriveConnected: false,
        oneDriveAccessToken: null,
        oneDriveRefreshToken: null,
        oneDriveDeltaLink: null,
      }
    });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onedrive/sync — trigger manual sync
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    OneDriveSyncService.syncCompany(companyId).catch(console.error);
    res.json({ status: 'ok', message: 'Sync started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onedrive/resync — clear delta link and do full resync from scratch
router.post('/resync', authMiddleware, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    await prisma.company.update({ where: { id: companyId }, data: { oneDriveDeltaLink: null } });
    OneDriveSyncService.syncCompany(companyId).catch(console.error);
    res.json({ status: 'ok', message: 'Full resync started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

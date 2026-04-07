const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const OneDriveSyncService = require('../services/OneDriveSyncService');

// POST /api/webhooks/onedrive — Microsoft Graph webhook notifications
router.post('/onedrive', express.text({ type: '*/*' }), async (req, res) => {
  // Microsoft validation handshake
  if (req.query.validationToken) {
    return res.status(200).type('text/plain').send(req.query.validationToken);
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const notifications = body?.value || [];

    // Fire-and-forget: respond quickly then process
    res.status(202).send();

    for (const notification of notifications) {
      try {
        // Find company by driveId in the resource path
        const resource = notification.resource || '';
        const driveMatch = resource.match(/drives\/([^/]+)/);
        if (driveMatch) {
          const driveId = driveMatch[1];
          const company = await prisma.company.findFirst({
            where: { oneDriveDriveId: driveId, oneDriveConnected: true }
          });
          if (company) {
            OneDriveSyncService.syncCompany(company.id).catch(console.error);
          }
        }
      } catch (err) {
        console.error('[Webhook] Error processing notification:', err.message);
      }
    }
  } catch (err) {
    console.error('[Webhook] Parse error:', err.message);
  }
});

module.exports = router;

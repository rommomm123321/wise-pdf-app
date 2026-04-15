const prisma = require('../prismaClient');

const SITE_URL = process.env.SITE_URL || 'https://your-domain.com';

/**
 * Send an Adaptive Card to Microsoft Teams via Incoming Webhook.
 * Silent failure — Teams notification is optional, never blocks the flow.
 */
async function sendTeamsNotification({ webhookUrl, title, message, documentName, documentId, projectId, assignmentId, type }) {
  if (!webhookUrl) return;
  try {
    const docUrl = `${SITE_URL}/projects/${projectId}/documents/${documentId}`;
    const actions = [];

    // Action button: Open Document
    actions.push({
      type: 'Action.OpenUrl',
      title: '📄 Open Document',
      url: docUrl,
    });

    // Review-specific action buttons — open site URL that auto-executes the action
    if (type === 'review_request' && assignmentId) {
      actions.push({
        type: 'Action.OpenUrl',
        title: '✅ Approve',
        url: `${SITE_URL}/review-action?assignmentId=${assignmentId}&action=approved`,
      });
      actions.push({
        type: 'Action.OpenUrl',
        title: '❌ Has Markups — Fix',
        url: `${SITE_URL}/review-action?assignmentId=${assignmentId}&action=has_markups`,
      });
    }

    // Color accent based on type
    const accentColor = type === 'review_approved' ? '4caf50'
      : type === 'review_rejected' ? 'f44336'
      : type === 'review_request' ? 'ff9800'
      : '2196f3';

    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          msteams: { width: 'Full' },
          body: [
            {
              type: 'Container',
              style: 'accent',
              bleed: true,
              items: [{
                type: 'TextBlock',
                text: `🔔 ${title}`,
                weight: 'Bolder',
                size: 'Medium',
                color: 'Light',
              }],
            },
            {
              type: 'TextBlock',
              text: message,
              wrap: true,
              spacing: 'Medium',
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Document', value: documentName || 'Unknown' },
                { title: 'Status', value: type === 'review_request' ? '⏳ Pending Review' : type === 'review_approved' ? '✅ Approved' : type === 'review_rejected' ? '❌ Has Issues' : '💬 Mention' },
              ],
            },
          ],
          actions,
        },
      }],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
  } catch (err) {
    console.warn('[Teams] Webhook failed (non-blocking):', err.message);
  }
}

/**
 * Send notification to a user via all configured channels (site, Teams, Revit).
 * Reads user preferences to decide which channels to use.
 */
async function sendNotification({ userId, actorId, type, documentId, projectId, markupId, assignmentId, message, io }) {
  try {
    const [user, actor, doc] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, preferences: true } }),
      prisma.user.findUnique({ where: { id: actorId }, select: { id: true, name: true, email: true } }),
      documentId ? prisma.document.findUnique({ where: { id: documentId }, select: { name: true } }) : null,
    ]);
    if (!user) return;

    const prefs = (user.preferences || {});
    const notifPrefs = prefs.notifications || {};
    const actorName = actor?.name || actor?.email || 'Someone';
    const documentName = doc?.name || '';

    // 1. Create DB notification (always — for site bell)
    const notification = await prisma.notification.create({
      data: {
        userId,
        actorId,
        type: type || 'mention',
        documentId: documentId || null,
        projectId: projectId || null,
        markupId: markupId || null,
        assignmentId: assignmentId || null,
        message: message || null,
      },
    });

    // 2. Socket.io (site real-time)
    if (io && notifPrefs.inApp !== false) {
      io.to(`user:${userId}`).emit('notification:new', {
        ...notification,
        createdAt: notification.createdAt.toISOString(),
        actor,
        documentName,
        type,
      });
    }

    // 3. Teams webhook
    if (notifPrefs.teamsWebhookUrl && notifPrefs.inTeams !== false) {
      const title = type === 'review_request' ? 'Review Assignment'
        : type === 'review_approved' ? 'Document Approved'
        : type === 'review_rejected' ? 'Corrections Needed'
        : 'Mention';
      sendTeamsNotification({
        webhookUrl: notifPrefs.teamsWebhookUrl,
        title,
        message: message || `${actorName} ${type === 'review_request' ? 'assigned you to review' : type === 'review_approved' ? 'approved' : type === 'review_rejected' ? 'found issues in' : 'mentioned you in'} "${documentName}"`,
        documentName,
        documentId,
        projectId,
        assignmentId,
        type,
      });
    }

    return notification;
  } catch (err) {
    console.error('[Notifications] sendNotification error:', err.message);
  }
}

/**
 * Parse @mentions from markup properties, create notifications, emit via socket + Teams.
 */
async function processMentions({ markupId, documentId, projectId, actorId, properties, io }) {
  try {
    if (properties?.isPastedOrDuplicated) return;

    const threadTexts = Array.isArray(properties?.thread) ? properties.thread.map(e => e.text) : [];
    const combined = [properties?.subject, properties?.comment, properties?.text, ...threadTexts]
      .filter(s => s && typeof s === 'string')
      .join(' ');

    if (!combined.includes('@')) return;

    const projectUsers = await prisma.user.findMany({
      where: {
        isDeleted: false,
        NOT: { id: actorId },
        assignedProjects: { some: { projectId } },
      },
      select: { id: true, name: true, email: true },
    });

    if (!projectUsers.length) return;

    const mentionedUsers = projectUsers.filter(u => {
      const name = u.name || u.email;
      if (!name) return false;
      return combined.toLowerCase().includes(`@${name.toLowerCase()}`);
    });

    if (!mentionedUsers.length) return;

    for (const user of mentionedUsers) {
      await sendNotification({
        userId: user.id,
        actorId,
        type: 'mention',
        documentId,
        projectId,
        markupId,
        io,
      });
    }
  } catch (err) {
    console.error('[Notifications] processMentions error:', err.message);
  }
}

module.exports = { processMentions, sendNotification, sendTeamsNotification };

const prisma = require('../prismaClient');

/**
 * Parse @mentions from markup properties, create notifications, emit via socket.
 * Supports multiple mentions in the same text → multiple notifications.
 *
 * Semantics: looks up ALL users on the project and checks if any are @mentioned
 * by their exact name (case-insensitive) in subject or comment.
 */
async function processMentions({ markupId, documentId, projectId, actorId, properties, io }) {
  try {
    // If it's a duplicated markup, we shouldn't send duplicate notifications
    if (properties?.isPastedOrDuplicated) return;

    const combined = [properties?.subject, properties?.comment, properties?.text]
      .filter(s => s && typeof s === 'string')
      .join(' ');

    if (!combined.includes('@')) return;

    // Fetch all project users (excluding the actor who is writing)
    const projectUsers = await prisma.user.findMany({
      where: {
        isDeleted: false,
        NOT: { id: actorId },
        assignedProjects: { some: { projectId } },
      },
      select: { id: true, name: true, email: true },
    });

    if (!projectUsers.length) return;

    // Find which users are mentioned: check if "@Name" appears in text (case-insensitive)
    const mentionedUsers = projectUsers.filter(u => {
      const name = u.name || u.email;
      if (!name) return false;
      return combined.toLowerCase().includes(`@${name.toLowerCase()}`);
    });

    if (!mentionedUsers.length) return;

    const [actor, docInfo] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorId }, select: { id: true, name: true, email: true } }),
      prisma.document.findUnique({ where: { id: documentId }, select: { name: true } }),
    ]);

    for (const user of mentionedUsers) {
      // Check if notification already exists
      const existing = await prisma.notification.findUnique({
        where: { userId_markupId: { userId: user.id, markupId } },
      });

      const notification = await prisma.notification.upsert({
        where: { userId_markupId: { userId: user.id, markupId } },
        update: { actorId, read: false, createdAt: new Date() },
        create: { userId: user.id, actorId, markupId, documentId, projectId },
      });

      // Only emit socket event for genuinely NEW notifications (not updates to existing ones)
      const isNew = !existing;
      if (io && isNew) {
        io.to(`user:${user.id}`).emit('notification:new', {
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          actor,
          documentName: docInfo?.name || '',
        });
      }
    }
  } catch (err) {
    console.error('[Notifications] processMentions error:', err.message);
  }
}

module.exports = { processMentions };

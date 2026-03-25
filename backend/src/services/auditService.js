const prisma = require('../prismaClient');

/**
 * Запись действия в аудит лог.
 * Вызывается из контроллеров после каждого значимого действия.
 */
async function logAction({ action, userId, projectId, folderId, documentId, markupId, targetUserId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        projectId: projectId || null,
        folderId: folderId || null,
        documentId: documentId || null,
        markupId: markupId || null,
        targetUserId: targetUserId || null,
        details: details || null,
      },
    });
  } catch (err) {
    // Аудит не должен ломать основной флоу
    console.error('[AuditService] Failed to log action:', err.message);
  }
}

module.exports = { logAction };

const prisma = require('../prismaClient');

/**
 * Получить effective permissions юзера для проекта.
 */
async function getProjectPermissions(userId, projectId) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { role: true }
  });
  if (!user) return null;

  if (user.systemRole === 'GENERAL_ADMIN') {
    return { canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true, scope: 'FULL' };
  }

  if (user.roleId) {
    const project = await prisma.project.findUnique({ 
      where: { id: projectId },
      include: { company: true }
    });

    if (project?.company?.isArchived) {
      return null;
    }

    // Если это админ компании — полный доступ
    if (project && user.role?.name === 'Admin' && user.companyId === project.companyId) {
      return { canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true, scope: 'FULL' };
    }
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  return assignment || null;
}

/**
 * Получить effective permissions юзера для папки (с поддержкой Ghost Path).
 */
async function getFolderPermissions(userId, folderId) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { role: true }
  });
  if (!user) return null;

  const folder = await prisma.folder.findUnique({ 
    where: { id: folderId },
    include: { children: { select: { id: true } }, files: { select: { id: true } } }
  });
  if (!folder) return null;

  if (user.systemRole === 'GENERAL_ADMIN') {
    return { canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true, scope: 'FULL' };
  }

  // 1.5 Check if company is archived
  const company = await prisma.company.findFirst({
    where: { projects: { some: { id: folder.projectId } } }
  });
  if (company?.isArchived) {
    return null;
  }

  // 2. Direct override на папку
  const folderPerm = await prisma.folderPermission.findUnique({
    where: { userId_folderId: { userId, folderId } },
  });
  if (folderPerm) return { ...folderPerm, scope: 'FULL' };

  // 3. Fallback на проект (если scope=FULL)
  const projPerms = await getProjectPermissions(userId, folder.projectId);
  if (projPerms && projPerms.scope === 'FULL') {
    return projPerms;
  }

  // 4. GHOST PATH LOGIC: recursive check — does user have access to ANY descendant?
  if (await hasDescendantAccess(userId, folderId)) {
    return { canView: true, canEdit: false, canDelete: false, canDownload: false, canMarkup: false, isGhost: true };
  }

  return null;
}

/**
 * Рекурсивно проверяет, есть ли у юзера доступ к любому потомку (папке) внутри данной папки.
 * Используется для Ghost Path — чтобы показать промежуточные папки как "контейнеры".
 */
async function hasDescendantAccess(userId, folderId) {
  // Получаем дочерние папки
  const childFolders = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true }
  });

  for (const child of childFolders) {
    // 1. Прямой FolderPermission на дочернюю папку
    const folderPerm = await prisma.folderPermission.findFirst({
      where: { userId, folderId: child.id }
    });
    if (folderPerm) return true;

    // 2. Рекурсия — проверяем потомков этой дочерней папки
    if (await hasDescendantAccess(userId, child.id)) return true;
  }

  return false;
}

/**
 * Получить effective permissions юзера для документа.
 * Документ полностью наследует права своей папки.
 */
async function getDocumentPermissions(userId, documentId) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { role: true }
  });
  
  const defaultNoAccess = { canView: false, canEdit: false, canDelete: false, canDownload: false, canMarkup: false, canManage: false };

  if (!user) return defaultNoAccess;

  if (user.systemRole === 'GENERAL_ADMIN') {
    return { canView: true, canEdit: true, canDelete: true, canDownload: true, canMarkup: true, canManage: true, scope: 'FULL' };
  }

  const doc = await prisma.document.findUnique({ 
    where: { id: documentId, isDeleted: false }, 
    include: { folder: { include: { project: { include: { company: true } } } } } 
  });
  
  if (!doc) return defaultNoAccess;

  if (doc?.folder?.project?.company?.isArchived) {
    return defaultNoAccess;
  }

  // Fallback на папку
  const folderPerms = await getFolderPermissions(userId, doc.folderId);
  if (!folderPerms || folderPerms.isGhost) {
    return defaultNoAccess;
  }
  
  return folderPerms;
}

// Middleware factories
function checkProjectAccess(permission) {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      const perms = await getProjectPermissions(req.user.userId, projectId);
      
      console.log(`[PermissionCheck] User: ${req.user.userId}, Project: ${projectId}, Required: ${permission}, Has: ${perms ? perms[permission] : false}`);

      if (!perms || !perms[permission]) return res.status(403).json({ error: `No ${permission} on project` });
      req.permissions = perms;
      next();
    } catch (error) { res.status(500).json({ error: error.message }); }
  };
}

function checkFolderAccess(permission) {
  return async (req, res, next) => {
    try {
      const folderId = req.params.folderId || req.body.folderId || req.body.parentId;
      if (!folderId) return res.status(400).json({ error: 'No folder context provided for permission check' });
      
      const perms = await getFolderPermissions(req.user.userId, folderId);
      
      console.log(`[PermissionCheck] User: ${req.user.userId}, Folder: ${folderId}, Required: ${permission}, Has: ${perms ? perms[permission] : false}`);

      if (!perms || !perms[permission]) return res.status(403).json({ error: `No ${permission} on folder` });
      req.permissions = perms;
      next();
    } catch (error) { res.status(500).json({ error: error.message }); }
  };
}

function checkDocumentAccess(permission) {
  return async (req, res, next) => {
    try {
      const documentId = req.params.documentId;
      const perms = await getDocumentPermissions(req.user.userId, documentId);
      
      console.log(`[PermissionCheck] User: ${req.user.userId}, Doc: ${documentId}, Required: ${permission}, Has: ${perms ? perms[permission] : false}`);

      if (!perms || !perms[permission]) return res.status(403).json({ error: `No ${permission} on document` });
      req.permissions = perms;
      next();
    } catch (error) { res.status(500).json({ error: error.message }); }
  };
}

module.exports = {
  checkProjectAccess,
  checkFolderAccess,
  checkDocumentAccess,
  getProjectPermissions,
  getFolderPermissions,
  getDocumentPermissions,
};

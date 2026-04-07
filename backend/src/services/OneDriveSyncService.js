const prisma = require('../prismaClient');
const StorageFactory = require('./storage/StorageFactory');

class OneDriveSyncService {
  static async syncCompany(companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.oneDriveConnected) return;

    console.log(`[OneDriveSync] Starting sync for company: ${company.name} (${companyId})`);

    try {
      const storage = await StorageFactory.getProviderForCompany(companyId);
      let currentDeltaLink = company.oneDriveDeltaLink || null;
      let hasMore = true;
      let allChanges = [];

      // 1. Fetch ALL pages of changes
      while (hasMore) {
        const { changes, nextDeltaLink } = await storage.getDelta(currentDeltaLink);
        allChanges = allChanges.concat(changes);
        
        if (nextDeltaLink && nextDeltaLink !== currentDeltaLink) {
          currentDeltaLink = nextDeltaLink;
          // If the link contains 'token=', it's usually the final deltaLink, not a nextLink
          if (nextDeltaLink.includes('token=')) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (allChanges.length > 0) {
        console.log(`[OneDriveSync] Found ${allChanges.length} total changes in OneDrive for ${company.name}`);
        
        // 2. Process changes in multiple passes to handle deep nesting
        let unprocessed = [...allChanges];
        let passes = 0;
        const maxPasses = 10; 

        while (unprocessed.length > 0 && passes < maxPasses) {
          const beforeCount = unprocessed.length;
          const stillUnprocessed = [];

          for (const change of unprocessed) {
            try {
              const success = await this._processChange(change, companyId, company.oneDriveRootItemId);
              if (!success) {
                stillUnprocessed.push(change);
              }
            } catch (err) {
              console.error(`[OneDriveSync] Error processing change ${change.id}:`, err.message);
            }
          }

          unprocessed = stillUnprocessed;
          passes++;
          if (unprocessed.length === beforeCount) break; // No progress made
        }
      }

      // 3. Self-heal: fix OneDrive folders that have parentId=null but should be under their project's Root folder
      await this._fixOrphanedFolders(companyId);

      // 4. Update the delta link for next time
      await prisma.company.update({
        where: { id: companyId },
        data: { oneDriveDeltaLink: currentDeltaLink, oneDriveLastSync: new Date() }
      });

    } catch (err) {
      console.error(`[OneDriveSync] Error syncing company ${companyId}:`, err.message);
    }
  }

  static async _processChange(change, companyId, rootItemId) {
    if (change.id === rootItemId) return true;

    if (change.deleted) {
      await this._handleDeleted(change);
      return true;
    }
    if (change.folder) {
      return await this._handleFolder(change, companyId, rootItemId);
    }
    if (change.file && change.name?.toLowerCase().endsWith('.pdf')) {
      return await this._handleFile(change, companyId, rootItemId);
    }
    return true; 
  }

  static async _handleFolder(change, companyId, rootItemId) {
    // Top-level folders inside Company Root -> map to Project
    if (change.parentReference?.id === rootItemId) {
      const existingProj = await prisma.project.findFirst({ where: { externalId: change.id } });
      if (existingProj) {
        if (existingProj.name !== change.name) {
          await prisma.project.update({ where: { id: existingProj.id }, data: { name: change.name } });
        }
      } else {
        const project = await prisma.project.create({
          data: {
            name: change.name,
            companyId: companyId,
            externalId: change.id,
          }
        });
        await prisma.folder.create({
          data: { name: 'Root', projectId: project.id },
        });
      }
      return true;
    }

    const existing = await prisma.folder.findFirst({ where: { externalId: change.id } });

    if (existing) {
      if (existing.syncSource === 'wise') {
        await prisma.folder.update({ where: { id: existing.id }, data: { syncSource: null } });
        return true;
      }
      let newParentFolder = null;
      if (change.parentReference?.id) {
        newParentFolder = await prisma.folder.findFirst({ where: { externalId: change.parentReference.id } });
        if (!newParentFolder) {
          const newParentProject = await prisma.project.findFirst({ where: { externalId: change.parentReference.id } });
          if (newParentProject) {
            // Resolve to Root folder, stamp externalId so future lookups skip project table
            let rootFolder = await prisma.folder.findFirst({ where: { projectId: newParentProject.id, parentId: null, name: 'Root' } });
            if (!rootFolder) rootFolder = await prisma.folder.create({ data: { name: 'Root', projectId: newParentProject.id } });
            if (!rootFolder.externalId) {
              rootFolder = await prisma.folder.update({ where: { id: rootFolder.id }, data: { externalId: change.parentReference.id }, select: { id: true, projectId: true, externalId: true } });
            }
            newParentFolder = rootFolder;
          }
        }
      }
      await prisma.folder.update({
        where: { id: existing.id },
        data: {
          name: change.name,
          ...(newParentFolder ? { parentId: newParentFolder.id, projectId: newParentFolder.projectId } : {}),
        }
      });
      return true;
    } else {
      let parentFolder = null;
      let parentProject = null;
      if (change.parentReference?.id) {
        parentFolder = await prisma.folder.findFirst({ where: { externalId: change.parentReference.id } });
        if (!parentFolder) {
          parentProject = await prisma.project.findFirst({ where: { externalId: change.parentReference.id } });
        }
      }
      // If parent is a project (not a folder), link to its Root folder and stamp Root's externalId
      if (parentProject && !parentFolder) {
        parentFolder = await prisma.folder.findFirst({
          where: { projectId: parentProject.id, parentId: null, name: 'Root' }
        });
        if (!parentFolder) {
          parentFolder = await prisma.folder.create({ data: { name: 'Root', projectId: parentProject.id } });
        }
        // Stamp the Root folder's externalId so future lookups hit the folder table directly
        if (!parentFolder.externalId) {
          await prisma.folder.update({ where: { id: parentFolder.id }, data: { externalId: change.parentReference.id } });
        }
      }
      if (parentFolder) {
        await prisma.folder.create({
          data: {
            name: change.name,
            externalId: change.id,
            parentId: parentFolder.id,
            projectId: parentFolder.projectId,
            syncSource: 'onedrive',
          }
        });
        return true;
      }
      return false; // Parent not found yet
    }
  }

  static async _handleFile(change, companyId, rootItemId) {
    if (change.parentReference?.id === rootItemId) return true; 

    const existing = await prisma.document.findFirst({ where: { externalId: change.id } });

    if (existing) {
      if (existing.syncSource === 'wise') {
        await prisma.document.update({ where: { id: existing.id }, data: { syncSource: null } });
        return true;
      }
      
      let newFolderId = existing.folderId;
      if (change.parentReference?.id) {
        let parentFolder = await prisma.folder.findFirst({ where: { externalId: change.parentReference.id } });
        if (!parentFolder) {
          const parentProject = await prisma.project.findFirst({ where: { externalId: change.parentReference.id } });
          if (parentProject) {
            parentFolder = await prisma.folder.findFirst({ where: { projectId: parentProject.id, parentId: null, name: 'Root' } });
            if (!parentFolder) parentFolder = await prisma.folder.create({ data: { name: 'Root', projectId: parentProject.id } });
            if (parentFolder && !parentFolder.externalId) {
              await prisma.folder.update({ where: { id: parentFolder.id }, data: { externalId: change.parentReference.id } });
            }
          }
        }
        if (parentFolder) newFolderId = parentFolder.id;
        else return false; // Parent not found yet
      }

      const { baseName } = this._parseVersionedName(change.name);
      await prisma.document.update({
        where: { id: existing.id },
        data: { name: baseName, folderId: newFolderId }
      });
      return true;
    } else {
      let parentFolder = null;
      let parentProject = null;
      if (change.parentReference?.id) {
        parentFolder = await prisma.folder.findFirst({ where: { externalId: change.parentReference.id } });
        if (!parentFolder) {
          parentProject = await prisma.project.findFirst({ where: { externalId: change.parentReference.id } });
        }
      }
      
      if (parentProject && !parentFolder) {
        parentFolder = await prisma.folder.findFirst({ where: { projectId: parentProject.id, parentId: null, name: 'Root' } });
        if (!parentFolder) parentFolder = await prisma.folder.create({ data: { name: 'Root', projectId: parentProject.id } });
      }

      if (parentFolder) {
        const { baseName, version } = this._parseVersionedName(change.name);
        await prisma.document.create({
          data: {
            name: baseName,
            storageUrl: change.id,
            externalId: change.id,
            version,
            isLatest: true,
            folderId: parentFolder.id,
            syncSource: 'onedrive',
          }
        });
        return true;
      }
      return false; // Parent not found yet
    }
  }

  static async _handleDeleted(change) {
    const folder = await prisma.folder.findFirst({ where: { externalId: change.id } });
    if (folder) {
      // Cascade soft-delete all descendant folders and documents
      const allFolders = await prisma.folder.findMany({ where: { projectId: folder.projectId, isDeleted: false } });
      const toDelete = new Set();
      const stack = [folder.id];
      while (stack.length > 0) {
        const id = stack.pop();
        toDelete.add(id);
        for (const f of allFolders) {
          if (f.parentId === id && !toDelete.has(f.id)) stack.push(f.id);
        }
      }
      await prisma.folder.updateMany({ where: { id: { in: [...toDelete] } }, data: { isDeleted: true } });
      await prisma.document.updateMany({ where: { folderId: { in: [...toDelete] } }, data: { isDeleted: true } });
      return;
    }
    const doc = await prisma.document.findFirst({ where: { externalId: change.id } });
    if (doc) {
      await prisma.document.update({ where: { id: doc.id }, data: { isDeleted: true } });
      return;
    }
    const proj = await prisma.project.findFirst({ where: { externalId: change.id } });
    if (proj) {
      await prisma.project.update({ where: { id: proj.id }, data: { isDeleted: true } });
      await prisma.folder.updateMany({ where: { projectId: proj.id }, data: { isDeleted: true } });
      await prisma.document.updateMany({ where: { folder: { projectId: proj.id } } , data: { isDeleted: true } });
    }
  }

  static _parseVersionedName(fileName) {
    const match = fileName.match(/^(.+)_v(\d+)(\.\w+)$/);
    if (match) {
      return { baseName: match[1] + match[3], version: parseInt(match[2]) };
    }
    return { baseName: fileName, version: 1 };
  }

  // Fix folders synced from OneDrive that ended up with parentId=null (should be under Root)
  static async _fixOrphanedFolders(companyId) {
    const projects = await prisma.project.findMany({
      where: { companyId, isDeleted: false, externalId: { not: null } },
      select: { id: true }
    });
    for (const proj of projects) {
      const rootFolder = await prisma.folder.findFirst({
        where: { projectId: proj.id, parentId: null, name: 'Root' }
      });
      if (!rootFolder) continue;
      // Find OneDrive-synced folders with no parent that are NOT the Root folder itself
      const orphaned = await prisma.folder.findMany({
        where: { projectId: proj.id, parentId: null, isDeleted: false, syncSource: 'onedrive', id: { not: rootFolder.id } }
      });
      if (orphaned.length > 0) {
        console.log(`[OneDriveSync] Fixing ${orphaned.length} orphaned folders in project ${proj.id}`);
        await prisma.folder.updateMany({
          where: { id: { in: orphaned.map(f => f.id) } },
          data: { parentId: rootFolder.id }
        });
      }
    }
  }

  static async syncAllCompanies() {
    const companies = await prisma.company.findMany({
      where: { oneDriveConnected: true, isArchived: false },
      select: { id: true, name: true }
    });

    // Parallel sync with concurrency limit (e.g., 3 companies at a time)
    const concurrency = 3;
    for (let i = 0; i < companies.length; i += concurrency) {
      const batch = companies.slice(i, i + concurrency);
      await Promise.all(batch.map(company => 
        OneDriveSyncService.syncCompany(company.id)
          .catch(err => console.error(`[Sync Turbo] Error syncing ${company.name}:`, err.message))
      ));
      // Give some breathing room to the event loop between batches
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

module.exports = OneDriveSyncService;

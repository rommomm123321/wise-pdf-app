const GoogleDriveProvider = require('./GoogleDriveProvider');
const LocalStorageProvider = require('./LocalStorageProvider');

class StorageFactory {
  static getProvider(companyId = null) {
    const storageType = (process.env.STORAGE_TYPE || process.env.STORAGE_PROVIDER || 'local').toLowerCase();

    if (storageType === 'onedrive') {
      const OneDriveProvider = require('./OneDriveProvider');
      if (!companyId) throw new Error('companyId required for OneDrive provider');
      return new OneDriveProvider(companyId);
    }
    if (storageType === 'google' || storageType === 'google_drive') {
      return new GoogleDriveProvider();
    }
    return new LocalStorageProvider();
  }

  // Get provider for a company, auto-detecting if OneDrive is connected
  static async getProviderForCompany(companyId) {
    if (!companyId) return new LocalStorageProvider();
    try {
      const prisma = require('../../prismaClient');
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { oneDriveConnected: true } });
      if (company?.oneDriveConnected) {
        const OneDriveProvider = require('./OneDriveProvider');
        return new OneDriveProvider(companyId);
      }
    } catch (e) { /* fallthrough to local */ }
    return StorageFactory.getProvider();
  }
}

module.exports = StorageFactory;

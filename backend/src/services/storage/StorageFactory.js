const GoogleDriveProvider = require('./GoogleDriveProvider');
const LocalStorageProvider = require('./LocalStorageProvider');

class StorageFactory {
  static getProvider() {
    // Поддерживаем разные варианты имен переменных для удобства
    const storageType = (process.env.STORAGE_TYPE || process.env.STORAGE_PROVIDER || 'local').toLowerCase();

    if (storageType === 'google' || storageType === 'google_drive') {
      return new GoogleDriveProvider();
    } else if (storageType === 'local') {
      return new LocalStorageProvider();
    } else if (storageType === 's3') {
      throw new Error('S3 provider is not implemented yet');
    } else {
      throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }
}

module.exports = StorageFactory;
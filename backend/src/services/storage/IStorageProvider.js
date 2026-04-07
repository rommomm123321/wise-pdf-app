class IStorageProvider {
  async uploadFile(fileData, fileName, mimeType, parentFolderId = null) {
    throw new Error('Method "uploadFile()" must be implemented.');
  }
  async downloadFile(fileId) {
    throw new Error('Method "downloadFile()" must be implemented.');
  }
  async deleteFile(fileId) {
    throw new Error('Method "deleteFile()" must be implemented.');
  }
  async getFileUrl(fileId) {
    throw new Error('Method "getFileUrl()" must be implemented.');
  }
  async createFolder(name, parentFolderId) {
    return null;
  }
  async deleteFolder(folderId) {
    return true;
  }
  async renameItem(itemId, newName) {
    return true;
  }
  async moveItem(itemId, newParentId) {
    return true;
  }
}
module.exports = IStorageProvider;

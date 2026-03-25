/**
 * Интерфейс IStorageProvider
 * 
 * Все классы, работающие с хранилищем файлов (Google Drive, S3, Local),
 * должны реализовывать этот контракт. Это гарантирует, что остальной код
 * не зависит от конкретного провайдера облака (SOLID: Dependency Inversion).
 */
class IStorageProvider {
  /**
   * Загружает файл в облако.
   * @param {Buffer|Stream} fileData Данные файла
   * @param {string} fileName Имя файла
   * @param {string} mimeType Тип файла (например, 'application/pdf')
   * @returns {Promise<string>} Уникальный идентификатор файла (URL или ID)
   */
  async uploadFile(fileData, fileName, mimeType) {
    throw new Error('Method "uploadFile()" must be implemented.');
  }

  /**
   * Удаляет файл из облака.
   * @param {string} fileId Уникальный идентификатор файла
   * @returns {Promise<boolean>} Результат удаления
   */
  async deleteFile(fileId) {
    throw new Error('Method "deleteFile()" must be implemented.');
  }

  /**
   * Получает ссылку для скачивания или просмотра файла.
   * @param {string} fileId Уникальный идентификатор файла
   * @returns {Promise<string>} URL для доступа к файлу
   */
  async getFileUrl(fileId) {
    throw new Error('Method "getFileUrl()" must be implemented.');
  }
}

module.exports = IStorageProvider;
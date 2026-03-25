const IStorageProvider = require('./IStorageProvider');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Реализация провайдера для локального хранилища.
 * Файлы будут сохраняться в папке uploads/ на сервере.
 */
class LocalStorageProvider extends IStorageProvider {
  constructor() {
    super();
    // Определяем папку загрузок (например, backend/uploads)
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    
    // Создаем папку, если ее нет
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      // Генерируем уникальное имя файла, чтобы избежать конфликтов
      const ext = path.extname(fileName) || '.pdf';
      const uniqueFileName = `${uuidv4()}${ext}`;
      const filePath = path.join(this.uploadDir, uniqueFileName);

      // Сохраняем файл на диск
      fs.writeFileSync(filePath, fileBuffer);
      
      console.log(`[Storage] Файл сохранен локально: ${uniqueFileName}`);
      return uniqueFileName; // Возвращаем имя файла как ID
    } catch (error) {
      console.error('[Storage] Ошибка сохранения локального файла:', error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      const filePath = path.join(this.uploadDir, fileId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Storage] Ошибка удаления локального файла ${fileId}:`, error);
      return false;
    }
  }

  async getFileUrl(fileId) {
    // В локальном хранилище мы возвращаем относительный URL, 
    // который будет обрабатываться нашим Express-сервером.
    return `/uploads/${fileId}`;
  }
}

module.exports = LocalStorageProvider;
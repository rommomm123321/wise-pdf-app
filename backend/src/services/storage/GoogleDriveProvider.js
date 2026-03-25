const { google } = require("googleapis");
const stream = require("stream");
const IStorageProvider = require("./IStorageProvider");
const fs = require("fs");
const path = require("path");

/**
 * Реализация провайдера хранилища для Google Drive (или Cloud Storage).
 */
class GoogleDriveProvider extends IStorageProvider {
  constructor() {
    super();
    this.drive = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Папка, куда будут падать все PDF
  }

  // Ленивая инициализация клиента Google Drive
  async initClient() {
    if (this.drive) return this.drive;

    try {
      // Здесь предполагается, что мы используем Service Account JSON
      const credsPath = process.env.GOOGLE_STORAGE_CREDENTIALS_JSON_PATH;
      const fullPath = path.resolve(
        process.cwd(),
        credsPath || "./google-creds.json",
      );

      if (!fs.existsSync(fullPath)) {
        console.warn(
          `[Storage] ⚠️ Google Service Account JSON не найден по пути: ${fullPath}`,
        );
        return null; // В Dev-режиме просто возвращаем null, чтобы сервер не падал
      }

      const impersonateEmail = process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL;

      if (impersonateEmail) {
        // Impersonation: SA действует от имени реального пользователя (нужен domain-wide delegation)
        const credentials = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const jwtClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ["https://www.googleapis.com/auth/drive"],
          subject: impersonateEmail,
        });
        this.drive = google.drive({ version: "v3", auth: jwtClient });
        console.log(`[Storage] Impersonating user: ${impersonateEmail}`);
      } else {
        // Обычный SA — работает только с Shared Drives
        const auth = new google.auth.GoogleAuth({
          keyFile: fullPath,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        this.drive = google.drive({ version: "v3", auth });
        console.log("[Storage] Using Service Account directly (Shared Drive required)");
      }
      return this.drive;
    } catch (error) {
      console.error(
        "[Storage] Ошибка инициализации Google Drive клиента:",
        error,
      );
      return null;
    }
  }

  async uploadFile(fileBuffer, fileName, mimeType) {
    const drive = await this.initClient();
    if (!drive) throw new Error("Google Drive client not initialized.");

    // 1. Проверяем папку и определяем driveId (для Shared Drives)
    let driveId = null;
    try {
      const folderCheck = await drive.files.get({
        fileId: this.folderId,
        fields: "id, name, driveId",
        supportsAllDrives: true,
      });
      driveId = folderCheck.data.driveId || null;
      console.log(
        `[Storage] Папка найдена: "${folderCheck.data.name}"`,
        driveId ? `(Shared Drive: ${driveId})` : "(My Drive)",
      );
    } catch (e) {
      console.error(
        "[Storage] КРИТИЧЕСКАЯ ОШИБКА: Сервис-аккаунт не видит папку!",
        e.message,
      );
      throw new Error("Target folder not accessible: " + e.message);
    }

    // 2. Конвертируем Buffer в Stream
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const fileMetadata = {
      name: fileName,
      parents: this.folderId ? [this.folderId] : [],
    };
    const media = {
      mimeType: mimeType,
      body: bufferStream,
    };

    // 3. Создаём файл — для Shared Drives НЕ используем keepRevisionForever
    try {
      const createParams = {
        requestBody: fileMetadata,
        media: media,
        fields: "id",
        supportsAllDrives: true,
      };
      // Если папка на Shared Drive — указываем driveId
      if (driveId) {
        createParams.driveId = driveId;
      }

      const file = await drive.files.create(createParams);
      console.log(
        `[Storage] Файл "${fileName}" загружен. ID: ${file.data.id}`,
      );
      return file.data.id;
    } catch (error) {
      console.error("[Storage] Ошибка загрузки файла:", error.message || error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    const drive = await this.initClient();
    if (!drive) return false;

    try {
      await drive.files.delete({ fileId, supportsAllDrives: true });
      return true;
    } catch (error) {
      console.error(`[Storage] Ошибка удаления файла ${fileId}:`, error);
      return false;
    }
  }

  async getFileUrl(fileId) {
    // Вместо ссылки возвращаем внутренний ID, чтобы потом проксировать через наш сервер
    return fileId;
  }

  async downloadFile(fileId) {
    const drive = await this.initClient();
    if (!drive) throw new Error("Drive client not initialized");

    try {
      const response = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream" },
      );
      return response.data;
    } catch (error) {
      console.error(`[Storage] Error downloading from Drive: ${fileId}`, error);
      throw error;
    }
  }
}

module.exports = GoogleDriveProvider;

# Техническое задание: Revit Plugin для WISE PDF Viewer

## Обзор

Плагин для Autodesk Revit, который позволяет:
1. Экспортировать текущий вид/лист как PDF
2. Выгружать PDF напрямую на сервер WISE PDF Viewer
3. Назначать ревьюера для проверки
4. Получать уведомления о результатах проверки
5. Сохранять настройки (пресеты) для one-click upload

## Технический стек

- **Язык**: C# (.NET Framework 4.8 для Revit 2023-2025, .NET 8 для Revit 2026+)
- **UI Framework**: WPF (XAML) или WinForms
- **HTTP Client**: `HttpClient` / `RestSharp`
- **WebSocket**: `System.Net.WebSockets.ClientWebSocket` (для real-time уведомлений)
- **Revit API**: `Autodesk.Revit.DB`, `Autodesk.Revit.UI`

---

## API Endpoints

### Базовый URL
```
https://<server-domain>/api/revit
```

### 1. Аутентификация

```http
POST /api/revit/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "<apiPassword>"   // 32-char hex из настроек пользователя
}

Response 200:
{
  "token": "<JWT>",             // 30-дневный токен
  "user": { "id": "...", "name": "...", "email": "...", "role": "..." }
}
```

**apiPassword** генерируется автоматически при создании пользователя. Администратор может просмотреть/скопировать его в настройках пользователя на сайте (User Detail → API Access).

### 2. Получить текущего пользователя

```http
GET /api/revit/me
Authorization: Bearer <token>

Response 200:
{
  "id": "...",
  "name": "...",
  "email": "...",
  "role": "GENERAL_ADMIN" | "COMPANY_ADMIN" | "USER"
}
```

### 3. Список проектов

```http
GET /api/revit/projects
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "name": "Project Name",
    "company": { "id": "...", "name": "..." }
  }
]
```

### 4. Дерево папок проекта

```http
GET /api/revit/projects/:projectId/folders
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "name": "Folder Name",
    "parentId": null | "uuid",
    "children": [ ... ]         // рекурсивное дерево
  }
]
```

### 5. Список пользователей проекта (для назначения ревьюера)

```http
GET /api/revit/projects/:projectId/users
Authorization: Bearer <token>

Response 200:
[
  { "id": "uuid", "name": "John Doe", "email": "john@company.com" }
]
```

### 6. Создать папку

```http
POST /api/revit/projects/:projectId/folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Folder",
  "parentId": "uuid" | null     // null = корень проекта
}

Response 201:
{ "id": "uuid", "name": "New Folder", "parentId": "..." }
```

### 7. Upload PDF + Assign Reviewer (ONE-CLICK)

```http
POST /api/revit/folders/:folderId/upload-and-assign
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  file        — PDF файл (обязательно, до 500MB)
  reviewerId  — UUID пользователя-ревьюера (опционально)
  comment     — комментарий к заданию (опционально)

Response 201:
{
  "status": "ok",
  "data": {
    "id": "uuid",               // ID документа
    "name": "drawing.pdf",
    "version": 1,
    "folderId": "uuid",
    "assignmentId": "uuid"      // ID назначения (null если reviewerId не указан)
  }
}
```

**Auto-versioning**: если файл с таким именем уже существует в папке, версия автоматически увеличивается (v1 → v2 → v3).

### 8. Upload Presets (сохранённые настройки)

```http
# Список пресетов
GET /api/revit/upload-presets
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "name": "Main Project Upload",
    "projectId": "uuid",
    "folderId": "uuid",
    "assignToId": "uuid" | null,
    "isDefault": true
  }
]

# Создать пресет
POST /api/revit/upload-presets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Preset",
  "projectId": "uuid",
  "folderId": "uuid",
  "assignToId": "uuid",         // опционально
  "isDefault": true              // опционально
}
```

### 9. Ответить на назначение (из Revit)

```http
PATCH /api/revit/notifications/:notificationId/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "has_markups" | "approved",
  "comment": "Optional comment"  // опционально
}

// "has_markups" — есть замечания, нужно исправить
// "approved"    — всё OK, готово к печати
```

### 10. Получить уведомления

```http
GET /api/notifications
Authorization: Bearer <token>

Response 200:
[
  {
    "id": "uuid",
    "type": "review_request" | "review_approved" | "review_rejected" | "mention",
    "actorId": "uuid",
    "actor": { "id": "...", "name": "...", "email": "..." },
    "documentId": "uuid",
    "documentName": "drawing.pdf",
    "assignmentId": "uuid",
    "message": "Please review this drawing",
    "read": false,
    "createdAt": "2026-04-13T12:00:00.000Z"
  }
]
```

---

## Архитектура плагина

### Модули

```
RevitWISE PDF ViewerPlugin/
├── Commands/
│   ├── LoginCommand.cs          // IExternalCommand — кнопка авторизации
│   ├── UploadCommand.cs         // IExternalCommand — экспорт + upload
│   └── NotificationsCommand.cs  // IExternalCommand — панель уведомлений
├── Services/
│   ├── AuthService.cs           // login, token storage, token refresh
│   ├── ApiService.cs            // HTTP клиент, все API вызовы
│   ├── PdfExportService.cs      // Revit → PDF через ViewSheet.Export
│   ├── PresetService.cs         // управление upload presets (local + server)
│   └── NotificationService.cs   // polling /api/notifications каждые 30 сек
├── UI/
│   ├── LoginWindow.xaml         // WPF окно авторизации
│   ├── UploadWindow.xaml        // WPF окно upload (folder tree + reviewer + preset)
│   ├── NotificationPanel.xaml   // WPF dockable panel для уведомлений
│   └── SettingsWindow.xaml      // Настройки (сервер URL, интервал polling)
├── Models/
│   ├── Project.cs
│   ├── Folder.cs
│   ├── UserInfo.cs
│   ├── UploadPreset.cs
│   └── Notification.cs
└── Plugin.addin                 // Revit manifest
```

### Workflow

```
1. ПЕРВЫЙ ЗАПУСК
   └─ Пользователь нажимает "Login" в Revit ribbon
   └─ Вводит email + API password
   └─ AuthService сохраняет token в Windows Credential Manager
   └─ Загружает projects/folders/presets в background

2. UPLOAD (каждый раз)
   └─ Пользователь нажимает "Upload to WISE PDF Viewer" в ribbon
   └─ Если есть default preset:
   │   └─ Показывает compact окно: "Upload [filename] to [folder]? Reviewer: [name]. [Upload] [Settings]"
   │   └─ Один клик → экспорт PDF → upload → assign → done
   └─ Если нет preset:
   │   └─ Показывает full окно с folder tree + reviewer dropdown + save preset checkbox
   │   └─ Пользователь выбирает → "Upload & Assign"
   └─ PdfExportService:
   │   └─ Revit API: doc.Export(folder, views, pdfOptions)
   │   └─ Генерирует PDF из текущего View/Sheet
   └─ ApiService:
       └─ POST /api/revit/folders/:id/upload-and-assign (multipart)
       └─ Показывает toast "Uploaded successfully. [Reviewer] will be notified."

3. УВЕДОМЛЕНИЯ
   └─ NotificationService polling каждые 30 сек GET /api/notifications
   └─ Новое уведомление → Revit TaskDialog:
   │   └─ "review_request": "[Name] assigned you to review [document]"
   │   │   └─ Кнопки: [Open in Browser] [Dismiss]
   │   └─ "review_approved": "[Name] approved [document] — ready to print"
   │   └─ "review_rejected": "[Name] found issues in [document]"
   │       └─ Кнопки: [Open in Browser] [Dismiss]
   └─ Настройки уведомлений:
       └─ В User Settings на сайте (preferences JSON):
           inApp: true/false (уведомления на сайте)
           inRevit: true/false (polling в Revit)
           inTeams: true/false (Microsoft Teams Adaptive Cards)
           teamsWebhookUrl: "https://..." (Teams Incoming Webhook)
```

### Хранение токена

```csharp
// Windows Credential Manager — безопасно, переживает перезагрузку
using System.Security.Cryptography;
using System.Runtime.InteropServices;

CredentialManager.Save("WISE PDF ViewerAPI", email, token);
var cred = CredentialManager.Load("WISE PDF ViewerAPI");
```

### PDF Export из Revit

```csharp
// Revit API: экспорт текущего вида как PDF
var options = new PDFExportOptions {
    FileName = sheetName,
    ExportRange = ExportRange.CurrentView,  // или SetOfViews
    ColorDepth = ColorDepthType.Color,
    RasterQuality = RasterQualityType.High,
    PaperFormat = ExportPaperFormat.Default,
    // ZoomType = ZoomType.Zoom, ZoomPercentage = 100
};

doc.Export(tempFolder, new List<ElementId> { viewSheet.Id }, options);
// Результат: tempFolder/sheetName.pdf
```

### Upload с Progress

```csharp
using var content = new MultipartFormDataContent();
using var fileStream = File.OpenRead(pdfPath);
var streamContent = new StreamContent(fileStream);
streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
content.Add(streamContent, "file", Path.GetFileName(pdfPath));
if (!string.IsNullOrEmpty(reviewerId))
    content.Add(new StringContent(reviewerId), "reviewerId");
if (!string.IsNullOrEmpty(comment))
    content.Add(new StringContent(comment), "comment");

var response = await _httpClient.PostAsync(
    $"{BaseUrl}/api/revit/folders/{folderId}/upload-and-assign",
    content
);
```

---

## UI в Revit

### Ribbon Tab

```
[WISE PDF Viewer] tab in Revit ribbon:
┌─────────────────────────────────────────────────────┐
│  [🔐 Login]  [📤 Upload]  [🔔 Notifications (3)]  [⚙️]  │
└─────────────────────────────────────────────────────┘
```

### Upload Window (compact mode — has preset)

```
┌───────────────────────────────────────┐
│  Upload to WISE PDF Viewer                   │
│                                       │
│  File: A101 - Floor Plan.pdf          │
│  Folder: Main Project / Drawings      │
│  Reviewer: John Doe                   │
│  Comment: [_________________]         │
│                                       │
│  [Upload]              [⚙️ Settings]  │
└───────────────────────────────────────┘
```

### Upload Window (full mode — no preset)

```
┌───────────────────────────────────────────────┐
│  Upload to WISE PDF Viewer                           │
│                                               │
│  Project: [▼ Select project          ]        │
│                                               │
│  Folder:                                      │
│  ├ 📁 Drawings                                │
│  │  ├ 📁 Architectural  ← selected           │
│  │  ├ 📁 Structural                           │
│  │  └ 📁 MEP                                  │
│  └ 📁 Submittals                              │
│  [+ New Folder]                               │
│                                               │
│  Assign to: [▼ Select reviewer       ]        │
│  Comment:   [________________________]        │
│                                               │
│  ☑ Save as preset: [My Upload Config ]        │
│  ☑ Set as default                             │
│                                               │
│  [Upload & Assign]              [Cancel]      │
└───────────────────────────────────────────────┘
```

### Notification Toast (Revit TaskDialog)

```
┌───────────────────────────────────────┐
│  📋 Review Assignment                 │
│                                       │
│  John Doe assigned you to review:     │
│  "A101 - Floor Plan.pdf"             │
│                                       │
│  Comment: "Please check MEP coords"  │
│                                       │
│  [Open in Browser]        [Dismiss]   │
└───────────────────────────────────────┘
```

---

## Настройки уведомлений (User Preferences)

В `User.preferences` (JSON) на сервере:

```json
{
  "notifications": {
    "inApp": true,        // уведомления на сайте (панель колокольчика)
    "inRevit": true,      // уведомления в Revit (TaskDialog popup)
    "emailDigest": false  // email дайджест (future)
  }
}
```

API для обновления:
```http
PATCH /api/users/me/preferences
Authorization: Bearer <token>
Content-Type: application/json

{ "notifications": { "inRevit": false } }
```

---

## Безопасность

1. **API Password** — 32-char hex, не пароль пользователя. Можно регенерировать без смены основного пароля.
2. **JWT Token** — 30 дней, HttpOnly. Хранится в Windows Credential Manager.
3. **File validation** — только `.pdf`, `.rvt`, `.dwg`, `.ifc`, `.nwd`. Макс 500MB.
4. **Permission check** — upload проверяет `canUpload` на уровне папки/проекта.
5. **HTTPS** — все запросы через TLS.

---

## Порядок разработки

1. **AuthService + LoginWindow** — авторизация, сохранение токена
2. **ApiService** — базовый HTTP клиент с auth header
3. **PdfExportService** — Revit → PDF (один вид или набор листов)
4. **UploadWindow (full)** — folder tree, reviewer, upload
5. **PresetService** — save/load presets, default preset
6. **UploadWindow (compact)** — one-click с preset
7. **NotificationService** — polling + TaskDialog
8. **Ribbon integration** — кнопки, иконки, tooltip
9. **Settings** — server URL, polling interval, notification prefs

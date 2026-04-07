# Revit Plugin Integration API

## Overview

The Redlines platform provides a REST API for external integrations including Autodesk Revit plugins, AutoCAD scripts, and any other desktop application that needs to upload documents programmatically.

**Base URL:** `https://your-domain.com/api/revit`

---

## Authentication

### Step 1: Get API Credentials

Each user has an **API Password** generated automatically on first login.

**Admin can view/copy credentials:**
1. Go to **Users** page in web admin
2. Click on a user to open their detail dialog
3. Find **API Password** section (visible to admins only)
4. Copy the email + password pair
5. Give credentials to the user for their Revit plugin

**Admin can regenerate password:**
```
POST /api/users/:userId/api-password/regenerate
Authorization: Bearer <admin_session_token>

Response: { "status": "ok", "data": { "email": "user@example.com", "apiPassword": "a1b2c3d4e5f6..." } }
```

### Step 2: Login from Revit Plugin

```http
POST /api/revit/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "<api_password>"
}

Response:
{
  "api_token": "<30-day JWT token>",
  "user": { "id": "...", "email": "user@example.com", "name": "John" }
}
```

The `api_token` is valid for **30 days**. Store it locally in the Revit plugin.

### Using the Token

All subsequent requests must include:
```
Authorization: Bearer <api_token>
```

### Verify Token

```http
GET /api/revit/me
Authorization: Bearer <api_token>

Response: { "status": "ok", "data": { "id": "...", "email": "...", "name": "...", "companyId": "..." } }
```

---

## API Endpoints

### List Projects

```http
GET /api/revit/projects
Authorization: Bearer <api_token>

Response:
{
  "status": "ok",
  "data": [
    { "id": "proj-uuid-1", "name": "Building A", "description": "..." },
    { "id": "proj-uuid-2", "name": "Building B", "description": "..." }
  ]
}
```

Returns only projects the user has access to (based on role and assignments).

---

### Get Folder Tree

```http
GET /api/revit/projects/:projectId/folders
Authorization: Bearer <api_token>

Response:
{
  "status": "ok",
  "data": [
    { "id": "folder-uuid-1", "name": "Architectural", "parentId": null, "isGhost": false },
    { "id": "folder-uuid-2", "name": "Structural", "parentId": null, "isGhost": false },
    { "id": "folder-uuid-3", "name": "Floor Plans", "parentId": "folder-uuid-1", "isGhost": false }
  ]
}
```

**`parentId: null`** = root folder  
**`isGhost: true`** = folder visible only because user has access to a child folder (not directly accessible)

---

### Create Folder

```http
POST /api/folders
Authorization: Bearer <api_token>
Content-Type: application/json

{
  "name": "New Folder",
  "parentId": "parent-folder-uuid"
}

// OR create root folder in project:
{
  "name": "New Folder",
  "projectId": "project-uuid"
}

Response: { "status": "ok", "data": { "id": "new-folder-uuid", "name": "New Folder", ... } }
```

Requires `canEdit` permission on the parent folder or project.

---

### Upload Document

```http
POST /api/revit/folders/:folderId/upload
Authorization: Bearer <api_token>
Content-Type: multipart/form-data

Form fields:
  file     — The file to upload (required, max 500MB)
  version  — Version number (optional, auto-increments)
  comment  — Version comment (optional)

Supported formats: .pdf, .rvt, .dwg, .ifc, .nwd

Response:
{
  "status": "ok",
  "data": {
    "id": "doc-uuid",
    "name": "floorplan.pdf",
    "version": 2,
    "folderId": "folder-uuid"
  }
}
```

**Auto-versioning:** If a file with the same name already exists in the folder, the system automatically:
1. Marks the old version as `isLatest: false`
2. Creates the new version with incremented version number
3. The web app shows version history with all revisions

**Permission required:** `canUpload` (default `true` for all roles, admin can disable per user/folder)

---

## Permissions

### Upload Permission (`canUpload`)

A new permission flag controls who can upload files:

| Level | Where it's set |
|-------|---------------|
| **Role default** | `defaultCanUpload` on the Role model (default: `true`) |
| **Project assignment** | `canUpload` on ProjectAssignment |
| **Folder override** | `canUpload` on FolderPermission |

Admin can disable upload for specific users/roles via the web UI permissions panel.

### Permission Hierarchy

1. `GENERAL_ADMIN` — always has full upload access
2. Company Admin — full access within company projects  
3. Project assignment `canUpload` — explicitly set per project
4. Folder permission `canUpload` — folder-level override

---

## Revit Plugin Flow (C# Example)

```csharp
// 1. Login (first time or when token expires)
var loginResponse = await httpClient.PostAsJsonAsync(
    "https://your-domain.com/api/revit/auth/login",
    new { email = "user@example.com", password = apiPassword }
);
var loginData = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
string apiToken = loginData.api_token;

// 2. Store token for future requests
httpClient.DefaultRequestHeaders.Authorization = 
    new AuthenticationHeaderValue("Bearer", apiToken);

// 3. List projects
var projects = await httpClient.GetFromJsonAsync<ProjectsResponse>(
    "https://your-domain.com/api/revit/projects"
);

// 4. Get folders for selected project
var folders = await httpClient.GetFromJsonAsync<FoldersResponse>(
    $"https://your-domain.com/api/revit/projects/{projectId}/folders"
);

// 5. Upload selected sheets as PDF
foreach (var sheet in selectedSheets)
{
    var pdfPath = ExportSheetToPdf(sheet);
    
    using var form = new MultipartFormDataContent();
    form.Add(new StreamContent(File.OpenRead(pdfPath)), "file", sheet.Name + ".pdf");
    form.Add(new StringContent("Exported from Revit"), "comment");
    
    var uploadResponse = await httpClient.PostAsync(
        $"https://your-domain.com/api/revit/folders/{folderId}/upload",
        form
    );
    
    var result = await uploadResponse.Content.ReadFromJsonAsync<UploadResponse>();
    Console.WriteLine($"Uploaded: {result.data.name} v{result.data.version}");
}
```

---

## Error Responses

All errors follow this format:
```json
{ "error": "Error description" }
```

| Status | Meaning |
|--------|---------|
| 400 | Missing required fields |
| 401 | No token provided |
| 403 | Invalid token, expired, or insufficient permissions |
| 404 | Resource not found (user, folder, document) |
| 413 | File too large (max 500MB) |
| 500 | Server error |

---

## Rate Limits

Currently no rate limits are enforced. For production deployments, consider adding rate limiting at the reverse proxy level (nginx/CloudFlare).

---

## Admin API: Manage API Passwords

### View User's API Password
```http
GET /api/users/:userId/api-password
Authorization: Bearer <admin_session_token>

Response: { "status": "ok", "data": { "email": "user@example.com", "apiPassword": "a1b2c3d4e5f6..." } }
```

### Regenerate API Password
```http
POST /api/users/:userId/api-password/regenerate
Authorization: Bearer <admin_session_token>

Response: { "status": "ok", "data": { "email": "user@example.com", "apiPassword": "<new_password>" } }
```

Both endpoints require admin role (`GENERAL_ADMIN` or company `Admin`).

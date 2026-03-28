# REDLINES — Full Project Context
> Last updated: 2026-03-29
> Read this file at the start of every new session to be fully up to speed.

---

## 1. What is Redlines?

A **collaborative PDF review & markup platform** (like Bluebeam Revu, but web-based).
Users open PDFs, draw annotations (markups), collaborate in real-time, leave comments, manage versions, control access per folder/project.

**Tech stack:**
| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, MUI v5, react-pdf (pdfjs-dist), Fabric.js, Y.js, react-hot-toast |
| Backend | Node.js + Express, Prisma ORM, PostgreSQL |
| Real-time | Socket.io (markup sync, cursors) + Y.js WebSocket (CRDT sync) |
| Storage | Pluggable: `LocalStorageProvider` (default, `/uploads/`), `GoogleDriveProvider`, S3-compatible |
| Auth | JWT + Google OAuth2 |

**Monorepo layout:**
```
redlines/
  backend/          # Express API + Prisma + Socket.io
    server.js       # entry point — HTTP + Socket.io + Y.js WS
    src/
      controllers/  # DocumentController, FolderController, MarkupController, …
      routes/       # documentRoutes, folderRoutes, markupRoutes, …
      middlewares/  # authMiddleware, permissionMiddleware
      services/
        storage/    # StorageFactory, LocalStorageProvider, GoogleDriveProvider
        auditService.js
        notificationService.js
      socketHandlers.js   # Socket.io markup events
      yjsServer.js        # Y.js CRDT persistence
      prismaClient.js
    prisma/
      schema.prisma
  frontend/
    src/
      pages/        # ProjectPage, DocumentViewPage, UsersPage, …
      components/
        pdf/        # MarkupLayer, PdfToolbar, PdfSidebar, MarkupListItem, MarkupPropertiesPanel
        filemanager/# DocumentCard, DocumentRow, ReplaceDocumentDialog, …
        layout/     # AppHeader, NotificationBell
        users/      # InviteDialog, AddUserDialog, SelectiveAccessDialog
      hooks/        # useMarkups, useFolderContents, useNotifications, …
      utils/        # exportPdfWithMarkups.ts, importAnnotationsFromPdf.ts
      contexts/     # AuthContext, ThemeContext
      router.tsx
```

---

## 2. Database Schema (Prisma)

```
Company  →  User (many)
         →  Project (many)
         →  Role (many)
         →  Invitation (many)
         →  CompanyTag (many)
         →  MarkupPropertyPreset (many)

User     →  ProjectAssignment (many)  — permissions per project
         →  FolderPermission (many)   — permissions per folder (override)
         →  Markup (many)
         →  Notification (many, sent & received)

Project  →  Folder (many, tree via parentId)
         →  ProjectAssignment (many)
         →  Role ("ProjectRoles", many)
         →  ProjectMarkupField (many)

Folder   →  Folder (children, self-relation)
         →  Document (many)
         →  FolderPermission (many)

Document →  Markup (many)
           Fields: id, name, storageUrl, version(Int), isLatest(Bool), scale, folderId, isDeleted

Markup   →  coordinates: Json   ← normalized 0–1 coords relative to page
           →  properties: Json   ← stroke, fill, fontSize, text, arrowStyle, …
           →  type: String       ← see §5
           →  pageNumber: Int    ← 0-indexed
           →  authorId, allowedEditUserIds[], allowedDeleteUserIds[]

Notification  ← userId, actorId, markupId, documentId, projectId, read
ProjectMarkupField ← custom fields per project (key, type, options[])
MarkupPropertyPreset ← reusable property templates per company
```

### Document versioning
- No parent-child FK between versions.
- Versions are identified by **same `name` + `folderId`**.
- Latest = `isLatest: true`, older = `isLatest: false`.
- `version: Int` increments on each replace.

---

## 3. API Routes (backend)

### Auth (inline in server.js)
- `POST /api/auth/google` — Google OAuth login → JWT
- `POST /api/auth/login` — email/password login

### Documents  `/api/documents`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Upload new document |
| PUT | `/:id/replace` | Upload new version (increments version, sets isLatest) |
| GET | `/:id/proxy` | **Auth-protected PDF stream** — always use this, never direct storageUrl |
| GET | `/:id/info` | Document metadata + markups + versions + breadcrumbs |
| GET | `/:id/versions` | All versions list |
| PATCH | `/:id/scale` | Save doc scale setting |
| POST | `/:id/copy-markups` | Copy markups from ALL previous versions → new version (deduplicates) |
| POST | `/bulk-delete` | Bulk soft-delete |
| POST | `/bulk-move` | Bulk move to folder |

### Folders  `/api/folders`
| Method | Path | Description |
|---|---|---|
| GET | `/tree?projectId=` | Full folder tree (Ghost Path support) |
| GET | `/:id/contents` | Paginated folder contents (folders + docs). Returns `allVersionMarkupsCount` per doc |
| GET | `/root/:projectId` | Get or create root folder |
| POST | `/` | Create folder |
| PATCH | `/:id/rename` | Rename folder |
| DELETE | `/:id` | Soft-delete folder |
| PATCH | `/:id/move` | Move folder |
| POST | `/bulk-delete` | Bulk soft-delete |
| POST | `/bulk-move` | Bulk move |

### Markups  `/api/markups`
| Method | Path | Description |
|---|---|---|
| GET | `/document/:documentId` | All markups for document |
| POST | `/` | Create markup |
| POST | `/batch` | Batch create markups (array) |
| PUT | `/:id` | Update markup |
| DELETE | `/:id` | Delete markup |

### Projects  `/api/projects`
- CRUD, assignments, roles, markup fields, folder tree

### Users / Invitations / Company / Roles / Audit / Search / Notifications
- Standard CRUD + invite flow

---

## 4. Frontend Pages

### `ProjectPage.tsx`  `/projects/:projectId[/folders/:folderId]`
**The file manager.** Shows the folder tree on the left + folder contents (cards or list or mobile) on the right.

Key state: `folderId`, `contents` (from `useFolderContents`), `selectionMode`, `replaceDocId`, view mode (cards/list).

Key handlers:
- `handleExportWithMarkups(docId, docName)` — calls `exportDocumentWithMarkups()` with toast progress
- `handleDownloadClean` — NOT here; it's per-component (DocumentCard/DocumentRow/DocumentMobileCard each call `/api/documents/:id/proxy` with auth)
- Replace flow: `replaceDocument.mutate()` → on success if `transferMarkups`, calls `POST /api/documents/:newId/copy-markups`

Three document display modes (same data, different layout):
1. `DocumentCard` — grid card view
2. `DocumentRow` — table row (list view)
3. `DocumentMobileCard` — inline component in ProjectPage, mobile/tablet

### `DocumentViewPage.tsx`  `/projects/:projectId/documents/:documentId`
**The PDF viewer.** Full-screen document viewer with markup tools.

Key state: `pdfDoc` (PDFDocumentProxy), `markups`, `tool`, `displayScale`, `zoom`, `currentPage`, `hiddenLayers`, `docScale`, `isExporting`, `sidebarOpen`, `splitView`, `embeddedAnnots`, `isImporting`.

Key features:
- PDF loaded via `react-pdf` (`<Document>`) using `/api/documents/:id/proxy` + auth header
- Real-time markup sync via Y.js WebSocket (`useMarkups` hook)
- `handleExportPdf` → `exportPdfWithMarkups({ pdfDocProxy: pdfDoc, ... })` — native PDF annotations
- `handleDownloadClean` → fetch proxy → blob → download
- Version switching: `onVersionChange={(v) => window.location.href = ...}`
- **Bluebeam import:** after `pdfDoc` loads, `detectAndParseAnnotations(pdfDoc)` runs in a useEffect. If annotations found → orange badge button in toolbar. Click → `handleImportAnnotations` creates each via `createMarkup()` (Y.js, real-time sync)

---

## 5. Markup Types

All stored in `Markup.type`. Coordinates are normalized (0–1) relative to page canvas.

| type | Coordinates fields | PDF annotation |
|---|---|---|
| `rect` | left, top, width, height, angle | `/Square` or `/Polygon` if rotated |
| `circle` | left, top, width, height | `/Circle` |
| `ellipse` | left, top, width, height | `/Circle` |
| `triangle` | left, top, width, height | `/Polygon` |
| `diamond` | left, top, width, height | `/Polygon` |
| `hexagon` | left, top, width, height | `/Polygon` |
| `star` | left, top, width, height | `/Polygon` |
| `cloud` | left, top, width, height | `/Polygon` + `IT:PolygonCloud` + `BE:{S:C}` |
| `callout` | cloud:{l,t,w,h}, textBox:{l,t,w,h}, tail?:{x,y} | `/Polygon`cloud + `/FreeText` IT:FreeTextCallout |
| `line` | x1, y1, x2, y2 | `/Line` LE:[None,None] |
| `arrow` | x1, y1, x2, y2 | `/Line` LE:[OpenArrow,...] IT:LineArrow |
| `measure` | x1, y1, x2, y2 | `/Line` IT:LineDimension, Contents=measurement |
| `polyline` | points:[{x,y}] | `/PolyLine` Vertices=[...] |
| `pen` | path(SVG string), left, top | `/Ink` InkList=[[...]] |
| `text` | left, top, width, height | `/FreeText` DA=font string |
| `highlighter` | width+height (rect) OR path (freehand) | `/Highlight` QuadPoints OR `/Ink` CA:0.5 |

### Markup properties (in `properties` JSON)
`stroke`, `strokeWidth`, `lineStyle`, `fill`, `fillOpacity`, `text`, `fontSize`, `textColor`, `fontFamily`, `fontWeight`, `fontStyle`, `arrowStyle`, `arrowSize`, `textBoxFill`, `originalWidth`, `originalHeight`, `showLength`, `borderColor`, `borderWidth`, `subject`, `comment`, `customFields`

**Bluebeam import extras:** `source: 'bluebeam_import'`, `bluebeamAuthor`, `pdfAnnotId`

### Line styles
`solid`, `dashed`, `dotted`, `dash-dot`, `dash-dot-dot`, `long-dash`, `short-dash`, `long-dash-dot`

---

## 6. Real-time Sync

**Y.js (primary):** Each document has a Y.js room (`documentId`). `yjsServer.js` persists to PostgreSQL.
On bind: loads all markups from DB into `ydoc.getMap('markups')`.
On update (debounced 800ms): saves to DB, processes `@mentions` in comments.

**Socket.io (secondary/notifications):** Used for:
- Markup create/update/delete events broadcast to `doc:${documentId}` room
- Cursor positions: `cursor:move` → broadcast to room
- Notification delivery to `user:${userId}` room

**`useMarkups` hook:** subscribes to the Y.js doc's `markups` map, returns live array of markups.

---

## 7. Permission System

### Hierarchy (highest wins)
1. `GENERAL_ADMIN` — full access everywhere
2. Company `Admin` role — full access to all company projects
3. `ProjectAssignment` — per-project permissions
4. `FolderPermission` — per-folder override
5. **Ghost Path** — if user has `FolderPermission` only on a sub-folder, they see ancestor folders as "ghost" (visible but no files)

### Permission flags (on Assignment + FolderPermission)
`canView`, `canEdit`, `canDelete`, `canDownload`, `canMarkup`, `canManage`

### `canMarkup` controls in the viewer
- `false` → toolbar hidden (read-only), canvas pointer-events disabled, no selection handles, properties panel read-only
- Highlight tool only available with `canMarkup: true`

---

## 8. PDF Export System

**File:** `frontend/src/utils/exportPdfWithMarkups.ts`

### Two exported functions:

**`exportPdfWithMarkups(opts)`** — called from DocumentViewPage
- `pdfDocProxy.getData()` → Uint8Array (raw bytes, no re-download)
- pdf-lib loads bytes, adds annotations, saves, triggers download

**`exportDocumentWithMarkups(opts)`** — called from file manager
- Fetches PDF bytes from `/api/documents/:id/proxy` with auth
- Fetches markups from `/api/markups/document/:id`
- Same annotation pipeline

### How annotations work
- All annotations created as native PDF annotation dicts via `pdfDoc.context.obj({...})` + `pdfDoc.context.register()`
- Added to each page's `/Annots` array
- **No pixel rendering** — just annotation metadata → fully editable in Bluebeam / Acrobat / Foxit
- Coordinate transform: normalized(0–1) → PDF points: `pdfX = normX * pw`, `pdfY = ph * (1 - normY)`

### Bluebeam export fields
Every exported annotation includes:
- `/NM` — markup UUID (Bluebeam tracks annotations by this for re-import matching)
- `/T` — author display name
- `/Subj` — subject/category field
- `/Contents` — `text || comment` (shown as annotation note in Bluebeam)
- `/IT` — intent type: `LineArrow`, `LineDimension`, `PolygonCloud`, `FreeTextCallout`

### Download (clean PDF, no markups)
All three file-manager components + DocumentViewPage use:
```js
fetch(`/api/documents/${id}/proxy`, { headers: { Authorization: `Bearer ${token}` } })
  .then(r => r.blob()) → URL.createObjectURL → <a>.click()
```
**Never use `document.storageUrl` directly** — it's not auth-protected.

---

## 9. Bluebeam Import System

**File:** `frontend/src/utils/importAnnotationsFromPdf.ts`

### How it works
1. After a PDF loads (`pdfDoc` state set), `detectAndParseAnnotations(pdfDoc)` runs in a `useEffect`
2. Uses pdfjs `page.getAnnotations({ intent: 'display' })` on every page
3. Returns `ImportedMarkup[]` (same shape as `createMarkup` expects)
4. If count > 0 → orange `SystemUpdateAltIcon` button shown in toolbar with badge
5. User clicks → `handleImportAnnotations` loops and calls `createMarkup()` for each → Y.js sync

### Annotation type mapping
| PDF Subtype | Redlines type |
|---|---|
| Square | rect |
| Circle (square aspect) | circle |
| Circle (other aspect) | ellipse |
| Polygon + `IT:PolygonCloud` or `BE:{S:C}` | cloud |
| Polygon 3 vertices | triangle |
| Polygon 4 vertices (diamond geometry) | diamond |
| Polygon 6 vertices | hexagon |
| Polygon 10 vertices | star |
| Polygon (other) | rect (bbox fallback) |
| Line + `IT:LineArrow` or has arrow endings | arrow |
| Line + `IT:LineDimension` | measure |
| Line (plain) | line |
| PolyLine | polyline |
| Ink (opacity < 0.75) | highlighter (freehand) |
| Ink (other) | pen |
| FreeText | text |
| Text (sticky note) | text |
| Highlight | highlighter (rect) |
| Underline / StrikeOut | highlighter |
| Stamp | text (shows stamp label) |
| Caret | rect |
| Any other non-skip subtype | rect (bbox, 100% import guarantee) |
| Link, Widget, Popup, FileAttachment, Movie, Sound, 3D, TrapNet, Watermark, PrinterMark | **skipped** |

### Coordinate transform (import)
```
normX = pdfX / pageWidth
normY = 1 − pdfY / pageHeight   ← Y flip (PDF is bottom-left, canvas is top-left)
```
Ink/pen paths: `canvasX = pdfX`, `canvasY = pageHeight − pdfY`, `originalWidth = pageWidth`, `originalHeight = pageHeight`, `left = top = 0`

### What is preserved
- Stroke color, fill/interior color (from pdfjs `Uint8ClampedArray` 0-255, no heuristics)
- Stroke width, line style (solid/dashed/dotted/dash-dot etc.)
- Opacity
- Text content, subject (`/Subj`), author (`/T` → `bluebeamAuthor`)
- Font size and color (from `defaultAppearanceData`)
- Font family (for round-trip text boxes)
- `source: 'bluebeam_import'` tag
- `pdfAnnotId` from `/NM`

---

## 10. Version Upload with Markup Transfer

**Flow:**
1. User clicks "Upload new version" → `ReplaceDocumentDialog` opens
2. User picks PDF file
3. If `allVersionMarkupsCount > 0` → Step 2 shown: radio choice
   - **"Bring markups from all versions"** — collects markups from ALL previous versions (deduplicated)
   - **"Start clean"** — new version has no markups
4. Frontend calls `PUT /api/documents/:id/replace` → backend creates new doc with `version+1, isLatest:true`, old gets `isLatest:false`
5. If transfer: calls `POST /api/documents/:newId/copy-markups`

**Backend `copy-markups` logic:**
1. Finds target doc → gets `name + folderId`
2. Finds ALL sibling docs (same name + folderId, not target, not deleted)
3. Collects ALL markups from all siblings
4. **Deduplicates** by `type|pageNumber|JSON.stringify(coordinates)` — prevents double-copying when markups were already transferred in prior upgrades
5. Creates copies in the target document

**`allVersionMarkupsCount`:** `getFolderContents` now includes this field — sum of markups across ALL versions with the same name in the folder. Used to decide whether to show the transfer dialog.

---

## 11. Notifications

**Trigger:** When a markup's `properties.comment` or `properties.subject` is saved/updated and contains `@username`, a notification is created.

**Model:** `Notification` — userId (receiver), actorId (sender), markupId, documentId, projectId, read.

**Frontend:**
- `NotificationBell` in AppHeader — shows unread count badge
- Clicking opens a popover with notifications list
- Click notification → navigate to the document
- `useNotifications` hook — fetches + marks read

---

## 12. Key Components Reference

### `PdfToolbar`
Props: `tool`, `onToolChange`, `activeColor`, `activeStrokeWidth`, `activeLineStyle`, `docScale`, `zoom`, `currentPage`, `numPages`, `scrollMode`, `canUndo`, `canRedo`, `versions`, `currentDocId`, `onVersionChange`, `canMarkup`, **`onDownloadClean`**, **`onExportPdf`**, **`isExporting`**, `sidebarOpen`, `onToggleSidebar`, **`embeddedAnnotCount`**, **`onImportAnnotations`**, **`isImporting`**

Download buttons:
- `DownloadIcon` → `onDownloadClean` (clean PDF, no markups)
- `LayersIcon` → `onExportPdf` (PDF with native annotations)
- `SystemUpdateAltIcon` (orange) → `onImportAnnotations` — shown only when `embeddedAnnotCount > 0` (Bluebeam annotations detected)

### `MarkupLayer`
Off-screen Fabric.js canvas overlay per page. Renders all markup types using Fabric objects.
Handles: mouse events for drawing, selection, drag, resize, rotate.
Key prop: `canMarkup` — if false, canvas is pointer-events:none, no handles.

### `PdfSidebar`
Left sidebar: markup list grouped by type, search/filter, layer toggles (show/hide per type).

### `MarkupListItem`
Single row in sidebar. Shows markup type icon, author, page, text preview. Click → scroll to markup + highlight. Double-click → open properties panel.
Shows **"BB" orange badge** when `properties.source === 'bluebeam_import'`.

### `MarkupPropertiesPanel`
Right panel showing markup properties. If `canMarkup=false` → all inputs disabled (read-only).
Shows **"Imported from Bluebeam · AuthorName"** info row for `source === 'bluebeam_import'`.

### `DocumentCard` / `DocumentRow`
File manager document item. Both use `useAuth()` internally for the clean PDF download.
3-dot menu items: Open, Versions History, Download (clean PDF), Download with markups, Upload new version, Share, Delete.

### `ReplaceDocumentDialog`
2-step: Step1 = file picker (drag-drop area), Step2 = markup transfer choice (only if markupCount > 0).

---

## 13. What Was Done (Stage-by-Stage)

| Stage | Summary |
|---|---|
| 1–2 | Initial setup: auth, projects, basic file manager |
| 3 | RBAC: Company/Role/ProjectAssignment/FolderPermission, Firm→Company rename |
| 4 | UX polish: drag-and-drop files, bulk ops, impersonation, folder tree fix |
| 5 | PDF viewer overhaul: toolbar, all shape tools, line styles, zoom, properties panel |
| 6 | Selection/sync fixes: `isInSync`, `isProgrammaticSelect`, double-click list, callout fix |
| 7 | Permissions in viewer: canMarkup flag enforced on canvas/toolbar/panel; search zoom to 150%; sidebar auto-expand; scale persistence |
| 8 | Read-only mode for `canMarkup=false`; highlight under text via raw canvas; split view |
| 9 | Bug fixes: sidebar collapse preserved on delete; textSelect tool; highlight canvas position |
| 10 | Perf optimizations; polyline showLength checkbox; split popup portal; rotation support |
| 11 | **Native PDF annotation export** (Bluebeam-compatible): replaced PNG-bake approach with pdf-lib annotation dicts |
| 11+ | Duplicate import fix (ProjectPage); clean PDF download via proxy (auth fix); "Download (clean PDF)" + "Download with markups" buttons in file manager 3-dot menus AND viewer toolbar; version upload markup transfer from ALL versions with deduplication |
| 12 | Markup statuses/threads/comment counter/CSV export; touch/stylus support; lazy thumbnails; date filter; batch ops in sidebar |
| 13 | **Bluebeam bi-directional compatibility**: `importAnnotationsFromPdf.ts` — 100% import rate of all PDF annotation types; automatic detection on PDF load; orange import button in toolbar; imported markups tagged with "BB" badge; export updated with `/NM`/`/T`/`/Subj` fields for Bluebeam tracking |

---

## 14. TODO / What to Build Next

Below is the full backlog Roman has mentioned or that are natural next steps:

### 🔴 High priority (mentioned by Roman)

1. **Touch / stylus support** in the viewer
   - Fabric.js supports touch events but needs `allowTouchScrolling` tuning
   - Add stylus pressure sensitivity for pen/highlighter tools
   - Pinch-zoom support on canvas

2. **Server-side PDF rendering** (page thumbnails)
   - Currently the viewer renders all pages client-side
   - Need a backend endpoint that renders a specific page to PNG via `pdfjs-dist` on Node (or a headless browser)
   - Used for: thumbnail sidebar, search result previews, faster initial load

3. **Markup search / filter improvements**
   - Filter by author, date range, type
   - Search within markup text/comments
   - Export filtered list to CSV/Excel

4. **Markup status workflow**
   - Statuses: Open / In Progress / Resolved / Closed
   - Filter sidebar by status
   - Color-coded chips in list
   - Status history log

5. **Batch markup operations from sidebar**
   - Select multiple in list → bulk delete / bulk change properties / bulk export

### 🟡 Medium priority

6. **Document comparison view**
   - Side-by-side or overlay mode comparing two versions
   - Highlight differences in the PDF content

7. **Markup export to PDF report**
   - Generate a separate PDF with a table listing all markups (type, author, date, comment, page, screenshot thumbnail)

8. **Email notifications**
   - Currently `notificationService.js` exists but email sending (via `emailService.js`) may not be fully wired
   - Send email when @mentioned or when a markup is assigned

9. **Markup templates / stamps**
   - Create reusable markup presets (MarkupPropertyPreset already in schema)
   - Apply preset to new markup (auto-fills properties)
   - Custom stamps (company logo, "APPROVED", "FOR REVIEW", etc.)

10. **Folder/document search**
    - Currently search searches within PDF text
    - Add filename/folder search
    - SearchController exists, may need expansion

11. **Mobile app / PWA**
    - Add PWA manifest + service worker
    - Touch-optimized markup tools

12. **Audit log improvements**
    - AuditLogPage exists but may need better filtering/export
    - Show markup change history (before/after properties)

### 🟢 Nice to have

13. **Google Drive integration**
    - GoogleDriveProvider exists in storage layer but may be incomplete
    - Import PDFs directly from Google Drive
    - Sync annotated PDFs back to Drive

14. **Hyperlink annotations**
    - Click a markup → open URL
    - `/Link` annotation type in PDF

15. **Measurement calibration per page**
    - Currently `docScale` is document-wide
    - Per-page scale calibration
    - Calibrate by clicking two known points and entering real-world distance

16. **Markup layers (named layers)**
    - Currently layer = markup type (highlight, rect, etc.)
    - Named layers like "Structural", "MEP", "Civil"
    - Show/hide per named layer

17. **Issue tracker integration**
    - Export markups as Jira/Linear issues

---

## 15. Critical Implementation Notes

### ❗ Always download PDFs via proxy
```js
// CORRECT
fetch(`/api/documents/${id}/proxy`, { headers: { Authorization: `Bearer ${token}` } })

// WRONG — not auth-protected, will 404 on local storage
<a href={document.storageUrl}>
```

### ❗ Markup coordinates are normalized (0–1)
When reading/writing coordinates, they are fractions of the page canvas dimensions at docScale.
PDF export converts: `pdfX = normX * pageWidth_pts`, `pdfY = pageHeight_pts * (1 - normY)`

### ❗ Document versions — no FK parent reference
Versions linked by `name + folderId`. Always query `isLatest: true` for current version.
When looking for all versions: `{ name: doc.name, folderId: doc.folderId, isDeleted: false }`

### ❗ Y.js is the source of truth for live markup state
`useMarkups(documentId)` subscribes to Y.js map — always use this in the viewer, not direct API calls.
Y.js persistence happens via debounced writes in `yjsServer.js` (800ms delay).

### ❗ Permission middleware is async and must be awaited
`getFolderPermissions(userId, folderId)` is async — used in FolderController loops.

### ❗ `canMarkup` prop flows from ProjectPage → DocumentViewPage → PdfToolbar / MarkupLayer / MarkupPropertiesPanel
If `canMarkup=false`: no toolbar tools shown, canvas is pointer-events:none, properties panel is read-only.

### ❗ pdf-lib annotation values
- PDF Names (Subtype, IT, S in BS, LE entries): must use `PDFName.of('Value')` — plain strings become PDFString
- Arrays, numbers, nested objects: `context.obj()` auto-converts recursively
- Page Annots: `page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)` to extend existing array

---

## 16. Running the Project

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
node server.js   # port 5000

# Frontend
cd frontend
npm install
npm run dev      # port 5173 (Vite)
```

**Environment variables (backend `.env`):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
STORAGE_TYPE=local   # or 'google-drive' or 's3'
PORT=5000
```

**Storage types:**
- `local` — files go to `backend/uploads/`, served via `/api/documents/:id/proxy`
- `google-drive` — `GoogleDriveProvider.js`
- S3-compatible — configure in `StorageFactory.js`

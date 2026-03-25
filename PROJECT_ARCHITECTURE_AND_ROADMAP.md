# WISE SMART PDF: Architecture & Development Roadmap

## 1. System Concept
Cloud platform for collaborative work on construction PDF blueprints between engineers and clients. Separates the static PDF background from the intelligent markup layer (lines, properties, circuit schedules).

### Key Principles:
- **Clean Branding:** Minimalist Wise branding. Favicon: "W" icon. No redundant text in headers.
- **Client-Centric Interaction (Core Feature):** Lightning-fast communication. Clients can instantly open and view PDF drawings. They can leave mentions/comments triggering real-time notifications. Professionals can directly markup files provided by clients.
- **Strict WebSocket-Only PDF Interaction:** All interactions within the context of a PDF file (creating/updating markups, adding comments, modifying properties, setting custom parameters, subject input) MUST go through WebSockets (`socket.io`) exclusively. REST APIs are completely forbidden for these actions to ensure ultra-low latency and real-time synchronization.
- **Markup Ownership & Permissions:** The creator of a markup can grant specific permissions (edit/delete) to other users. Markup properties transparently display who last updated the markup.
- **Multi-Company Architecture:** User can belong to MULTIPLE companies. Each company has its own projects, roles, tags.
- **Role-Based Flexibility:** SystemRole (GENERAL_ADMIN / USER) + per-company Role (Admin, Worker, Client, custom). Per-project/folder/document granular permissions.
- **Hierarchy:** Company → Projects → Folders (nested) → Documents (PDF) → Markups
- **Validation First:** Strict validation on all inputs.
- **Bulk Operations:** Every management view supports bulk create, update, and delete.
- **Personalization:** DnD sort order, filters, view mode preserved per user.

### Permission Hierarchy (most specific wins):
```
DocumentPermission → FolderPermission → ProjectAssignment → CompanyMembership role defaults
```
- **GENERAL_ADMIN** — full access to everything, no checks
- **Company Admin** (role.name === 'Admin') — full access within own company
- **Other roles** — checked against ProjectAssignment / FolderPermission / DocumentPermission
- **AccessScope:** FULL (entire project subtree) vs SELECTIVE (only explicitly granted folders/documents)
- **canManage** — allows delegation (user can share/assign others within their scope)

---

## 2. Tech Stack
- **Frontend:** React 19, Vite 8, MUI 7 (Responsive), TanStack React Query, react-i18next
- **Backend:** Node.js, Express 5, Prisma 7, PostgreSQL
- **Libraries:** `@hello-pangea/dnd` (DnD sorting), `react-pdf` + `Fabric.js` (PDF viewer + markup), Socket.io (real-time), `@microsoft/microsoft-graph-client` (OneDrive)
- **Auth:** Google OAuth 2.0 + JWT (7-day sessions) + Azure AD (for OneDrive Access)
- **Super Admin:** Configured via `SUPER_ADMIN_EMAILS` env variable (comma-separated). First to login gets GENERAL_ADMIN.

---

## 3. Data Model (Current → Target)

### Current Schema Issues:
- `User.companyId` = single company FK (User can only be in ONE company)
- `User.roleId` = single role FK (role is global, not per-company)

### Target: Multi-Company Model
```
CompanyMembership (NEW join table):
  id, userId, companyId, roleId, joinedAt
  @@unique([userId, companyId])

User:
  - REMOVE companyId, roleId
  - ADD companyMemberships CompanyMembership[]

Company:
  - REMOVE users User[] (direct)
  - ADD memberships CompanyMembership[]

Role:
  - stays company-scoped (companyId FK)
  - referenced from CompanyMembership.roleId
```

### Current Models (working):
- **Company** — id, name, projects[], roles[], tags[]
- **Role** — id, name, color, isSystem, companyId, defaultCan* (6 booleans)
- **User** — id, email, name, googleId, systemRole, companyId(!), roleId(!), preferences, tags[]
- **Project** — id, name, description, companyId
- **Folder** — id, name, projectId, parentId (self-referencing tree), externalId (Cloud ID)
- **Document** — id, name, storageUrl, version, isLatest, folderId, externalId (Cloud ID)
- **ProjectAssignment** — userId, projectId, roleId, scope (FULL/SELECTIVE), 6x can* booleans
- **FolderPermission** — userId, folderId, roleId, scope, 5x can* booleans
- **DocumentPermission** — userId, documentId, roleId, 5x can* booleans
- **Invitation** — email, roleId, companyId, invitedById, token, status, projectIds[], expiresAt
- **CompanyTag** — text, color, companyId, users[]
- **Markup** — type, pageNumber, coordinates, properties, documentId, authorId
- **MarkupPropertyPreset** — name, fields (JSON), companyId, createdById
- **ProjectMarkupField** — id, key, label, projectId (Custom fields per project)
- **MarkupLayer** — id, name, parentId, projectId, isVisible, sortOrder (Hierarchical layers)
- **Panel** — id, name, projectId, companyId (Project electrical panels)
- **PanelScheduleEntry** — circuit data per panel
- **ConduitScheduleEntry** — homerun data (TAG ID, FROM/TO, length, etc.)
- **AuditLog** — action, userId, projectId?, folderId?, documentId?, markupId?, details

---

## 4. API Endpoints (Current)

### Auth
- `GET /api/config` — Google client ID
- `POST /api/auth/google` — Google OAuth login (auto GENERAL_ADMIN for super admin email)
- `GET /api/auth/me` — Current user with company, role, assignedProjects

### Companies
- `GET /api/companies` — All companies (GENERAL_ADMIN only)
- `POST /api/companies` — Create company (auto-creates Admin/Worker/Client roles)
- `GET /api/companies/my-company` — Current user's company data

### Projects
- `GET /api/projects` — Projects (filtered by company/assignments)
- `POST /api/projects` — Create project (requires companyId)
- `GET /api/projects/:projectId` — Single project
- `PATCH /api/projects/:projectId` — Update project
- `DELETE /api/projects/:projectId` — Delete project
- `GET /api/projects/:projectId/permissions` — Project assignments list
- `POST /api/projects/bulk/delete` — Bulk delete

### Folders
- `GET /api/folders/tree?projectId=` — Folder tree for project
- `GET /api/folders/root/:projectId` — Root folder of project
- `GET /api/folders/:folderId/contents` — Folder children + documents
- `POST /api/folders` — Create folder (with parentId or projectId)
- `PATCH /api/folders/:folderId` — Rename folder
- `DELETE /api/folders/:folderId` — Delete folder
- `POST /api/folders/bulk/delete` — Bulk delete

### Documents
- `POST /api/documents` — Upload PDF (FormData: file + folderId)
- `DELETE /api/documents/:id` — Delete document
- `PUT /api/documents/:id/replace` — Upload new version
- `POST /api/documents/bulk/delete` — Bulk delete

### Users
- `GET /api/users` — Company users list
- `GET /api/users/search?q=` — Search users across platform
- `POST /api/users/:userId/add-to-company` — Add user to company
- `PATCH /api/users/:userId/role` — Update user role/systemRole
- `DELETE /api/users/:userId` — Remove user from company
- `PATCH /api/users/preferences` — Update user preferences
- `POST /api/users/:userId/projects/:projectId` — Assign to project
- `DELETE /api/users/:userId/projects/:projectId` — Unassign from project
- `PATCH /api/users/:userId/projects/:projectId` — Update project permissions
- `POST /api/users/bulk/delete` — Bulk remove users
- `POST /api/users/bulk/role` — Bulk update roles
- `POST /api/users/bulk/assign-projects` — Bulk assign to projects

### Tags
- `GET /api/users/tags` — Company tags
- `POST /api/users/tags` — Create tag
- `DELETE /api/users/tags/:tagId` — Delete tag
- `PATCH /api/users/:userId/tags` — Update user's tags

### Custom Roles
- `GET /api/custom-roles` — Company roles list
- `POST /api/custom-roles` — Create role
- `PATCH /api/custom-roles/:id` — Update role
- `DELETE /api/custom-roles/:id` — Delete role
- `PATCH /api/users/:userId/custom-role` — Assign role to user

### Invitations
- `POST /api/invitations` — Create invitation (email, roleId, projectIds)
- `GET /api/invitations` — List invitations
- `DELETE /api/invitations/:id` — Cancel invitation
- `GET /api/invitations/info/:token` — Public: invitation info
- `POST /api/invitations/accept/:token` — Public: accept with Google credential

### Permissions (Folder/Document level)
- `GET /api/permissions/folders/:folderId/permissions` — Folder permissions
- `PUT /api/permissions/folders/:folderId/permissions/:userId` — Set folder permission
- `DELETE /api/permissions/folders/:folderId/permissions/:userId` — Remove folder permission
- `GET /api/permissions/documents/:documentId/permissions` — Document permissions
- `PUT /api/permissions/documents/:documentId/permissions/:userId` — Set document permission

### Markups
- `GET /api/markups?documentId=` — Get markups for document
- `POST /api/markups` — Create markup
- `PATCH /api/markups/:id` — Update markup
- `DELETE /api/markups/:id` — Delete markup

### Markup Property Presets
- `GET /api/presets` — List presets for user's company
- `POST /api/presets` — Create preset
- `PATCH /api/presets/:id` — Update preset
- `DELETE /api/presets/:id` — Delete preset
- `POST /api/presets/:id/apply` — Bulk-apply preset to all markups in a document

### Search
- `GET /api/search?q=` — Global search (projects, folders, documents)

---

## 5. Frontend Pages & Components

### Pages:
- **LoginPage** — Google OAuth login
- **Dashboard** — Company card, projects grid (DnD sortable), create company/project dialogs, share/rename/delete project via 3-dot menu
- **ProjectPage** — Folder tree sidebar, file manager (folders + documents grid), DnD sort, breadcrumbs, upload/create/rename/delete/share/replace, bulk operations toolbar
- **UsersPage** — Users table with filters (role, project, tags), bulk actions (delete, change role, assign projects), invite dialog, add existing user dialog, user detail dialog with project assignment management
- **InvitePage** — Public page for accepting invitations via Google login
- **DocumentViewPage** — PDF viewer with markup canvas

### Key Components:
- **AppSidebar** — Navigation (Dashboard, Users for admins), folder tree when inside project
- **FileManagerToolbar** — Search, sort, group, view mode toggle, create/upload buttons
- **FolderCard / DocumentCard** — Grid/list items with context menu (rename, delete, share, replace)
- **ShareDialog** — Add users with permission presets, toggle individual permissions per user (optimistic local state)
- **BulkActionsToolbar** — Floating toolbar for selected items
- **RenameDialog / ConfirmDialog** — Reusable dialogs
- **FolderTreeView** — Sidebar tree navigation within projects
- **InviteDialog** — Create invitations with role selector (from company roles), project multi-select, pending invitations tab
- **AddUserDialog** — Search and add existing platform users to company with role
- **UserDetailDialog** — User info, role management, project assignments with scope (FULL/SELECTIVE), folder/document permission overrides
- **SelectiveAccessDialog** — Folder tree with checkboxes for granular folder/document access
- **ProjectPermissionRow** — Per-project permission toggles + scope selector

---

## 6. Development Roadmap

### Stage 1: Infrastructure [COMPLETED]
- [x] Docker + PostgreSQL + Prisma setup
- [x] Vite + React + MUI project scaffold
- [x] Google OAuth 2.0 authentication
- [x] JWT session management (7-day expiry)
- [x] i18n (English + Ukrainian)
- [x] Light/Dark theme toggle
- [x] Responsive layout (desktop sidebar + mobile drawer)

### Stage 2: File Manager [COMPLETED]
- [x] Company CRUD
- [x] Project CRUD with company binding
- [x] Folder tree (self-referencing parentId)
- [x] Document upload/download/replace (versioning)
- [x] Breadcrumb navigation
- [x] DnD sorting (projects, folders, documents) with user preferences
- [x] Grid/List view toggle
- [x] Global search (projects, folders, documents)

### Stage 3: RBAC & User Management [COMPLETED]
- [x] SystemRole enum (GENERAL_ADMIN, USER)
- [x] Company-scoped Role model (Admin, Worker, Client + custom roles)
- [x] Role CRUD with default permissions and color
- [x] CompanyTag model (many-to-many User↔Tag)
- [x] Tag CRUD and user tag assignment
- [x] Invitation system (email + roleId + projectIds, token-based, 7-day expiry)
- [x] Accept invitation page (public, Google login)
- [x] ProjectAssignment with granular 6-permission model + AccessScope (FULL/SELECTIVE)
- [x] FolderPermission overrides
- [x] DocumentPermission overrides
- [x] 3-level permission hierarchy middleware (Document → Folder → Project)
- [x] Permission delegation via canManage
- [x] Users page with table, filters, bulk actions
- [x] User detail dialog with project assignment management
- [x] Selective access dialog (folder tree checkboxes)
- [x] Share dialog (project/folder/document) with permission presets and toggle switches
- [x] Add existing user to company dialog
- [x] Audit logging (AuditLog model, logAction service)
- [x] Super admin email always gets GENERAL_ADMIN

### Stage 3.5: Bug Fixes & API Audit [COMPLETED]
- [x] Fix permissionMiddleware: `user.role` → `user.systemRole` + Role lookup
- [x] Fix CompanyController: correct role checks, auto-create default roles
- [x] Fix InvitationController: role string → roleId FK
- [x] Fix UserController: add missing addToCompany method
- [x] Fix useFolderTree: wrong API URL
- [x] Fix useAssignCustomRole: parameter name mismatch
- [x] Fix Dashboard: missing Menu component for project actions
- [x] Fix usePermissions: `user.role` string comparison → `user.systemRole` + `role?.name`
- [x] Fix InviteDialog: hardcoded roles → company roles from useCustomRoles
- [x] Fix AddUserDialog: hardcoded ROLES → company roles from useCustomRoles
- [x] Fix InvitePage: role type string → object { name, color }
- [x] Fix useInvitations: role → roleId in mutation type
- [x] Fix ShareDialog: invalid List prop, add optimistic local state
- [x] Fix permissionMiddleware: add `req.body.parentId` for folder creation check
- [x] Add folderRoutes: register GET /root/:projectId for root folder endpoint
- [x] Add missing i18n keys (30+ keys: scope, search, sharing, errors, etc.)

### Stage 3.7: Pagination [COMPLETED]
- [x] **Backend:** ProjectController.getProjects — page/limit/total/totalPages
- [x] **Backend:** UserController.getUsers — page/limit/total/totalPages
- [x] **Backend:** FolderController.getFolderContents — page/limit for documents (totalDocs/totalPages)
- [x] **Frontend:** useProjects hook — accepts page/limit, returns { projects, pagination }
- [x] **Frontend:** useUsers hook — accepts page/limit, returns { users, pagination }
- [x] **Frontend:** useFolderContents hook — accepts page/limit, returns { folders, documents, pagination }
- [x] **Frontend:** Dashboard — MUI Pagination for projects
- [x] **Frontend:** UsersPage — MUI Pagination for users table
- [x] **Frontend:** ProjectPage — MUI Pagination for documents in folder view

### Stage 4: Mini Bluebeam PDF Engine [COMPLETED]
- [x] Full Engine Swap: Removed `@react-pdf-viewer`, implemented native `react-pdf` + `pdfjs-dist` wrapper.
- [x] Native Scrolling: Fixed Continuous vs One Page scrolling using CSS native overflow.
- [x] CRDT Real-time Sync: Integrated `Yjs` (y-websocket) for conflict-free collaborative editing.
- [x] Granular Markup Permissions: Authors can now grant Edit/Delete rights to specific project users.
- [x] Tools Rework: Split Cloud and Callout into separate, customizable tools.
- [x] Sidebar Filtering: Group markups by author/date/type and filter by keyword.
- [x] Search Highlights: Custom search implementation with text layer synchronization.
- [x] Duplicate Logic: Deep clone properties to ensure independent markup instances.

### Stage 5: Advanced Engineering [IN PROGRESS]
- [x] **Responsive Design**: Full mobile/tablet support across all pages. Toolbar tool-collapsing (More menu), full-width sidebars on mobile.
- [x] **Advanced UI**: Visual Line Style previews in dropdowns, hierarchical markup grouping (Author > Date).
- [x] **Branding & Consistency**: Restored Gold Wise theme for toolbars and quick property selectors.
- [ ] **Adaptive Styles**: Dark/Light theme perfection, glass effects.
- [ ] **Multi-segment Cloud**: Polygon cloud tool.
- [ ] **Calibrated Measurements**: Set drawing scale and measure real distances.
- [ ] **Ghost Paths**: Logic to see "ghost" icons of documents needed for navigation.

---

## 7. Key Architectural Concepts & Access Logic

### System vs. Custom Roles
- **System Roles (`isSystem: true`)**: When a company is created, "Admin", "Worker", and "Client" are auto-generated. These cannot be deleted to ensure baseline roles always exist.
- **Custom Roles**: Created by the General/Company Admin. A recent update enforces `@@unique([companyId, name])` so a single company cannot have duplicate role names.
- **General Admin Scope**: A `GENERAL_ADMIN` oversees all companies. To prevent duplicate role UI issues, the backend (`/api/custom-roles`) requires a `companyId` context to fetch valid roles for assignment.

### The "Ghost Path" Logic
When a user is granted selective access to a nested folder (e.g., `Root > Reports > Rev A`), they inherently need to navigate through the parent folders (`Root` and `Reports`).
- **Backend**: `getFolderPermissions` uses `hasDescendantAccess` to detect if the user has access to any child document or folder. If yes, it returns `{ isGhost: true }` for that parent. The user can traverse the parent folder, but its other contents (unauthorized siblings) remain hidden.
- **Frontend**: In the Selective Access Dialog, if a descendant is selected but the current folder is not explicitly selected, the checkbox displays as **indeterminate (`[-]`)**. This visually confirms the Ghost Path without tricking the Admin into fully checking it (which would accidentally grant full access).

### Comprehensive Audit Logging
Audit logging captures **every single state mutation** across the application ensuring total traceability. 
- Actions tracked: `CREATE`, `RENAME/UPDATE`, `MOVE`, `DELETE`, `BULK_DELETE`, `DOWNLOAD`, `NEW_VERSION`
- Entities tracked: `Project`, `Folder`, `Document`, `Markup`, `User`, `Role`, `Company`
- Controller Integration: Direct instrumentation (`logAction`) inside every successful Prisma transaction.

---

## 8. File Manifest

### Backend Structure:
```
backend/
├── prisma/
│   └── schema.prisma                    # Data model (14 models)
├── src/
│   ├── controllers/
│   │   ├── CompanyController.js
│   │   ├── ProjectController.js
│   │   ├── FolderController.js
│   │   ├── FolderPermissionController.js
│   │   ├── InvitationController.js
│   │   ├── UserController.js
│   │   ├── RoleController.js            # Custom role CRUD
│   │   ├── SearchController.js
│   │   ├── MarkupController.js
│   │   └── PresetController.js          # Markup property presets CRUD
│   ├── middlewares/
│   │   ├── authMiddleware.js            # JWT verification
│   │   └── permissionMiddleware.js      # 3-level permission check
│   ├── routes/
│   │   ├── companyRoutes.js
│   │   ├── projectRoutes.js
│   │   ├── folderRoutes.js
│   │   ├── folderPermissionRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── userRoutes.js
│   │   ├── invitationRoutes.js
│   │   ├── customRoleRoutes.js
│   │   ├── searchRoutes.js
│   │   ├── markupRoutes.js
│   │   └── presetRoutes.js              # Markup property presets routes
│   ├── services/
│   │   └── auditService.js             # logAction()
│   └── prismaClient.js
└── server.js                            # Express entry point
```

### Frontend Structure:
```
frontend/src/
├── contexts/
│   └── AuthContext.tsx                   # User state, login/logout
├── pages/
│   ├── LoginPage.tsx
│   ├── Dashboard.tsx                    # Company + projects overview
│   ├── ProjectPage.tsx                  # File manager
│   ├── UsersPage.tsx                    # User management
│   ├── InvitePage.tsx                   # Accept invitation (public)
│   └── DocumentViewPage.tsx             # PDF viewer orchestrator
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx               # Navigation + folder tree
│   │   ├── AppBar.tsx                   # Top bar
│   │   ├── ProtectedRoute.tsx
│   │   └── BulkActionsToolbar.tsx
│   ├── filemanager/
│   │   ├── FileManagerToolbar.tsx
│   │   ├── FolderCard.tsx
│   │   ├── DocumentCard.tsx
│   │   ├── FolderTreeView.tsx
│   │   ├── Breadcrumbs.tsx
│   │   ├── CreateFolderDialog.tsx
│   │   ├── UploadDocumentDialog.tsx
│   │   ├── ReplaceDocumentDialog.tsx
│   │   ├── RenameDialog.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── ShareDialog.tsx              # Permission management
│   ├── pdf/
│   │   ├── PdfToolbar.tsx               # Extracted viewer toolbar
│   │   ├── PdfSidebar.tsx               # Pages/Bookmarks/Markups tabs
│   │   ├── MarkupLayer.tsx              # Fabric.js canvas (optimized)
│   │   ├── MarkupListItem.tsx           # Markup row in sidebar list
│   │   └── MarkupPropertiesPanel.tsx    # Slide-out properties panel
│   └── users/
│       ├── InviteDialog.tsx
│       ├── AddUserDialog.tsx
│       ├── UserDetailDialog.tsx
│       ├── ProjectPermissionRow.tsx
│       └── SelectiveAccessDialog.tsx
├── hooks/
│   ├── useProjects.ts
│   ├── useFolderContents.ts
│   ├── useFolderTree.ts
│   ├── useUsers.ts
│   ├── useInvitations.ts
│   ├── useCustomRoles.ts
│   ├── useCompany.ts
│   ├── useSharing.ts
│   ├── usePermissions.ts
│   ├── useUserPreferences.ts
│   └── useMarkupPresets.ts              # Preset CRUD hooks
├── lib/
│   └── api.ts                           # apiFetch wrapper
├── i18n.ts                              # EN + UK translations
└── router.tsx                           # React Router config
```

---

## 9. Conduit Schedule Specification

### Homerun Schedule Columns:
`TAG ID`, `E1OSL`, `FROM`, `TO`, `LEVEL`, `AREA`, `CONDUIT SIZE`, `SERVICE TYPE`, `CKT# I` to `IX`, `PDF/BIM Length` (calculated), `Load Descriptions`, `Required Conduit Size`, `Conduit Type`, `Conduit Fill`, `Voltage Drop`, `Wire#`, `Derating`, `Max Amp`, `Phases`, `Circuits`, `Ph A/B/C`, `N`, `G`, `WIP Fields (Ph A/B/C, N, Circuits)`, `Min`.

### Key Integration Logic:
1. **Source Data**: Homerun rows are combined from **Panel Schedule (PS)** circuits.
2. **Project Context**: Panels and Schedules are unique per project (duplicate panel names allowed in different projects).
3. **PDF Tagging**: Markups assigned a `TAG ID` automatically contribute their scaled length to the `PDF/BIM Length` column.
4. **Calculations**: Live sizing based on load, distance, and conductor counts (formulas to be provided).
5. **UI/UX**: Clear signaling/highlighting for rows that are "combined" vs "missing" from the panel schedule.

---

## 10. Manual Verification Protocol

**Note:** In the absence of automated end-to-end tests, all verification is performed via systematic browser testing.

### PDF Viewer & Toolbar
- [ ] **Tools Removal**: Verify `callout`, `polyline`, `stamp`, `measure-area` are removed from the toolbar.
- [ ] **Shapes Select**: Dropdown contains all 8 shapes (Rectangle to Cross).
- [ ] **Arrow Customization**: Start/End markers apply correctly to line ends.
- [ ] **Version History**: Switch between versions and verify PDF binary reloads.

### Properties & Logic
- [ ] **Auto-Open**: Select markup -> Panel opens. Deselect -> Panel closes.
- [ ] **Scale Calibration**: Set scale (e.g., 1/4"=1'0") and verify Line measurements convert to Ft/In accurately.
- [ ] **Search Persistence**: Type search term -> Switch to 'Markups' tab -> Switch back to 'Search' -> Results and keyword remain.

### UI & Layout
- [ ] **Full Width**: Sidebar is always visible; PDF canvas utilizes all remaining width.
- [ ] **Scroll Isolation**: Verify that scrolling the PDF doesn't cause the browser page to scroll away from the viewport.
- [ ] **Responsive Design**: Test on Large Desktop, Laptop, and Tablet resolutions. Use Sidebar Toggle to hide/show bookmarks on small screens.
- [ ] **Dark Theme**: Verify zoom %, dropdowns, and filter selects are perfectly legible.

### Performance & Collaboration
- [ ] **Socket Sync**: Open same document in two tabs. Drawing in Tab 1 renders in Tab 2 instantly.
- [ ] **Copy/Paste**: Select markup -> Ctrl+C -> Ctrl+V. A duplicate must appear in the correct coordinates.
- [ ] **Archive/Restore**: Archive company -> Projects become inaccessible. Restore -> All data link integrity remains.

---

## 11. External Cloud Integration: OneDrive Sync

### 11.1 Concept: "Shadow Mirroring"
The application acts as a high-performance interactive interface over Microsoft OneDrive. It provides full real-time synchronization of folder structures and files, allowing users to work on the same data from both the "Mini Bluebeam" app and native Windows Explorer/OneDrive web interface.

### 11.2 Architectural Principles:
1.  **Pluggable Provider:** Implementation of `OneDriveStorageProvider` extending `IStorageProvider`. Switchable via `.env`.
2.  **Bidirectional Sync Strategy:**
    *   **App → OneDrive:** Any action (folder creation, PDF upload) is instantly pushed via Microsoft Graph API.
    *   **OneDrive → App:** Leverages **Microsoft Graph Webhooks (Subscriptions)**. The server listens for remote changes and updates the local Prisma database state.
    *   **Delta Sync:** On user login or server startup, a "Delta Query" is executed to catch up on any missed changes.
3.  **Virtual Tree:** `Folder` and `Document` models are extended with an `externalId` field to map local records to OneDrive Item IDs.

### 11.4 Permissions & Governance
**OneDrive is strictly a storage and structure backend.**
1.  **Governance Override:** The application's existing Permission Hierarchy (Company -> Project -> Folder -> Document) remains the absolute source of truth. Even if a folder exists in OneDrive, a user will NOT see it in the app unless they have explicit or inherited permissions in the local PostgreSQL database.
2.  **No Direct OneDrive Access for Clients:** Clients and external workers interact only through the "Mini Bluebeam" interface. They do not need (and should not have) direct access to the underlying OneDrive folder. The backend acts as a security gatekeeper, proxying requests and enforcing the application's RBAC.
3.  **Isolation:** Multi-company isolation is maintained by the app. OneDrive just provides the physical hierarchy mirrored by `externalId` links.


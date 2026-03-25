import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  en: {
    translation: {
      uploadingFiles: "Uploading files...",
      download: "Download",
      uploadNewVersion: "Upload New Version",
      appName: "WISE SMART PDF",
      appDescription: "Intelligent platform for PDF collaboration",
      welcome: "Welcome, {{name}}!",
      email: "Email",
      role: "Role",
      roleWithName: "Role: {{role}}",
      loginTitle: "Sign in to your account",
      loginDescription: "Use your Google account to log in",
      noConfigWarn:
        "GOOGLE_CLIENT_ID is not configured. Insert your key into the .env file",
      logout: "Logout",
      dashboardTitle: "Dashboard",
      myCompany: "My Company",
      noCompanyAssigned: "You are not assigned to any company yet.",
      projects: "Projects",
      noProjects: "No projects found.",
      noDescription: "No description",
      createCompanyBtn: "Create Company",
      createProjectBtn: "Create Project",
      dialogCreateCompanyTitle: "Create a New Company",
      dialogCreateProjectTitle: "Create a New Project",
      nameLabel: "Name",
      descLabel: "Description",
      cancelBtn: "Cancel",
      submitBtn: "Create",
      rename: "Rename",
      delete: "Delete",
      share: "Share",
      confirmBtn: "Confirm",
      renameFolder: "Rename Folder",
      deleteFolder: "Delete Folder",
      renameProject: "Rename Project",
      deleteProject: "Delete Project",
      deleteProjectConfirm:
        "Are you sure you want to delete this project? This will delete all folders, files and markups within it.",
      renameDocument: "Rename Document",

      // Search
      searchPlaceholder: "Search projects, folders, documents...",
      searchNoResults: "No results found",

      // File Manager
      folders: "Folders",
      documents: "Documents",
      createFolder: "New Folder",
      uploadDocument: "Upload PDF",
      downloadDocument: "Download",
      deleteDocument: "Delete",
      replaceDocument: "New Version",
      replaceHint:
        "Upload a new version of this document. The old version will be kept in history.",
      uploadHint: "Click to select a PDF file",
      uploading: "Uploading...",
      emptyFolder: "This folder is empty",
      noAccess: "No access",
      breadcrumbHome: "Home",

      // Sort & View
      sortBy: "Sort by",
      sortByName: "Name",
      sortByDate: "Date",
      sortByVersion: "Version",
      sortManual: "Manual (Drag)",
      selected: "Selected",
      bulkDeleteConfirm: "Are you sure you want to delete selected items?",

      // Theme
      lightMode: "Light mode",
      darkMode: "Dark mode",

      // Confirm
      confirmDelete: "Confirm Delete",
      confirmDeleteMessage: "Are you sure you want to delete this item?",

      // Users & Permissions (Stage 3)
      users: "Users",
      assignedProjects: "Assigned Projects",
      inviteUser: "Invite User",
      inviteEmail: "Email address",
      inviteRole: "Role",
      inviteProjects: "Projects",
      inviteLink: "Copy invite link",
      inviteCopied: "Link copied!",
      invitePending: "Pending Invitations",
      inviteCancel: "Cancel Invitation",
      inviteSend: "Send Invitation",
      inviteExpired: "This invitation has expired",
      inviteAlreadyAccepted: "This invitation has already been accepted",
      noPendingInvitations: "No pending invitations",
      actions: "Actions",

      // Permissions
      permissions: "Permissions",
      canView: "View",
      canEdit: "Edit",
      canDelete: "Delete",
      canDownload: "Download",
      canMarkup: "Markup",
      canManage: "Manage",
      editPermissions: "Edit Permissions",

      // Role management
      changeRole: "Change Role",
      removeUser: "Remove User",
      removeUserConfirm:
        "Are you sure you want to remove this user from the company? Their project assignments will be deleted.",
      noUsers: "No users found",
      userRemoved: "User removed successfully",
      roleUpdated: "Role updated successfully",
      inviteSent: "Invitation sent!",

      // Project assignments
      assignToProject: "Add to Project",
      unassignFromProject: "Remove from Project",
      assignBtn: "Add",
      noProjectAssignments: "No project assignments yet",

      // Permission presets
      presetWorker: "Default: View + Download + Markup",
      presetTeamLead: "Default: View + Edit + Download + Markup + Manage",
      presetClient: "Default: View + Download",

      // Accept invitation
      acceptInvitation: "You've been invited!",
      invitationCompany: "Company",
      inviteAcceptHint: "Sign in with Google to accept the invitation",
      joinCompany: "Join Company",

      // Add existing user
      addExistingUser: "Add User",
      addUserHint:
        "Search for users who have already signed in with Google. They will be added to your company.",
      searchByEmailOrName: "Search by email or name...",
      noCompany: "No company",

      // Filters & sorting
      filterByRole: "Filter by role",
      filterByProject: "Project",
      allRoles: "All roles",
      allProjects: "All projects",
      tags: "Tags",
      registered: "Registered",

      // Custom roles
      customRoles: "Custom Roles",
      createCustomRole: "Create Role",
      editCustomRole: "Edit Role",
      deleteCustomRole: "Delete Role",
      roleName: "Role name",
      roleColor: "Color",
      defaultPermissions: "Default Permissions",
      deleteRoleConfirm:
        "Are you sure you want to delete this custom role? Users with this role will lose it.",
      noCustomRoles: "No custom roles created yet",
      customRole: "Custom Role",
      noCustomRole: "None",

      // Tags
      addTag: "Add tag",
      enterTag: "Enter tag name...",
      userTags: "Tags",
      manageCompanyRoles: "Manage Company Roles",
      rolesSubtitle: "Standard and custom roles available in your company.",
      systemRoleLabel: "SYSTEM",
      addRole: "Add Role",
      defaultPermissionsForRole: "Default Permissions for this role",
      permsHint:
        "These permissions will be applied automatically when you assign a user with this role to a project.",

      // Scope
      scopeFull: "Full Access",
      scopeSelective: "Selective Access",
      selectiveAccessTitle: "Selective Access",
      selectiveHint:
        "Choose specific folders and documents this user can access.",
      editSelectiveAccess: "Edit Selective Access",
      noSelectiveItems: "No specific folders or documents selected",

      // Misc
      dropFilesToUpload: "Drop files to upload",
      dropFilesHint: "Files will be added to the current folder",
      noPermissionToUpload:
        "You do not have permission to upload files to this project.",
      companyRole: "Role",
      company: "Company",
      confirmChangeCompany:
        "Changing company will remove all current project assignments and tags. Proceed?",
      done: "Done",
      close: "Close",
      search: "Search",
      save: "Save",
      removeAccess: "Remove Access",
      viewer: "Viewer",
      editor: "Editor",
      errorNameRequired: "Name is required",
      errorEmailRequired: "Email is required",
      errorInvalidEmail: "Invalid email format",
      errorRoleRequired: "Please select a role",

      // Table headers
      name: "Name",
      type: "Type",
      version: "Version",
      description: "Description",
      date: "Date & Time",
      companyName: "Company Name",
      createdAt: "Created At",

      // Sharing
      addUserToScope: "Add user",
      searchUsers: "Search users",
      whoHasAccess: "Who has access",
      noSpecificPermissions: "No specific permissions set",
      canManageHint: "Can invite/assign other users to this scope",
      copyLink: "Copy Invite Link",
      sending: "Sending...",

      // Audit Logs
      auditLogTitle: "Audit Logs",
      auditLogs: "Audit Logs",
      filterByUser: "Filter by User",
      filterByAction: "Action Type",
      filterByFolder: "Folder",
      filterByCompany: "Company",
      filterByTag: "Tag",
      allActions: "All Actions",
      allCompanies: "All Companies",
      allFolders: "All Folders",
      allTags: "All Tags",
      clearFilters: "Reset Filters",
      dateFrom: "Date From",
      dateTo: "Date To",
      searchByUserPlaceholder: "Start typing name or email...",
      noUsersFound: "No users found",
      noLogsFound: "No activity logs match your search criteria.",
      user: "User",
      action: "Action",
      details: "Context Details",
      viewAsUser: "View as this user",

      // Access control
      accessDeniedAdmin: "Access denied. Admin privileges required.",
      adminOnlyPage: "This page is available only for administrators.",

      // PDF Viewer
      pdfViewer: "PDF Viewer",
      pages: "Pages",
      page: "Page",
      bookmarks: "Bookmarks",
      markups: "Markups",
      properties: "Properties",
      selectMarkup: "Select a markup",
      noMarkups: "No markups yet",
      author: "Author",
      created: "Created",
      subject: "Subject",
      comments: "Comments",
      customProperties: "Custom Properties",
      addProperty: "Add Property",
      deleteMarkup: "Delete Markup",
      presets: "Presets",
      createPreset: "Create Preset",
      applyPreset: "Apply Preset",
      presetName: "Preset Name",
      deletePreset: "Delete Preset",
      applyToAll: "Apply to All Markups",
      propertyKey: "Property Name",
      propertyValue: "Value",
    },
  },
  uk: {
    translation: {
      appName: "WISE SMART PDF",
      appDescription: "Інтелектуальна платформа для роботи з PDF",
      welcome: "Вітаємо, {{name}}!",
      email: "Email",
      role: "Роль",
      roleWithName: "Роль: {{role}}",
      loginTitle: "Увійти в систему",
      loginDescription: "Використовуйте Google акаунт для входу",
      noConfigWarn:
        "GOOGLE_CLIENT_ID не налаштовано. Вставте свій ключ у файл .env",
      logout: "Вийти",
      dashboardTitle: "Панель керування",
      myCompany: "Моя Компанія",
      noCompanyAssigned: "Ви ще не прив'язані до жодної компанії.",
      projects: "Проєкти",
      noProjects: "Проєктів не знайдено.",
      noDescription: "Без опису",
      createCompanyBtn: "Створити Компанію",
      createProjectBtn: "Створити Проєкт",
      dialogCreateCompanyTitle: "Створити Нову Компанію",
      dialogCreateProjectTitle: "Створити Новий Проєкт",
      nameLabel: "Назва",
      descLabel: "Опис",
      cancelBtn: "Скасувати",
      submitBtn: "Створити",
      rename: "Перейменувати",
      delete: "Видалити",
      share: "Поділитися",
      confirmBtn: "Підтвердити",
      renameFolder: "Перейменувати Папку",
      deleteFolder: "Видалити Папку",
      renameProject: "Перейменувати Проєкт",
      deleteProject: "Видалити Проєкт",
      deleteProjectConfirm:
        "Ви впевнені що хочете видалити цей проєкт? Це видалить всі папки, файли та маркапи в ньому.",
      renameDocument: "Перейменувати Документ",

      // Search
      searchPlaceholder: "Пошук проєктів, папок, документів...",
      searchNoResults: "Нічого не знайдено",

      // File Manager
      folders: "Папки",
      documents: "Документи",
      createFolder: "Нова Папка",
      uploadDocument: "Завантажити PDF",
      downloadDocument: "Завантажити",
      deleteDocument: "Видалити",
      replaceDocument: "Нова Версія",
      replaceHint:
        "Завантажте нову версію документа. Стара версія збережеться в історії.",
      uploadHint: "Натисніть щоб обрати PDF файл",
      uploading: "Завантаження...",
      emptyFolder: "Ця папка порожня",
      noAccess: "Немає доступу",
      breadcrumbHome: "Головна",

      // Sort & View
      sortBy: "Сортувати за",
      sortByName: "Назвою",
      sortByDate: "Датою",
      sortByVersion: "Версією",
      sortManual: "Вручну (Drag-n-Drop)",
      selected: "Обрано",
      bulkDeleteConfirm: "Ви впевнені, що хочете видалити обрані елементи?",

      // Theme
      lightMode: "Світла тема",
      darkMode: "Темна тема",

      // Confirm
      confirmDelete: "Підтвердіть видалення",
      confirmDeleteMessage: "Ви впевнені, що хочете видалити цей елемент?",

      // Users & Permissions (Stage 3)
      users: "Користувачі",
      assignedProjects: "Призначені проєкти",
      inviteUser: "Запросити користувача",
      inviteEmail: "Email адреса",
      inviteRole: "Роль",
      inviteProjects: "Проєкти",
      inviteLink: "Скопіювати посилання",
      inviteCopied: "Посилання скопійовано!",
      invitePending: "Очікують подвтердження",
      inviteCancel: "Скасувати запрошення",
      inviteSend: "Надіслати запрошення",
      inviteExpired: "Запрошення закінчилось",
      inviteAlreadyAccepted: "Запрошення вже прийнято",
      noPendingInvitations: "Немає очікуючих запрошень",
      actions: "Дії",

      // Permissions
      permissions: "Права доступу",
      canView: "Перегляд",
      canEdit: "Редагування",
      canDelete: "Видалення",
      canDownload: "Завантаження",
      canMarkup: "Маркап",
      canManage: "Управління",
      editPermissions: "Редагувати права",

      // Role management
      changeRole: "Змінити роль",
      removeUser: "Видалити користувача",
      removeUserConfirm:
        "Ви впевнені що хочете видалити цього користувача з компанії? Всі призначення на проєкти будуть видалені.",
      noUsers: "Користувачів не знайдено",
      userRemoved: "Користувача видалено",
      roleUpdated: "Роль оновлено",
      inviteSent: "Запрошення надіслано!",

      // Project assignments
      assignToProject: "Додати до проєкту",
      unassignFromProject: "Видалити з проєкту",
      assignBtn: "Додати",
      noProjectAssignments: "Немає призначень на проєкти",

      // Permission presets
      presetWorker: "За замовчуванням: Перегляд + Завантаження + Маркап",
      presetTeamLead:
        "За замовчуванням: Перегляд + Редагування + Завантаження + Маркап + Управління",
      presetClient: "За замовчуванням: Перегляд + Завантаження",

      // Accept invitation
      acceptInvitation: "Вас запрошено!",
      invitationCompany: "Компанія",
      inviteAcceptHint: "Увійдіть через Google щоб прийняти запрошення",
      joinCompany: "Приєднатися до компанії",

      // Add existing user
      addExistingUser: "Додати користувача",
      addUserHint:
        "Шукайте користувачів, які вже увійшли через Google. Вони будут додані до вашої компанії.",
      searchByEmailOrName: "Пошук за email або ім'ям...",
      noCompany: "Без компанії",

      // Filters & sorting
      filterByRole: "Фільтр за роллю",
      filterByProject: "Проєкт",
      allRoles: "Всі ролі",
      allProjects: "Всі проєкти",
      tags: "Теги",
      registered: "Зареєстрований",

      // Custom roles
      customRoles: "Кастомні ролі",
      createCustomRole: "Створити роль",
      editCustomRole: "Редагувати роль",
      deleteCustomRole: "Видалити роль",
      roleName: "Назва ролі",
      roleColor: "Колір",
      defaultPermissions: "Права за замовчуванням",
      deleteRoleConfirm:
        "Ви впевнені що хочете видалити цю роль? Користувачі з цією роллю втратять її.",
      noCustomRoles: "Кастомних ролей ще не створено",
      customRole: "Кастомна роль",
      noCustomRole: "Немає",

      // Tags
      addTag: "Додати тег",
      enterTag: "Введіть назву тегу...",
      userTags: "Теги",
      manageCompanyRoles: "Управління ролями компанії",
      rolesSubtitle: "Стандартні та кастомні ролі, доступні у вашій компанії.",
      systemRoleLabel: "СИСТЕМНА",
      addRole: "Додати роль",
      defaultPermissionsForRole: "Права за замовчуванням для цієї ролі",
      permsHint:
        "Ці права будуть застосовані автоматично при призначенні користувача з цією роллю на проект.",

      // Scope
      scopeFull: "Повний доступ",
      scopeSelective: "Вибірковий доступ",
      selectiveAccessTitle: "Вибірковий доступ",
      selectiveHint:
        "Оберіть конкретні папки та документи, до яких матиме доступ цей користувач.",
      editSelectiveAccess: "Редагувати вибірковий доступ",
      noSelectiveItems: "Конкретних папок чи документів не обрано",

      // Misc
      noRole: "Без ролі",
      systemRole: "Системна роль",
      dropFilesToUpload: "Перетягніть файли для завантаження",
      dropFilesHint: "Файли будуть додані до поточної папки",
      noPermissionToUpload:
        "У вас немає прав для завантаження файлів до цього проєкту.",
      companyRole: "Роль",
      company: "Компанія",
      confirmChangeCompany:
        "Зміна компанії призведе до видалення всіх поточних призначень на проєкти та тегів. Продовжити?",
      done: "Готово",
      close: "Закрити",
      search: "Пошук",
      save: "Зберегти",
      removeAccess: "Видалити доступ",
      viewer: "Читач",
      editor: "Редактор",
      errorNameRequired: "Назва обов'язкова",
      errorEmailRequired: "Email обов'язковий",
      errorInvalidEmail: "Невірний формат email",
      errorRoleRequired: "Будь ласка, оберіть роль",

      // Table headers
      name: "Назва",
      type: "Тип",
      version: "Версія",
      description: "Опис",
      date: "Дата і час",
      companyName: "Назва компанії",
      createdAt: "Дата створення",

      // Sharing
      addUserToScope: "Додати користувача",
      searchUsers: "Пошук користувачів",
      whoHasAccess: "Хто має доступ",
      noSpecificPermissions: "Немає конкретних прав доступу",
      canManageHint:
        "Може запрошувати/призначати інших користувачів в цей скоуп",
      copyLink: "Скопіювати посилання-запрошення",
      sending: "Надсилання...",

      // Audit Logs
      auditLogTitle: "Журнал дій",
      auditLogs: "Журнал дій",
      filterByUser: "Фільтр за користувачем",
      filterByAction: "Тип дії",
      filterByFolder: "Папка",
      filterByCompany: "Компанія",
      filterByTag: "Тег",
      allActions: "Всі дії",
      allCompanies: "Всі компанії",
      allFolders: "Всі папки",
      allTags: "Всі теги",
      clearFilters: "Скинути фільтри",
      dateFrom: "Дата з",
      dateTo: "Дата по",
      searchByUserPlaceholder: "Почніть вводити ім'я або email...",
      noUsersFound: "Користувачів не знайдено",
      noLogsFound: "Записів дій за вашими критеріями не знайдено.",
      user: "Користувач",
      action: "Дія",
      details: "Деталі",
      viewAsUser: "Переглянути як цей користувач",

      // Access control
      accessDeniedAdmin: "Доступ заборонено. Потрібні права адміністратора.",
      adminOnlyPage: "Ця сторінка доступна лише адміністраторам.",

      // PDF Viewer
      pdfViewer: "PDF переглядач",
      pages: "Сторінки",
      page: "Сторінка",
      bookmarks: "Закладки",
      markups: "Маркапи",
      properties: "Властивості",
      selectMarkup: "Оберіть маркап",
      noMarkups: "Маркапів ще немає",
      author: "Автор",
      created: "Створено",
      subject: "Тема",
      comments: "Коментарі",
      customProperties: "Кастомні властивості",
      addProperty: "Додати властивість",
      deleteMarkup: "Видалити маркап",
      presets: "Пресети",
      createPreset: "Створити пресет",
      applyPreset: "Застосувати пресет",
      presetName: "Назва пресету",
      deletePreset: "Видалити пресет",
      applyToAll: "Застосувати до всіх",
      propertyKey: "Назва властивості",
      propertyValue: "Значення",
    },
  },
  ru: {
    translation: {
      appName: "WISE SMART PDF",
      appDescription: "Интеллектуальная платформа для работы с PDF",
      welcome: "Добро пожаловать, {{name}}!",
      email: "Email",
      role: "Роль",
      roleWithName: "Роль: {{role}}",
      loginTitle: "Войти в аккаунт",
      loginDescription: "Используйте Google аккаунт для входа",
      noConfigWarn:
        "GOOGLE_CLIENT_ID не настроен. Вставьте ваш ключ в файл .env",
      logout: "Выйти",
      dashboardTitle: "Панель управления",
      myCompany: "Моя Компания",
      noCompanyAssigned: "Вы еще не привязаны ни к одной компании.",
      projects: "Проекты",
      noProjects: "Проекты не найдены.",
      noDescription: "Без описания",
      createCompanyBtn: "Создать Компанию",
      createProjectBtn: "Создать Проект",
      dialogCreateCompanyTitle: "Создать Новую Компанию",
      dialogCreateProjectTitle: "Создать Новый Проект",
      nameLabel: "Название",
      descLabel: "Описание",
      cancelBtn: "Отмена",
      submitBtn: "Создать",
      rename: "Переименовать",
      delete: "Удалить",
      share: "Поделиться",
      confirmBtn: "Подтвердить",
      renameFolder: "Переименовать Папку",
      deleteFolder: "Удалить Папку",
      renameProject: "Переименовать Проект",
      deleteProject: "Удалить Проект",
      deleteProjectConfirm:
        "Вы уверены, что хотите удалить этот проект? Это удалит все папки, файлы и разметку внутри него.",
      renameDocument: "Переименовать Документ",

      // Search
      searchPlaceholder: "Поиск проектов, папок, документов...",
      searchNoResults: "Ничего не найдено",

      // File Manager
      folders: "Папки",
      documents: "Документы",
      createFolder: "Новая Папка",
      uploadDocument: "Загрузить PDF",
      downloadDocument: "Скачать",
      deleteDocument: "Удалить",
      replaceDocument: "Новая Версия",
      replaceHint:
        "Загрузите новую версию документа. Старая версия будет сохранена в истории.",
      uploadHint: "Нажмите, чтобы выбрать PDF файл",
      uploading: "Загрузка...",
      emptyFolder: "Эта папка пуста",
      noAccess: "Нет доступа",
      breadcrumbHome: "Главная",

      // Sort & View
      sortBy: "Сортировать по",
      sortByName: "Имени",
      sortByDate: "Дате",
      sortByVersion: "Версии",
      sortManual: "Вручную (Drag-n-Drop)",
      selected: "Выбрано",
      bulkDeleteConfirm: "Вы уверены, что хотите удалить выбранные элементы?",

      // Theme
      lightMode: "Светлая тема",
      darkMode: "Темная тема",

      // Confirm
      confirmDelete: "Подтвердите удаление",
      confirmDeleteMessage: "Вы уверены, что хотите удалить этот элемент?",

      // Users & Permissions
      users: "Пользователи",
      assignedProjects: "Назначенные проекты",
      inviteUser: "Пригласить пользователя",
      inviteEmail: "Email адрес",
      inviteRole: "Роль",
      inviteProjects: "Проекты",
      inviteLink: "Копировать ссылку",
      inviteCopied: "Ссылка скопирована!",
      invitePending: "Ожидают подтверждения",
      inviteCancel: "Отменить приглашение",
      inviteSend: "Отправить приглашение",
      inviteExpired: "Срок действия приглашения истек",
      inviteAlreadyAccepted: "Приглашение уже принято",
      noPendingInvitations: "Нет ожидающих приглашений",
      actions: "Действия",

      // Permissions
      permissions: "Права доступа",
      canView: "Просмотр",
      canEdit: "Редактирование",
      canDelete: "Удаление",
      canDownload: "Скачивание",
      canMarkup: "Разметка",
      canManage: "Управление",
      editPermissions: "Редактировать права",

      // Role management
      changeRole: "Изменить роль",
      removeUser: "Удалить пользователя",
      removeUserConfirm:
        "Вы уверены, что хотите удалить этого пользователя из компании? Все назначения на проекты будут удалены.",
      noUsers: "Пользователи не найдены",
      userRemoved: "Пользователь удален",
      roleUpdated: "Роль обновлена",
      inviteSent: "Приглашение отправлено!",

      // Project assignments
      assignToProject: "Добавить в проект",
      unassignFromProject: "Удалить из проекта",
      assignBtn: "Добавить",
      noProjectAssignments: "Нет назначений на проекты",

      // Permission presets
      presetWorker: "По умолчанию: Просмотр + Скачивание + Разметка",
      presetTeamLead:
        "По умолчанию: Просмотр + Ред. + Скачивание + Разметка + Управление",
      presetClient: "По умолчанию: Просмотр + Скачивание",

      // Accept invitation
      acceptInvitation: "Вас пригласили!",
      invitationCompany: "Компания",
      inviteAcceptHint: "Войдите через Google, чтобы принять приглашение",
      joinCompany: "Присоединиться к компании",

      // Add existing user
      addExistingUser: "Добавить пользователя",
      addUserHint:
        "Ищите пользователей, которые уже вошли через Google. Они будут добавлены в вашу компанию.",
      searchByEmailOrName: "Поиск по email или имени...",
      noCompany: "Без компании",

      // Filters & sorting
      filterByRole: "Фильтр по роли",
      filterByProject: "Проект",
      allRoles: "Все роли",
      allProjects: "Все проекты",
      tags: "Теги",
      registered: "Зарегистрирован",

      // Custom roles
      customRoles: "Кастомные роли",
      createCustomRole: "Создать роль",
      editCustomRole: "Редактировать роль",
      deleteCustomRole: "Удалить роль",
      roleName: "Название роли",
      roleColor: "Цвет",
      defaultPermissions: "Права по умолчанию",
      deleteRoleConfirm:
        "Вы уверены, что хотите удалить эту роль? Пользователи с этой ролью потеряют её.",
      noCustomRoles: "Кастомных ролей еще не создано",
      customRole: "Кастомная роль",
      noCustomRole: "Нет",

      // Tags
      addTag: "Добавить тег",
      enterTag: "Введите название тега...",
      userTags: "Теги",
      manageCompanyRoles: "Управление ролями компании",
      rolesSubtitle:
        "Стандартные и кастомные роли, доступные в вашей компании.",
      systemRoleLabel: "СИСТЕМНАЯ",
      addRole: "Добавить роль",
      defaultPermissionsForRole: "Права по умолчанию для этой роли",
      permsHint:
        "Эти права будут применены автоматически при назначении пользователя с этой ролью на проект.",

      // Scope
      scopeFull: "Полный доступ",
      scopeSelective: "Выборочный доступ",
      selectiveAccessTitle: "Выборочный доступ",
      selectiveHint:
        "Выберите конкретные папки и документы, к которым будет иметь доступ этот пользователь.",
      editSelectiveAccess: "Редактировать выборочный доступ",
      noSelectiveItems: "Конкретные папки или документы не выбраны",

      // Misc
      noRole: "Без роли",
      systemRole: "Системная роль",
      dropFilesToUpload: "Перетащите файлы для загрузки",
      dropFilesHint: "Файлы будут добавлены в текущую папку",
      noPermissionToUpload: "У вас нет прав для загрузки файлов в этот проект.",
      companyRole: "Роль",
      company: "Компания",
      confirmChangeCompany:
        "Смена компании приведет к удалению всех текущих назначений на проекты и тегов. Продолжить?",
      done: "Готово",
      close: "Закрыть",
      search: "Поиск",
      save: "Сохранить",
      removeAccess: "Удалить доступ",
      viewer: "Зритель",
      editor: "Редактор",
      errorNameRequired: "Название обязательно",
      errorEmailRequired: "Email обязателен",
      errorInvalidEmail: "Неверный формат email",
      errorRoleRequired: "Пожалуйста, выберите роль",

      // Table headers
      name: "Название",
      type: "Тип",
      version: "Версия",
      description: "Описание",
      date: "Дата и время",
      companyName: "Название компании",
      createdAt: "Дата создания",

      // Sharing
      addUserToScope: "Добавить пользователя",
      searchUsers: "Поиск пользователей",
      whoHasAccess: "Кто имеет доступ",
      noSpecificPermissions: "Нет конкретных прав доступа",
      canManageHint:
        "Может приглашать/назначать других пользователей в этот скоуп",
      copyLink: "Копировать ссылку-приглашение",
      sending: "Отправка...",

      // Audit Logs
      auditLogTitle: "Журнал действий",
      auditLogs: "Журнал действий",
      filterByUser: "Фильтр по пользователю",
      filterByAction: "Тип действия",
      filterByFolder: "Папка",
      filterByCompany: "Компания",
      filterByTag: "Тег",
      allActions: "Все действия",
      allCompanies: "Все компании",
      allFolders: "Все папки",
      allTags: "Все теги",
      clearFilters: "Сбросить фильтры",
      dateFrom: "Дата с",
      dateTo: "Дата по",
      searchByUserPlaceholder: "Начните вводить имя или email...",
      noUsersFound: "Пользователи не найдены",
      noLogsFound: "Записей о действиях по вашему запросу не найдено.",
      user: "Пользователь",
      action: "Действие",
      details: "Детали",
      viewAsUser: "Просмотреть как этот пользователь",

      // Access control
      accessDeniedAdmin: "Доступ запрещен. Требуются права администратора.",
      adminOnlyPage: "Эта страница доступна только администраторам.",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

# REDLINES — Полный контекст проекта (Master Document)

## 📋 Оглавление
1. [Концепция проекта](#1-концепция-проекта)
2. [Технологический стек](#2-технологический-стек)
3. [Архитектура системы](#3-архитектура-системы)
4. [Текущее состояние (Stage 20)](#4-текущее-состояние-stage-20)
5. [Проблемы и решения](#5-проблемы-и-решения)
6. [Планы развития](#6-планы-развития)
7. [Оптимизации производительности](#7-оптимизации-производительности)
8. [Интеграции](#8-интеграции)
9. [Ключевые файлы](#9-ключевые-файлы)
10. [Как запустить проект](#10-как-запустить-проект)

---

## 1. Концепция проекта

**Redlines** — это высокопроизводительная облачная платформа для совместной работы с PDF-чертежами, аналог Bluebeam Revu для веба.

### Ключевые принципы:
- **Клиенто-центричное взаимодействие**: Мгновенное открытие чертежей, упрощенная коммуникация
- **Real-time collaboration**: Мультиплеер через Y.js (CRDT синхронизация)
- **High-performance rendering**: Go tile server для рендеринга больших PDF
- **Multi-company architecture**: Пользователи могут принадлежать к нескольким компаниям
- **Granular permissions**: Иерархия прав (Company → Project → Folder → Document)
- **Bluebeam compatibility**: Импорт/экспорт аннотаций Bluebeam

### Целевая аудитория:
- Инженеры-строители
- Архитекторы
- Проектировщики MEP (механика, электрика, сантехника)
- Клиенты строительных компаний

---

## 2. Технологический стек

### Frontend
- **React 19** + TypeScript + Vite
- **Material-UI (MUI)** для UI компонентов
- **Fabric.js** для векторных маркапов на canvas
- **pdfjs-dist** (через react-pdf) для fallback рендеринга
- **Y.js** + y-websocket для real-time синхронизации
- **TanStack React Query** для управления состоянием
- **react-i18next** для интернационализации

### Backend
- **Node.js** + Express 5
- **Prisma 7** + PostgreSQL
- **Socket.io** для real-time событий
- **JWT** аутентификация (7-дневные сессии)
- **Google OAuth 2.0** + Microsoft Graph API (OneDrive)

### Tile Server (Go)
- **Golang 1.23** с MuPDF (go-fitz)
- **HTTP API** вместо WebSocket (Stage 20)
- **LRU кеширование** тайлов в памяти/диске
- **WebP encoding** (quality 75 для тайлов, 88 для thumbnail)
- **Singleflight** для предотвращения дублирующих рендеров

### Инфраструктура
- **Docker Compose** для развертывания
- **PostgreSQL** для основного хранилища
- **Pluggable storage providers**: Local, Google Drive, OneDrive, S3

---

## 3. Архитектура системы

### Монолитная структура
```
redlines/
├── backend/           # Express API + Prisma + Socket.io
├── frontend/          # React + Vite + TypeScript
└── tile-server/       # Go сервис для рендеринга PDF
```

### Data Model (Prisma)
```
Company → Project → Folder (tree) → Document → Markup
       ↘ User (many-to-many via CompanyMembership)
       ↘ Role (company-scoped)
       ↘ Tag
```

### Permission Hierarchy
```
1. GENERAL_ADMIN (системный) → полный доступ везде
2. Company Admin → полный доступ в компании
3. ProjectAssignment → права на уровне проекта
4. FolderPermission → переопределение на уровне папки
5. DocumentPermission → переопределение на уровне документа
```

### Ghost Path Logic
При selective access пользователь видит "призрачные" папки для навигации к доступным вложенным ресурсам.

---

## 4. Текущее состояние (Stage 20)

### ✅ Завершенные этапы

#### Stage 1-4: Инфраструктура и File Manager
- Docker + PostgreSQL + Prisma setup
- Google OAuth 2.0 аутентификация
- Company/Project/Folder/Document CRUD
- DnD сортировка, bulk операции
- Глобальный поиск

#### Stage 5-6: PDF Viewer Core
- Замена @react-pdf-viewer на react-pdf + Fabric.js
- Набор инструментов для рисования (12+ типов маркапов)
- Real-time синхронизация через Y.js
- Панель свойств маркапов

#### Stage 7-9: Расширенный функционал
- Responsive design (mobile/tablet/desktop)
- Поиск по тексту PDF с highlight
- Масштабирование с сохранением в БД
- Split view для сравнения страниц

#### Stage 10-11: Производительность и экспорт
- Оптимизация рендеринга Fabric.js
- Экспорт PDF с маркапами (pdf-lib)
- Импорт аннотаций Bluebeam

#### Stage 12-13: Коллаборация
- Статусы маркапов (open/in-review/resolved)
- Комментарии и threads
- Фильтры по дате/автору/статусу
- Поддержка touch/stylus

#### Stage 14-15: Tile Server интеграция
- Go tile server для high-performance рендеринга
- WebSocket протокол для тайлов
- Fallback на react-pdf при недоступности tile server

#### Stage 16-17: UX улучшения
- Desktop toolbar redesign
- Zoom-to-cursor anchor
- Ctrl+C/V между страницами
- Mobile-optimized toolbar

#### Stage 18-19: Расширенные возможности
- Image markups (загрузка изображений)
- Callout с полным resize
- Custom property filter в sidebar
- Pyramid tile fallback

#### Stage 20: Оптимизация производительности
- **Tile server: WebSocket → HTTP** (упрощение, кеширование)
- **Дискретные уровни зума** (ZOOM_LEVELS массив)
- **Улучшенное кеширование** (ETag, Cache-Control: immutable)
- **Оптимизация памяти** (fitzHandleCount: 4 → 2)

### 🚧 Актуальные проблемы (решаются)

1. **Зум/скролл при переключении инструментов**:
   - Обработчик wheel пересоздается при смене tool
   - Решение: стабильный ref-based handler

2. **Навигация к маркапам на других страницах**:
   - `doTileNavigate` не устанавливает currentPage
   - Решение: добавить `setCurrentPage(pageIdx + 1)`

3. **Медленная первичная загрузка**:
   - Нет агрессивного prefetching
   - Решение: загрузка всех thumbnails при открытии + localStorage кеш

---

## 5. Проблемы и решения

### Проблема: Производительность с большими PDF
**Решение**: Go tile server с тайловым рендерингом
- PDF рендерится на сервере через MuPDF
- Клиент получает только видимые тайлы (512×512 WebP)
- Pyramid fallback: при отсутствии тайла уровня N используется уровень N-1

### Проблема: Real-time синхронизация конфликтов
**Решение**: Y.js (CRDT)
- Conflict-free replicated data types
- Автоматическое разрешение конфликтов
- Дебаунс записи в БД (800ms)

### Проблема: Память в браузере с 1000+ маркапами
**Решение**: Server-side compositing (в разработке)
- Рендеринг маркапов на сервере в составе тайлов
- Клиент получает готовые изображения
- Интерактивные маркапы рендерятся поверх

### Проблема: OneDrive latency
**Решение**: Кеширование на Go сервере
- PDF скачивается один раз при первом запросе
- Хранится в памяти/диске Go сервера
- Все последующие запросы мгновенные

---

## 6. Планы развития

### OneDrive Integration (ONEDRIVE_INTEGRATION_PLAN.md)
**Статус**: В разработке
- Двусторонняя синхронизация WISE ↔ OneDrive
- Per-company OneDrive подключение
- Microsoft Graph API + Webhooks
- Graceful degradation при недоступности OneDrive

### Revit Plugin API (REVIT_API.md)
**Статус**: Готово к реализации
- REST API для Revit плагина
- Token-based аутентификация
- Upload текущего вида как PDF
- Интеграция с существующей структурой папок

### GPU Acceleration (GPU_ACCELERATION_RESEARCH.md)
**Статус**: Исследование
- MuPDF с OpenGL/Vulkan рендерингом
- 3-5x ускорение для векторных PDF
- Docker с GPU support (NVIDIA/Intel/AMD)

### Server-side Compositing (SERVER_SIDE_COMPOSITING_RESEARCH.md)
**Статус**: Исследование
- Рендеринг маркапов на сервере (Cairo/Skia)
- Автоматическое переключение client/server
- Сохранение интерактивности для выбранных маркапов

---

## 7. Оптимизации производительности

### В процессе (OPTIMIZATION_TRACKER.md)

#### A. Go Server Оптимизации
1. **GPU acceleration** (🔄 В процессе) - 2-5x ускорение
2. **CDN integration** (⏳ Не начато) - edge кеширование
3. **Adaptive WebP quality** (⏳ Не начато) - на основе скорости сети
4. **AVIF/WebP2** (⏳ Не начато) - 20-30% уменьшение размера

#### B. Frontend Оптимизации
1. **Web Workers** (🔄 В процессе) - декодирование тайлов в worker
2. **WASM декодер** (⏳ Не начато) - собственный WebP декодер
3. **Predictive prefetch** (⏳ Не начато) - ML для предсказания страниц
4. **Brotli compression** (⏳ Не начато) - дополнительное сжатие

#### C. Маркапы Оптимизации
1. **Server-side compositing** (🔄 В процессе) - для >100 маркапов
2. **WebGL рендеринг** (⏳ Не начато) - Three.js для тысяч маркапов
3. **Incremental sync** (⏳ Не начато) - delta updates вместо полной синхронизации

---

## 8. Интеграции

### Реализовано
- **Google OAuth 2.0** - аутентификация пользователей
- **Microsoft Graph API** - OneDrive storage provider
- **Bluebeam формат** - импорт/экспорт аннотаций

### В планах
- **Autodesk BIM 360** - интеграция с экосистемой Autodesk
- **Procore** - синхронизация с construction management
- **Slack/Microsoft Teams** - уведомления и интеграция

---

## 9. Ключевые файлы

### Frontend
| Файл | Назначение |
|------|-----------|
| `frontend/src/pages/DocumentViewPage.tsx` | Главный PDF viewer (2000+ строк) |
| `frontend/src/components/pdf/TileViewer.tsx` | Go tile server рендерер |
| `frontend/src/components/pdf/MarkupLayer.tsx` | Fabric.js canvas для маркапов |
| `frontend/src/components/pdf/PdfToolbar.tsx` | Панель инструментов |
| `frontend/src/components/pdf/PdfSidebar.tsx` | Боковая панель (5 вкладок) |
| `frontend/src/components/pdf/MarkupPropertiesPanel.tsx` | Свойства маркапов |

### Backend
| Файл | Назначение |
|------|-----------|
| `backend/src/controllers/DocumentController.js` | Управление документами |
| `backend/src/controllers/MarkupController.js` | CRUD маркапов |
| `backend/src/middlewares/permissionMiddleware.js` | Иерархия прав |
| `backend/src/services/storage/StorageFactory.js` | Pluggable storage providers |
| `backend/src/yjsServer.js` | Y.js persistence layer |

### Tile Server (Go)
| Файл | Назначение |
|------|-----------|
| `tile-server/main.go` | HTTP сервер |
| `tile-server/internal/pool/pool.go` | PDF document pool |
| `tile-server/internal/renderer/renderer.go` | MuPDF рендерер |
| `tile-server/internal/cache/cache.go` | LRU кеш тайлов |

---

## 10. Как запустить проект

### Docker (рекомендуется)
```bash
docker-compose up -d --build
# Доступно на http://localhost:3030
```

### Локальная разработка
```bash
# Terminal 1: Tile Server (Go)
cd tile-server
go run main.go

# Terminal 2: Backend (Node)
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Terminal 3: Frontend (Vite)
cd frontend
npm install
npm run dev
```

### Environment variables
```env
# Backend (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=super_secret_jwt_key
STORAGE_TYPE=local  # or 'onedrive', 'google-drive'
TILE_SERVER_URL=http://localhost:8080

# Azure AD для OneDrive
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 📊 Статистика проекта

- **Кодовая база**: ~50,000 строк кода
- **Компоненты**: 100+ React компонентов
- **API endpoints**: 50+ REST endpoints
- **Типы маркапов**: 20+ различных типов
- **Поддерживаемые форматы**: PDF, изображения, Bluebeam annotations

## 🎯 Цели на ближайший период

1. **Исправить зум/скролл** - стабильная работа при переключении инструментов
2. **Улучшить навигацию** - корректный переход к маркапам на других страницах
3. **Ускорить загрузку** - агрессивный prefetching + localStorage кеш
4. **Завершить OneDrive интеграцию** - полная двусторонняя синхронизация

## 📞 Контакты и поддержка

- **Документация**: Этот файл + отдельные MD файлы по темам
- **Версионирование**: Git с semantic versioning
- **Мониторинг**: Встроенные метрики в tile server
- **Логирование**: Structured logs для всех операций

---

*Последнее обновление: 2026-04-05*  
*Версия: Stage 20 (Go tile server оптимизация)*  
*Статус: Production-ready с ongoing оптимизациями*

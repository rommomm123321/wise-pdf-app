# REDLINES — Быстрый старт (TL;DR)

## 🎯 Что это?
**Web-based Bluebeam альтернатива** для совместной работы с PDF-чертежами в строительстве.

## 🏗️ Архитектура
```
Frontend (React + Fabric.js) ↔ Backend (Node + Prisma) ↔ Tile Server (Go + MuPDF)
```

## ✅ Что работает
- **File manager**: Проекты → Папки → Документы (с версионированием)
- **PDF viewer**: 20+ инструментов для разметки (линии, текст, облака и т.д.)
- **Real-time collaboration**: Мультиплеер через Y.js
- **Permissions**: Иерархия прав (компания → проект → папка → документ)
- **Search**: Поиск по тексту PDF + фильтры маркапов
- **Export/Import**: Совместимость с Bluebeam форматом

## 🚀 Ключевая фича: Go Tile Server
**Проблема**: Большие PDF (50+ MB) лагают в браузере.
**Решение**: Go сервер рендерит PDF в тайлы 512×512 WebP.
**Результат**: Любые PDF открываются за 0.5 сек, скролл/зум без лагов.

## 🔧 Текущие задачи (Stage 20+)

### 1. Исправить зум/скролл
**Проблема**: При переключении инструментов (select → pan → textSelect) зум работает некорректно.
**Решение**: Стабильные обработчики событий, не пересоздающиеся при рендере.

### 2. Улучшить навигацию к маркапам
**Проблема**: Клик на маркап в sidebar не переключает страницу.
**Решение**: Добавить `setCurrentPage()` в `doTileNavigate`.

### 3. Ускорить загрузку
**Проблема**: Первое открытие документа медленное.
**Решение**: Агрессивный prefetching всех thumbnails + localStorage кеш.

### 4. OneDrive интеграция
**Статус**: В разработке (см. ONEDRIVE_INTEGRATION_PLAN.md)
**Цель**: Двусторонняя синхронизация с Microsoft OneDrive.

## 📁 Ключевые файлы

### Frontend
- `DocumentViewPage.tsx` - Главный PDF viewer
- `TileViewer.tsx` - Go tile server рендерер  
- `MarkupLayer.tsx` - Fabric.js canvas для маркапов
- `PdfToolbar.tsx` - Панель инструментов
- `PdfSidebar.tsx` - Боковая панель (5 вкладок)

### Backend
- `DocumentController.js` - Управление документами
- `MarkupController.js` - CRUD маркапов
- `permissionMiddleware.js` - Иерархия прав
- `StorageFactory.js` - Pluggable storage (Local/Google/OneDrive)

### Tile Server (Go)
- `main.go` - HTTP сервер
- `pool.go` - PDF document pool (LRU, max 20)
- `renderer.go` - MuPDF рендерер
- `cache.go` - LRU кеш тайлов

## 🚀 Запуск

### Docker (проще всего)
```bash
docker-compose up -d --build
# http://localhost:3030
```

### Локально
```bash
# 1. Go tile server
cd tile-server && go run main.go

# 2. Node backend  
cd backend && npm run dev

# 3. React frontend
cd frontend && npm run dev
```

## 📈 Статус проекта
- **Stage 20**: Go tile server оптимизация (HTTP вместо WebSocket)
- **Готовность**: Production-ready
- **Активные задачи**: Исправление UX проблем + OneDrive интеграция
- **Дальнейшие планы**: GPU acceleration, server-side compositing

## 🔗 Полезные ссылки
- `PROJECT_MASTER_CONTEXT.md` - Полный контекст проекта
- `ONEDRIVE_INTEGRATION_PLAN.md` - План интеграции с OneDrive
- `OPTIMIZATION_TRACKER.md` - Трекер оптимизаций производительности
- `GO_PDF_TILE_SERVER_PLAN.md` - Архитектура Go tile server

---

**Главное преимущество**: Производительность. 100-страничные чертежи открываются мгновенно, 1000+ маркапов без лагов.

**Главная проблема сейчас**: UX нестабильность (зум/навигация) - исправляется в текущем цикле.

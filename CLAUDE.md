# 🗂️ REDLINES — ПОЛНАЯ ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ
> Последнее обновление: 2026-04-07 | Версия сессии: Stage 25 (batch 15)

---

## 📐 АРХИТЕКТУРА ПРОЕКТА

```
redlines/
├── frontend/            # React 19 + TypeScript + Vite + MUI v6
├── backend/             # Node.js + Express + Prisma (PostgreSQL)
├── tile-server/         # Go — высокопроизводительный рендерер PDF в тайлы
├── docker-compose.yml   # Оркестрация: app + tile-server + db
└── CLOUD.md             # Этот файл
```

### Стек технологий
| Слой | Технология |
|------|-----------|
| Frontend | React 19, TypeScript, Vite 8, MUI v6, Fabric.js, Y.js |
| Backend | Node.js, Express, Prisma ORM, PostgreSQL |
| PDF рендеринг | Go (gorilla/mux), pdfium (C binding via CGO) |
| Real-time | Y.js WebSocket (collaborative markup) |
| Auth | JWT (7d), Google OAuth2 |
| Кэш тайлов | L1: in-memory LRU + L2: disk cache (`/tmp/tile-cache`) |
| Deploy | Docker Compose (3 контейнера) |

---

## 🏗️ КЛЮЧЕВЫЕ КОМПОНЕНТЫ

### 1. `TileViewer.tsx` — ядро рендеринга
**Путь:** `frontend/src/components/pdf/TileViewer.tsx`

**Что делает:**
- Canvas-based рендерер PDF через Go tile server
- Tile-based подход: документ делится на тайлы 512×512px
- 5 уровней зума (zoom levels 0-4) соответствующих масштабам `[0.25, 0.5, 1.0, 2.0, 4.0]`
- Пирамидальный рендеринг: при зуме показывает fallback (zoom-0 thumbnail) пока грузятся HD тайлы
- Web Worker для декодирования изображений (tile-decoder.worker)
- Инерционный пан + pointer events

**Дискретные уровни зума (ZOOM_LEVELS):**
```typescript
[0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0, 1.1, 
 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0, 12.0, 20.0]
```

**Ref-архитектура (важно! все стабильные refs чтобы не было re-registration):**
```
viewportRef      — текущий viewport (zoom, x, y) без React stale closure
renderCanvasRef  — функция рендера (вызывается из RAF)
handleWheelRef   — wheel handler (ref чтобы не re-add listener при смене tool)
docInfoRef       — синхронный доступ к DocInfo для imperative handle
pageLayoutsRef   — layout страниц (worldX, worldY, w, h)
isZoomingRef     — флаг активного зума (defer tile fetches)
wheelAccumulatorRef — накопитель дельты для trackpad
```

**Endpoints которые вызывает:**
```
POST /prepare/:documentId?token=...   — инициализация документа
GET  /tiles/:docId/:page/:zoom/:x/:y  — тайл
GET  /thumbnail/:docId/:page          — thumbnail (sidebar)
```

**Imperative Handle (ref API):**
```typescript
interface TileViewerHandle {
  navigateTo(worldX, worldY, zoom)           // перейти к мировой точке
  navigateToPagePoint(pageIndex, pageX, pageY, zoom) // перейти к точке на странице
  navigateToPage(page: number)               // перейти к странице (1-based)
  getViewport()                              // получить текущий viewport
  getPageSize(pageIndex)                     // размер страницы из tile server (0-based)
  screenToWorld(clientX, clientY)            // конвертация координат
  fitPage()                                  // Fit Page (как в Bluebeam)
  fitWidth()                                 // Fit Width (как в Bluebeam)
  prioritizePage(pageIndex)                  // приоритет загрузки страницы
}
```

**Координаты страниц — важно!**
- Tile server возвращает размеры 2× (A4: 1190×1684)
- pdfjs возвращает 1× (A4: 595×842)
- `getPageSize(pageIndex)` → tile server размеры (правильные для навигации)
- Маркапы хранят координаты как доли (0..1) от tile server размеров → умножать на `getPageSize().w/h`

**Loading phases:**
```
loadPhase 0 → "Connecting to tile server…" (indeterminate progress)
loadPhase 1 → "Loading document…" (тайлы грузятся)
loadPhase 2 → контент показан, overlay скрыт
```

---

### 2. `MarkupOverlay.tsx` — разметка поверх TileViewer
**Путь:** `frontend/src/components/pdf/MarkupOverlay.tsx`

- Абсолютно позиционированный слой поверх TileViewer canvas
- Для каждой видимой страницы монтирует `MarkupLayer` (Fabric.js canvas)
- Поддержка text layer через react-pdf `<Page renderMode="none" renderTextLayer>` (для textSelect mode)
- CSS scale trick: `viewport.zoom / renderedZoom` — instant visual feedback при зуме без перерисовки Fabric

**Детали:**
```tsx
// Для каждой видимой страницы:
transform: `translate(${screenX}px, ${screenY}px) scale(${cssScale})`
// screenX/Y рассчитываются из мировых координат TileViewer
```

---

### 3. `DocumentViewPage_temp.tsx` — главная страница документа
**Путь:** `frontend/src/pages/DocumentViewPage_temp.tsx`

> ⚠️ Это АКТИВНАЯ версия (подключена в router.tsx). Старая версия — `DocumentViewPage.tsx` (react-pdf only, не используется)

**Режимы отображения:**
- `continuous` — все страницы вертикально (TileViewer)
- `page` — одна страница (TileViewer)
- `split` — две панели, каждая с react-pdf (legacy, для split view)

**Что инициализирует:**
1. `/api/documents/:id/info` — метаданные документа
2. `/api/documents/:id/proxy` — URL для PDF.js (для поиска и text layer)
3. `pdfjs.getDocument(...)` — pdfDoc для: поиска, page labels, bookmarks, detectAnnotations
4. `TileViewer` — получает `token` и `documentId`, запрашивает `/prepare/`

**Важный reset при смене документа:**
```typescript
useEffect(() => {
  setPageLabels([]);    // сбрасываем сразу
  setBookmarks([]);     // чтобы не показывать старые данные
  setNumPages(0);
  setCurrentPage(1);
  setSearchResults([]);
  // ...
}, [documentId]);
```

**page labels + bookmarks:**
```typescript
// Извлекаем из pdfDoc после загрузки:
const labels = await doc.getPageLabels();
setPageLabels(labels || []);
const outline = await doc.getOutline();
setBookmarks(outline || []);
```

---

### 4. `PdfSidebar.tsx` — боковая панель
**Путь:** `frontend/src/components/pdf/PdfSidebar.tsx`

**Критически важные пропы:**
```tsx
<PdfSidebar
  documentId={documentId}   // ← БЫЛ ПРОПУЩЕН → вечный спиннер
  token={token}             // ← БЫЛ ПРОПУЩЕН → тайлы не грузились
  numPages={numPages}
  pageLabels={pageLabels}
  bookmarks={bookmarks}
  // ...
/>
```

**Логика названий страниц (приоритет):**
1. `pageLabels[i]` — если не просто число
2. `bookmarks[i].title` — название из outline (sheet names)
3. `"Page ${i+1}"` — fallback

**Lazy thumbnails:** `LazyPageThumbnail` — рендерит thumbnail через:
```
GET /thumbnail/:documentId/:pageNum  (через tile server)
```

---

### 5. Go Tile Server
**Путь:** `tile-server/`

**Endpoints:**
```
POST /prepare/:docId?token=...    — загружает PDF в пул, возвращает DocInfo
GET  /tiles/:docId/:page/:zoom/:x/:y  — рендерит тайл 512×512
GET  /thumbnail/:docId/:page          — thumbnail страницы
DELETE /cache/:docId               — очистить кэш
GET  /metrics                      — метрика пула и кэша
GET  /health                       — healthcheck
WS   /ws/doc/:docId                — WebSocket (legacy)
```

**DocInfo (возвращается /prepare/):**
```json
{
  "docId": "...",
  "pageCount": 42,
  "pages": [{ "w": 1190, "h": 1684 }, ...]
}
```

**Кэш двухуровневый:**
- L1: in-memory LRU (настраивается `TILE_CACHE_MAX_ITEMS`, default 5000)
- L2: disk cache (`/tmp/tile-cache`)

**Pool PDF-документов:**
- `PDF_POOL_MAX_SIZE` (default 50) — максимум открытых PDF в памяти

---

### 6. Backend Proxy (server.js)
**Путь:** `backend/server.js`

Backend Express проксирует tile server запросы на `http://tile-server:8080`:

```javascript
const tileProxyPaths = ['/tiles/', '/thumbnail/', '/prepare/', '/cache/', '/metrics'];
app.use(tileProxyPaths, (req, res) => {
  // proxy to TILE_SERVER_URL
});

// WebSocket upgrade proxy для /ws/
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws/')) {
    net.createConnection(tilePort, tileHost, () => { ... })
  }
});
```

---

## 🔄 ПОТОК ДАННЫХ — ОТКРЫТИЕ ДОКУМЕНТА

```
User opens /projects/:id/documents/:docId
    │
    ├─→ GET /api/documents/:docId/info        → doc metadata, scale
    ├─→ GET /api/documents/:docId/proxy       → PDF binary (for pdfjs)
    │
    ├─→ pdfjs.getDocument(url)                → pdfDoc proxy
    │       ├─→ doc.getPageLabels()           → pageLabels[]
    │       ├─→ doc.getOutline()              → bookmarks[]
    │       └─→ doc.getPage(1).getViewport()  → pageDimensions
    │
    └─→ TileViewer mounts
            │
            └─→ POST /prepare/:docId?token=...  → DocInfo (pageCount, pages[])
                    │
                    ├─→ setLoadPhase(1)          → "Loading document…"
                    ├─→ prefetch ALL zoom-0 thumbnails (aggressive)
                    └─→ fetch visible tiles at current zoom level
                            │
                            └─→ first tile arrives → setLoadPhase(2) → overlay hides
```

---

## 🎮 ZOOM BEHAVIOUR (Bluebeam-style)

### Реализованное поведение:
| Действие | Результат |
|----------|-----------|
| `Ctrl + колёсико` | Зум к курсору, строго 1 уровень за тик |
| `Колёсико без Ctrl` | Только скролл (вертикальный пан) |
| `+` / `-` кнопки в тулбаре | Зум к центру |
| **Fit Page** кнопка | Вся страница в viewport (с отступом 24px) |
| **Fit Width** кнопка | Страница по ширине контейнера |

### Формула zoom-to-cursor:
```typescript
// Мировая точка под курсором до зума:
const worldX = prev.x + (mouseScreenX - containerCenterX) / prev.zoom;
const worldY = prev.y + mouseScreenY / prev.zoom;

// Новый viewport чтобы та же точка осталась под курсором:
const rawX = worldX - (mouseScreenX - containerCenterX) / nextZoom;
const rawY = worldY - mouseScreenY / nextZoom;
```

> **Ключевой момент:** `containerCenterX` — горизонтальный центр (X центрирован),
> `Y` измеряется от верха (0 = верх viewport).

### Trackpad vs мышь:
```typescript
const isStandardMouse = Math.abs(delta) >= 50;  // мышь даёт ~100
// Trackpad: накапливаем до порога 40 → только 1 уровень
// Мышь: сразу 1 уровень за событие
```

---

## 📋 ЧЕКПОИНТЫ — ЧТО БЫЛО СДЕЛАНО

### Stage 1-10 (предыдущие сессии)
- Базовый react-pdf просмотрщик
- Markup (Fabric.js) — все инструменты: pen, rect, circle, line, arrow, cloud, text, callout, measure, polyline, image, highlighter
- Y.js collaborative editing (real-time маркапы между пользователями)
- Аутентификация Google OAuth2 + JWT
- Управление компаниями, проектами, папками, документами
- Версионирование документов
- Поиск по тексту PDF + по маркапам
- Bookmarks (outline) навигация
- PdfSidebar с thumbnails

### Stage 11-15
- Go Tile Server разработан с нуля
- WebSocket подключение TileViewer → tile server
- Пирамидальный рендеринг (zoom levels 0-4)
- Web Worker для decode тайлов (prevent UI freeze)
- Aggressive prefetch всех thumbnails при открытии

### Stage 16-18
- Split view режим (два PDF рядом)
- MarkupOverlay поверх TileViewer
- Page mode (одна страница)
- Export PDF с маркапами
- Import annotations из Bluebeam PDF

### Stage 19
- **FIX:** TileViewer — двойной promise в `decodeTileImage` (race condition)
- **FIX:** `isDraggingState` как React state (ранее ref) → правильный cursor
- **FIX:** Event listener re-creation при смене tool → jitter при зуме

### Stage 20
- **FIX:** `handleJumpToPage` — пропущена зависимость `pageDimensions.width`
- **FIX:** `PdfSidebar` не получал `token` → вечный спиннер в списке страниц
- **ADD:** Full-screen loading overlay с progress bar (3 фазы)
- **ADD:** Smooth transitions на loading overlay

### Stage 21
- **FIX:** `router.tsx` подключал `DocumentViewPage.tsx` (react-pdf) вместо `DocumentViewPage_temp.tsx` (TileViewer) → tile server не задействован!
- **FIX:** Нормальный view заменён с `<Document>/<Page>` на `<TileViewer> + <MarkupOverlay>`
- **ADD:** Loading overlay в TileViewer (loadPhase 0/1 → чёрный экран заменён на анимированный лоадер)
- **FIX:** `pageLabels` и `bookmarks` теперь извлекаются из `pdfDoc` напрямую (не только через `onDocumentLoadSuccess` react-pdf)
- **FIX:** Мгновенный сброс `pageLabels/bookmarks/numPages` при смене документа (не показываем старые данные)
- **FIX:** `PdfSidebar` — приоритетная логика названий листов: pageLabel → bookmark title → "Page N"
- **REWRITE:** Wheel handler — Bluebeam-style zoom-to-cursor с правильной формулой
- **ADD:** `fitPage()` и `fitWidth()` в TileViewerHandle
- **ADD:** Кнопки Fit Page / Fit Width в PdfToolbar (иконки FitScreen, CropLandscape)
- **FIX:** `docInfoRef.current` синхронизируется сразу в `.then((info) =>` (для imperative handle)

### Stage 22 — Оптимизация 800-900MB PDF файлов и улучшенная синхронизация
- **FIX:** `TileViewer` — использование `useLayoutEffect` для синхронного сброса `transform` overlay сразу после React render. Устранено "дерганье" (jitter) маркапов при панорамировании.
- **ADD:** `qualityForZoom` (Go backend). Динамическое качество WebP тайлов: zoom 0-1 (thumbnail) = 72..78, zoom 2 = 85, zoom 3 = 92, zoom 4+ (500%+) = 96 (кристально чёткий текст без потери производительности).
- **PERF:** Потоковая загрузка (Streaming) огромных PDF (до 1GB). `io.Copy(disk, resp.Body)` вместо `io.ReadAll`. Избегает скачка оперативной памяти (RAM spike) при загрузке. Увеличен WriteTimeout до 30 минут.
- **ADD:** `/prepare/{docId}/status` endpoint для мониторинга прогресса загрузки PDF пулом.
- **ADD:** Красивый детерминированный loading overlay в `TileViewer`, показывающий загрузку тяжелых документов в мегабайтах (напр., `340.5 MB / 850.1 MB` - `40%`).
- **ADD:** `prioritizePage()` API в `TileViewerHandle`. При навигации (через thumbnails, bookmarks или scroll), TileViewer немедленно прерывает фоновую загрузку старых тайлов (`ac.abort()`) и запрашивает тайлы (и zoom-0, и целевой zoom) для выбранной страницы. Устраняется ожидание при скачках по большому документу.

### Stage 23 (текущий) — UX-полировка, исправление навигации и производительности

#### Batch 1 — Критические баги просмотра
- **FIX:** Зависание интерфейса на 5 секунд при зуме 500%+ — добавлен `MAX_RENDERED_ZOOM = 2.0` в `MarkupOverlay`. Fabric.js больше не создаёт canvas >4760×6736px.
- **FIX:** Поисковые хайлайты не отображались поверх TileViewer — добавлены пропы `searchResults` и `activeSearchResultIndex` в `MarkupOverlay`.
- **FIX:** В режиме Continuous Scroll при скролле принудительно возвращало на страницу 1 — убран вызов `setViewport` в navigation effect для continuous mode (только page mode).
- **FIX (частичный):** Первая страница называлась "Sheets" (название раздела outline) — добавлена последовательная обработка outline (children overwrite parents). Полный fix — в Batch 3 и 23.

#### Batch 2 — Навигация по маркапам и UX
- **FIX:** При клике на маркап в списке маркуп исчезал за краем экрана — заменён `scrollContainerRef.scrollTo()` на `tileViewerRef.current.navigateToPagePoint()`.
- **ADD:** @mention в Reply-треде маркапа — при вводе `@` открывается список участников проекта; отправляется уведомление с ссылкой на маркап.
- **ADD:** Автодополнение ключей в Custom property filter — поле "Field name" показывает выпадающий список всех уникальных кастомных ключей из текущих маркапов.

#### Batch 3 — Качество рендеринга и производительность
- **FIX:** Блокирующий loading overlay убран — заменён тонким прогресс-баром (3px) в верхней части экрана. Страница доступна сразу.
- **FIX:** Размытые маркапы при любом масштабе — включён `enableRetinaScaling: true` в Fabric.js. Физический canvas рендерится в 2×DPR. `MAX_RENDERED_ZOOM` снижен до 2.0 (вместо 3.0).
- **FIX:** Первая страница "Sheets" — полный фикс: глубокий обход outline, дети перезаписывают родителей (sequential, не concurrent).
- **FIX:** Дёргания зума при большом количестве маркапов — убран `setViewport(next)` из wheel handler. Один commit через 180ms debounce.
- **FIX:** Непрерывный скролл прыгал на страницу 1 — убран принудительный setViewport из navigation effect в continuous mode.

#### Batch 4 — Custom filter UI, координаты навигации, плавность пана

- **UX:** Custom property filter — полный редизайн:
  - Поля стекируются вертикально (было в строку)
  - Добавлен `pt: 1` padding при раскрытии
  - X-кнопка для очистки каждого поля по отдельности
  - Pending state (`pendingCustomKey/Value`) — фильтр применяется по кнопке "Apply Filter" (или Enter), не живым обновлением
  - Кнопка "Apply Filter" фиксирует выбранные условия

- **FIX (критичный):** Навигация к маркапу на другой странице не работала в Page mode — `pageLayoutsRef` содержит только текущую страницу. Решение: `navigateToPagePoint` теперь строит synthetic layout из `docInfoRef.current` если страница не найдена в layouts. Добавлен `getPageSize(pageIndex)` в `TileViewerHandle`.

- **FIX (критичный):** Координаты навигации к маркапу были вдвое меньше правильных — `pageDimensions` из pdfjs (595×842 для A4) использовался для расчёта cx/cy, но маркапы хранятся в tile server координатах (1190×1684). `handleJumpToMarkup` теперь вызывает `tileViewerRef.current.getPageSize(m.pageNumber)` для правильного масштаба.

- **FIX (критичный):** В Page mode при клике на маркап другой страницы не было перехода — добавлен `setCurrentPage(m.pageNumber + 1)` + `navigateToPage()` с `setTimeout(doNavigate, 80)` для ожидания rebuild layout.

- **FIX:** Дёргания при пане — `panRafRef` изменён с `requestAnimationFrame` (60fps React re-renders) на `setTimeout(150ms)`. Canvas и CSS transform обновляются синхронно на 60fps через `renderCanvasRef.current()`. React state коммитится ≤7 раз/сек вместо 60 раз/сек → Fabric.js не пересчитывает видимые страницы на каждый пиксель смещения.

- **FIX (финальный):** Первая страница показывала "Sheets" несмотря на предыдущие фиксы — корень: "Sheets" → pageIdx 0, все листы → pageIdx 1+. Финальное решение: `collect()` теперь собирает **только leaf nodes** (без детей). Контейнеры вроде "Sheets" пропускаются полностью, используются только реальные названия листов.

- **FIX:** Детектирование текущей страницы в Continuous Scroll использовало `viewport` (React state, потенциально 150ms устаревший) вместо `viewportRef.current` — исправлено на `vpNow = viewportRef.current`. Устранены ложные срабатывания `onPageChange(1)` при пане.

- **ADD:** Loading indicator восстановлен как non-blocking карточка — маленький card внизу слева с:
  - Пульсирующей PDF иконкой
  - Текстом "Connecting…" (phase 0) или "Loading document…" (phase 1)
  - Прогрессом загрузки в MB для тяжёлых файлов
  - Тонкий gold progress bar вверху
  - Исчезает автоматически как только загружен первый тайл (loadPhase = 2)

### Stage 24 — Bluebeam-style Markups panel + Callout/Cloud fix

#### Batch 1 — Bluebeam-style MarkupTable
- **REWRITE:** `MarkupTable.tsx` (новый файл) — полностью заменил старый список маркапов. Bluebeam-style flat таблица:
  - Sortable columns (Subject / Status / Page / Author / Date)
  - Group By (author / status / page)
  - Shift+click range select, Ctrl+click toggle
  - Right-click context menu: Jump to → Set Status (submenu) → Delete
  - Compact rows 34px с author sublabel
  - Footer: count + quick status dots + bulk delete + clear selection
  - Export CSV
- **UPDATE:** `STATUS_COLORS` / `STATUS_LABELS` в `MarkupListItem.tsx` — Bluebeam statuses: None / Accepted / Rejected / Cancelled / Completed (legacy open/in-progress/resolved/closed оставлены для backward compat display)
- **FIX:** `MarkupPropertiesPanel.tsx` default status: `'open'` → `'none'`
- **CLEANUP:** `PdfSidebar.tsx` — удалено ~200 строк старого markup filter кода, tab===2 заменён на `<MarkupTable>`

#### Batch 2 — Bluebeam PDF status round-trip
- **ADD:** `exportPdfWithMarkups.ts` — `addStatusAnnot()` создаёт PDF reply annotation по ISO 32000-1 §12.5.6.3: `/Subtype /Text /IRT parentRef /RT /R /StateModel (Review) /State (Accepted|Rejected|...)`. `addMarkupAnnotation()` теперь возвращает `PDFRef`, цикл annotateDoc записывает status annotation для маркапов с не-none статусом.
- **ADD:** `importAnnotationsFromPdf.ts` — второй проход после импорта: reply annotations с `stateModel === 'Review'` пропускаются как отдельные маркапы, их `state` применяется к родительскому маркапу через `idToMarkup` map.

#### Batch 3 — MarkupTable стиль под Search section
- **RESTYLE:** Search input — `border: 1px solid divider`, `padding: 7px 10px`, `fontSize: 0.85rem`, `borderRadius: 6px` (идентично Search секции sidebar)
- **RESTYLE:** Select dropdowns — `borderColor: theme.palette.divider` (вместо светлого), height 30px, fontSize 0.82rem
- **RESTYLE:** Строки — minHeight 34px, checkbox 18×18px с `border: divider`, type icon 15-18px, subject 0.83rem
- **UX:** Колонка заголовков: Select All теперь кликабельный текст "Select all" / "Deselect all" / "N selected" — вся строка заголовка кликабельна и очевидна
- **UX:** Status column — убраны bordered pills ("ACCEP" text boxes), заменены простыми цветными dots 8px
- **UX:** Фильтр-бар: 3 строки (search | author+status | group+export) вместо одной переполненной строки
- **ADD:** `MarkupPropertiesPanel.tsx` — textarea поле "Text" для callout типа (редактирование текста выноски прямо из панели свойств)

#### Batch 4 — Callout и Cloud как в Bluebeam
- **ADD:** `pendingCalloutEditRef` в `MarkupLayer.tsx` — после рисования callout, когда `renderMarkup` создаёт Fabric.js textbox, автоматически вызывается `setActiveObject(textbox)` + `enterEditing()` + `selectAll()`. Курсор сразу в поле ввода как в Bluebeam.
- **FIX:** `mouse:dblclick` handler — двойной клик по любой части callout (облако или textbox) → `canvas.discardActiveObject()` → `setActiveObject(textbox)` → `enterEditing()` → `selectAll()`.
- **FIX:** Cloud после рисования — `auto-switch to select` (раньше оставался в режиме рисования). Теперь после завершения cloud: `onSwitchToSelectRef.current?.()` через 50ms.

### Stage 25 — Performance, Document Comparison, Review Stamps, Bluebeam Export, Revit API

#### Batch 1 — Performance (14 из 18 PERF пунктов)

**Ранее (Stage 20-24):** PERF-1 (LRU + `.close()`), PERF-3 (momentum throttle), PERF-4 (visible pages only), PERF-7 (hash-diffing), PERF-8 (pinch throttle), PERF-11 (tile retry), PERF-12 (pendingNavigationRef)

**Stage 25:**
- **PERF-2:** `@tanstack/react-virtual` в MarkupTable — только visible rows в DOM
- **PERF-5:** Go `/search/:docId?q=query` — pdfium text extraction, `fitz.Text()` pre-filter → `fitz.HTML()` координаты
- **PERF-9:** Service Worker `tile-sw.js` — cache-first, 10K max entries, 7-day TTL
- **PERF-10:** Smart prefetch direction — `scrollDirRef` + prefetch only in scroll direction
- **PERF-15:** `React.memo(MarkupLayer)` + `useStablePageMarkups()` — stable per-page arrays
- **PERF-17:** Ctrl+click zoom in / Alt+click zoom out (Bluebeam-style)
- **PERF-18:** Keyboard shortcuts: `+`/`-` zoom, `Ctrl+0` fit page, arrows pan, Space scroll lock

**Не реализовано (сложно/рискованно):** PERF-6 (OffscreenCanvas), PERF-13 (lazy Fabric), PERF-14 (server-side markup render), PERF-16 (cursors)

#### Batch 2 — Cache optimization (4 уровня, все с лимитами)
| Уровень | Тип | Лимит | Eviction |
|---------|-----|-------|----------|
| Browser RAM | `tileCache` Map | 500 tiles | LRU + `bitmap.close()` |
| Service Worker | Cache API | 10000 entries | Async eviction 20% oldest |
| Go L1 RAM | `container/list` | 5000 tiles | O(1) LRU |
| Go L2 Disk | Files | 20000 files | 5-min goroutine, 20% hysteresis |

- **Go L1:** Переписан с `[]string` O(n) на `container/list` O(1)
- **Go L2:** `evictionLoop()` goroutine, `os.Chtimes` для LRU по mtime

#### Batch 3 — Bluebeam full round-trip (import/export)
- **Export:** BSIColumnData (custom props), CreationDate/M, fill opacity (`ca`), `/NM` unique ID
- **Import:** BSIColumnData, FreeTextCallout detection, dates, opacity
- **FIX:** Убран `tilePageSizes` (2x) из export → pdf-lib `page.getSize()` (1x native) → маркапы видны

#### Batch 4 — Search UI
- Cross-page navigation: `setCurrentPage + navigateToPage` перед `navigateToPagePoint` в page mode
- Toolbar: ▲/▼ prev/next, position counter, Group by page, Filter (text/markup), Sort (found/page)
- MUI Selects matching MarkupTable style (30px, divider border, gold)

#### Batch 5 — Navigation fixes
- **Pending nav X formula:** `x: targetWorldX` (was `targetWorldX - (cw/2 - layout.worldX)/zoom`)
- **Pre-fetch before layout:** `navigateToPagePoint` сразу грузит zoom-0 + zoom-1 тайлы
- **Pending nav HD tiles:** После выполнения pending → fetchTile для текущего zoom level
- **prioritizePage fallback:** Если layout не найден → `docInfoRef.current.pages[idx]`
- **Zoom-0 for ALL visible:** `doTileSync` теперь fetchTile zoom-0 для всех visible pages (не только next)

#### Batch 6 — Downloads with progress
- Export PDF: toast `"Page 5 of 42 (12%)"` → success/error
- Download clean: `ReadableStream` с `"12.5 MB (45%)"`
- `triggerBlobDownload()` helper

#### Batch 7 — Review Stamps (15 штампов)
- **Status:** Approved, Rejected, Revise & Resubmit, For Review, Verified
- **Issues:** Dimension Error, Missing Detail, Conflict, Code Violation, Verify, Coordinate
- **Notes:** Note, Question, RFI, Attention
- Toolbar: `PlaylistAddCheckIcon`, Customize Toolbar, More Menu, mobile toolbar
- One-shot: tool+color переключаются → рисуешь → subject/status/comment автозаполняются

#### Batch 8 — Copy/Paste
- **Ctrl+C/V маркапов:** Вставка на currentPage с nudge 2%, polyline points тоже
- **Ctrl+V изображений:** Global paste handler, `createImageBitmap` → dataURL → image markup
- Compare mode exit on document switch (`setCompareConfig(null)` in documentId effect)

#### Batch 9 — Document Comparison (Visual Diff) — КЛЮЧЕВАЯ ФИЧА

**Go Tile Server — Bluebeam-style tinting (`/compare/`):**
```
GET /compare/:docId1/:docId2/:page1/:page2/:zoom/:x/:y
    ?oldColor=CC0000&newColor=00AA44&opacity=50&showOld=1&showNew=1
```
- Рендерит обе страницы → grayscale ink intensity → тинтирует ВСЁ содержимое:
  - Old content → красный (oldColor)
  - New content → зелёный (newColor)
  - Совпадения → тёмный (red+green)
  - Фон → белый
- `showOld=0` → только зелёный; `showNew=0` → только красный
- Cache с `showOld/showNew` в ключе

**CompareDialog (`CompareDialog.tsx`):**
- Оба Select-а выбираемые (Old + New, не только current)
- `useEffect([open])` сбрасывает state при открытии
- Page modes: All / Range (stacked selects) / Custom mapping (карточки Old→New)
- Colors: Old=#CC0000, New=#00AA44
- Responsive: fullScreen на ≤550px

**CompareToolbar — Desktop:**
- Встроен в content area: `position: absolute, top: 8px, left: 50%`
- Pill: `[■Rev1] [■Rev2] ━━━●━━━ 50% 📥💾✕`
- Slider width: 140px (хорошо видно)
- Layer toggles с цветной рамкой

**CompareToolbar — Mobile:**
- Встроен в мобильный toolbar как верхняя строка (borderBottom separator)
- Те же контролы в компактном виде
- Перетаскивается вместе с тулбаром

**TileViewer compare integration:**
- `compareConfigRef` — ref для доступа в fetchTile без re-creation
- `fetchTile` всегда использует `/compare/` URL в compare mode (стандартный cache key)
- Cache flush: `setViewport(prev => ({...prev}))` + fetchTile zoom-0 для всех visible pages + HD tiles
- `compareCacheKey` effect с `prevRef` — skip initial render

**Export Comparison PDF (`exportComparisonPdf.ts`):**
- **Подход:** Round-trip embed: `copyPages → save → load → embedPdf` → Form XObjects
- **OCG синтаксис:** `/OC /LayerOld BDC ... EMC` (тег `/OC` обязателен для Bluebeam)
- **OCProperties:** `{ OCGs: [...], D: { ON: [...], BaseState: /ON, Order: [...] } }`
- **Слои:** "Old Revision" (полная opacity) + "New Revision" (user opacity)
- **Качество:** Вектор, текст выделяемый, все ресурсы через round-trip
- **Размер:** ~23MB для 17 страниц A1 чертежей
- **Save to Project:** Upload в ту же папку + `queryClient.invalidateQueries(['folder-contents'])`

**Compare exit:** `setCompareConfig(null)` при смене documentId

#### Batch 10 — Tile quality
| Zoom | Old | New | Compare |
|------|-----|-----|---------|
| 0 | 72% | 78% | 82% |
| 1 | 78% | 85% | 88% |
| 2 | 85% | 90% | 92% |
| 3 | 92% | 95% | — |
| 4+ | 96% | 97% | 96% |

#### Batch 11 — Revit API + API Password
- **Schema:** `apiPassword String?` на User, `canUpload Boolean @default(true)` на ProjectAssignment/FolderPermission/Role
- **`POST /api/revit/auth/login`:** email + apiPassword → 30d JWT
- **Admin UI:** UserDetailDialog → "API Access" → show/copy/regenerate password
- **Permission:** `canUpload` check в upload endpoint
- **Docs:** `REVIT_INTEGRATION.md`

#### Batch 12 — PDF Layers panel (OCG detection)
- `pdf.getOptionalContentConfig()` при загрузке PDF → `pdfLayers` state
- PdfSidebar Layers tab: секция "PDF Layers" (OCG toggle) + "Markup Layers" (type toggle)
- Props: `pdfLayers`, `onTogglePdfLayer`

#### Batch 13 — UX fixes
- **MarkupOverlay:** `loading={null} noData={null} error={null}` на `<Document>` — убрано "Loading PDF..." текст
- **Compare both Select:** Old и New оба выбираемые (Rev 2 vs Rev 3 при открытой Rev 5)
- **Compare prepare:** `Promise.all([prepare(old), prepare(new)])` — параллельная подготовка
- **File explorer refresh:** `queryClient.invalidateQueries(['folder-contents', 'folder-tree'])` после Save

#### Batch 14 — Compare processing overlay + OCG fix
- **Processing overlay:** `compareProcessing` state → fullscreen blur overlay с spinner + текст "Processing comparison..." при любой compare операции (prepare/export/save). Блокирует весь UI, `zIndex: 2000`.
- **OCG fix (критичный):** pdf-lib `PDFCatalog.set('OCProperties', ...)` **молча игнорирует** значение — serializer пишет только known keys. Решение: `injectOCGIncremental()` — post-processing raw PDF bytes с incremental update (append OCG objects + new catalog + xref + trailer).
- **OCG `/OC` tag:** Content stream BDC syntax `/OC /LayerOld BDC` (тег `/OC` обязателен для Bluebeam).
- **Export round-trip:** `copyPages → save → load → embedPdf` гарантирует рабочие Form XObjects.
- **`useObjectStreams: false`** при save — нужен для пatchable xref формата.

#### Batch 15 — Redline Routing (Cable/Pipe Routing)

**Новый тип маркапов для прокладки маршрутов кабелей/труб от панелей к устройствам.**

**Routing Algorithm (`frontend/src/lib/routingAlgorithm.ts` — NEW):**
```
Чистые геометрические функции без React/Fabric зависимостей:
- projectPointOnPolyline(pt, polyline) → { point, segmentIndex, t, distance }
- extractSubPath(polyline, from, to) → points[]
- offsetPolyline(polyline, offset) → points[] (miter joins, capped scale)
- buildRoute(start, end, backbone, routeIndex, spacing) → points[]
- generateRoutes(start, endpoints[], backbone, spacing) → GeneratedRoute[]
```

**Route Template (Backbone) — `routeTemplate` markup type:**
- Новый инструмент `Route` в тулбаре (`RouteIcon`, рядом с Polyline)
- Рисуется как polyline (click → click → double-click)
- Стиль: серая пунктирная линия, 1px, `showLength: false`
- Определяет коридор/трассу по которой идут маршруты
- Добавлен в Customize Toolbar, DEFAULT_TOOL_ORDER, MarkupTable TYPE_ICONS/LABELS
- Видим в Layers панели с toggle вкл/выкл

**Route Redline — `route` markup type:**
- Автогенерируемый polyline маршрут: Panel → по backbone → ответвление → Device
- Properties: `from`, `to`, `stroke: #FF0000`, `strokeWidth: 2`, `lineStyle: solid`
- При нескольких маршрутах от одной панели — параллельный offset (spacing)

**Два режима работы:**

**Режим 1 — Автороутинг к устройствам:**
1. Захайлайтить устройства → Ctrl+click выбрать
2. ПКМ → "Route Redline" (подпись "N device(s)")
3. RouteWizardDialog: выбор template + spacing
4. Click на панель → маршруты к каждому устройству автоматически

**Режим 2 — Point-to-point (свободный):**
1. Ничего не выбирать
2. ПКМ → "Route Redline" (подпись "Point-to-point")
3. RouteWizardDialog: выбор template + spacing
4. Click A → Click B → Click C → Double-click для завершения
5. Создаются сегменты A→B, B→C по backbone
6. Properties: `from: "Point A"`, `to: "Point B"`, ...

**RouteWizardDialog (`RouteWizardDialog.tsx` — NEW):**
- Step 1: Select Route Template (dropdown)
- Step 2: Spacing (TextField, default 0.005, range 0.001-0.05)
- Step 3: Instructions (разные для device mode vs point-to-point)
- "Start Routing" → closes dialog → crosshair cursor mode

**TileViewer — `worldToPage()` method (NEW):**
- Конвертирует world coordinates → normalized page coordinates (0-1)
- Используется для определения точки клика в routing mode

**Panel-click mode:**
- `routePanelClickMode` state → cursor: crosshair
- Banner: "Click to set start point (panel)"
- Click → `tileViewerRef.screenToWorld → worldToPage → handleGenerateRoutes`
- ESC отменяет

**Multi-click mode (point-to-point):**
- `routeMultiClickMode` + `routeMultiClickPoints[]` state
- Banner: "Route: 3 points — click to add, double-click to finish"
- Toast на каждый клик: "Point C placed"
- Double-click → `handleFinishMultiClickRoute` → создаёт route segments по backbone
- ESC отменяет

**Ключевые файлы:**
| Файл | Изменение |
|------|-----------|
| `frontend/src/lib/routingAlgorithm.ts` | **NEW** — geometry |
| `frontend/src/components/pdf/RouteWizardDialog.tsx` | **NEW** — wizard UI |
| `frontend/src/components/pdf/PdfToolbar.tsx` | DrawTool + button |
| `frontend/src/components/pdf/MarkupLayer.tsx` | drawing + rendering |
| `frontend/src/components/pdf/MarkupTable.tsx` | type icons/labels |
| `frontend/src/components/pdf/TileViewer.tsx` | worldToPage() |
| `frontend/src/pages/DocumentViewPage_temp.tsx` | context menu, wizard, click modes |

---

## 🔬 АНАЛИЗ СЛАБЫХ МЕСТ — ЧТО НУЖНО ИСПРАВИТЬ

> Выявлено анализом исходного кода. Приоритет: P0 = критично, P1 = серьёзно, P2 = надёжность, P3 = производительность/UX.

---

### 🔴 P0 — Блокирует корректную работу функционала

#### P0-1. Поисковые хайлайты отображаются в неправильном месте
**Файл:** `MarkupOverlay.tsx` (строки 158-161)
**Причина:** Search results из pdfjs имеют координаты в 1× пространстве (595×842 для A4). В MarkupOverlay они множатся на `renderedZoom` напрямую — но canvas и маркапы работают в 2× пространстве tile server (1190×1684). Хайлайт появляется примерно в 2× меньшем масштабе и смещён.
**Симптом:** Синий прямоугольник поиска не совпадает с найденным текстом.
**Решение:** Умножить `res.x, res.y, res.w, res.h` на коэффициент масштаба (`tilePageW / pdfjsPageW`, обычно 2.0) перед применением `renderedZoom`.

---

### 🟠 P1 — Серьёзные проблемы качества

#### P1-1. Утечка GPU-памяти: `ImageBitmap` никогда не освобождается
**Файл:** `TileViewer.tsx` — `tileCache.current.clear()` при смене документа
**Причина:** `ImageBitmap` — это GPU текстуры. Они должны быть явно закрыты через `.close()`. При смене документа вызывается `tileCache.current.clear()` без вызова `.close()` на каждом bitmap. За сессию с 10+ открытиями документов GPU-память растёт неограниченно → браузер начинает тормозить или крашится.
**Симптом:** Браузер постепенно замедляется, Chrome DevTools Memory → ImageBitmap occupancy растёт.
**Решение:**
```typescript
// Перед tileCache.current.clear():
for (const bitmap of tileCache.current.values()) bitmap.close();
tileCache.current.clear();
```

#### P1-2. Нет лимита браузерного кэша тайлов (unbounded Map)
**Файл:** `TileViewer.tsx` — `tileCache = useRef(new Map<string, ImageBitmap>())`
**Причина:** `tileCache` растёт без ограничений. При просмотре 100-страничного документа на zoom 3-4 кэш заполняется тысячами тайлов. 1 тайл 512×512 RGBA = 1MB. 1000 тайлов = 1GB RAM/VRAM.
**Решение:** LRU-eviction по количеству тайлов (например, `MAX_TILE_CACHE = 500`). При добавлении нового тайла вычищать самый давний по `tileTimestamps` с вызовом `.close()`.

#### P1-3. Momentum scroll вызывает `setViewport` на 60fps
**Файл:** `TileViewer.tsx` — функция `startMomentum()` (поле `momentumRafRef`)
**Причина:** Во время инерционного скролла после отпускания мыши `setViewport` вызывается в каждом RAF-фрейме (60fps). Это та же проблема что и при пане — React рендерит на 60fps, Fabric пересчитывает видимые страницы, возникают рывки.
**Симптом:** После отпускания при быстром перелистывании → дёргания в первые 0.5-1 сек.
**Решение:** Тот же подход что для pan — throttle `setViewport` до ~150ms внутри `startMomentum`, canvas обновлять через `renderCanvasRef.current()` каждый кадр.

#### P1-4. Pinch-zoom (touch) вызывает `setViewport` на 60fps
**Файл:** `TileViewer.tsx` — `handleTouchMove`, двухпальцевое увеличение
**Причина:** При pinch-zoom вызывается `setViewport(prev => {...})` напрямую в каждом touch-событии — без debounce и без throttle. На мобильных устройствах это критично.
**Решение:** Такой же паттерн — `viewportRef.current` обновлять мгновенно, `setViewport` через setTimeout/throttle.

#### P1-5. Фрагильный `setTimeout(80ms)` для навигации к маркапу на другой странице
**Файл:** `DocumentViewPage_temp.tsx` — `handleJumpToMarkup`
**Причина:** После `setCurrentPage(n)` ждём 80ms, надеясь что React успеет пересчитать `pageLayouts`. На медленном девайсе/большом документе 80ms может не хватить. Маркап будет проигнорирован (layout всё ещё пустой).
**Симптом:** Клик на маркап другой страницы → переход на страницу произошёл, но центрирование на маркапе не сработало.
**Решение:** Вместо timeout — добавить в TileViewerHandle метод `onLayoutReady(pageIndex): Promise<void>` или передавать pending navigation через ref, которая выполняется в следующем `useLayoutEffect` после rebuild pageLayouts.

---

### 🟡 P2 — Надёжность и корректность

#### P2-1. Нет retry при ошибке загрузки тайла
**Файл:** `TileViewer.tsx` — блок `.catch()` в prefetch и fetchTile
**Причина:** При сетевой ошибке или 500 от tile server тайл просто игнорируется. Пустое место остаётся белым навсегда до ручного обновления.
**Решение:** При не-AbortError — 1 retry через 2 секунды (exponential backoff). Максимум 2 повторных попытки.

#### P2-2. Смена документа не отменяет momentum
**Файл:** `TileViewer.tsx` — `useEffect([documentId])`
**Причина:** При смене `documentId` effect абортит in-flight tile requests, но `momentumRafRef.current` не отменяется. RAF продолжает вызывать `startMomentum` → обновляет `viewportRef.current` нового документа некорректными дельтами старого momentum.
**Решение:** Добавить в cleanup effect:
```typescript
if (momentumRafRef.current !== null) {
  cancelAnimationFrame(momentumRafRef.current);
  momentumRafRef.current = null;
}
if (panRafRef.current !== null) {
  clearTimeout(panRafRef.current);
  panRafRef.current = null;
}
```

#### P2-3. `panRafRef` setTimeout не очищается при размонтировании
**Файл:** `TileViewer.tsx`
**Причина:** Если компонент размонтируется пока висит `panRafRef` (timeout 150ms), callback вызовет `setViewport` на unmounted component → React warning + потенциальный crash.
**Решение:** Добавить cleanup в `useEffect` возврат:
```typescript
return () => { if (panRafRef.current !== null) clearTimeout(panRafRef.current); }
```

#### P2-4. Race condition двух источников `pageLabels`
**Файл:** `DocumentViewPage_temp.tsx`
**Причина:** `pageLabels` устанавливается дважды:
1. Быстро: `onDocInfo` → из DocInfo.pages[i].label (tile server)
2. Медленно: async pdfjs outline processing → из bookmark names
Если pdfjs закончил раньше чем tile server (редко, но возможно), правильные имена из outline будут перезаписаны числовыми метками tile server.
**Решение:** Использовать один источник истины. Приоритет: pdfjs outline (если есть) > tile server labels. После получения обоих — merge с приоритетом.

#### P2-5. Нет UI-состояния ошибки при недоступности tile server
**Файл:** `TileViewer.tsx`
**Причина:** Если tile server вернул 502/503 на `/prepare/`, `loadPhase` остаётся на 0 вечно (прогресс-бар никогда не скрывается). Пользователь видит бесконечный лоадер без объяснений.
**Решение:** При ошибке `/prepare/` — перейти в `loadPhase(2)` (убрать лоадер) + показать toast/alert "Tile server unavailable, retrying…". Добавить retry с backoff.

#### P2-6. Tile cache не инвалидируется при смене версии документа
**Файл:** `TileViewer.tsx` — `documentId` как ключ кэша
**Причина:** Ключ тайла: `${documentId}/${page}/...`. При переходе с версии A на версию B documentId МЕНЯЕТСЯ → новый кэш. Но если tile server имеет свой disk cache для старого docId и пользователь вернулся к нему — может показать устаревшие тайлы.
**Статус:** Некритично при текущей архитектуре (documentId = UUID версии), но важно отслеживать.

---

### 🔵 P3 — Производительность и UX

#### P3-1. `localStorage` запись тайлов синхронная в main thread
**Файл:** `TileViewer.tsx` — `decodeTileImage` callback
**Причина:** После декодирования тайла код пытается сохранить его в localStorage через base64 encode + `setItem`. Это synchronous I/O на главном потоке. Для 512×512 WebP это ~1-3ms блок, при быстром скролле — накапливается.
**Решение:** Убрать localStorage запись тайлов (это legacy код, tile server уже имеет свой L1+L2 disk cache). Браузерный in-memory cache достаточен для сессии.

#### P3-2. `workerStatus` и `networkQuality` — мёртвый state
**Файл:** `TileViewer.tsx` — строки 122-123
**Причина:** Состояния `workerStatus` и `networkQuality` вычисляются и хранятся, но нигде не используются для изменения поведения (ни buffer size, ни prefetch количество, ни качество запроса не меняются).
**Решение:** Либо использовать их (например `networkQuality === 'slow'` → меньше prefetch tiles), либо удалить.

#### P3-3. `scale` prop sync создаёт потенциальный feedback loop
**Файл:** `TileViewer.tsx` — строки 240-251
**Причина:** `onZoom(z)` → parent `setZoom(z)` → `scale={zoom}` prop → sync effect → `setViewport(...)`. Защита через `lastOnZoomRef` работает, но при drift float-point значений (0.5000000001 vs 0.5) может вызвать лишний re-render.
**Решение:** Увеличить epsilon с `0.01` до `0.005` или заменить на `Math.round(v.zoom * 1000) !== Math.round(scale * 1000)`.

#### P3-4. MarkupOverlay `visiblePages` на основе stale React state
**Файл:** `MarkupOverlay.tsx`
**Причина:** `visiblePages` useMemo зависит от `viewport` (React state, 150ms задержка при пане). При быстром пане Fabric.js canvas страниц монтируется/размонтируется с задержкой — кратковременно может быть не смонтирован canvas для только что вошедшей в экран страницы.
**Решение:** Добавить padding к visible range (уже есть `PADDING = max(50, min(150, ...))` — возможно увеличить до 300px чтобы canvas не мигал).

#### P3-5. Нет Error Boundary вокруг TileViewer и MarkupOverlay
**Файл:** `DocumentViewPage_temp.tsx`
**Причина:** Если Fabric.js или tile decode выбросит необработанное исключение → весь DocumentViewPage крашится → белый экран без объяснений.
**Решение:** Обернуть `<TileViewer>` и `<MarkupOverlay>` в React ErrorBoundary с user-friendly сообщением и кнопкой "Reload".

---

## 🐛 ИЗВЕСТНЫЕ АРХИТЕКТУРНЫЕ НЮАНСЫ

### 1. Split view — использует react-pdf, не TileViewer
Split mode рендерит панели через `<Document>/<Page>` (react-pdf). Legacy, в TODO на замену.

### 2. Zoom в тулбаре vs TileViewer
`handleZoom()` в DocumentViewPage меняет React state, TileViewer управляет zoom через `viewportRef` внутренне. Рассинхрон возможен. TODO: добавить `zoomIn()/zoomOut()` в TileViewerHandle.

### 3. pdfFile vs TileViewer — двойная загрузка
PDF грузится дважды: pdfjs (поиск, text layer) + tile server (рендеринг). Для 900+ MB файлов pdfjs может вызвать crash браузера. Решение долгосрочное — серверный поиск через tile server.

### 4. Thumbnails в sidebar
`LazyPageThumbnail` → `/thumbnail/:docId/:page` → tile server. Недоступен tile server → `502`.
**Диагностика:** `docker logs redlines_tile_server` и `curl http://localhost:3030/health`

---

## 📦 DOCKER COMPOSE

```yaml
services:
  db:         PostgreSQL 15
  app:        Node.js backend + React static (порт 3030)
  tile-server: Go tile server (порт 8080, внутренний)

# tile-server не экспонирует порт наружу!
# Все запросы с фронтенда идут через proxy в backend/server.js
# app → tile-server по docker network: http://tile-server:8080
```

**Env переменные tile-server:**
```
PORT=8080
EXPRESS_URL=http://app:3030      # для загрузки PDF с backend
JWT_SECRET=...                   # тот же что у backend
PDF_POOL_MAX_SIZE=50
TILE_CACHE_MAX_ITEMS=5000
TILE_SIZE=512
DISK_CACHE_DIR=/tmp/tile-cache
```

**Важно:** tile server сам скачивает PDF с Express по URL:
```
http://app:3030/api/documents/:docId/proxy
```
С JWT токеном переданным во `/prepare/`.

---

## 🚀 ПЛАН ПРОИЗВОДИТЕЛЬНОСТИ — "ВСЁ ЛЕТАЕТ"

> Цель: любой чертёж (1GB+), тысячи маркапов, мгновенный отклик.
> **Статус Stage 25:** 14 из 18 пунктов реализованы. Осталось: PERF-6 (OffscreenCanvas), PERF-13 (lazy Fabric), PERF-14 (server-side markup render), PERF-16 (cursors).

---

### 🔴 TIER-1 — Прямо влияет на "тормоза" (делать первыми)

#### PERF-1. LRU-кэш тайлов + `.close()` ImageBitmap
**Файл:** `TileViewer.tsx` — `tileCache = useRef(new Map<string, ImageBitmap>())`
**Что:** `tileCache` растёт без ограничений. 1 тайл 512×512 RGBA = 1MB. 1000 тайлов = 1GB RAM/VRAM. При смене документа `tileCache.current.clear()` не вызывает `.close()` на GPU-текстурах → GPU memory leak.
**Решение:**
```typescript
const MAX_TILE_CACHE = 400;
const tileLRU = useRef(new Map<string, number>());  // key → timestamp
// При добавлении тайла: tileLRU eviction + bitmap.close() на удаляемых
// При смене документа: for (const bm of tileCache.current.values()) bm.close();
```
**Эффект:** Браузер не замедляется при работе с большими документами весь день.

#### PERF-2. Virtualized MarkupTable (react-virtual)
**Файл:** `MarkupTable.tsx`
**Что:** При 5000+ маркапов DOM рендерит все строки — лаг при открытии панели.
**Решение:** `@tanstack/react-virtual` или `react-window`. Рендерит только видимые строки (~20). Overhead минимальный, выигрыш на 1000+ маркапов огромный.
**Эффект:** Панель маркапов открывается мгновенно при любом количестве маркапов.

#### PERF-3. Momentum scroll throttle (setViewport 60fps → 7fps)
**Файл:** `TileViewer.tsx` — `startMomentum()` функция
**Что:** После отпускания мыши инерционный скролл вызывает `setViewport` в каждом RAF (60fps) → React ре-рендер → Fabric.js пересчитывает страницы → рывки 0.5-1 сек.
**Решение:** Тот же паттерн что для pan — `viewportRef.current` обновляется каждый RAF, `setViewport` коммитится через `setTimeout(~150ms)`.
**Эффект:** Плавный инерционный скролл без дёрганий.

#### PERF-4. Fabric.js объекты только для видимых страниц
**Файл:** `MarkupOverlay.tsx` — `visiblePages` calculation
**Что:** При 200-страничном документе все `MarkupLayer` (Fabric.js canvas) для невидимых страниц висят в памяти с тысячами объектов.
**Решение:** Увеличить `PADDING` для предзагрузки соседних страниц, но **полностью размонтировать** MarkupLayer для страниц дальше ±5 от видимой зоны. При возврате — быстро пересоздать из маркапов (они уже в памяти в Y.js).
**Эффект:** Fabric.js держит в памяти объекты только для 5-7 страниц вместо 200.

#### PERF-5. Серверный поиск (tile server text extraction)
**Файл:** `DocumentViewPage_temp.tsx` — `handleSearch()`
**Что:** pdfjs загружает весь PDF в браузерную память для поиска. Для 900MB PDF → браузер крашится или зависает на 10+ сек.
**Решение:** Go tile server + pdfium умеет `extractText`. Новый endpoint `GET /search/:docId?q=query&page=N` возвращает совпадения с координатами. Pdfjs нужен только для text layer (подсветка выделения мышью), не для поиска.
**Эффект:** Поиск в 1GB PDF работает за 1-2 сек, браузер не зависает.

---

### 🟠 TIER-2 — Крупные улучшения отклика

#### PERF-6. OffscreenCanvas для MarkupLayer (Web Worker)
**Файл:** `MarkupLayer.tsx`
**Что:** Fabric.js рендерит canvas на main thread. При 500+ маркапах на странице → `canvas.requestRenderAll()` может занять 30-50ms → jank (замёрзший интерфейс).
**Решение:** `OffscreenCanvas` + `fabric.Canvas` в Worker через `canvas.transferControlToOffscreen()`. Рендеринг маркапов не блокирует main thread. События мыши проксируются через `postMessage`.
**Эффект:** UI никогда не зависает даже при 1000 маркапах на странице.

#### PERF-7. Incremental Y.js markup diff (не перерендеривать всё)
**Файл:** `MarkupLayer.tsx` — `useEffect([markups])`
**Что:** При любом изменении маркапов (даже одного) `useEffect` запускает полный цикл `renderMarkup` для всех маркапов на странице.
**Решение:** Использовать `yMap.observe()` напрямую в MarkupLayer — получать diff (added/modified/deleted IDs). Перерисовывать только изменённые объекты через `objectCache`.
**Эффект:** При коллаборации (несколько пользователей) UI не "моргает" при каждом чужом движении.

#### PERF-8. Pinch-zoom throttle (mobile)
**Файл:** `TileViewer.tsx` — `handleTouchMove`
**Что:** `setViewport` на каждое touch-событие. На мобильных 120fps → 120 React ре-рендеров/сек.
**Решение:** `viewportRef.current` обновляется немедленно, `setViewport` через `setTimeout(80ms)`.
**Эффект:** Плавный pinch-zoom на iOS/Android.

#### PERF-9. IndexedDB tile cache (persist between sessions)
**Что:** Сейчас тайлы кэшируются только в RAM. При перезагрузке страницы всё заново.
**Решение:** Service Worker перехватывает `/tiles/` запросы. Ответы кэшируются в Cache API. Повторное открытие того же документа — тайлы из кэша (0ms latency).
**Эффект:** Второе открытие документа мгновенное. Особенно заметно для больших чертежей.

#### PERF-10. Tile prefetch — умная стратегия
**Файл:** `TileViewer.tsx` — prefetch logic
**Что:** Сейчас агрессивно prefetch-ится каждый тайл при скролле. При быстром листании запускаются сотни запросов которые AbortController отменяет.
**Решение:** `IntersectionObserver`-style prefetch: prefetch только для тайлов в viewport + 1 страница вперёд в направлении скролла. Detect scroll direction из `viewportRef` delta.
**Эффект:** 3-5× меньше сетевых запросов при быстром листании.

---

### 🟡 TIER-3 — Заметные улучшения UX

#### PERF-11. Tile retry с exponential backoff
**Файл:** `TileViewer.tsx` — `.catch()` блоки
**Что:** При сетевой ошибке тайл остаётся белым навсегда.
**Решение:** При не-AbortError → retry через 2s → retry через 5s → показать placeholder.

#### PERF-12. `onLayoutReady` вместо `setTimeout(80ms)` в handleJumpToMarkup
**Файл:** `DocumentViewPage_temp.tsx`, `TileViewer.tsx`
**Что:** `setTimeout(80ms)` — хрупко. На медленном девайсе layout может не успеть.
**Решение:** `TileViewerHandle.onLayoutReady(pageIndex): Promise<void>` — resolves когда `pageLayoutsRef` содержит нужную страницу.

#### PERF-13. Lazy load Fabric.js + MarkupLayer
**Файл:** `MarkupOverlay.tsx`
**Что:** `fabric.js` — тяжёлая библиотека (~300KB gzip). Грузится при открытии любого PDF, даже если пользователь только читает без маркапов.
**Решение:** `const fabric = await import('fabric')` при первом `canMarkup=true` или первом клике инструмента.
**Эффект:** Первая загрузка страницы на 300KB легче → быстрее TTI.

#### PERF-14. Snapshot маркапов в tile server (PDF-native рендеринг)
**Что:** Для read-only просмотра маркапов можно запечь их в тайлы прямо на Go tile server. Tile server получает JSON маркапов и рендерит их поверх PDF через pdfium → один растеризованный тайл с маркапами.
**Эффект:** Просмотрщик для read-only пользователей не грузит Fabric.js вообще. Маркапы видны через тайлы.

---

### 🟢 TIER-4 — Финальная полировка

#### PERF-15. React.memo + useMemo для MarkupLayer пропсов
Сейчас `markupsByPage` может быть new array ref при каждом рендере. Стабилизировать через `useRef`-based stable memo.

#### PERF-16. Collaboration cursors (Y.js awareness)
Показывать позиции курсоров других пользователей в реальном времени поверх TileViewer. Легковесно — только X/Y позиция и имя.

#### PERF-17. Zoom by click (Ctrl+click / Alt+click)
Bluebeam: Ctrl+click = zoom in к точке, Alt+click = zoom out. Реализуется в `mouse:down` handler TileViewer.

#### PERF-18. Keyboard shortcuts
`+`/`-` = zoom in/out к центру, `Space+drag` = pan в любом режиме инструмента, `Ctrl+0` = Fit Page.

---

## 🛣️ ДРУГИЕ ПЛАНЫ И TODO

### 🔴 Критично (исправить в первую очередь)

#### 1. Синхронизация zoom тулбар ↔ TileViewer
**Проблема:** `onZoomIn`/`onZoomOut` в PdfToolbar вызывают `handleZoom()` который меняет React state, но TileViewer управляет zoom внутренне через `viewportRef`. Рассинхрон.

**Решение:** Добавить в `TileViewerHandle`:
```typescript
zoomIn(): void;   // переходит на следующий ZOOM_LEVEL
zoomOut(): void;  // переходит на предыдущий ZOOM_LEVEL
```
И подключить к тулбару.

#### 2. TileViewer в Split mode
Заменить react-pdf в split panels на TileViewer (x2 инстанса).

#### 3. Keyboard shortcuts для zoom
`+` и `-` на клавиатуре должны зумировать к центру экрана (как в Bluebeam).

### 🟡 Важно (следующая итерация)

#### 4. OneDrive Integration
Файл `ONEDRIVE_INTEGRATION_PLAN.md` содержит план интеграции. Основное:
- Автосинхронизация документов из OneDrive
- Webhook для уведомлений об изменениях
- Поддержка версионирования через OneDrive versions

#### 5. Export PDF с TileViewer
`exportPdfWithMarkups` использует `pdfDoc` (pdfjs proxy). Это должно работать т.к. pdfDoc всё ещё загружается. Но нужно верифицировать.

### 🟢 Nice to have

#### 6. Zoom by click (Ctrl+click = zoom in, Alt+click = zoom out)
Bluebeam позволяет зумировать кликом при зажатом Ctrl/Alt.

#### 7. Rotation поддержка
Документы с rotation (portrait/landscape) — корректный рендеринг.

#### 8. Page thumbnails — прогрессивная загрузка
Сейчас thumbnails грузятся через lazy intersection observer. Можно добавить blur-up эффект (placeholder → real thumbnail).

#### 9. Collaboration cursors ✅ в PERF-16
Показывать курсоры других пользователей в реальном времени поверх TileViewer (через Y.js awareness).

#### 10. Серверный поиск и text extraction ✅ в PERF-5
Для файлов >500MB — pdfjs грузит весь PDF в браузерную память. Стоит перенести поиск на tile server (Go/pdfium умеет extractText).

---

## 🔧 КОМАНДЫ ДЛЯ РАЗРАБОТКИ

```bash
# Frontend dev server
cd frontend && npm run dev

# Build + deploy to backend/public
cd frontend && npm run deploy

# Rebuild всё в Docker
docker-compose up -d --build

# Только пересобрать app (без tile-server)
docker-compose up -d --build app

# Логи tile server
docker logs redlines_tile_server -f

# Логи backend
docker logs redlines_app -f

# Health check tile server
curl http://localhost:3030/health
curl http://localhost:3030/metrics

# Очистить кэш tile server для документа
curl -X DELETE http://localhost:3030/cache/:docId -H "Authorization: Bearer TOKEN"
```

---

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ

| Файл | Роль |
|------|------|
| `frontend/src/pages/DocumentViewPage_temp.tsx` | **АКТИВНАЯ** страница документа |
| `frontend/src/components/pdf/TileViewer.tsx` | Canvas рендерер через Go tile server |
| `frontend/src/components/pdf/MarkupOverlay.tsx` | Fabric.js overlay поверх TileViewer |
| `frontend/src/components/pdf/MarkupLayer.tsx` | Fabric.js canvas для рисования (React.memo) |
| `frontend/src/components/pdf/MarkupTable.tsx` | Bluebeam-style виртуализированная таблица маркапов |
| `frontend/src/components/pdf/PdfSidebar.tsx` | Боковая панель: Pages, Markups, Layers, Search, Bookmarks |
| `frontend/src/components/pdf/PdfToolbar.tsx` | Toolbar: инструменты, zoom, review stamps, compare |
| `frontend/src/components/pdf/CompareDialog.tsx` | Диалог настройки Document Comparison |
| `frontend/src/components/pdf/CompareToolbar.tsx` | Floating toolbar для compare mode |
| `frontend/src/utils/exportPdfWithMarkups.ts` | Export PDF с маркапами (Bluebeam-compatible annotations) |
| `frontend/src/utils/exportComparisonPdf.ts` | Export comparison PDF с OCG layers |
| `frontend/src/utils/importAnnotationsFromPdf.ts` | Import Bluebeam/Acrobat annotations |
| `frontend/public/tile-sw.js` | Service Worker для кэширования тайлов |
| `backend/server.js` | Express + tile proxy + WebSocket proxy + Google OAuth |
| `backend/src/routes/revitRoutes.js` | Revit Plugin API (auth, projects, folders, upload) |
| `backend/src/controllers/UserController.js` | Users + API password management |
| `tile-server/main.go` | Go HTTP сервер, маршруты |
| `tile-server/internal/handler/http.go` | Tile handler, auth, cache |
| `tile-server/internal/handler/compare.go` | Document Comparison pixel-diff endpoint |
| `tile-server/internal/handler/search.go` | Full-text search via pdfium |
| `tile-server/internal/renderer/` | PDF → tile rendering (pdfium) |
| `tile-server/internal/cache/memory.go` | O(1) LRU in-memory tile cache |
| `tile-server/internal/cache/disk.go` | Disk tile cache с eviction loop |
| `tile-server/internal/pool/` | PDF document pool |
| `docker-compose.yml` | Конфиг деплоя |
| `frontend/src/lib/routingAlgorithm.ts` | Routing geometry (project, offset, buildRoute) |
| `frontend/src/components/pdf/RouteWizardDialog.tsx` | Route Wizard (template select, spacing, start) |
| `REVIT_INTEGRATION.md` | Документация Revit Plugin API |

---

## 🔐 АУТЕНТИФИКАЦИЯ — FLOW

```
Web app (Google OAuth):
1. User → Google OAuth2 → Google ID Token
2. Backend: googleClient.verifyIdToken() → создаёт/находит User + генерирует apiPassword
3. Выдаёт JWT: { userId, email, role } • expiresIn: 7d
4. JWT в httpOnly cookie "token" + response body

Revit plugin / Scripts (API Password):
1. POST /api/revit/auth/login { email, password: apiPassword }
2. Получает 30-дневный JWT (api_token)
3. Все запросы: Authorization: Bearer <api_token>
4. Админ видит/копирует apiPassword в UserDetailDialog → "API Access"

Tile server auth:
- Frontend передаёт token в URL: /prepare/:docId?token=JWT
- Tile server верифицирует JWT с тем же JWT_SECRET
```

---

## 📊 МОНИТОРИНГ

**Health endpoint:**
```
GET /health → { "status":"ok","service":"tile-server","pool_size":N,"cache_size":N }
```

- `pool_size: 0` → документы не загружены в пул (никто не открывал)
- `cache_size: 0` → кэш пустой (нормально при старте)
- `pool_size > 0` → tile server активно используется ✅

**Если pool_size всегда 0:**
- Браузер не делает запрос на `/prepare/`
- TileViewer не монтируется (проверь router.tsx)
- token = null (auth не работает)

---

## 🎨 UI/UX ДИЗАЙН

- **Тема:** Dark mode + Light mode (MUI v6 theme)
- **Основной цвет:** Золотой `rgba(180,140,60,*)` (primary)
- **Loading overlay:** Пульсирующая анимация, золотая иконка PDF, прогресс-бар
- **Toolbar:** Pill-style группы инструментов, responsive collapse
- **Sidebar:** 280px, tabs: Pages | Markups | Layers | Search | Bookmarks

---

*Документ создан автоматически на основе всей истории сессий разработки Redlines PDF Viewer.*
*Актуален на: 2026-04-06 01:00 MSK*

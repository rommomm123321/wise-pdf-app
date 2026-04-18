## EVAL: redlines-full-audit
Created: 2026-04-18

Полный аудит всех фич Redlines PDF Viewer.
Цель: определить что работает корректно, что сломано, что имеет баги.

---

### 🟦 ГРУППА 1 — PDF Rendering (TileViewer)

#### Capability Evals
- [ ] PDF открывается и рендерится через tile server (не react-pdf fallback)
- [ ] Tile server возвращает тайлы 512×512 для всех zoom levels (0-4)
- [ ] Zoom-to-cursor работает корректно (точка под курсором остаётся на месте)
- [ ] Fit Page центрирует страницу с отступом 24px
- [ ] Fit Width растягивает страницу по ширине viewport
- [ ] Дискретные уровни зума (23 уровня от 0.1 до 20.0) — переключение по одному
- [ ] Trackpad vs мышь: trackpad накапливает до порога, мышь — 1 уровень за тик
- [ ] Инерционный пан плавный (не 60fps React ре-рендеры)
- [ ] Пирамидальный рендеринг: zoom-0 thumbnail как fallback пока грузятся HD тайлы
- [ ] Загрузка 800MB+ PDF без краша браузера (streaming)
- [ ] Loading overlay отображается корректно (3 фазы: connecting → loading → done)
- [ ] Непрерывный скролл (continuous mode) не прыгает на страницу 1

#### Regression Evals
- [ ] Смена документа сбрасывает viewport и кэш
- [ ] Thumbnails в sidebar грузятся через tile server (не react-pdf)
- [ ] Page mode — одна страница, continuous mode — все страницы

---

### 🟦 ГРУППА 2 — Markup Rendering (MarkupOverlay + MarkupLayer)

#### Capability Evals
- [ ] Все типы маркапов рендерятся корректно: rect, circle, line, arrow, polyline, cloud, text, callout, measure, image, highlight, stamp, electricalBox, stub, panel, wireTag, stickyNote, routeTemplate, route
- [ ] Маркапы не "улетают" в левый угол при syncMarkups (Group→Path migration)
- [ ] Маркапы масштабируются корректно при зуме (CSS scale trick)
- [ ] auxLabelCache: текстовые лейблы всегда поверх основных объектов
- [ ] Callout: авто-открытие текстового редактора после рисования
- [ ] Cloud: авто-переключение в select после рисования
- [ ] Arrow: корректное перемещение через _lastLeft/_lastTop delta
- [ ] Measure: label перемещается над линией при коротких измерениях
- [ ] ReviewStamp: заливные штампы всегда с белым текстом

#### Regression Evals
- [ ] Перетаскивание маркапа не вызывает flash (object:moving не тригерит onMarkupModified)
- [ ] Resize маркапа сохраняется корректно
- [ ] Locked маркапы не выделяются box-select
- [ ] Z-order: Bring to Front / Send to Back работает мгновенно (без flicker)

---

### 🟦 ГРУППА 3 — Collaboration Modes (Personal / Edit / Live)

#### Capability Evals
- [ ] Personal mode (default): новые маркапы сохраняются в localStorage, не синхронизируются
- [ ] Personal mode: Publish отправляет маркапы в Y.js → сервер
- [ ] Personal mode: Discard очищает localStorage
- [ ] Edit mode: эксклюзивная блокировка через Y.js Awareness
- [ ] Edit mode: при входе другого пользователя → toast с именем блокирующего
- [ ] Edit mode: lock TTL 5 минут (игнорирует устаревшие locks)
- [ ] Live mode: Y.js real-time синхронизация
- [ ] Live mode: зелёный "LIVE" индикатор + аватары подключённых
- [ ] Live mode: можно редактировать только свои session-маркапы (sessionId)
- [ ] Collaboration cursors: видны позиции других пользователей

#### Regression Evals
- [ ] sessionId ротируется после Publish → опубликованные маркапы становятся server-owned
- [ ] Edit drafts сохраняются в localStorage при закрытии страницы
- [ ] Восстановление edit lock при перезагрузке страницы

---

### 🟦 ГРУППА 4 — MarkupTable (Bluebeam-style)

#### Capability Evals
- [ ] Виртуализация (@tanstack/react-virtual): 5000+ маркапов без лага
- [ ] Сортировка по: Subject / Status / Page / Author / Date
- [ ] Group By: author / status / page
- [ ] Shift+click range select, Ctrl+click toggle select
- [ ] ПКМ контекст-меню: Jump to / Set Status / Delete
- [ ] Export CSV с корректными данными
- [ ] Footer: count + status dots + bulk delete
- [ ] bluebeamAuthor имеет приоритет везде (MarkupTable, CSV, sort, filter)

#### Regression Evals
- [ ] Клик на маркап в таблице → навигация к нему в документе
- [ ] Навигация к маркапу на другой странице (page mode) работает корректно

---

### 🟦 ГРУППА 5 — Document Comparison

#### Capability Evals
- [ ] CompareDialog: выбор Old и New (оба свободно выбираемые)
- [ ] Tinted compare tiles: old=красный, new=зелёный, совпадения=тёмный
- [ ] Slider для opacity mixing
- [ ] Layer toggles (show old / show new)
- [ ] Auto-detect changes: создаёт REVISION CLOUD маркапы в draft mode
- [ ] Export Comparison PDF с OCG layers (работает в Bluebeam)
- [ ] Compare processing overlay блокирует UI во время операции

#### Regression Evals
- [ ] Compare exit при смене документа (setCompareConfig(null))
- [ ] Параллельная подготовка обоих документов (Promise.all)

---

### 🟦 ГРУППА 6 — Search

#### Capability Evals
- [ ] 3 режима поиска: Contains / Exact / Fuzzy
- [ ] Поисковые хайлайты отображаются в ПРАВИЛЬНОМ месте (2× координаты tile server)
- [ ] Навигация ▲/▼ между результатами
- [ ] Cross-page навигация: setCurrentPage + navigateToPage
- [ ] Group by page, filter (text/markup), sort (found/page)
- [ ] Search в маркапах (subject, text, author)

#### Regression Evals
- [ ] Highlight Y-coordinate: использует tx[3] (font scale), не transform[0]
- [ ] При смене документа результаты поиска сбрасываются

---

### 🟦 ГРУППА 7 — PDF Import/Export (Bluebeam Round-Trip)

#### Capability Evals
- [ ] Export: все типы маркапов → PDF annotations (pdf-lib)
- [ ] Export: BSIColumnData для custom properties
- [ ] Export: status reply annotations (ISO 32000-1 §12.5.6.3)
- [ ] Export: OCG layers для comparison PDF
- [ ] Import: Bluebeam/Acrobat annotations → Redlines маркапы
- [ ] Import: bluebeamAuthor, dates, opacity, locked flag, custom props
- [ ] Auto-import при первом открытии PDF (если markups.length === 0)
- [ ] Координаты export/import корректны (1× native, не 2× tile)

#### Regression Evals
- [ ] Round-trip: export → import возвращает те же маркапы
- [ ] Import badge скрыт если маркапы уже импортированы

---

### 🟦 ГРУППА 8 — QA/QC Review System

#### Capability Evals
- [ ] Spell check: сканирует текст PDF (getTextContent), не только маркапы
- [ ] 40+ construction terms whitelist (hvac, rebar, conduit и т.д.)
- [ ] Checklist templates: 3 дефолтных + custom
- [ ] Review lifecycle: start → pass/fail items → complete
- [ ] Fail items: comment + pin placement на чертеже
- [ ] Review Reports: все завершённые ревью видны всем
- [ ] "Mark as Fixed" для ответственного лица
- [ ] Previous Version Reviews overlay

#### Regression Evals
- [ ] React hooks order (useState/useMemo перед early returns)
- [ ] QA/QC color присутствует в popover colors record (не crash)

---

### 🟦 ГРУППА 9 — Performance

#### Capability Evals
- [ ] ImageBitmap.close() вызывается при смене документа (нет GPU leak)
- [ ] tileCache LRU: ограничен 400-500 тайлами (нет unbounded growth)
- [ ] propHash fast-path: updatedAt timestamp → O(1) skip если не изменился
- [ ] Y.js incremental observe: обновляет только изменённые маркапы
- [ ] Adaptive throttle: 200+ markups → 100ms delay
- [ ] Tile prefetch в направлении скролла (scrollDirRef)
- [ ] Service Worker: cache-first для тайлов, 10K entries, 7-day TTL

#### Regression Evals
- [ ] Momentum scroll throttled (не 60fps setViewport)
- [ ] Pan throttled (~150ms, не 60fps React re-renders)
- [ ] Pinch-zoom throttled (mobile)

---

### 🟦 ГРУППА 10 — UX & Settings

#### Capability Evals
- [ ] UserSettingsDialog: 6 секций (Markup Defaults, Permissions, Behavior, Interface, Collab, Quick Wheel)
- [ ] Markup Wheel (Q key / middle-click): radial menu, max 15 slots
- [ ] Tool Chest: per-user presets, 22 сохраняемых свойства
- [ ] Custom Stamps: составные маркапы из выделения
- [ ] Markup Grouping: Ctrl+G / Ctrl+Shift+G
- [ ] Review Stamps: 15 штампов (5 статусов + 6 issues + 4 notes) + 10 Favorites
- [ ] Copy/Paste маркапов: Ctrl+C/V с nudge, Ctrl+V изображений
- [ ] Undo/Redo с error feedback
- [ ] VectorSharpenOverlay: pdfjs sharpening при 350ms settle

#### Regression Evals
- [ ] Zoom race condition fix: hasInitializedRef не перезаписывает user zoom
- [ ] Delete confirmation через MUI Dialog (не window.confirm)
- [ ] MarkupWheel блокирует все background events (capture phase)

---

### 🔴 KNOWN BUGS (отслеживаем)

- [ ] [BUG] Чёрный экран при двойном клике на Text/Cloud+/Sticky (Fabric.js v5 + CSS transform scale)
- [ ] [BUG] P0-1: Search highlights в неправильном месте (2× координаты)
- [ ] [BUG] P1-1: ImageBitmap GPU leak при смене документа (нет .close())
- [ ] [BUG] P1-5: setTimeout(80ms) для навигации к маркапу — хрупко

---

### Success Criteria

- **Capability evals:** pass@3 > 90%
- **Regression evals:** pass^3 = 100%
- **Known bugs:** все P0 должны быть fixed перед SHIP
- **Known bugs:** P1 должны быть в backlog с планом решения

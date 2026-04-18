# Eval Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 actionable issues identified in the `redlines-full-audit` eval (2026-04-18).

**Architecture:** All fixes are isolated, surgical edits to existing files. No new files needed except VectorSharpenOverlay which gets a full rewrite. No dependencies between tasks — they can be done in any order.

**Tech Stack:** React 19, TypeScript, Fabric.js, MUI v6, pdfjs-dist, pdf-lib

---

## Pre-Work: Corrected Understanding of Eval Failures

After code review, two eval "failures" turned out to be non-issues:

| Eval Item | Finding |
|-----------|---------|
| `propHash()` includes w/h | **Intentional** — comment at line 191 MarkupLayer.tsx: "includes canvas dimensions to force recreation on zoom. Recreation is batched — zero per-object flicker." Do NOT remove w/h. |
| Search cross-page nav | **Already correct** — lines 1228-1243 DocumentViewPage_temp.tsx: setCurrentPage → navigateToPage → navigateToPagePoint all present. |
| Search highlight 2× coords | **Already correct** — coordScale = tileW/pdfjsW applied in MarkupOverlay.tsx lines 224-226. P0-1 is fixed. |

**Real actionable tasks:**
1. Search highlight padding ±1px (trivial)
2. VectorSharpenOverlay re-enable (medium)
3. CLAUDE.md documentation corrections

---

## Task 1: Search Highlight Padding ±1px

**Files:**
- Modify: `frontend/src/components/pdf/MarkupOverlay.tsx:229-240`

The search highlight rect uses exact pdfjs coordinates with no visual padding. A 1px expansion makes it easier to see the highlight border isn't cutting off characters.

- [ ] **Step 1: Open MarkupOverlay.tsx and locate the search highlight Box**

Read `frontend/src/components/pdf/MarkupOverlay.tsx` around lines 220-245. Find the `<Box sx={{ position: 'absolute', left: res.x * coordScale * renderedZoom, ... }}>` block.

- [ ] **Step 2: Add ±1px padding to the highlight rect**

The current code (lines ~233-236):
```tsx
left: res.x * coordScale * renderedZoom,
top: res.y * coordScale * renderedZoom,
width: (res.w || 20) * coordScale * renderedZoom,
height: (res.h || 12) * coordScale * renderedZoom,
```

Replace with:
```tsx
left: res.x * coordScale * renderedZoom - 1,
top: res.y * coordScale * renderedZoom - 1,
width: (res.w || 20) * coordScale * renderedZoom + 2,
height: (res.h || 12) * coordScale * renderedZoom + 2,
```

- [ ] **Step 3: Verify the change looks correct — build frontend**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: build completes with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\roman\Desktop\redlines
git add frontend/src/components/pdf/MarkupOverlay.tsx
git commit -m "fix: add 1px padding to search highlight rect for better visual coverage"
```

---

## Task 2: VectorSharpenOverlay Re-enable

**Files:**
- Modify: `frontend/src/components/pdf/VectorSharpenOverlay.tsx` (full rewrite)

The component was disabled because it caused "partial page display, offset issues". The fix is to use the `pageLayouts` prop (passed in) to position the overlay exactly, and add a pixel cap + settle timer to prevent performance issues.

**How it works:**
1. Find the most-visible page from `pageLayouts`
2. Wait 350ms after viewport stops changing (settle timer)
3. Use pdfjs to render that page at `zoom × devicePixelRatio` scale
4. Position the canvas at exact screen coordinates matching the tile layer
5. Safety cap: skip if rendered pixel count > 40M

**Props already passed:** `pdfDoc, viewport, pageLayouts, containerWidth, containerHeight`

- [ ] **Step 1: Understand the coordinate system**

Pages in TileViewer are positioned as:
```
screenX = layout.worldX * viewport.zoom + containerWidth/2
screenY = (layout.worldY - viewport.y) * viewport.zoom
```
Where `layout.worldX`, `layout.worldY` are world coords, `viewport.zoom/x/y` is the current view.

The overlay canvas must be placed at the same `screenX, screenY` and sized `layout.w * viewport.zoom` × `layout.h * viewport.zoom`.

- [ ] **Step 2: Implement VectorSharpenOverlay**

Replace the entire content of `frontend/src/components/pdf/VectorSharpenOverlay.tsx`:

```tsx
import { useEffect, useRef, memo } from 'react';

interface Props {
  pdfDoc: any;
  viewport: { zoom: number; x: number; y: number };
  pageLayouts: Array<{ index: number; worldX: number; worldY: number; w: number; h: number }>;
  containerWidth: number;
  containerHeight: number;
}

const MAX_PIXELS = 40_000_000; // 40M pixel safety cap
const SETTLE_MS = 350;

function VectorSharpenOverlay({ pdfDoc, viewport, pageLayouts, containerWidth, containerHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(async () => {
      if (!pdfDoc || !canvasRef.current || pageLayouts.length === 0) return;

      // Find the most-visible page (largest intersection with viewport)
      const vpCenterY = containerHeight / 2;
      let bestLayout = pageLayouts[0];
      let bestScore = -Infinity;
      for (const layout of pageLayouts) {
        const screenY = (layout.worldY - viewport.y) * viewport.zoom;
        const screenH = layout.h * viewport.zoom;
        const visibleTop = Math.max(0, screenY);
        const visibleBot = Math.min(containerHeight, screenY + screenH);
        const overlap = visibleBot - visibleTop;
        if (overlap > bestScore) {
          bestScore = overlap;
          bestLayout = layout;
        }
      }

      const renderW = Math.round(bestLayout.w * viewport.zoom);
      const renderH = Math.round(bestLayout.h * viewport.zoom);
      const physW = Math.round(renderW * dpr);
      const physH = Math.round(renderH * dpr);

      // Safety cap
      if (physW * physH > MAX_PIXELS) return;

      try {
        const page = await pdfDoc.getPage(bestLayout.index + 1);
        const vp = page.getViewport({ scale: viewport.zoom * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${renderW}px`;
        canvas.style.height = `${renderH}px`;

        // Position: match TileViewer's page screen position
        const screenX = bestLayout.worldX * viewport.zoom + containerWidth / 2;
        const screenY = (bestLayout.worldY - viewport.y) * viewport.zoom;
        canvas.style.left = `${screenX}px`;
        canvas.style.top = `${screenY}px`;
        canvas.style.opacity = '1';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, vp.width, vp.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      } catch {
        // Swallow errors (page not loaded, canvas gone, etc.)
      }
    }, SETTLE_MS);

    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [pdfDoc, viewport, pageLayouts, containerWidth, containerHeight, dpr]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.2s',
        imageRendering: 'crisp-edges',
        zIndex: 5,
      }}
    />
  );
}

export default memo(VectorSharpenOverlay);
```

- [ ] **Step 3: Build and check for TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors relating to VectorSharpenOverlay.

- [ ] **Step 4: Verify it's used in DocumentViewPage_temp.tsx**

Grep for `VectorSharpenOverlay` in DocumentViewPage_temp.tsx — it should already be imported and rendered with all required props. If not, skip this step (it was conditionally removed).

```bash
grep -n "VectorSharpenOverlay" frontend/src/pages/DocumentViewPage_temp.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pdf/VectorSharpenOverlay.tsx
git commit -m "feat: re-enable VectorSharpenOverlay with 350ms settle, 40M pixel cap, correct positioning"
```

---

## Task 3: CLAUDE.md Documentation Corrections

**Files:**
- Modify: `CLAUDE.md`

Three documentation errors to fix:

1. **Auto-import**: Stage 29 says "ADD: Auto-import при первом открытии PDF (markups.length === 0)" but code at DocumentViewPage line 4480 has comment "never auto-import". The feature was intentionally removed.

2. **dataHash w/h**: Stage 30 Batch 7 says "FIX: dataHash() without w/h" but current code intentionally includes w/h with comment "force recreation on zoom". The entry is misleading.

3. **P0-1 search highlight**: CLAUDE.md lists P0-1 as an open bug but it IS fixed in MarkupOverlay (coordScale applied).

- [ ] **Step 1: Fix the Auto-import entry in CLAUDE.md**

Find the Stage 29 section with "Auto-import при первом открытии PDF". Change the ADD line to:

```
- **DETECT:** Embedded annotations detected at first open via `detectAndParseAnnotations()` — stored in `embeddedAnnots` state for user to manually import. Auto-import deliberately NOT implemented.
```

- [ ] **Step 2: Fix P0-1 bug status in the "АНАЛИЗ СЛАБЫХ МЕСТ" section**

Find `#### P0-1. Поисковые хайлайты отображаются в неправильном месте` and change header to:

```markdown
#### ~~P0-1. Поисковые хайлайты — FIXED~~
**Статус:** ✅ Исправлено в Stage 30. `coordScale = tileW / pdfjsW` применяется в `MarkupOverlay.tsx` строки 224-226.
```

- [ ] **Step 3: Fix the dataHash entry in Stage 30 Batch 7 notes**

Find "FIX: `dataHash()` without `w/h`" and update:

```markdown
- **NOTE:** `propHash()` intentionally includes `w/h` (canvas dimensions) — forces recreation on zoom. Batched with `renderOnAddRemove=false` = zero flicker. The tsCache fast-path (`updatedAt` timestamp check) avoids redundant hashing on unchanged markups.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix CLAUDE.md inaccuracies — auto-import, P0-1 status, propHash behavior"
```

---

## Self-Review

### Spec Coverage
- ±1px highlight padding: Task 1 ✅
- VectorSharpenOverlay re-enable with 350ms/40M: Task 2 ✅
- CLAUDE.md auto-import correction: Task 3 ✅
- CLAUDE.md P0-1 correction: Task 3 ✅
- propHash explanation: Task 3 ✅

### Placeholder Scan
None — all steps contain exact code or commands.

### Type Consistency
- `VectorSharpenOverlay` Props interface unchanged (same as before)
- All pdfjs API calls use `pdfDoc.getPage(n)` → `.getViewport()` → `.render()` (standard pdfjs-dist pattern)

### Out of Scope (deferred)
- **Import badge hidden when markups exist** — requires UI changes to PdfSidebar/DocumentViewPage. The `embeddedAnnots` state exists, just no UI wired to it. Low priority.
- **VectorSharpenOverlay in DocumentViewPage** — if not already wired, wiring it is a separate task (check grep in Step 4).

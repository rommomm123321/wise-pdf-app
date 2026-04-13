import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

export interface WheelItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color: string;
  tool?: string;
  config?: any;
}

interface MarkupWheelProps {
  open: boolean;
  x: number;
  y: number;
  items: WheelItem[];
  onSelect: (item: WheelItem) => void;
  onClose: () => void;
}

const WHEEL_RADIUS = 140;
const ITEM_SIZE = 56;

function MarkupWheel({ open, x, y, items, onSelect, onClose }: MarkupWheelProps) {
  const theme = useTheme();
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const centerRef = useRef({ x: 0, y: 0 });
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  // Use refs for mouse tracking to avoid re-renders on every mousemove
  const hoveredIdxRef = useRef(-1);
  const lineRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segHighlightRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (open) {
      centerRef.current = { x, y };
      setHoveredIdx(-1);
      hoveredIdxRef.current = -1;
    }
  }, [open, x, y]);

  // Close on Escape / Q
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'q') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Block pointer events from reaching Fabric.js canvas
  const wheelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const block = (e: Event) => {
      const target = e.target as Node | null;
      if (target && wheelRef.current?.contains(target)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const events = ['mousedown', 'mousemove', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick'] as const;
    events.forEach(ev => window.addEventListener(ev, block, true));
    return () => { events.forEach(ev => window.removeEventListener(ev, block, true)); };
  }, [open]);

  // Mousemove: update visuals via DOM refs (no React state update per frame)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const count = items.length;
    if (count === 0) return;

    let newIdx = -1;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;

    if (dist >= 30) {
      const segmentAngle = (Math.PI * 2) / count;
      let adjusted = angle + Math.PI / 2;
      if (adjusted > Math.PI * 2) adjusted -= Math.PI * 2;
      newIdx = Math.floor(adjusted / segmentAngle) % count;
    }

    // Update direction line via ref (no re-render)
    if (lineRef.current) {
      if (newIdx >= 0) {
        lineRef.current.style.display = 'block';
        lineRef.current.style.transform = `rotate(${angle}rad)`;
        lineRef.current.style.backgroundColor = alpha(items[newIdx]?.color || gold, 0.25);
      } else {
        lineRef.current.style.display = 'none';
      }
    }

    const prevIdx = hoveredIdxRef.current;
    if (newIdx === prevIdx) return; // no change — skip all DOM updates

    hoveredIdxRef.current = newIdx;

    // Update segment highlight via ref
    if (segHighlightRef.current) {
      if (newIdx >= 0) {
        const seg = (Math.PI * 2) / count;
        const startA = seg * newIdx - Math.PI / 2 - seg / 2;
        const endA = startA + seg;
        const cx2 = WHEEL_RADIUS + ITEM_SIZE / 2, cy2 = WHEEL_RADIUS + ITEM_SIZE / 2;
        const ir = WHEEL_RADIUS - ITEM_SIZE / 2 - 5, or2 = WHEEL_RADIUS + ITEM_SIZE / 2 + 5;
        const large = seg > Math.PI ? 1 : 0;
        const d = [
          `M${cx2 + ir * Math.cos(startA)},${cy2 + ir * Math.sin(startA)}`,
          `A${ir},${ir} 0 ${large},1 ${cx2 + ir * Math.cos(endA)},${cy2 + ir * Math.sin(endA)}`,
          `L${cx2 + or2 * Math.cos(endA)},${cy2 + or2 * Math.sin(endA)}`,
          `A${or2},${or2} 0 ${large},0 ${cx2 + or2 * Math.cos(startA)},${cy2 + or2 * Math.sin(startA)}`,
          'Z'
        ].join(' ');
        segHighlightRef.current.setAttribute('d', d);
        segHighlightRef.current.setAttribute('fill', alpha(items[newIdx].color, 0.15));
        segHighlightRef.current.style.display = 'block';
      } else {
        segHighlightRef.current.style.display = 'none';
      }
    }

    // Update item scale/style via refs (un-hover prev, hover new)
    if (prevIdx >= 0 && itemRefs.current[prevIdx]) {
      const el = itemRefs.current[prevIdx]!;
      const item = items[prevIdx];
      el.style.transform = 'scale(1)';
      el.style.backgroundColor = isDark ? '#2a2a2a' : '#fff';
      el.style.color = item.color;
      el.style.borderColor = alpha(item.color, 0.25);
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      el.style.zIndex = '1';
    }
    if (newIdx >= 0 && itemRefs.current[newIdx]) {
      const el = itemRefs.current[newIdx]!;
      const item = items[newIdx];
      el.style.transform = 'scale(1.18)';
      el.style.backgroundColor = item.color;
      el.style.color = '#fff';
      el.style.borderColor = item.color;
      el.style.boxShadow = `0 0 0 4px ${alpha(item.color, 0.2)}, 0 6px 24px rgba(0,0,0,0.3)`;
      el.style.zIndex = '3';
    }

    // Update label via ref
    if (labelRef.current) {
      if (newIdx >= 0) {
        labelRef.current.style.display = 'block';
        labelRef.current.style.backgroundColor = items[newIdx].color;
        labelRef.current.textContent = items[newIdx].label;
      } else {
        labelRef.current.style.display = 'none';
      }
    }

    // Only update React state for center circle checkmark
    setHoveredIdx(newIdx);
  }, [items, isDark, gold]);

  const handleMouseUp = useCallback(() => {
    const idx = hoveredIdxRef.current;
    if (idx >= 0 && idx < items.length) {
      onSelect(items[idx]);
    }
    onClose();
  }, [items, onSelect, onClose]);

  // Touch support: track finger position and select on release
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    // Synthesize a mouse event for the move handler
    const synth = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent;
    handleMouseMove(synth);
  }, [handleMouseMove]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  if (!open || items.length === 0) return null;

  return (
    <Box
      ref={wheelRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); }}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      sx={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'default', touchAction: 'none' }}
    >
      {/* Backdrop — semi-transparent, no blur for performance */}
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.18)' }} />

      {/* Wheel */}
      <Box sx={{
        position: 'absolute',
        left: x - WHEEL_RADIUS - ITEM_SIZE / 2,
        top: y - WHEEL_RADIUS - ITEM_SIZE / 2,
        width: (WHEEL_RADIUS + ITEM_SIZE / 2) * 2,
        height: (WHEEL_RADIUS + ITEM_SIZE / 2) * 2,
      }}>
        {/* Background ring + highlight segment */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <circle cx={WHEEL_RADIUS + ITEM_SIZE / 2} cy={WHEEL_RADIUS + ITEM_SIZE / 2} r={WHEEL_RADIUS}
            fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} strokeWidth={ITEM_SIZE + 10} />
          <path ref={segHighlightRef} style={{ display: 'none', transition: 'fill 0.1s' }} />
        </svg>

        {/* Center circle */}
        <Box sx={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 48, height: 48, borderRadius: '50%',
          bgcolor: isDark ? '#222' : '#fff',
          border: `2.5px solid ${hoveredIdx >= 0 ? items[hoveredIdx]?.color || gold : alpha(gold, 0.3)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          zIndex: 2, transition: 'border-color 0.15s',
        }}>
          {hoveredIdx >= 0 ? (
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: items[hoveredIdx].color }}>✓</Typography>
          ) : (
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'text.disabled', textAlign: 'center', lineHeight: 1.1 }}>Q</Typography>
          )}
        </Box>

        {/* Direction line — updated via ref, not state */}
        <Box ref={lineRef} sx={{
          position: 'absolute', left: '50%', top: '50%',
          width: WHEEL_RADIUS - 20, height: 2,
          transformOrigin: '0 50%',
          borderRadius: 1, zIndex: 1,
          display: 'none',
        }} />

        {/* Items — initial render only, hover updates via refs */}
        {items.map((item, idx) => {
          const angle = ((Math.PI * 2) / items.length) * idx - Math.PI / 2;
          const cx = Math.cos(angle) * WHEEL_RADIUS + WHEEL_RADIUS + ITEM_SIZE / 2;
          const cy = Math.sin(angle) * WHEEL_RADIUS + WHEEL_RADIUS + ITEM_SIZE / 2;

          return (
            <Box
              key={item.id}
              ref={(el: HTMLDivElement | null) => { itemRefs.current[idx] = el; }}
              sx={{
                position: 'absolute',
                left: cx - ITEM_SIZE / 2, top: cy - ITEM_SIZE / 2,
                width: ITEM_SIZE, height: ITEM_SIZE,
                borderRadius: '14px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                bgcolor: isDark ? '#2a2a2a' : '#fff',
                color: item.color,
                border: `2.5px solid ${alpha(item.color, 0.25)}`,
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
                zIndex: 1,
                '& svg': { fontSize: 20 },
              }}
            >
              {item.icon || (
                <Box sx={{
                  width: 24, height: 24, borderRadius: '6px',
                  bgcolor: alpha(item.color, 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 900,
                  color: item.color,
                }}>
                  {item.label.slice(0, 2).toUpperCase()}
                </Box>
              )}
              <Typography sx={{
                fontSize: '0.52rem', fontWeight: 700, lineHeight: 1, mt: 0.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: ITEM_SIZE - 6, textAlign: 'center',
              }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Hovered label — updated via ref */}
      <Box
        ref={labelRef}
        sx={{
          position: 'absolute',
          left: x, top: y + WHEEL_RADIUS + ITEM_SIZE / 2 + 16,
          transform: 'translateX(-50%)',
          px: 2, py: 0.5, borderRadius: '10px',
          color: '#fff',
          fontSize: '0.88rem', fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap', zIndex: 10,
          display: 'none',
          transition: 'background-color 0.1s',
        }}
      />
    </Box>
  );
}

export default memo(MarkupWheel);

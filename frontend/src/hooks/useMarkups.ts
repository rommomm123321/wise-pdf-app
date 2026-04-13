import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '../contexts/AuthContext';

export interface Markup {
  id: string;
  type: string;
  pageNumber: number;
  coordinates: any;
  properties: any;
  documentId: string;
  authorId: string;
  author?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedBy?: { id: string; name: string };
  updatedAt?: string;
  allowedEditUserIds?: string[];  // ['*'] = unrestricted; [] = nobody; [ids] = specific users
  allowedDeleteUserIds?: string[];
}

// Global cache to avoid reconnecting on every re-render
const ydocs: Record<string, { doc: Y.Doc; provider: WebsocketProvider }> = {};

/** Get the cached provider for a documentId (if it exists) */
export function getYjsProvider(documentId: string): WebsocketProvider | null {
  return ydocs[documentId]?.provider ?? null;
}

// ─── Awareness types ───
export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
  cursor: { pageIndex: number; x: number; y: number } | null;
}

export interface AwarenessState {
  user?: AwarenessUser;
}

// Deterministic color palette for user cursors
const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export function useMarkups(documentId: string | undefined) {
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const { token, user } = useAuth();

  useEffect(() => {
    if (!documentId || !token) return;

    if (!ydocs[documentId]) {
      const doc = new Y.Doc();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Always use the current host — in dev Vite proxies /yjs → backend:3000,
      // in production Express serves both HTTP and WS on the same port.
      const host = window.location.host;
      const fullWsUrl = `${protocol}//${host}/yjs`;

      console.log(`[Yjs] Connecting to ${fullWsUrl}/${documentId}?token=...`);
      const provider = new WebsocketProvider(fullWsUrl, documentId, doc, {
        params: { token }
      });

      provider.on('status', (event: any) => {
        console.log(`[Yjs] Connection status for ${documentId}:`, event.status);
      });

      ydocs[documentId] = { doc, provider };
    }

    const { doc, provider } = ydocs[documentId];
    const ymap = doc.getMap<Markup>('markups');

    // Set local awareness state with user info
    if (user && provider.awareness) {
      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.name || user.email || 'Unknown',
        color: getUserColor(user.id),
        cursor: null,
      });
    }

    // Batched update: coalesce rapid Yjs updates into a single React state update.
    // For large docs (200+ markups), use 100ms throttle to prevent React spam.
    // For small docs, use RAF (16ms) for snappy UI.
    let rafId: number | null = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null || throttleTimer !== null) return;
      const count = ymap.size;
      if (count > 200) {
        // Large doc: throttle to 100ms to prevent React spam
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          setMarkups(Array.from(ymap.values()));
        }, 100);
      } else {
        // Small doc: RAF (16ms)
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setMarkups(Array.from(ymap.values()));
        });
      }
    };

    // Only schedule update when actual markup data changed (not awareness/meta)
    const observeHandler = (event: Y.YMapEvent<Markup>) => {
      if (event.changes.keys.size > 0) {
        scheduleUpdate();
      }
    };
    ymap.observe(observeHandler);
    provider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
      scheduleUpdate();
    });

    // Initial state — immediate, no debounce
    setMarkups(Array.from(ymap.values()));

    return () => {
      ymap.unobserve(observeHandler);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (throttleTimer !== null) clearTimeout(throttleTimer);
    };
  }, [documentId, user?.id]);

  // Flush: immediately read from Y.js bypassing throttle.
  // Call after local updateMarkupAPI to reflect property changes instantly on canvas.
  const flushMarkups = useCallback(() => {
    if (!documentId || !ydocs[documentId]) return;
    const ymap = ydocs[documentId].doc.getMap<Markup>('markups');
    setMarkups(Array.from(ymap.values()));
  }, [documentId]);

  return {
    data: markups,
    isSynced,
    flushMarkups,
    refetch: () => {} // no-op for compatibility
  };
}

export function useCreateMarkup() {
  const { user } = useAuth();
  
  return {
    mutateAsync: async (data: Partial<Markup>) => {
      const id = data.id || crypto.randomUUID();
      const documentId = data.documentId;
      
      if (!documentId) throw new Error('documentId is required');

      const ydocEntry = ydocs[documentId];
      if (ydocEntry) {
        const ymap = ydocEntry.doc.getMap<Markup>('markups');
        const newMarkup: Markup = {
          id,
          documentId,
          type: data.type!,
          pageNumber: data.pageNumber!,
          coordinates: data.coordinates,
          properties: data.properties || {},
          authorId: user?.id || '',
          author: { id: user?.id || '', name: user?.name || user?.email || 'Unknown' },
          createdAt: new Date().toISOString(),
          // ['*'] = everyone, [] = nobody, [ids] = specific — null/undefined defaults to ['*']
          allowedEditUserIds: data.allowedEditUserIds != null ? data.allowedEditUserIds : ['*'],
          allowedDeleteUserIds: data.allowedDeleteUserIds != null ? data.allowedDeleteUserIds : ['*'],
        };
        ymap.set(id, newMarkup);
        return newMarkup;
      }
      throw new Error('Yjs doc not initialized');
    }
  };
}

export function useUpdateMarkup() {
  return {
    mutateAsync: async (data: Partial<Markup> & { id: string }) => {
      let foundDoc: Y.Doc | null = null;
      let existing: Markup | undefined;
      
      for (const entry of Object.values(ydocs)) {
        const ymap = entry.doc.getMap<Markup>('markups');
        if (ymap.has(data.id)) {
          foundDoc = entry.doc;
          existing = ymap.get(data.id);
          break;
        }
      }

      if (foundDoc && existing) {
        const ymap = foundDoc.getMap<Markup>('markups');
        const { _replaceProperties, ...cleanData } = data as any;
        const updated = {
          ...existing,
          ...cleanData,
          coordinates: cleanData.coordinates ? { ...existing.coordinates, ...cleanData.coordinates } : existing.coordinates,
          // _replaceProperties: full replacement (for deleting custom params). Default: merge.
          properties: cleanData.properties
            ? (_replaceProperties ? cleanData.properties : { ...existing.properties, ...cleanData.properties })
            : existing.properties,
        };
        ymap.set(data.id, updated);
        return updated;
      }
      throw new Error('Markup not found in any Yjs document');
    }
  };
}

export function useDeleteMarkup() {
  return {
    mutateAsync: async (id: string) => {
      for (const entry of Object.values(ydocs)) {
        const ymap = entry.doc.getMap<Markup>('markups');
        if (ymap.has(id)) {
          ymap.delete(id);
          return;
        }
      }
    }
  };
}

// ─── Awareness hooks ───

/**
 * Returns array of connected users with their cursor positions.
 * Updates when any user's awareness state changes.
 */
export function useAwareness(documentId: string | undefined): AwarenessUser[] {
  const [users, setUsers] = useState<AwarenessUser[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!documentId) { setUsers([]); return; }
    const entry = ydocs[documentId];
    if (!entry) { setUsers([]); return; }

    const awareness = entry.provider.awareness;

    const collect = () => {
      const states = awareness.getStates() as Map<number, AwarenessState>;
      const result: AwarenessUser[] = [];
      states.forEach((state, clientId) => {
        if (!state.user) return;
        // Exclude self
        if (state.user.id === user?.id) return;
        result.push(state.user);
      });
      setUsers(result);
    };

    awareness.on('change', collect);
    collect(); // initial

    return () => { awareness.off('change', collect); };
  }, [documentId, user?.id]);

  return users;
}

/**
 * Returns a stable function to update the local user's cursor position in awareness.
 */
export function useSetLocalCursor(documentId: string | undefined) {
  const cursorRef = useRef<{ pageIndex: number; x: number; y: number } | null>(null);

  const setLocalCursor = useCallback((pageIndex: number, x: number, y: number) => {
    if (!documentId) return;
    const entry = ydocs[documentId];
    if (!entry) return;
    const awareness = entry.provider.awareness;
    const prev = cursorRef.current;
    // Throttle: only update if moved significantly
    if (prev && prev.pageIndex === pageIndex && Math.abs(prev.x - x) < 0.002 && Math.abs(prev.y - y) < 0.002) return;
    cursorRef.current = { pageIndex, x, y };
    awareness.setLocalStateField('user', {
      ...(awareness.getLocalState()?.user || {}),
      cursor: { pageIndex, x, y },
    });
  }, [documentId]);

  const clearLocalCursor = useCallback(() => {
    if (!documentId) return;
    const entry = ydocs[documentId];
    if (!entry) return;
    cursorRef.current = null;
    const awareness = entry.provider.awareness;
    awareness.setLocalStateField('user', {
      ...(awareness.getLocalState()?.user || {}),
      cursor: null,
    });
  }, [documentId]);

  return { setLocalCursor, clearLocalCursor };
}

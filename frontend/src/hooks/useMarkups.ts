import { useEffect, useState } from 'react';
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

export function useMarkups(documentId: string | undefined) {
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!documentId || !token) return;

    if (!ydocs[documentId]) {
      const doc = new Y.Doc();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In development, Vite proxy handles /api, but WebSocket usually needs direct port 3000
      const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
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

    // RAF-batch: coalesce rapid Yjs updates (e.g. bulk imports, collab bursts)
    // into a single React state update per animation frame.
    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setMarkups(Array.from(ymap.values()));
      });
    };

    ymap.observe(scheduleUpdate);
    provider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
      scheduleUpdate();
    });

    // Initial state — immediate, no debounce
    setMarkups(Array.from(ymap.values()));

    return () => {
      ymap.unobserve(scheduleUpdate);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [documentId]);

  return {
    data: markups,
    isSynced,
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
        const updated = {
          ...existing,
          ...data,
          coordinates: data.coordinates ? { ...existing.coordinates, ...data.coordinates } : existing.coordinates,
          properties: data.properties ? { ...existing.properties, ...data.properties } : existing.properties,
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

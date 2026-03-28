import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  actor: { id: string; name?: string; email: string };
  markupId: string;
  documentId: string;
  projectId: string;
  documentName: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ status: string; data: AppNotification[] }>('/api/notifications');
      setNotifications(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time socket updates
  useEffect(() => {
    if (!user || !token) return;
    const socket = getSocket(token);
    const handler = (n: AppNotification) => {
      setNotifications(prev => {
        if (prev.some(x => x.id === n.id)) return prev;
        return [n, ...prev];
      });

      // Use stable id so react-hot-toast deduplicates if handler fires twice
      if (!n.read) {
        const actorName = n.actor?.name || n.actor?.email || 'Someone';
        const docName = n.documentName || 'a document';
        toast.success(`${actorName} mentioned you in "${docName}"`, {
          id: `mention-${n.id}`,
          duration: 6000,
        });
      }
    };
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const deleteAll = useCallback(async () => {
    setNotifications([]);
    await apiFetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, deleteOne, deleteAll, refetch: fetchNotifications };
}

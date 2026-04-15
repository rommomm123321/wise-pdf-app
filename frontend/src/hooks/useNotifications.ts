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
  markupId?: string;
  documentId?: string;
  projectId?: string;
  documentName?: string;
  // Review assignment support
  type?: 'mention' | 'review_request' | 'review_approved' | 'review_rejected';
  assignmentId?: string;
  assignmentStatus?: 'pending' | 'has_markups' | 'approved';
  message?: string;
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
    const handler = (n: any) => {
      console.log('[Notifications] Received notification:new', n);
      const notif: AppNotification = {
        ...n,
        id: n.id || crypto.randomUUID(),
        read: false,
      };
      setNotifications(prev => {
        if (notif.id && prev.some(x => x.id === notif.id)) return prev;
        return [notif, ...prev];
      });

      if (!notif.read) {
        const actorName = notif.actor?.name || notif.actor?.email || (n as any).actorName || 'Someone';
        const docName = notif.documentName || 'a document';
        const msg = notif.type === 'review_request' ? `${actorName} assigned you to review "${docName}"`
          : notif.type === 'review_approved' ? `${actorName} approved "${docName}"`
          : notif.type === 'review_rejected' ? `${actorName} found issues in "${docName}"`
          : `${actorName} mentioned you in "${docName}"`;
        toast.success(msg, { id: `notif-${notif.id}`, duration: 6000 });
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

  // Respond to review assignment (has_markups / approved)
  const respondToAssignment = useCallback(async (assignmentId: string, action: 'has_markups' | 'approved', comment?: string) => {
    try {
      await apiFetch(`/api/review-assignments/${assignmentId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ action, comment }),
      });
      toast.success(action === 'approved' ? 'Approved — ready to print' : 'Sent back for corrections');
      fetchNotifications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond');
    }
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, deleteOne, deleteAll, respondToAssignment, refetch: fetchNotifications };
}

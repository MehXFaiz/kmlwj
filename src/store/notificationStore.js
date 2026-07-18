import { create } from 'zustand';
import api from '../services/api';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  _pollInterval: null,

  fetchNotifications: async () => {
    try {
      const response = await api.get('/api/v1/notifications?limit=50');
      const { data, meta } = response.data;
      set({
        notifications: data || [],
        unreadCount: meta?.unreadCount ?? 0,
      });
    } catch {
      // Silent fail — notifications are non-critical
    }
  },

  // Kept for backward compatibility: existing form components call this after
  // a successful save. We simply trigger a re-fetch so the DB-generated
  // notification surfaces immediately without waiting for the poll interval.
  addNotification: () => {
    get().fetchNotifications();
  },

  markAsRead: async (id) => {
    // Optimistic update
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      if (!target || target.isRead) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
    try {
      await api.patch(`/api/v1/notifications?action=mark-read&id=${id}`);
    } catch {
      // Revert on failure
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await api.patch('/api/v1/notifications?action=mark-all-read');
    } catch {
      get().fetchNotifications();
    }
  },

  removeNotification: async (id) => {
    // Optimistic update
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    });
    try {
      await api.patch(`/api/v1/notifications?action=dismiss&id=${id}`);
    } catch {
      get().fetchNotifications();
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await api.patch('/api/v1/notifications?action=clear-all');
    } catch {
      get().fetchNotifications();
    }
  },

  startPolling: () => {
    if (get()._pollInterval) return; // Already running
    // Fetch immediately on start
    get().fetchNotifications();
    const interval = setInterval(() => {
      get().fetchNotifications();
    }, 30000); // Poll every 30 s
    set({ _pollInterval: interval });
  },

  stopPolling: () => {
    const { _pollInterval } = get();
    if (_pollInterval) {
      clearInterval(_pollInterval);
      set({ _pollInterval: null });
    }
  },
}));

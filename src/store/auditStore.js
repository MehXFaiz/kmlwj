import { create } from 'zustand';
import { auditService } from '../services/apiServices';

export const useAuditStore = create((set) => ({
  logs: [],
  loading: false,
  error: null,

  fetchLogs: async () => {
    set({ loading: true, error: null });
    try {
      const data = await auditService.getAll();
      set({ logs: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch audit logs', loading: false });
    }
  },
}));

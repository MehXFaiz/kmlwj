import { create } from 'zustand';
import { dashboardService } from '../services/apiServices';

export const useDashboardStore = create((set) => ({
  stats: null,
  loading: false,
  error: null,

  fetchStats: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await dashboardService.getStats(params);
      set({ stats: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch dashboard statistics', loading: false });
    }
  },
}));

import { create } from 'zustand';
import { dashboardService, reportsService } from '../services/apiServices';

export const useDashboardStore = create((set) => ({
  stats: null,
  tbReport: null,
  loading: false,
  error: null,
  lastParams: {},
  lastTbParams: {},

  fetchStats: async (params = null) => {
    set((state) => ({ loading: true, error: null, lastParams: params || state.lastParams }));
    try {
      const currentParams = params || useDashboardStore.getState().lastParams;
      const data = await dashboardService.getStats(currentParams);
      set({ stats: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch dashboard statistics', loading: false });
    }
  },

  fetchTbReport: async (params = null) => {
    set((state) => ({ loading: true, error: null, lastTbParams: params || state.lastTbParams }));
    try {
      const currentParams = params || useDashboardStore.getState().lastTbParams;
      const data = await reportsService.getTrialBalance(currentParams);
      set({ tbReport: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch trial balance report', loading: false });
    }
  },
  
  invalidateAll: () => {
    useDashboardStore.getState().fetchStats();
    if (useDashboardStore.getState().tbReport) {
      useDashboardStore.getState().fetchTbReport();
    }
  }
}));

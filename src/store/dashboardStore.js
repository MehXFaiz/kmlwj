import { create } from 'zustand';
import { dashboardService, reportsService } from '../services/apiServices';

export const useDashboardStore = create((set, get) => ({
  stats: null,
  tbReport: null,
  loading: false,
  error: null,
  lastParams: {},
  // Incremented on every invalidateAll — watched by Reports, TrialBalanceSheet,
  // and any other view that needs to auto-refresh after a mutation.
  version: 0,

  fetchStats: async (params = null) => {
    const currentParams = params !== null ? params : get().lastParams;
    set({ loading: true, error: null, lastParams: currentParams });
    try {
      const data = await dashboardService.getStats(currentParams);
      set({ stats: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch dashboard statistics', loading: false });
    }
  },

  fetchTbReport: async (params = null) => {
    const currentParams = params !== null ? params : get().lastParams;
    set({ loading: true, error: null, lastParams: currentParams });
    try {
      const data = await reportsService.getTrialBalance(currentParams);
      set({ tbReport: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch trial balance report', loading: false });
    }
  },

  // Call after any Create / Update / Delete / Post operation. Bumps `version`
  // so every subscribed view (Dashboard, Reports, TrialBalanceSheet, etc.)
  // immediately re-fetches from the posted ledger — the single source of truth.
  invalidateAll: () => {
    const state = get();
    state.fetchStats(state.lastParams);
    state.fetchTbReport(state.lastParams);
    set((s) => ({ version: s.version + 1 }));
  }
}));

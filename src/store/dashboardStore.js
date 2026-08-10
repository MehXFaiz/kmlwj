import { create } from 'zustand';
import { dashboardService, reportsService } from '../services/apiServices';

export const useDashboardStore = create((set, get) => ({
  stats: null,
  tbReport: null,
  loading: false,
  error: null,
  lastParams: {},
  // The period each dataset was actually fetched for. `stats` and `tbReport`
  // are shared across views that scope them differently — the Dashboard loads
  // a fiscal year while TrialBalanceSheet loads all-time by default — so the
  // two can legitimately describe different periods. Consumers that compare
  // them against each other must check these first.
  statsParams: null,
  tbParams: null,
  // Incremented on every invalidateAll — watched by Reports, TrialBalanceSheet,
  // and any other view that needs to auto-refresh after a mutation.
  version: 0,

  fetchStats: async (params = null) => {
    const currentParams = params !== null ? params : get().lastParams;
    set({ loading: true, error: null, lastParams: currentParams });
    try {
      const data = await dashboardService.getStats(currentParams);
      set({ stats: data, statsParams: currentParams, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch dashboard statistics', loading: false });
    }
  },

  fetchTbReport: async (params = null) => {
    const currentParams = params !== null ? params : get().lastParams;
    set({ loading: true, error: null, lastParams: currentParams });
    try {
      const data = await reportsService.getTrialBalance(currentParams);
      set({ tbReport: data, tbParams: currentParams, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch trial balance report', loading: false });
    }
  },

  // Call after any Create / Update / Delete / Post operation. Bumps `version`
  // so every subscribed view (Dashboard, Reports, TrialBalanceSheet, etc.)
  // immediately re-fetches from the posted ledger — the single source of truth.
  invalidateAll: () => {
    const state = get();
    // Refetch each dataset for the period IT was last loaded with. Using a
    // single shared `lastParams` here silently re-scoped one dataset to the
    // other's period — e.g. after visiting the all-time Trial Balance page,
    // any mutation would reload the Dashboard's fiscal-year stats as all-time.
    state.fetchStats(state.statsParams ?? state.lastParams);
    state.fetchTbReport(state.tbParams ?? state.lastParams);
    set((s) => ({ version: s.version + 1 }));
  }
}));

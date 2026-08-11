import { create } from 'zustand';
import { dashboardService, reportsService } from '../services/apiServices';

// Monotonic request counters. `/api/v1/dashboard/stats` is by far the slower of
// the two endpoints (it heals header postings and rebuilds the balance cache in
// a write transaction before it reports), so when a mutation fires a second
// round of fetches on top of an in-flight one, responses routinely arrive out of
// order. Without a guard the OLDER response wins and `stats` ends up describing
// an earlier ledger state than `tbReport` — which is exactly what the
// Dashboard's reconciliation check then reported as an accounting discrepancy.
let statsRequestId = 0;
let tbRequestId = 0;

export const useDashboardStore = create((set, get) => ({
  stats: null,
  tbReport: null,
  loading: false,
  // Per-dataset loading flags. A single shared `loading` was set AND cleared by
  // both fetches, so whichever finished first cleared it while the other was
  // still in flight, making the Dashboard look settled mid-refresh.
  statsLoading: false,
  tbLoading: false,
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
    const currentParams = params !== null ? params : (get().statsParams ?? get().lastParams);
    const requestId = ++statsRequestId;
    set({ loading: true, statsLoading: true, error: null, lastParams: currentParams });
    try {
      const data = await dashboardService.getStats(currentParams);
      // A newer fetchStats started while this one was in flight — discard this
      // response instead of letting stale numbers overwrite fresher ones.
      if (requestId !== statsRequestId) return;
      set((s) => ({ stats: data, statsParams: currentParams, statsLoading: false, loading: s.tbLoading }));
    } catch (err) {
      if (requestId !== statsRequestId) return;
      set((s) => ({ error: err.message || 'Failed to fetch dashboard statistics', statsLoading: false, loading: s.tbLoading }));
    }
  },

  fetchTbReport: async (params = null) => {
    const currentParams = params !== null ? params : (get().tbParams ?? get().lastParams);
    const requestId = ++tbRequestId;
    set({ loading: true, tbLoading: true, error: null, lastParams: currentParams });
    try {
      const data = await reportsService.getTrialBalance(currentParams);
      if (requestId !== tbRequestId) return;
      set((s) => ({ tbReport: data, tbParams: currentParams, tbLoading: false, loading: s.statsLoading }));
    } catch (err) {
      if (requestId !== tbRequestId) return;
      set((s) => ({ error: err.message || 'Failed to fetch trial balance report', tbLoading: false, loading: s.statsLoading }));
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


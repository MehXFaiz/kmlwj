import { create } from 'zustand';
import { pettyCashService } from '../services/apiServices';
import { useDashboardStore } from './dashboardStore';

export const usePettyCashStore = create((set, get) => ({
  config: null,
  register: [],
  totalCount: 0,
  loading: false,
  error: null,
  activeFilter: { startDate: '', endDate: '', type: '' },

  fetchConfig: async () => {
    try {
      const data = await pettyCashService.getConfig();
      set({ config: data });
    } catch (err) {
      console.error('Failed to fetch Petty Cash config:', err);
    }
  },

  fetchRegister: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const activeFilter = { ...get().activeFilter, ...params };
      const data = await pettyCashService.getRegister(activeFilter);
      set({
        register: data.register || [],
        totalCount: data.totalCount || 0,
        activeFilter,
        loading: false
      });
    } catch (err) {
      set({ error: err.message || 'Failed to load Petty Cash register', loading: false });
    }
  },

  addCash: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await pettyCashService.addCash(data);
      await Promise.all([get().fetchConfig(), get().fetchRegister()]);
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  recordExpense: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await pettyCashService.recordExpense(data);
      await Promise.all([get().fetchConfig(), get().fetchRegister()]);
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  replenish: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await pettyCashService.replenish(data);
      await Promise.all([get().fetchConfig(), get().fetchRegister()]);
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  updateConfig: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await pettyCashService.updateConfig(data);
      set({ config: res, loading: false });
      return res;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  reconcile: async (data) => {
    try {
      const res = await pettyCashService.reconcile(data);
      return res;
    } catch (err) {
      throw err;
    }
  },

  revertTransaction: async (transactionId, revertReason) => {
    set({ loading: true, error: null });
    try {
      const res = await pettyCashService.revert({ transactionId, revertReason });
      await Promise.all([get().fetchConfig(), get().fetchRegister()]);
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  }
}));

import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';
import { useCoaStore } from './coaStore';
import { useJournalStore } from './journalStore';

export const useOpeningBalanceStore = create((set, get) => ({
  loading: false,
  saving: false,
  error: null,
  financialYear: '',
  openingDate: new Date().toISOString().split('T')[0],
  batch: null,
  accounts: {},

  fetchOpeningBalances: async (dateStr) => {
    set({ loading: true, error: null });
    try {
      const url = dateStr ? `/api/v1/opening-balances?date=${dateStr}` : '/api/v1/opening-balances';
      const res = await api.get(url);
      const data = res.data.data;
      set({
        financialYear: data.financialYear,
        openingDate: data.openingDate,
        batch: data.batch,
        accounts: data.accounts || {},
        loading: false
      });
      return data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to load opening balances';
      set({ error: errMsg, loading: false });
      throw err;
    }
  },

  saveOpeningBalances: async (openingDate, balances) => {
    set({ saving: true, error: null });
    try {
      const res = await api.post('/api/v1/opening-balances', {
        openingDate,
        balances
      });

      set({ saving: false });
      
      // Invalidate relevant stores
      useDashboardStore.getState().invalidateAll();
      useCoaStore.getState().fetchAccountsTree();
      useJournalStore.getState().fetchJournals();

      await get().fetchOpeningBalances(openingDate);
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to save opening balances';
      set({ error: errMsg, saving: false });
      throw err;
    }
  }
}));

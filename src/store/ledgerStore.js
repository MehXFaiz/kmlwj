import { create } from 'zustand';
import api from '../services/api';

export const useLedgerStore = create((set, get) => ({
  ledgerData: null,
  isLoading: false,
  error: null,

  fetchLedger: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.accountId) queryParams.append('accountId', filters.accountId);
      if (filters.glCode) queryParams.append('glCode', filters.glCode);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);

      const res = await api.get(`/api/v1/general-ledger?${queryParams.toString()}`);
      set({ ledgerData: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch ledger', isLoading: false });
    }
  },

  addLedgerEntry: async (entryData, currentFilters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/api/v1/general-ledger', entryData);
      await get().fetchLedger(currentFilters);
      return { success: true, data: res.data.data };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to add GL entry';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  deleteLedgerEntry: async (id, currentFilters = {}) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/v1/general-ledger?id=${id}`, { data: { id } });
      await get().fetchLedger(currentFilters);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to delete GL entry';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  bulkDeleteLedgerEntries: async (ids, currentFilters = {}) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete('/api/v1/general-ledger', { data: { ids } });
      await get().fetchLedger(currentFilters);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to bulk delete GL entries';
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  resetLedger: () => {
    set({ ledgerData: null, error: null });
  },
}));

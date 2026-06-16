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

  resetLedger: () => {
    set({ ledgerData: null, error: null });
  },
}));

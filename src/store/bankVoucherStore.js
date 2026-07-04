import { create } from 'zustand';
import api from '../services/api';

export const useBankVoucherStore = create((set, get) => ({
  vouchers: [],
  loading: false,
  error: null,

  fetchVouchers: async (type = 'BP') => {
    set({ loading: true, error: null });
    try {
      const res = await api.get(`/api/v1/journal-entries?type=${type}`);
      set({ vouchers: res.data.data || [], loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch vouchers', loading: false });
    }
  },

  addVoucher: async (voucherData) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/api/v1/journal-entries', voucherData);
      set({ loading: false });
      return res.data;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  updateVoucherStatus: async (id, status, type) => {
    set({ loading: true, error: null });
    try {
      const res = await api.patch('/api/v1/journal-entries', { id, status });
      await get().fetchVouchers(type);
      set({ loading: false });
      return res.data;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  deleteVoucher: async (id, type) => {
    set({ loading: true, error: null });
    try {
      const res = await api.delete(`/api/v1/journal-entries?id=${id}`);
      await get().fetchVouchers(type);
      set({ loading: false });
      return res.data;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  bulkDeleteVouchers: async (ids, type) => {
    set({ loading: true, error: null });
    try {
      const res = await api.delete('/api/v1/journal-entries', { data: { ids } });
      await get().fetchVouchers(type);
      set({ loading: false });
      return res.data;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  }
}));

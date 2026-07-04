import { create } from 'zustand';
import { donationReceivedService } from '../services/donationReceivedService';

export const useDonationReceivedStore = create((set, get) => ({
  donations: [],
  stats: {
    totalAmount: 0,
    cashAmount: 0,
    bankAmount: 0,
    totalReceipts: 0,
  },
  loading: false,
  error: null,

  fetchDonations: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await donationReceivedService.getAll(params);
      set({
        donations: data.data || [],
        stats: data.stats || { totalAmount: 0, cashAmount: 0, bankAmount: 0, totalReceipts: 0 },
        loading: false,
        error: null
      });
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
    }
  },

  addDonation: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await donationReceivedService.create(data);
      await get().fetchDonations();
      set({ loading: false });
      return res;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  updateDonationStatus: async (id, status, extraData = {}) => {
    set({ loading: true, error: null });
    try {
      const res = await donationReceivedService.update(id, { status, ...extraData });
      await get().fetchDonations();
      set({ loading: false });
      return res;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  deleteDonation: async (id) => {
    set({ loading: true, error: null });
    try {
      await donationReceivedService.delete(id);
      set(state => ({
        donations: state.donations.filter(d => d.id !== id),
        loading: false
      }));
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  bulkDeleteDonations: async (ids) => {
    set({ loading: true, error: null });
    try {
      const res = await donationReceivedService.bulkDelete(ids);
      await get().fetchDonations();
      set({ loading: false });
      return res;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  }
}));

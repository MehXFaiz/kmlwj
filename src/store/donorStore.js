import { create } from 'zustand';
import { donorService } from '../services/donorService';
import { useDashboardStore } from './dashboardStore';

export const useDonorStore = create((set, get) => ({
  donors: [],
  loading: false,
  error: null,

  fetchDonors: async (search = '') => {
    set({ loading: true, error: null });
    try {
      const data = await donorService.getAll(search);
      set({ donors: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
    }
  },

  addDonor: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await donorService.create(data);
      await get().fetchDonors();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  updateDonor: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const res = await donorService.update(id, data);
      await get().fetchDonors();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  deleteDonor: async (id) => {
    set({ loading: true, error: null });
    try {
      await donorService.delete(id);
      await get().fetchDonors();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message, loading: false });
      throw err;
    }
  },

  bulkDeleteDonors: async (ids) => {
    set({ loading: true, error: null });
    try {
      const res = await donorService.bulkDelete(ids);
      await get().fetchDonors();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'Unable to delete selected donors.';
      set({ error: message, loading: false });
      const error = new Error(message);
      error.status = err.response?.status;
      throw error;
    }
  }
}));

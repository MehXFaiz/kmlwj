import { create } from 'zustand';
import { donationService } from '../services/donationService';
import { useDashboardStore } from './dashboardStore';

export const useDonationStore = create((set, get) => ({
  donations: [],
  loading: false,
  error: null,

  fetchDonations: async (params) => {
    set({ loading: true });
    try {
      const data = await donationService.getAll(params);
      set({ donations: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  checkDuplicate: async (disbursementMonth, donationType, bankAccountId) => {
    try {
      return await donationService.checkDuplicate(disbursementMonth, donationType, bankAccountId);
    } catch (err) {
      return { isDuplicate: false };
    }
  },

  addDonation: async (data) => {
    try {
      const res = await donationService.create(data);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateDonation: async (id, data) => {
    try {
      const res = await donationService.update(id, data);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  approveDonation: async (id) => {
    try {
      const res = await donationService.approve(id);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  revertDonation: async (id, reason) => {
    try {
      const res = await donationService.revert(id, reason);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteDonation: async (id) => {
    try {
      const res = await donationService.delete(id);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkDeleteDonations: async (ids) => {
    try {
      await donationService.bulkDelete(ids);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
      return { success: true };
    } catch (err) {
      set({ error: err.message });
      return { success: false, error: err.message };
    }
  }
}));

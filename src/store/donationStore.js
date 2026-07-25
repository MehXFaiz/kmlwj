import { create } from 'zustand';
import { donationService } from '../services/donationService';
import { useDashboardStore } from './dashboardStore';

export const useDonationStore = create((set, get) => ({
  donations: [],
  loading: false,
  error: null,

  fetchDonations: async () => {
    set({ loading: true });
    try {
      const data = await donationService.getAll();
      set({ donations: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addDonation: async (data) => {
    try {
      const res = await donationService.create(data);
      // refetch to get beneficiary details attached correctly, or just refetch whole list
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateDonation: async (id, data) => {
    try {
      await donationService.update(id, data);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  approveDonation: async (id) => {
    try {
      await donationService.approve(id);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteDonation: async (id) => {
    try {
      await donationService.delete(id);
      await get().fetchDonations();
      useDashboardStore.getState().invalidateAll();
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

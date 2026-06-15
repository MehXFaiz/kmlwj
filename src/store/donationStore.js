import { create } from 'zustand';
import { donationService } from '../services/donationService';

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
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateDonation: async (id, data) => {
    try {
      await donationService.update(id, data);
      await get().fetchDonations();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  approveDonation: async (id) => {
    try {
      await donationService.approve(id);
      await get().fetchDonations();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  }
}));

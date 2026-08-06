import { create } from 'zustand';
import { zakatCardService } from '../services/zakatCardService';
import { useDashboardStore } from './dashboardStore';

export const useZakatCardStore = create((set, get) => ({
  cards: [],
  loading: false,
  error: null,

  fetchCards: async () => {
    set({ loading: true, error: null });
    try {
      const res = await zakatCardService.getAll();
      set({ cards: res.data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  issueCard: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await zakatCardService.create(data);
      await get().fetchCards();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return res.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteCard: async (id) => {
    set({ loading: true, error: null });
    try {
      await zakatCardService.delete(id);
      await get().fetchCards();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));

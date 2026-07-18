import { create } from 'zustand';
import { zakatCardService } from '../services/zakatCardService';

export const useZakatCardStore = create((set) => ({
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
    const res = await zakatCardService.create(data);
    set((state) => ({ cards: [res.data, ...state.cards] }));
    return res.data;
  },

  deleteCard: async (id) => {
    await zakatCardService.delete(id);
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }));
  },
}));

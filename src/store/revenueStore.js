import { create } from 'zustand';
import { revenueService } from '../services/apiServices';

export const useRevenueStore = create((set, get) => ({
  heads: [],
  loading: false,
  error: null,

  fetchHeads: async () => {
    set({ loading: true, error: null });
    try {
      const data = await revenueService.getAll();
      set({ heads: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch revenue heads', loading: false });
    }
  },

  addHead: async (head) => {
    set({ loading: true, error: null });
    try {
      const newHead = await revenueService.create({
        code: head.code,
        name: head.name,
        category: head.category || 'Operating',
        description: head.description || '',
        budget: parseFloat(head.budget) || 0,
        actual: parseFloat(head.actual) || 0,
        status: head.status || 'Active',
      });
      await get().fetchHeads();
      set({ loading: false });
      return newHead;
    } catch (err) {
      set({ error: err.message || 'Failed to add revenue head', loading: false });
      throw err;
    }
  },

  updateHead: async (id, updatedFields) => {
    set({ loading: true, error: null });
    try {
      const updated = await revenueService.update(id, {
        code: updatedFields.code,
        name: updatedFields.name,
        category: updatedFields.category,
        description: updatedFields.description,
        budget: parseFloat(updatedFields.budget) || 0,
        actual: parseFloat(updatedFields.actual) || 0,
        status: updatedFields.status,
      });
      await get().fetchHeads();
      set({ loading: false });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update revenue head', loading: false });
      throw err;
    }
  },

  deleteHead: async (id) => {
    set({ loading: true, error: null });
    try {
      await revenueService.delete(id);
      await get().fetchHeads();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to delete revenue head', loading: false });
      throw err;
    }
  },
}));

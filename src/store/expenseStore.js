import { create } from 'zustand';
import { expenseService } from '../services/apiServices';
import { useDashboardStore } from './dashboardStore';

export const useExpenseStore = create((set, get) => ({
  heads: [],
  loading: false,
  error: null,

  fetchHeads: async () => {
    set({ loading: true, error: null });
    try {
      const data = await expenseService.getAll();
      set({ heads: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch expense heads', loading: false });
    }
  },

  addHead: async (head) => {
    set({ loading: true, error: null });
    try {
      const newHead = await expenseService.create({
        name: head.name,
        category: head.category,
        accountId: head.accountId || null,
        isActive: head.isActive !== undefined ? head.isActive : true,
      });
      await get().fetchHeads();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return newHead;
    } catch (err) {
      set({ error: err.message || 'Failed to add expense head', loading: false });
      throw err;
    }
  },

  updateHead: async (id, updatedFields) => {
    set({ loading: true, error: null });
    try {
      const updated = await expenseService.update(id, {
        name: updatedFields.name,
        category: updatedFields.category,
        accountId: updatedFields.accountId || null,
        isActive: updatedFields.isActive,
      });
      await get().fetchHeads();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update expense head', loading: false });
      throw err;
    }
  },

  deleteHead: async (id) => {
    set({ loading: true, error: null });
    try {
      await expenseService.delete(id);
      await get().fetchHeads();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message || 'Failed to delete expense head', loading: false });
      throw err;
    }
  },
}));

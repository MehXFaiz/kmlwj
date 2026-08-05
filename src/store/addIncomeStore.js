import { create } from 'zustand';
import { addIncomeService } from '../services/addIncomeService';
import { useDashboardStore } from './dashboardStore';

export const useAddIncomeStore = create((set, get) => ({
  categories: [],
  records: [],
  pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
  loading: false,
  categoriesLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ categoriesLoading: true });
    try {
      const res = await addIncomeService.getCategories();
      set({ categories: res.data || [], categoriesLoading: false });
    } catch (err) {
      set({ categoriesLoading: false, error: err.response?.data?.error?.message || err.message });
    }
  },

  createCategory: async (data) => {
    const res = await addIncomeService.createCategory(data);
    await get().fetchCategories();
    return res;
  },

  updateCategory: async (id, data) => {
    const res = await addIncomeService.updateCategory(id, data);
    await get().fetchCategories();
    return res;
  },

  deleteCategory: async (id) => {
    const res = await addIncomeService.deleteCategory(id);
    await get().fetchCategories();
    return res;
  },

  fetchRecords: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const res = await addIncomeService.getRecords(params);
      set({
        records: res.data || [],
        pagination: res.pagination || { total: (res.data || []).length, page: 1, limit: 50, totalPages: 1 },
        loading: false
      });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error?.message || err.message });
    }
  },

  createRecord: async (data) => {
    const res = await addIncomeService.createRecord(data);
    await get().fetchRecords();
    try {
      useDashboardStore.getState().invalidateAll();
    } catch (e) {}
    return res;
  },

  updateRecord: async (id, data) => {
    const res = await addIncomeService.updateRecord(id, data);
    await get().fetchRecords();
    try {
      useDashboardStore.getState().invalidateAll();
    } catch (e) {}
    return res;
  },

  deleteRecord: async (id) => {
    const res = await addIncomeService.deleteRecord(id);
    await get().fetchRecords();
    try {
      useDashboardStore.getState().invalidateAll();
    } catch (e) {}
    return res;
  }
}));

import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';

export const useSimpleExpenseStore = create((set, get) => ({
  expenses: [],
  isLoading: false,
  error: null,

  fetchExpenses: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/api/v1/simple-expense');
      set({ expenses: data.data || [] });
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch expenses' });
    } finally {
      set({ isLoading: false });
    }
  },

  createExpense: async (expenseData) => {
    set({ error: null });
    try {
      const { data } = await api.post('/api/v1/simple-expense', expenseData);
      set(state => ({ expenses: [data.data, ...state.expenses] }));
      useDashboardStore.getState().invalidateAll();
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to record expense' });
      return false;
    }
  },

  updateExpense: async (id, expenseData) => {
    set({ error: null });
    try {
      const { data } = await api.put('/api/v1/simple-expense', { id, ...expenseData });
      set(state => ({
        expenses: state.expenses.map(e => e.id === id ? data.data : e)
      }));
      useDashboardStore.getState().invalidateAll();
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to update expense' });
      return false;
    }
  },

  deleteExpense: async (id) => {
    set({ error: null });
    try {
      await api.delete(`/api/v1/simple-expense?id=${id}`);
      set(state => ({
        expenses: state.expenses.filter(e => e.id !== id)
      }));
      useDashboardStore.getState().invalidateAll();
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to delete expense' });
      return false;
    }
  }
}));

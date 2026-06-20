import { create } from 'zustand';
import api from '../services/api';

export const useSimpleExpenseStore = create((set, get) => ({
  expenses: [],
  isLoading: false,
  error: null,

  fetchExpenses: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/v1/simple-expense');
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
      const { data } = await api.post('/v1/simple-expense', expenseData);
      set(state => ({ expenses: [data.data, ...state.expenses] }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to record expense' });
      return false;
    }
  }
}));

import { create } from 'zustand';
import api from '../services/api';
import toast from 'react-hot-toast';

export const useSimpleExpenseStore = create((set, get) => ({
  expenses: [],
  isLoading: false,

  fetchExpenses: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/simple-expense');
      set({ expenses: data.data || [] });
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to fetch expenses');
    } finally {
      set({ isLoading: false });
    }
  },

  createExpense: async (expenseData) => {
    try {
      const { data } = await api.post('/v1/simple-expense', expenseData);
      set(state => ({ expenses: [data.data, ...state.expenses] }));
      toast.success('Expense recorded successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to record expense');
      return false;
    }
  }
}));

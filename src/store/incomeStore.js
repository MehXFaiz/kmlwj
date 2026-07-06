import { create } from 'zustand';
import api from '../services/api';

export const useIncomeStore = create((set, get) => ({
  incomes: [],
  isLoading: false,
  error: null,

  fetchIncomes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/api/v1/simple-income');
      set({ incomes: data.data || [] });
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to fetch incomes' });
    } finally {
      set({ isLoading: false });
    }
  },

  createIncome: async (incomeData) => {
    set({ error: null });
    try {
      const { data } = await api.post('/api/v1/simple-income', incomeData);
      set(state => ({ incomes: [data.data, ...state.incomes] }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Failed to record income' });
      return false;
    }
  }
}));

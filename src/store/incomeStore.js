import { create } from 'zustand';
import api from '../services/api';
import toast from 'react-hot-toast';

export const useIncomeStore = create((set, get) => ({
  incomes: [],
  isLoading: false,

  fetchIncomes: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/v1/simple-income');
      set({ incomes: data.data || [] });
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to fetch incomes');
    } finally {
      set({ isLoading: false });
    }
  },

  createIncome: async (incomeData) => {
    try {
      const { data } = await api.post('/v1/simple-income', incomeData);
      set(state => ({ incomes: [data.data, ...state.incomes] }));
      toast.success('Income recorded successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to record income');
      return false;
    }
  }
}));

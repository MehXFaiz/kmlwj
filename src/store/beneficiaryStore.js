import { create } from 'zustand';
import { beneficiaryService } from '../services/beneficiaryService';

export const useBeneficiaryStore = create((set, get) => ({
  beneficiaries: [],
  loading: false,
  error: null,

  fetchBeneficiaries: async () => {
    set({ loading: true });
    try {
      const data = await beneficiaryService.getAll();
      set({ beneficiaries: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addBeneficiary: async (data) => {
    try {
      await beneficiaryService.create(data);
      await get().fetchBeneficiaries();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateBeneficiary: async (id, data) => {
    try {
      await beneficiaryService.update(id, data);
      await get().fetchBeneficiaries();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteBeneficiary: async (id) => {
    try {
      await beneficiaryService.delete(id);
      set(state => ({
        beneficiaries: state.beneficiaries.filter(b => b.id !== id)
      }));
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  }
}));

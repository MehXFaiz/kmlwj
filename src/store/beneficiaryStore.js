import { create } from 'zustand';
import { beneficiaryService } from '../services/beneficiaryService';

export const useBeneficiaryStore = create((set, get) => ({
  beneficiaries: [],
  loading: false,
  error: null,

  fetchBeneficiaries: async () => {
    set({ loading: true, error: null });
    try {
      const data = await beneficiaryService.getAll();
      set({ beneficiaries: data?.data || [], loading: false });
    } catch (err) {
      set({ loading: false, error: err.message || 'Failed to load beneficiaries' });
    }
  },

  addBeneficiary: async (data) => {
    const created = await beneficiaryService.create(data);
    await get().fetchBeneficiaries();
    return created;
  },

  updateBeneficiary: async (id, data) => {
    const updated = await beneficiaryService.update(id, data);
    await get().fetchBeneficiaries();
    return updated;
  },

  deleteBeneficiary: async (id) => {
    await beneficiaryService.delete(id);
    await get().fetchBeneficiaries();
  }
}));

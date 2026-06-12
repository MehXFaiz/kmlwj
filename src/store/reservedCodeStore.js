import { create } from 'zustand';
import { reservedCodeService } from '../services/apiServices';

export const useReservedCodeStore = create((set, get) => ({
  codes: [],
  loading: false,
  error: null,

  fetchCodes: async () => {
    set({ loading: true, error: null });
    try {
      const data = await reservedCodeService.getAll();
      set({ codes: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch reserved codes', loading: false });
    }
  },

  addCode: async (codeData) => {
    set({ loading: true, error: null });
    try {
      const newCode = await reservedCodeService.create(codeData);
      await get().fetchCodes();
      set({ loading: false });
      return newCode;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message || 'Failed to add reserved code', loading: false });
      throw err;
    }
  },

  updateCode: async (id, updatedFields) => {
    set({ loading: true, error: null });
    try {
      const updated = await reservedCodeService.update(id, updatedFields);
      await get().fetchCodes();
      set({ loading: false });
      return updated;
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message || 'Failed to update reserved code', loading: false });
      throw err;
    }
  },

  deleteCode: async (id) => {
    set({ loading: true, error: null });
    try {
      await reservedCodeService.delete(id);
      await get().fetchCodes();
      set({ loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error?.message || err.message || 'Failed to delete reserved code', loading: false });
      throw err;
    }
  },
}));

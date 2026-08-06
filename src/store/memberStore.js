import { create } from 'zustand';
import { memberService } from '../services/memberService';
import { useDashboardStore } from './dashboardStore';

export const useMemberStore = create((set, get) => ({
  members: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    set({ loading: true });
    try {
      const data = await memberService.getAll();
      set({ members: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addMember: async (data) => {
    try {
      const res = await memberService.create(data);
      await get().fetchMembers();
      useDashboardStore.getState().invalidateAll();
      return res.data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateMember: async (id, data) => {
    try {
      const res = await memberService.update(id, data);
      await get().fetchMembers();
      useDashboardStore.getState().invalidateAll();
      return res.data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteMember: async (id) => {
    try {
      await memberService.delete(id);
      await get().fetchMembers();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkDeleteMembers: async (ids) => {
    try {
      const res = await memberService.bulkDelete(ids);
      await get().fetchMembers();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  }
}));


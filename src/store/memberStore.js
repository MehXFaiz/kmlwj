import { create } from 'zustand';
import { memberService } from '../services/memberService';

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
      return res.data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteMember: async (id) => {
    try {
      await memberService.delete(id);
      set(state => ({
        members: state.members.filter(m => m.id !== id)
      }));
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkDeleteMembers: async (ids) => {
    try {
      const res = await memberService.bulkDelete(ids);
      await get().fetchMembers();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  }
}));


import { create } from 'zustand';
import { memberService } from '../services/memberService';

const LOCAL_STORAGE_KEY = 'kmlwj_members';

const getLocalMembers = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalMembers = (members) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(members));
  } catch (e) {
    console.error('Error saving local members:', e);
  }
};

export const useMemberStore = create((set, get) => ({
  members: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    set({ loading: true });
    try {
      const data = await memberService.getAll();
      const list = data.data || [];
      saveLocalMembers(list);
      set({ members: list, loading: false, error: null });
    } catch (err) {
      console.warn('Backend fetchMembers failed, using local storage fallback:', err.message);
      const list = getLocalMembers();
      set({ members: list, loading: false, error: null });
    }
  },

  addMember: async (data) => {
    set({ loading: true });
    try {
      const res = await memberService.create(data);
      await get().fetchMembers();
      return res.data;
    } catch (err) {
      console.warn('Backend addMember failed, saving to local storage fallback:', err.message);
      const newMember = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const list = [newMember, ...getLocalMembers()];
      saveLocalMembers(list);
      set({ members: list, loading: false, error: null });
      return newMember;
    }
  },

  updateMember: async (id, data) => {
    set({ loading: true });
    try {
      const res = await memberService.update(id, data);
      await get().fetchMembers();
      return res.data;
    } catch (err) {
      console.warn('Backend updateMember failed, updating in local storage fallback:', err.message);
      const list = getLocalMembers().map(m => m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m);
      saveLocalMembers(list);
      set({ members: list, loading: false, error: null });
      return list.find(m => m.id === id);
    }
  },

  deleteMember: async (id) => {
    try {
      await memberService.delete(id);
      set(state => {
        const list = state.members.filter(m => m.id !== id);
        saveLocalMembers(list);
        return { members: list };
      });
    } catch (err) {
      console.warn('Backend deleteMember failed, deleting from local storage fallback:', err.message);
      const list = getLocalMembers().filter(m => m.id !== id);
      saveLocalMembers(list);
      set({ members: list });
    }
  }
}));

import { create } from 'zustand';
import { userService } from '../services/apiServices';
import { useDashboardStore } from './dashboardStore';

export const useUserStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const data = await userService.getAll();
      set({ users: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch users', loading: false });
    }
  },

  addUser: async (userData) => {
    set({ loading: true, error: null });
    try {
      const newUser = await userService.create({
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
        role: userData.role,
      });
      await get().fetchUsers();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return newUser;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to add user';
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  updateUser: async (id, updatedFields) => {
    set({ loading: true, error: null });
    try {
      const updated = await userService.update(id, {
        fullName: updatedFields.fullName,
        role: updatedFields.role,
        isActive: updatedFields.isActive,
        password: updatedFields.password,
      });
      await get().fetchUsers();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
      return updated;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to update user';
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  deleteUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await userService.delete(id);
      await get().fetchUsers();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to delete user';
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },
}));

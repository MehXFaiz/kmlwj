import { create } from 'zustand';
import { userService } from '../services/apiServices';

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
      return newUser;
    } catch (err) {
      set({ error: err.message || 'Failed to add user', loading: false });
      throw err;
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
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update user', loading: false });
      throw err;
    }
  },
}));

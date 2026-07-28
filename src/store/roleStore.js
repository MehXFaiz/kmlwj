import { create } from 'zustand';
import { roleService, auditService } from '../services/apiServices';
import { useDashboardStore } from './dashboardStore';

export const useRoleStore = create((set, get) => ({
  roles: [],
  activity: [],
  loading: false,
  error: null,

  fetchRoles: async () => {
    set({ loading: true, error: null });
    try {
      const data = await roleService.getAll();
      set({ roles: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch roles', loading: false });
    }
  },

  addRole: async (payload) => {
    set({ loading: true, error: null });
    try {
      await roleService.create(payload);
      await get().fetchRoles();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message || 'Failed to create role', loading: false });
      throw err;
    }
  },

  updateRole: async (id, payload) => {
    set({ loading: true, error: null });
    try {
      await roleService.update(id, payload);
      await get().fetchRoles();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message || 'Failed to update role', loading: false });
      throw err;
    }
  },

  deleteRole: async (id) => {
    set({ loading: true, error: null });
    try {
      await roleService.delete(id);
      await get().fetchRoles();
      set({ loading: false });
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message || 'Failed to delete role', loading: false });
      throw err;
    }
  },

  fetchActivity: async () => {
    try {
      const data = await auditService.getAll();
      set({ activity: data });
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    }
  },
}));

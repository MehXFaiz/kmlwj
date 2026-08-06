import { create } from 'zustand';
import { customerService } from '../services/customerService';
import { useDashboardStore } from './dashboardStore';

export const useCustomerStore = create((set, get) => ({
  customers: [],
  loading: false,
  error: null,

  fetchCustomers: async () => {
    set({ loading: true });
    try {
      const data = await customerService.getAll();
      set({ customers: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addCustomer: async (data) => {
    try {
      await customerService.create(data);
      await get().fetchCustomers();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateCustomer: async (id, data) => {
    try {
      await customerService.update(id, data);
      await get().fetchCustomers();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteCustomer: async (id) => {
    try {
      await customerService.delete(id);
      await get().fetchCustomers();
      useDashboardStore.getState().invalidateAll();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkDeleteCustomers: async (ids) => {
    try {
      const res = await customerService.bulkDelete(ids);
      await get().fetchCustomers();
      useDashboardStore.getState().invalidateAll();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  }
}));

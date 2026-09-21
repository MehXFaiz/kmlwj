import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';

export const useRevenueCollectionStore = create((set, get) => ({
  collections: [],
  loading: false,
  error: null,
  currentCategory: null,
  currentParams: {},

  fetchCollections: async (category, params = {}) => {
    const activeCategory = category !== undefined ? category : get().currentCategory;
    const activeParams = params !== undefined ? params : get().currentParams;
    set({ loading: true, error: null, currentCategory: activeCategory, currentParams: activeParams });
    try {
      const queryParams = new URLSearchParams({ limit: '1000', ...activeParams });
      if (activeCategory) queryParams.set('category', activeCategory);
      const url = `/api/v1/revenue-collections?${queryParams.toString()}`;
      const response = await api.get(url);
      set({ collections: response.data.data || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addCollection: async (data) => {
    try {
      const response = await api.post('/api/v1/revenue-collections', data);
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  updateCollection: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/revenue-collections?id=${id}`, data);
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  postCollection: async (id) => {
    try {
      const response = await api.post('/api/v1/revenue-collections?action=approve', { id });
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  revertCollection: async (id) => {
    try {
      const response = await api.post('/api/v1/revenue-collections?action=revert', { id });
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  deleteCollection: async (id) => {
    try {
      await api.delete(`/api/v1/revenue-collections?id=${id}`);
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
    } catch (error) {
      throw error;
    }
  },

  bulkDeleteCollections: async (ids) => {
    try {
      const response = await api.delete('/api/v1/revenue-collections', { data: { ids } });
      await get().fetchCollections();
      useDashboardStore.getState().invalidateAll();
      return { success: true, count: response.data?.data?.length || ids.length };
    } catch (error) {
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }
}));

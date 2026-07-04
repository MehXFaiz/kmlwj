import { create } from 'zustand';
import api from '../services/api';

export const useRevenueCollectionStore = create((set, get) => ({
  collections: [],
  loading: false,
  error: null,

  fetchCollections: async (category) => {
    set({ loading: true, error: null });
    try {
      const url = category ? `/api/v1/revenue-collections?category=${encodeURIComponent(category)}` : '/api/v1/revenue-collections';
      const response = await api.get(url);
      set({ collections: response.data.data || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addCollection: async (data) => {
    try {
      const response = await api.post('/api/v1/revenue-collections', data);
      set((state) => ({ collections: [response.data.data, ...state.collections] }));
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  updateCollection: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/revenue-collections?id=${id}`, data);
      set((state) => ({
        collections: state.collections.map(c => c.id === id ? response.data.data : c)
      }));
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  postCollection: async (id) => {
    try {
      const response = await api.post('/api/v1/revenue-collections?action=approve', { id });
      set((state) => ({
        collections: state.collections.map(c => c.id === id ? { ...c, ...response.data.data } : c)
      }));
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  deleteCollection: async (id) => {
    try {
      await api.delete(`/api/v1/revenue-collections?id=${id}`);
      set((state) => ({ collections: state.collections.filter((c) => c.id !== id) }));
    } catch (error) {
      throw error;
    }
  },

  bulkDeleteCollections: async (ids) => {
    try {
      const response = await api.delete('/api/v1/revenue-collections', { data: { ids } });
      set((state) => ({
        collections: state.collections.filter((c) => !ids.includes(c.id))
      }));
      return { success: true, count: response.data?.data?.length || ids.length };
    } catch (error) {
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }
}));

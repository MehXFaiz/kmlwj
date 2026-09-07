import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';

export const useHallBookingStore = create((set, get) => ({
  bookings: [],
  loading: false,
  error: null,

  fetchBookings: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams({ limit: '1000', ...params }).toString();
      const response = await api.get(`/api/v1/hall-bookings?${query}`);
      set({ bookings: response.data.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addBooking: async (bookingData) => {
    try {
      const response = await api.post('/api/v1/hall-bookings', bookingData);
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  fetchBookingById: async (id) => {
    try {
      const response = await api.get(`/api/v1/hall-bookings?id=${id}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  updateBooking: async (id, bookingData) => {
    try {
      const response = await api.put(`/api/v1/hall-bookings?id=${id}`, bookingData);
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  postBooking: async (id) => {
    try {
      const response = await api.post('/api/v1/hall-bookings?action=approve', { id });
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  revertBooking: async (id) => {
    try {
      const response = await api.post('/api/v1/hall-bookings?action=revert', { id });
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  deleteBooking: async (id) => {
    try {
      await api.delete(`/api/v1/hall-bookings?id=${id}`);
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
    } catch (error) {
      throw error;
    }
  },

  bulkDeleteBookings: async (ids) => {
    try {
      const response = await api.delete('/api/v1/hall-bookings', { data: { ids } });
      await get().fetchBookings();
      useDashboardStore.getState().invalidateAll();
      return { success: true, data: response.data };
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      return { success: false, error: msg };
    }
  },
}));

import { create } from 'zustand';
import api from '../services/api';

export const useHallBookingStore = create((set) => ({
  bookings: [],
  loading: false,
  error: null,

  fetchBookings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/v1/hall-bookings');
      set({ bookings: response.data.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addBooking: async (bookingData) => {
    try {
      const response = await api.post('/api/v1/hall-bookings', bookingData);
      set((state) => ({ bookings: [response.data.data, ...state.bookings] }));
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  postBooking: async (id) => {
    try {
      const response = await api.post('/api/v1/hall-bookings?action=approve', { id });
      set((state) => ({
        bookings: state.bookings.map(b => b.id === id ? { ...b, ...response.data.data } : b)
      }));
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  deleteBooking: async (id) => {
    try {
      await api.delete(`/api/v1/hall-bookings?id=${id}`);
      set((state) => ({ bookings: state.bookings.filter((b) => b.id !== id) }));
    } catch (error) {
      throw error;
    }
  },

  bulkDeleteBookings: async (ids) => {
    try {
      const response = await api.delete('/api/v1/hall-bookings', { data: { ids } });
      set((state) => ({ bookings: state.bookings.filter((b) => !ids.includes(b.id)) }));
      return { success: true, data: response.data };
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      return { success: false, error: msg };
    }
  },
}));

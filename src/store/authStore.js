import { create } from 'zustand';
import { authService, tokenStorage } from '../services/authService';

export const useAuthStore = create((set) => {
  // Listen for session expiry event from service layer
  if (typeof window !== 'undefined') {
    window.addEventListener('auth_session_expired', () => {
      set({ user: null, isAuthenticated: false, error: 'Your session has expired. Please log in again.' });
    });
  }

  const userMeta = tokenStorage.getUserMeta();
  const hasAccessToken = !!tokenStorage.getAccessToken();

  return {
    user: userMeta,
    isAuthenticated: hasAccessToken,
    loading: false,
    error: null,
    successMessage: null,

    clearError: () => set({ error: null }),
    clearSuccess: () => set({ successMessage: null }),

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const user = await authService.login(email, password);
        set({ user, isAuthenticated: true, loading: false });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    register: async (email, password, name, role) => {
      set({ loading: true, error: null });
      try {
        await authService.register(email, password, name, role);
        set({ loading: false, successMessage: 'Registration successful! You can now log in.' });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    logout: async () => {
      set({ loading: true });
      try {
        await authService.logout();
      } finally {
        set({ user: null, isAuthenticated: false, loading: false, successMessage: 'Logged out successfully' });
      }
    },

    forgotPassword: async (email) => {
      set({ loading: true, error: null, successMessage: null });
      try {
        const res = await authService.forgotPassword(email);
        set({ successMessage: res.message || 'Reset link printed to server logs.', loading: false });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    resetPassword: async (token, newPassword) => {
      set({ loading: true, error: null, successMessage: null });
      try {
        await authService.resetPassword(token, newPassword);
        set({ successMessage: 'Password reset successful! You can now log in.', loading: false });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    changePassword: async (oldPassword, newPassword) => {
      set({ loading: true, error: null, successMessage: null });
      try {
        await authService.changePassword(oldPassword, newPassword);
        set({ successMessage: 'Password updated successfully!', loading: false });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },
  };
});

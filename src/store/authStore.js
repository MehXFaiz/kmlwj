import { create } from 'zustand';
import { authService, tokenStorage } from '../services/authService';
import api from '../services/api';

export const canUserEditOrDelete = (role) => {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return r === 'admin' || r === 'super admin' || r === 'administrator';
};

export const canUserPostToLedger = (role) => {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return r === 'admin' || r === 'super admin' || r === 'administrator';
};

export const useAuthStore = create((set, get) => {
  // Listen for session expiry event from service layer
  if (typeof window !== 'undefined') {
    window.addEventListener('auth_session_expired', () => {
      set({ user: null, role: null, permissions: [], canEditOrDelete: false, canPostToLedger: false, isAuthenticated: false, loading: false, error: 'Your session has expired. Please log in again.' });
    });
  }

  return {
    user: null,
    role: null,
    permissions: [],
    canEditOrDelete: false,
    canPostToLedger: false,
    isAuthenticated: false,
    loading: false,
    error: null,
    successMessage: null,

    checkCanEditOrDelete: () => canUserEditOrDelete(get().role),
    checkCanPostToLedger: () => canUserPostToLedger(get().role),

    clearError: () => set({ error: null }),
    clearSuccess: () => set({ successMessage: null }),

    restoreSession: async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) return false;
      
      set({ loading: true, error: null });
      try {
        const res = await api.get('/api/v1/auth/me');
        const userData = res.data.data;
        set({
          user: userData,
          role: userData.role,
          permissions: userData.permissions || [],
          canEditOrDelete: canUserEditOrDelete(userData.role),
          canPostToLedger: canUserPostToLedger(userData.role),
          isAuthenticated: true,
          loading: false,
        });
        return true;
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          tokenStorage.clear();
        }
        set({ user: null, role: null, permissions: [], canEditOrDelete: false, canPostToLedger: false, isAuthenticated: false, loading: false });
        return false;
      }
    },

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        await authService.login(email, password);
        // Immediately fetch the full user profile including permissions
        const res = await api.get('/api/v1/auth/me');
        const userData = res.data.data;
        
        set({
          user: userData,
          role: userData.role,
          permissions: userData.permissions || [],
          canEditOrDelete: canUserEditOrDelete(userData.role),
          canPostToLedger: canUserPostToLedger(userData.role),
          isAuthenticated: true,
          loading: false
        });
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    loginAsGuest: async () => {
      return get().login('guest@erp.com', 'guest_access_token_request');
    },

    register: async (email, password, name) => {
      set({ loading: true, error: null });
      try {
        await authService.register(email, password, name);
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
        set({ user: null, role: null, permissions: [], canEditOrDelete: false, isAuthenticated: false, loading: false, successMessage: 'Logged out successfully' });
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

import { create } from 'zustand';
import { authService, tokenStorage } from '../services/authService';
import api from '../services/api';

/**
 * Returns true if the user holds a privileged role (Super Admin or Admin).
 * Uses the isPrivileged flag from the /me API response — never checks role
 * name strings so a future role rename won't break authorization.
 *
 * Privileged roles: full CRUD access.
 * All other roles: View + Create only (Edit/Delete hidden and backend-blocked).
 */
export const canUserEditOrDelete = (isPrivileged) => {
  return isPrivileged === true;
};

export const canUserPostToLedger = (isPrivileged) => {
  return isPrivileged === true;
};

export const useAuthStore = create((set, get) => {
  // Listen for session expiry event from service layer
  if (typeof window !== 'undefined') {
    window.addEventListener('auth_session_expired', () => {
      set({
        user: null,
        role: null,
        isPrivileged: false,
        permissions: [],
        canEditOrDelete: false,
        canPostToLedger: false,
        isAuthenticated: false,
        loading: false,
        error: 'Your session has expired. Please log in again.',
      });
    });
  }

  return {
    user: null,
    role: null,
    /** true = Super Admin or Admin (full CRUD). false = restricted (View + Create only). */
    isPrivileged: false,
    permissions: [],
    canEditOrDelete: false,
    canPostToLedger: false,
    isAuthenticated: false,
    loading: false,
    error: null,
    successMessage: null,

    checkCanEditOrDelete: () => get().canEditOrDelete,
    checkCanPostToLedger: () => get().canPostToLedger,

    clearError: () => set({ error: null }),
    clearSuccess: () => set({ successMessage: null }),

    restoreSession: async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) return false;

      set({ loading: true, error: null });
      try {
        const res = await api.get('/api/v1/auth/me');
        const userData = res.data.data;
        const privileged = userData.isPrivileged === true;
        set({
          user: userData,
          role: userData.role,
          isPrivileged: privileged,
          permissions: userData.permissions || [],
          canEditOrDelete: canUserEditOrDelete(privileged),
          canPostToLedger: canUserPostToLedger(privileged),
          isAuthenticated: true,
          loading: false,
        });
        return true;
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          tokenStorage.clear();
        }
        set({
          user: null,
          role: null,
          isPrivileged: false,
          permissions: [],
          canEditOrDelete: false,
          canPostToLedger: false,
          isAuthenticated: false,
          loading: false,
        });
        return false;
      }
    },

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        await authService.login(email, password);
        // Immediately fetch the full user profile including isPrivileged + permissions
        const res = await api.get('/api/v1/auth/me');
        const userData = res.data.data;
        const privileged = userData.isPrivileged === true;

        set({
          user: userData,
          role: userData.role,
          isPrivileged: privileged,
          permissions: userData.permissions || [],
          canEditOrDelete: canUserEditOrDelete(privileged),
          canPostToLedger: canUserPostToLedger(privileged),
          isAuthenticated: true,
          loading: false,
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
        set({
          user: null,
          role: null,
          isPrivileged: false,
          permissions: [],
          canEditOrDelete: false,
          canPostToLedger: false,
          isAuthenticated: false,
          loading: false,
          successMessage: 'Logged out successfully',
        });
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

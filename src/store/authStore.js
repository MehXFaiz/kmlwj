import { create } from 'zustand';
import { authService, tokenStorage } from '../services/authService';
import api from '../services/api';

/**
 * Returns true if the user holds permission to edit or delete records.
 * Privileged roles (Super Admin, Admin) have global edit/delete access.
 * Dynamic custom roles check against module-specific or global permissions.
 */
export const canUserEditOrDelete = (isPrivileged, permissions = [], module = null) => {
  if (isPrivileged === true) return true;
  if (!module) {
    return permissions.some(
      (p) =>
        p.endsWith('.update') ||
        p.endsWith('.delete') ||
        p.includes('UPDATE') ||
        p.includes('DELETE') ||
        p.includes('MANAGE')
    );
  }
  return (
    permissions.includes(`${module}.update`) ||
    permissions.includes(`${module}.delete`) ||
    permissions.includes(`UPDATE_${module.toUpperCase()}`) ||
    permissions.includes(`DELETE_${module.toUpperCase()}`) ||
    permissions.includes(`MANAGE_${module.toUpperCase()}`)
  );
};

export const canUserPostToLedger = (isPrivileged, permissions = [], module = null) => {
  if (isPrivileged === true) return true;
  if (module && permissions.includes(`${module}.post`)) return true;
  return permissions.includes('ledger.post') || permissions.includes('POST_JOURNAL');
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
        modulePermissions: {},
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
    /** true = Super Admin or Admin (full CRUD). false = restricted / dynamic role. */
    isPrivileged: false,
    permissions: [],
    modulePermissions: {},
    canEditOrDelete: false,
    canPostToLedger: false,
    isAuthenticated: false,
    loading: false,
    error: null,
    successMessage: null,

    // Dynamic Permission Checker: can('donations', 'update')
    can: (moduleKey, action) => {
      const state = get();
      if (state.isPrivileged) return true;
      if (!moduleKey) return false;

      // Check structured modulePermissions first
      if (state.modulePermissions && state.modulePermissions[moduleKey]?.[action]) {
        return true;
      }

      // Check raw permission strings
      const targetPerm = `${moduleKey}.${action}`;
      if (state.permissions.includes(targetPerm)) return true;

      // Check action aliases
      if (action === 'post' && (state.permissions.includes('ledger.post') || state.permissions.includes('POST_JOURNAL'))) {
        return true;
      }

      return false;
    },

    hasPermission: (permName) => {
      const state = get();
      if (state.isPrivileged) {
        const isSecurity =
          permName === 'SYSTEM_SETTINGS' ||
          permName === 'MANAGE_USERS' ||
          permName === 'MANAGE_ROLES' ||
          permName.startsWith('users.') ||
          permName.startsWith('roles.') ||
          permName.startsWith('settings.');
        return state.user?.role === 'Super Admin' || !isSecurity;
      }
      return state.permissions.includes(permName);
    },

    canEdit: (moduleKey) => get().can(moduleKey, 'update'),
    canDelete: (moduleKey) => get().can(moduleKey, 'delete'),
    canApprove: (moduleKey) => get().can(moduleKey, 'approve'),
    canExport: (moduleKey) => get().can(moduleKey, 'export') || get().hasPermission('reports.export'),
    canPrint: (moduleKey) => get().can(moduleKey, 'print') || get().hasPermission('reports.print'),

    checkCanEditOrDelete: (moduleKey) => {
      const state = get();
      if (moduleKey) return state.can(moduleKey, 'update') || state.can(moduleKey, 'delete');
      return state.canEditOrDelete;
    },

    checkCanPostToLedger: (moduleKey) => {
      const state = get();
      if (moduleKey) return state.can(moduleKey, 'post');
      return state.canPostToLedger;
    },

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
        const perms = userData.permissions || [];
        const modPerms = userData.modulePermissions || {};

        set({
          user: userData,
          role: userData.role,
          isPrivileged: privileged,
          permissions: perms,
          modulePermissions: modPerms,
          canEditOrDelete: canUserEditOrDelete(privileged, perms),
          canPostToLedger: canUserPostToLedger(privileged, perms),
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
          modulePermissions: {},
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
        // Fetch the full user profile including isPrivileged + permissions
        const res = await api.get('/api/v1/auth/me');
        const userData = res.data.data;
        const privileged = userData.isPrivileged === true;
        const perms = userData.permissions || [];
        const modPerms = userData.modulePermissions || {};

        set({
          user: userData,
          role: userData.role,
          isPrivileged: privileged,
          permissions: perms,
          modulePermissions: modPerms,
          canEditOrDelete: canUserEditOrDelete(privileged, perms),
          canPostToLedger: canUserPostToLedger(privileged, perms),
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
          modulePermissions: {},
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

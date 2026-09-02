import { create } from 'zustand';
import { authService, tokenStorage } from '../services/authService';
import api from '../services/api';
import { hasPermission as checkPerm, canAccessModule as checkCanAccess, normalizePermissions } from '../utils/permissions';

/**
 * Returns true if the user holds permission to edit or delete records.
 */
export const canUserEditOrDelete = (isPrivileged, permissions = [], module = null, role = null) => {
  if (role === 'Super Admin' || role?.name === 'Super Admin') return true;
  if (isPrivileged !== true) return false;
  if (!module) return true;
  return checkPerm(permissions, isPrivileged, module, 'update') || checkPerm(permissions, isPrivileged, module, 'delete');
};

export const canUserPostToLedger = (isPrivileged, permissions = [], module = null, role = null) => {
  if (isPrivileged === true) return true;
  const roleName = typeof role === 'string' ? role : (role?.name || '');
  if (roleName === 'Super Admin' || roleName === 'Admin' || roleName === 'Accountant' || roleName?.toLowerCase().includes('accountant')) return true;
  if (!module) return true;
  return checkPerm(permissions, isPrivileged, module, 'post', role);
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
        permissionsList: [],
        rawPermissions: [],
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
    /** true = Super Admin or Admin. false = restricted / dynamic role. */
    isPrivileged: false,
    permissions: [],
    permissionsList: [],
    rawPermissions: [],
    modulePermissions: {},
    canEditOrDelete: false,
    canPostToLedger: false,
    isAuthenticated: false,
    loading: false,
    error: null,
    successMessage: null,

    // Dynamic Permission Checker: hasPermission('donations', 'view') or hasPermission('donations', 'create')
    hasPermission: (moduleOrPerm, action) => {
      const state = get();
      const isSuper = state.user?.role === 'Super Admin' || state.role === 'Super Admin' || state.role?.name === 'Super Admin';
      if (isSuper) return true;

      // Two-argument form: hasPermission(module, action)
      if (action !== undefined) {
        return checkPerm(state.permissionsList, state.isPrivileged, moduleOrPerm, action, state.role || state.user?.role);
      }

      // Single argument: dot-notation string like 'donations.view'
      if (typeof moduleOrPerm === 'string' && moduleOrPerm.includes('.')) {
        const [mod, act] = moduleOrPerm.split('.');
        return checkPerm(state.permissionsList, state.isPrivileged, mod, act, state.role || state.user?.role);
      }


      // Single argument: module name check for 'view'
      if (typeof moduleOrPerm === 'string' && !moduleOrPerm.includes('_')) {
        return checkCanAccess(state.permissionsList, state.isPrivileged, moduleOrPerm);
      }

      // Single argument: legacy uppercase permission like 'MANAGE_USERS'
      if (state.rawPermissions?.includes(moduleOrPerm) || state.permissions?.includes(moduleOrPerm)) {
        return true;
      }

      return false;
    },

    // Alias for hasPermission(module, action)
    can: (moduleKey, action) => {
      return get().hasPermission(moduleKey, action);
    },

    canAccessModule: (moduleKey) => {
      const state = get();
      return checkCanAccess(state.permissionsList, state.isPrivileged, moduleKey);
    },

    canEdit: (moduleKey) => get().hasPermission(moduleKey, 'update'),
    canDelete: (moduleKey) => get().hasPermission(moduleKey, 'delete'),
    canApprove: (moduleKey) => get().hasPermission(moduleKey, 'approve'),
    canExport: (moduleKey) => get().hasPermission(moduleKey, 'export'),
    canPrint: (moduleKey) => get().hasPermission(moduleKey, 'print'),

    checkCanEditOrDelete: (moduleKey) => {
      const state = get();
      if (moduleKey) return state.hasPermission(moduleKey, 'update') || state.hasPermission(moduleKey, 'delete');
      return state.isPrivileged;
    },

    checkCanPostToLedger: (moduleKey) => {
      const state = get();
      const roleName = state.role || state.user?.role || '';
      const isAccountant = roleName === 'Accountant' || roleName?.toLowerCase?.().includes('accountant');
      if (state.isPrivileged || isAccountant) return true;
      if (moduleKey) return state.hasPermission(moduleKey, 'post');
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
        const payload = res.data.data || {};
        const userRecord = payload.user || payload;
        const roleObj = payload.role && typeof payload.role === 'object' ? payload.role : null;
        const roleName = typeof userRecord.role === 'string'
          ? userRecord.role
          : (roleObj?.name || payload.roleName || (typeof payload.role === 'string' ? payload.role : 'Staff'));
        const privileged = payload.isPrivileged === true || roleObj?.isPrivileged === true || userRecord.isPrivileged === true || roleName === 'Super Admin';
        const rawPerms = payload.rawPermissions || userRecord.rawPermissions || (Array.isArray(payload.permissions) && typeof payload.permissions[0] === 'string' ? payload.permissions : []);
        const permsList = normalizePermissions(payload.permissions || rawPerms);
        const modPerms = payload.modulePermissions || userRecord.modulePermissions || {};

        const normalizedUser = {
          ...userRecord,
          id: userRecord.id || payload.id,
          name: userRecord.name || userRecord.fullName || payload.name || payload.fullName,
          fullName: userRecord.name || userRecord.fullName || payload.name || payload.fullName,
          email: userRecord.email || payload.email,
          role: roleName,
          roleObj,
          roleId: userRecord.roleId || roleObj?.id || payload.roleId,
          isPrivileged: privileged,
          permissions: payload.permissions || userRecord.permissions || [],
          themePreference: userRecord.themePreference || payload.themePreference || 'system',
        };

        const isAccountant = roleName === 'Accountant' || roleObj?.name === 'Accountant' || roleName?.toLowerCase?.().includes('accountant');
        const canPost = privileged || isAccountant || permsList.some(p => p.action === 'post') || rawPerms.includes('POST_JOURNAL') || rawPerms.includes('POST_LEDGER') || rawPerms.includes('ledger.post');

        set({
          user: normalizedUser,
          role: roleName,
          roleObj,
          isPrivileged: privileged,
          permissions: payload.permissions || [],
          permissionsList: permsList,
          rawPermissions: rawPerms,
          modulePermissions: modPerms,
          canEditOrDelete: privileged,
          canPostToLedger: canPost,
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
          roleObj: null,
          isPrivileged: false,
          permissions: [],
          permissionsList: [],
          rawPermissions: [],
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
        const payload = res.data.data || {};
        const userRecord = payload.user || payload;
        const roleObj = payload.role && typeof payload.role === 'object' ? payload.role : null;
        const roleName = typeof userRecord.role === 'string'
          ? userRecord.role
          : (roleObj?.name || payload.roleName || (typeof payload.role === 'string' ? payload.role : 'Staff'));
        const privileged = payload.isPrivileged === true || roleObj?.isPrivileged === true || userRecord.isPrivileged === true || roleName === 'Super Admin';
        const rawPerms = payload.rawPermissions || userRecord.rawPermissions || (Array.isArray(payload.permissions) && typeof payload.permissions[0] === 'string' ? payload.permissions : []);
        const permsList = normalizePermissions(payload.permissions || rawPerms);
        const modPerms = payload.modulePermissions || userRecord.modulePermissions || {};

        const normalizedUser = {
          ...userRecord,
          id: userRecord.id || payload.id,
          name: userRecord.name || userRecord.fullName || payload.name || payload.fullName,
          fullName: userRecord.name || userRecord.fullName || payload.name || payload.fullName,
          email: userRecord.email || payload.email,
          role: roleName,
          roleObj,
          roleId: userRecord.roleId || roleObj?.id || payload.roleId,
          isPrivileged: privileged,
          permissions: payload.permissions || userRecord.permissions || [],
          themePreference: userRecord.themePreference || payload.themePreference || 'system',
        };

        const isAccountant = roleName === 'Accountant' || roleObj?.name === 'Accountant' || roleName?.toLowerCase?.().includes('accountant');
        const canPost = privileged || isAccountant || permsList.some(p => p.action === 'post') || rawPerms.includes('POST_JOURNAL') || rawPerms.includes('POST_LEDGER') || rawPerms.includes('ledger.post');

        set({
          user: normalizedUser,
          role: roleName,
          roleObj,
          isPrivileged: privileged,
          permissions: payload.permissions || [],
          permissionsList: permsList,
          rawPermissions: rawPerms,
          modulePermissions: modPerms,
          canEditOrDelete: privileged,
          canPostToLedger: canPost,
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
          permissionsList: [],
          rawPermissions: [],
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

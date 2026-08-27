import { create } from 'zustand';
import { showToast } from '../components/ui/Toast';

export const useConfirmStore = create((set, get) => ({
  isOpen: false,
  title: '',
  description: '',
  details: null,
  type: 'warning', // 'warning', 'success', 'error', 'info', 'danger'
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  alertOnly: false,
  isDangerous: false, // Red destructive styling for dangerous actions
  loadingLabel: 'Processing...',
  successMessage: '',
  action: null,

  isLoading: false,
  error: null,
  isSuccess: false,

  resolve: null,

  showConfirm: (options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title: options.title || 'Are you sure?',
        description: options.description || '',
        details: options.details || null,
        type: options.type || 'warning',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        alertOnly: options.alertOnly || false,
        isDangerous: options.isDangerous || false,
        loadingLabel: options.loadingLabel || 'Processing...',
        successMessage: options.successMessage || '',
        action: options.action || null,
        isLoading: false,
        error: null,
        isSuccess: false,
        resolve,
      });
    });
  },

  handleConfirm: async () => {
    const { action, resolve, successMessage } = get();

    if (action) {
      set({ isLoading: true, error: null, isSuccess: false });
      try {
        await action();
        if (successMessage) {
          set({ isLoading: false, isSuccess: true });
        } else {
          set({ isOpen: false });
          if (resolve) resolve(true);
        }
      } catch (err) {
        console.error('Confirmation action error:', err);
        const isForbidden = err?.response?.status === 401 || err?.response?.status === 403;
        const errMsg = isForbidden
          ? 'You do not have permission to delete this record.'
          : (err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'An error occurred.');
        set({
          isLoading: false,
          isSuccess: false,
          error: errMsg,
        });
        showToast(errMsg, 'error');
      }
    } else {
      set({ isOpen: false });
      if (resolve) resolve(true);
    }
  },

  handleCancel: () => {
    const { resolve } = get();
    set({ isOpen: false });
    if (resolve) resolve(false);
  },

  handleClose: () => {
    const { resolve, isSuccess } = get();
    set({ isOpen: false });
    if (resolve) resolve(Boolean(isSuccess));
  },
}));


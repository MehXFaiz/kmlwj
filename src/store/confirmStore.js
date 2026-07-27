import { create } from 'zustand';

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
      set({ isLoading: true, error: null });
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
        set({
          isLoading: false,
          error: err.response?.data?.error?.message || err.message || 'An error occurred.',
        });
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
    const { resolve } = get();
    set({ isOpen: false });
    if (resolve) resolve(true);
  },
}));

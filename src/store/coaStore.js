import { create } from 'zustand';
import { accountService } from '../services/apiServices';

export const useCoaStore = create((set, get) => ({
  accounts: [],
  selectedSubsidiary: 'Global',
  fiscalYear: '2026',
  loading: false,
  error: null,

  setSelectedSubsidiary: (subsidiary) => set({ selectedSubsidiary: subsidiary }),
  setFiscalYear: (fiscalYear) => set({ fiscalYear }),

  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await accountService.getAll();
      set({ accounts: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch accounts', loading: false });
    }
  },

  addAccount: async (account) => {
    set({ loading: true, error: null });
    try {
      const newAcc = await accountService.create({
        code: account.code,
        name: account.name,
        type: account.type,
        detailType: account.detailType || 'Header',
        parentCode: account.parentCode,
        currency: account.currency || 'USD',
        subsidiary: account.subsidiary || ['Global'],
        initialBalance: account.initialBalance || 0,
        description: account.description || '',
      });
      await get().fetchAccounts();
      set({ loading: false });
      return newAcc;
    } catch (err) {
      set({ error: err.message || 'Failed to add account', loading: false });
      throw err;
    }
  },

  updateAccount: async (id, updatedFields) => {
    set({ loading: true, error: null });
    try {
      const updated = await accountService.update(id, {
        code: updatedFields.code,
        name: updatedFields.name,
        type: updatedFields.type,
        detailType: updatedFields.detailType,
        parentCode: updatedFields.parentCode,
        currency: updatedFields.currency,
        subsidiary: updatedFields.subsidiary,
        initialBalance: updatedFields.initialBalance,
        description: updatedFields.description,
      });
      await get().fetchAccounts();
      set({ loading: false });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update account', loading: false });
      throw err;
    }
  },

  toggleAccountStatus: async (id) => {
    const acc = get().accounts.find(a => a.id === id);
    if (!acc) return;
    
    set({ loading: true, error: null });
    try {
      await accountService.update(id, {
        isLocked: acc.status === 'Active',
      });
      await get().fetchAccounts();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to toggle status', loading: false });
    }
  },

  deleteAccount: async (id) => {
    set({ loading: true, error: null });
    try {
      await accountService.delete(id);
      await get().fetchAccounts();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to delete account', loading: false });
      throw err;
    }
  },

  importAccounts: async (importedList) => {
    set({ loading: true, error: null });
    try {
      for (const item of importedList) {
        await accountService.create(item);
      }
      await get().fetchAccounts();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to import accounts', loading: false });
    }
  },

  resetAccounts: () => {
    get().fetchAccounts();
  },
}));

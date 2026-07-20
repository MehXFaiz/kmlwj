import { create } from 'zustand';
import { accountService } from '../services/apiServices';

export const getCurrentFiscalYear = () => String(new Date().getFullYear());

export const useCoaStore = create((set, get) => ({
  accounts: [], // flat list fallback if needed globally
  treeAccounts: [], // Nested tree structure
  flatAccounts: [], // Paginated list
  meta: { total: 0, page: 1, limit: 100 },
  selectedSubsidiary: 'Global',
  fiscalYear: getCurrentFiscalYear(),
  loading: false,
  error: null,

  syncFiscalYear: () => {
    const fiscalYear = getCurrentFiscalYear();
    if (get().fiscalYear !== fiscalYear) set({ fiscalYear });
    return fiscalYear;
  },

  // Deprecated generic fetch, kept for backward compatibility if needed elsewhere
  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await accountService.getAll();
      set({ accounts: data.data || data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch accounts', loading: false });
    }
  },

  fetchAccountsList: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await accountService.getAll({ limit: 1000, ...params });
      set({ 
        flatAccounts: response.data, 
        meta: response.meta || { total: 0, page: 1, limit: 1000 },
        loading: false 
      });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch account list', loading: false });
    }
  },

  fetchAccountsTree: async () => {
    set({ loading: true, error: null });
    try {
      const data = await accountService.getTree();
      set({ treeAccounts: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch account tree', loading: false });
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
        currency: account.currency || 'PKR',
        subsidiary: account.subsidiary || ['Global'],
        initialBalance: account.initialBalance || 0,
        description: account.description || '',
        isLocked: account.isLocked || false,
        isReserved: account.isReserved || false,
      });
      // Update both tree and list views
      await Promise.all([get().fetchAccountsTree(), get().fetchAccountsList()]);
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
        isLocked: updatedFields.isLocked,
        isReserved: updatedFields.isReserved,
      });
      await get().fetchAccountsTree();
      set({ loading: false });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update account', loading: false });
      throw err;
    }
  },

  toggleAccountStatus: async (id) => {
    const flatten = (nodes) => nodes.reduce((acc, node) => {
      acc.push(node);
      if (node.children) acc.push(...flatten(node.children));
      return acc;
    }, []);
    const all = [
      ...(get().accounts || []),
      ...(get().flatAccounts || []),
      ...flatten(get().treeAccounts || [])
    ];
    const acc = all.find(a => a.id === id);
    if (!acc) return;
    
    if (acc.level === 'MAIN') {
      alert('MAIN accounts are permanent and cannot be deactivated.');
      return;
    }

    set({ loading: true, error: null });
    try {
      await accountService.update(id, {
        isLocked: acc.status === 'Active',
      });
      await Promise.all([
        get().fetchAccountsTree(),
        get().fetchAccountsList()
      ]);
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to toggle status', loading: false });
    }
  },

  deleteAccount: async (id) => {
    // Fix 7 — Block reserved accounts from being deleted
    const flatten = (nodes) => nodes.reduce((acc, node) => {
      acc.push(node);
      if (node.children) acc.push(...flatten(node.children));
      return acc;
    }, []);
    const all = [
      ...(get().accounts || []),
      ...(get().flatAccounts || []),
      ...flatten(get().treeAccounts || [])
    ];
    const acc = all.find(a => a.id === id);
    if (acc?.isReserved) {
      const err = new Error('This is a reserved code and cannot be deleted.');
      set({ error: err.message, loading: false });
      throw err;
    }

    set({ loading: true, error: null });
    try {
      await accountService.delete(id);
      await get().fetchAccountsTree();
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
      await get().fetchAccountsTree();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to import accounts', loading: false });
    }
  },

  resetAccounts: () => {
    get().fetchAccountsTree();
    get().fetchAccountsList();
  },
}));

import { create } from 'zustand';
import api from '../services/api';

export const useJournalStore = create((set, get) => ({
  journals: [],
  isLoading: false,
  error: null,

  fetchJournals: async (subsidiary = 'Global', page = 1, limit = 100) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/api/v1/journal-entries?subsidiary=${subsidiary}&page=${page}&limit=${limit}`);
      set({ journals: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch journals', isLoading: false });
    }
  },

  addJournalEntry: async (entry) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/api/v1/journal-entries', entry);
      
      // Refresh the list after successful creation
      await get().fetchJournals(entry.subsidiary || 'Global');
      set({ isLoading: false });
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.message || 'Failed to create journal entry', isLoading: false });
      return { success: false, error: err.message || 'Failed to create journal entry' };
    }
  },

  updateJournalStatus: async (id, status) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put('/api/v1/journal-entries', { id, status });
      
      // Refresh the list after successful update
      const { journals } = get();
      const entry = journals.find(j => j.dbId === id);
      if (entry) {
        await get().fetchJournals(entry.subsidiary || 'Global');
      }
      set({ isLoading: false });
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.message || 'Failed to update journal status', isLoading: false });
      return { success: false, error: err.message || 'Failed to update journal status' };
    }
  },

  deleteJournalEntry: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.delete(`/api/v1/journal-entries?id=${id}`);
      set(state => ({
        journals: state.journals.filter(j => j.dbId !== id && j.id !== id),
        isLoading: false
      }));
      return { success: true, data: res.data };
    } catch (err) {
      set({ error: err.message || 'Failed to delete journal entry', isLoading: false });
      return { success: false, error: err.message || 'Failed to delete journal entry' };
    }
  },

  bulkDeleteJournalEntries: async (ids) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.delete('/api/v1/journal-entries', { data: { ids } });
      set(state => ({
        journals: state.journals.filter(j => !ids.includes(j.dbId) && !ids.includes(j.id)),
        isLoading: false
      }));
      return { success: true, data: res.data };
    } catch (err) {
      set({ error: err.message || 'Failed to bulk delete journal entries', isLoading: false });
      return { success: false, error: err.message || 'Failed to bulk delete journal entries' };
    }
  },

  logActivity: () => {
  },

  resetJournals: () => {
    set({ journals: [], error: null });
  },
}));

// Helper function to calculate the balance for a single account including its descendants
export const calculateAccountBalances = (accounts, journals, subsidiary = 'Global') => {
  // 1. Calculate posting-level balances directly from journal lines + initialBalances
  const baseBalances = {};

  accounts.forEach((acc) => {
    baseBalances[acc.code] = {
      code: acc.code,
      initial: 0,
      debits: 0,
      credits: 0,
    };
    
    // Filter initial balance by subsidiary check
    // If the account has this subsidiary OR subsidiary is 'Global'
    const appliesToSubsidiary = subsidiary === 'Global' || (acc.subsidiary && acc.subsidiary.includes(subsidiary));
    
    if (appliesToSubsidiary) {
      baseBalances[acc.code].initial = acc.initialBalance || 0;
    }
  });

  // Aggregate journal lines
  journals.forEach((je) => {
    // Check if subsidiary matches
    if (subsidiary !== 'Global' && je.subsidiary !== subsidiary) {
      return;
    }
    // Only count Posted entries
    if (je.status !== 'Posted') {
      return;
    }

    je.lines.forEach((line) => {
      if (baseBalances[line.accountCode]) {
        baseBalances[line.accountCode].debits += line.debit;
        baseBalances[line.accountCode].credits += line.credit;
      }
    });
  });

  // Calculate local balance for each account code
  const localBalances = {};
  accounts.forEach((acc) => {
    const stats = baseBalances[acc.code] || { initial: 0, debits: 0, credits: 0 };
    const { initial, debits, credits } = stats;

    let balance = 0;
    const type = acc.type;

    if (type === 'Asset' || type === 'Expense') {
      balance = initial + debits - credits;
    } else if (type === 'Liability' || type === 'Equity' || type === 'Revenue') {
      balance = initial + credits - debits;
    }

    localBalances[acc.code] = balance;
  });

  // 2. Rollup hierarchy: Parent account balance = sum of self and all descendants
  const rollupBalances = {};

  // Build tree index mapping parent to children
  const childrenMap = {};
  accounts.forEach((acc) => {
    if (acc.parentCode) {
      if (!childrenMap[acc.parentCode]) childrenMap[acc.parentCode] = [];
      childrenMap[acc.parentCode].push(acc.code);
    }
  });

  // DFS function to compute recursive rollup balances
  const getRollupBalance = (code) => {
    if (rollupBalances[code] !== undefined) return rollupBalances[code];

    const currentLocal = localBalances[code] || 0;
    const children = childrenMap[code] || [];

    let total = currentLocal;
    children.forEach((childCode) => {
      total += getRollupBalance(childCode);
    });

    rollupBalances[code] = total;
    return total;
  };

  accounts.forEach((acc) => {
    getRollupBalance(acc.code);
  });

  return { localBalances, rollupBalances, baseBalances };
};


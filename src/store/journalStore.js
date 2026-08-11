import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';
import {
  toPaisa,
  fromPaisa,
  toMoney,
  subMoney,
  isSaneMoney,
  formatMoney,
  BALANCE_ERROR_MESSAGE,
} from '../utils/money';

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
      useDashboardStore.getState().invalidateAll();
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
      useDashboardStore.getState().invalidateAll();
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
      await get().fetchJournals();
      useDashboardStore.getState().invalidateAll();
      set({ isLoading: false });
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
      await get().fetchJournals();
      useDashboardStore.getState().invalidateAll();
      set({ isLoading: false });
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
//
// All accumulation happens in integer PAISA via src/utils/money.js. Two bugs
// lived in the previous version, and together they produced the corrupted
// "Available Cash: -486,000,366,500,017,900,000,000…" on the transaction forms:
//
//   • `debits += line.debit` — debit/credit arrive from the API as Decimal(18,2)
//     values. They used to be serialized as JSON strings, so `+=` concatenated
//     instead of adding ("1000" then "1250" became "010001250"), and the final
//     `initial + debits - credits` evaluated to -4.86e266 for GL 1010103, whose
//     real ledger balance is 7,444,213.00.
//   • floating-point accumulation drifts over a long run of additions.
//
// A malformed amount now yields NaN and the account's code is reported in
// `invalidCodes` rather than becoming a plausible-looking wrong balance.
export const calculateAccountBalances = (accounts, journals, subsidiary = 'Global') => {
  // 1. Calculate posting-level balances directly from journal lines + initialBalances
  const baseBalances = {};
  const invalidCodes = new Set();

  accounts.forEach((acc) => {
    // Filter initial balance by subsidiary check
    // If the account has this subsidiary OR subsidiary is 'Global'
    const appliesToSubsidiary = subsidiary === 'Global' || (acc.subsidiary && acc.subsidiary.includes(subsidiary));

    let initialPaisa = 0;
    if (appliesToSubsidiary && acc.initialBalance !== null && acc.initialBalance !== undefined && acc.initialBalance !== '') {
      initialPaisa = toPaisa(acc.initialBalance);
      if (!Number.isFinite(initialPaisa)) {
        invalidCodes.add(acc.code);
        initialPaisa = 0;
      }
    }

    baseBalances[acc.code] = {
      code: acc.code,
      initialPaisa,
      debitPaisa: 0,
      creditPaisa: 0,
    };
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

    (je.lines || []).forEach((line) => {
      const stats = baseBalances[line.accountCode];
      if (!stats) return;

      const debitPaisa = line.debit === null || line.debit === undefined || line.debit === '' ? 0 : toPaisa(line.debit);
      const creditPaisa = line.credit === null || line.credit === undefined || line.credit === '' ? 0 : toPaisa(line.credit);

      if (!Number.isFinite(debitPaisa) || !Number.isFinite(creditPaisa)) {
        invalidCodes.add(line.accountCode);
        return;
      }

      stats.debitPaisa += debitPaisa;
      stats.creditPaisa += creditPaisa;
    });
  });

  // Calculate local balance for each account code, applying the standard
  // debit/credit rules: debit-normal accounts (Asset/Expense) increase on the
  // debit side, credit-normal accounts (Liability/Equity/Revenue) on the credit
  // side. A cash transfer therefore debits one asset and credits another,
  // leaving total Cash + Bank unchanged.
  const localBalances = {};
  accounts.forEach((acc) => {
    // Once ANY input for this account failed to parse, the balance is unknown.
    // Computing it from the surviving lines would produce a plausible-looking
    // but understated figure — worse than an explicit error, because nothing
    // downstream could tell it was wrong.
    if (invalidCodes.has(acc.code)) {
      localBalances[acc.code] = NaN;
      return;
    }

    const { initialPaisa, debitPaisa, creditPaisa } = baseBalances[acc.code]
      || { initialPaisa: 0, debitPaisa: 0, creditPaisa: 0 };

    let balancePaisa = 0;
    const type = acc.type;

    if (type === 'Asset' || type === 'Expense') {
      balancePaisa = initialPaisa + debitPaisa - creditPaisa;
    } else if (type === 'Liability' || type === 'Equity' || type === 'Revenue') {
      balancePaisa = initialPaisa + creditPaisa - debitPaisa;
    }

    const balance = fromPaisa(balancePaisa);
    if (!isSaneMoney(balance)) {
      invalidCodes.add(acc.code);
      localBalances[acc.code] = NaN;
      return;
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

  // DFS function to compute recursive rollup balances. Accumulated in paisa for
  // the same reason as above; a descendant that failed to compute propagates
  // NaN so a parent total can never silently under-report by treating a broken
  // child as zero.
  const getRollupBalance = (code) => {
    if (rollupBalances[code] !== undefined) return rollupBalances[code];

    // Seed before recursing so a malformed parent/child cycle terminates.
    rollupBalances[code] = NaN;

    let totalPaisa = toPaisa(localBalances[code] ?? 0);
    const children = childrenMap[code] || [];

    for (const childCode of children) {
      totalPaisa += toPaisa(getRollupBalance(childCode));
    }

    const total = Number.isFinite(totalPaisa) ? fromPaisa(totalPaisa) : NaN;
    if (!isSaneMoney(total)) invalidCodes.add(code);

    rollupBalances[code] = total;
    return total;
  };

  accounts.forEach((acc) => {
    getRollupBalance(acc.code);
  });

  // `invalidCodes` lists accounts whose balance could not be computed from the
  // ledger. Callers must check it before using a balance in a financial
  // decision (e.g. fund validation) and surface BALANCE_ERROR_MESSAGE rather
  // than rendering a corrupted figure.
  return { localBalances, rollupBalances, baseBalances, invalidCodes: Array.from(invalidCodes) };
};

/**
 * Client-side pre-check mirroring the server's FundValidationService, so both
 * forms ask the same question of the same numbers instead of each re-deriving
 * the formula. The server remains the authority — this only avoids a round trip
 * for an obviously insufficient balance.
 *
 * READ-ONLY: it computes a balance and compares it. It never posts an entry,
 * never mutates an account, and never pre-subtracts the amount — the balance
 * changes only when the transaction is actually posted.
 *
 * @returns {{ ok: boolean, available: number, message?: string }}
 */
export const validateSufficientFunds = ({ accounts, journals, account, amount, subsidiary = 'Global' }) => {
  const { localBalances, invalidCodes } = calculateAccountBalances(accounts, journals, subsidiary);

  const required = toMoney(amount);
  if (!isSaneMoney(required) || required <= 0) {
    return { ok: false, available: NaN, message: 'Amount must be a positive number.' };
  }

  const raw = localBalances[account.code] !== undefined
    ? localBalances[account.code]
    : account.initialBalance;
  const available = toMoney(raw);

  // A balance that could not be computed is an error to report, never a number
  // to display and never grounds to silently allow or block the transaction.
  if (invalidCodes.includes(account.code) || !isSaneMoney(available)) {
    return { ok: false, available: NaN, message: BALANCE_ERROR_MESSAGE };
  }

  if (required <= available) {
    return { ok: true, available };
  }

  const isCash = account.detailType === 'Cash' || (account.name || '').toLowerCase().includes('cash');
  const shortfall = subMoney(required, available);
  const label = isCash ? 'Insufficient Cash Balance' : 'Insufficient Bank Balance';
  const availableLabel = isCash ? 'Available Cash' : 'Available Balance';

  return {
    ok: false,
    available,
    message: `${label}.\n${availableLabel}: Rs ${formatMoney(available)}\nRequired Amount: Rs ${formatMoney(required)}\nShortfall: Rs ${formatMoney(shortfall)}`,
  };
};


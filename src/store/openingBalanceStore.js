import { create } from 'zustand';
import api from '../services/api';
import { useDashboardStore } from './dashboardStore';
import { useCoaStore } from './coaStore';
import { useJournalStore } from './journalStore';

export const useOpeningBalanceStore = create((set, get) => ({
  loading: false,
  saving: false,
  error: null,
  financialYear: '',
  openingDate: new Date().toISOString().split('T')[0],
  batch: null,
  isAutoRolled: false,
  isLocked: false,
  sourceFinancialYear: null,
  sourceClosingDate: null,
  adjustmentReason: null,
  hasPreviousYear: false,
  accounts: {},
  allAccounts: [],

  fetchOpeningBalances: async (dateStr) => {
    set({ loading: true, error: null });
    try {
      const url = dateStr ? `/api/v1/opening-balances?date=${dateStr}` : '/api/v1/opening-balances';
      const res = await api.get(url);
      const data = res.data.data;

      // Deduplicate strictly by GL Code: Each account appears only ONCE
      const rawAccounts = Array.isArray(data.allAccounts) && data.allAccounts.length > 0
        ? data.allAccounts
        : Object.values(data.accounts || {});

      const seenGls = new Set();
      const dedupedAccounts = [];
      for (const a of rawAccounts) {
        const gl = String(a.glCode || '').trim();
        if (gl && !seenGls.has(gl)) {
          seenGls.add(gl);
          dedupedAccounts.push({
            ...a,
            glCode: gl
          });
        }
      }

      set({
        financialYear: data.financialYear,
        openingDate: data.openingDate,
        batch: data.batch,
        isAutoRolled: data.isAutoRolled ?? Boolean(data.batch?.isAutoRolled),
        isLocked: data.isLocked ?? (Boolean(data.batch?.id) || Boolean(data.isAutoRolled)),
        sourceFinancialYear: data.sourceFinancialYear ?? data.batch?.sourceFinancialYear ?? null,
        sourceClosingDate: data.sourceClosingDate ?? data.batch?.sourceClosingDate ?? null,
        adjustmentReason: data.adjustmentReason ?? data.batch?.adjustmentReason ?? null,
        hasPreviousYear: Boolean(data.hasPreviousYear),
        accounts: data.accounts || {},
        allAccounts: dedupedAccounts,
        loading: false
      });
      return data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to load opening balances';
      set({ error: errMsg, loading: false });
      throw err;
    }
  },

  saveOpeningBalances: async (openingDate, balances, isAdjustment = false, reason = '', financialYear = '') => {
    set({ saving: true, error: null });
    try {
      const res = await api.post('/api/v1/opening-balances', {
        openingDate,
        balances,
        financialYear,
        isAdjustment,
        reason
      });

      set({ saving: false });
      
      // Invalidate relevant stores
      useDashboardStore.getState().invalidateAll();
      useCoaStore.getState().fetchAccountsTree();
      useJournalStore.getState().fetchJournals();

      await get().fetchOpeningBalances(openingDate);
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to save opening balances';
      set({ error: errMsg, saving: false });
      throw err;
    }
  }
}));

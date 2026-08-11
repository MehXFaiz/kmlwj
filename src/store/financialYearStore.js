import { create } from 'zustand';
import { financialYearService } from '../services/apiServices';
import { showToast } from '../components/ui/Toast';

export const useFinancialYearStore = create((set, get) => ({
  years: [],
  selectedYear: '',
  loading: false,
  validating: false,
  closing: false,
  reopening: false,
  error: null,
  validationResult: null,

  fetchFinancialYears: async () => {
    set({ loading: true, error: null });
    try {
      const res = await financialYearService.getAll();
      const yearsList = res.financialYears || [];
      const activeOrLatest = yearsList.find(y => !y.isClosed)?.code || yearsList[yearsList.length - 1]?.code || 'FY 2026-2027';

      set({
        years: yearsList,
        selectedYear: get().selectedYear || activeOrLatest,
        loading: false
      });
      return yearsList;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to load financial years';
      set({ error: errMsg, loading: false });
      return [];
    }
  },

  setSelectedYear: (code) => {
    set({ selectedYear: code, validationResult: null });
  },

  validateYearEndClosing: async (code) => {
    const fyCode = code || get().selectedYear;
    set({ validating: true, error: null, validationResult: null });
    try {
      const data = await financialYearService.validate(fyCode);
      set({ validationResult: data, validating: false });
      return data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Validation failed';
      set({ error: errMsg, validating: false });
      throw err;
    }
  },

  executeYearEndClosing: async (closingData) => {
    set({ closing: true, error: null });
    try {
      const res = await financialYearService.close(closingData);
      showToast.success(res.message || 'Financial Year closed successfully!');
      set({ closing: false, validationResult: null });
      await get().fetchFinancialYears();
      return res;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Year-end closing failed';
      showToast.error(errMsg);
      set({ error: errMsg, closing: false });
      throw err;
    }
  },

  reopenFinancialYear: async (financialYear, reason) => {
    set({ reopening: true, error: null });
    try {
      const res = await financialYearService.reopen({ financialYear, reason });
      showToast.success(res.message || 'Financial Year reopened!');
      set({ reopening: false });
      await get().fetchFinancialYears();
      return res;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Reopening failed';
      showToast.error(errMsg);
      set({ error: errMsg, reopening: false });
      throw err;
    }
  },

  adjustOpeningBalance: async (adjustData) => {
    try {
      const res = await financialYearService.adjust(adjustData);
      showToast.success(res.message || 'Opening balances adjusted successfully');
      await get().fetchFinancialYears();
      return res;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Adjustment failed';
      showToast.error(errMsg);
      throw err;
    }
  }
}));

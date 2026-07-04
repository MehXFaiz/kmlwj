import { create } from 'zustand';
import { invoiceService } from '../services/invoiceService';

export const useInvoiceStore = create((set, get) => ({
  invoices: [],
  currentInvoice: null,
  loading: false,
  error: null,

  fetchInvoices: async () => {
    set({ loading: true });
    try {
      const data = await invoiceService.getAll();
      set({ invoices: data.data || [], loading: false, error: null });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchInvoiceById: async (id) => {
    set({ loading: true });
    try {
      const data = await invoiceService.getById(id);
      set({ currentInvoice: data.data || null, loading: false, error: null });
      return data.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  addInvoice: async (data) => {
    try {
      const res = await invoiceService.create(data);
      await get().fetchInvoices();
      return res.data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateInvoice: async (id, data) => {
    try {
      const res = await invoiceService.update(id, data);
      await get().fetchInvoices();
      return res.data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteInvoice: async (id) => {
    try {
      await invoiceService.delete(id);
      set(state => ({
        invoices: state.invoices.filter(inv => inv.id !== id)
      }));
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  bulkDeleteInvoices: async (ids) => {
    try {
      const res = await invoiceService.bulkDelete(ids);
      await get().fetchInvoices();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  postInvoice: async (id, revenueAccountId) => {
    try {
      set({ loading: true });
      const res = await invoiceService.post(id, revenueAccountId);
      set({ currentInvoice: res.data, loading: false });
      await get().fetchInvoices();
      return res;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  payInvoice: async (id, paymentData) => {
    try {
      set({ loading: true });
      const res = await invoiceService.pay(id, paymentData);
      set({ currentInvoice: res.data, loading: false });
      await get().fetchInvoices();
      return res;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  cancelInvoice: async (id, revenueAccountId) => {
    try {
      set({ loading: true });
      const res = await invoiceService.cancel(id, revenueAccountId);
      set({ currentInvoice: res.data, loading: false });
      await get().fetchInvoices();
      return res;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  }
}));

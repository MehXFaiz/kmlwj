import { create } from 'zustand';
import { invoiceService } from '../services/invoiceService';

export const useInvoiceStore = create((set, get) => ({
  invoices: [],
  loading: false,
  error: null,

  fetchInvoices: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await invoiceService.getAll(params);
      set({ invoices: data.data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addInvoice: async (data) => {
    try {
      const res = await invoiceService.create(data);
      await get().fetchInvoices();
      return res;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateInvoice: async (id, data) => {
    try {
      await invoiceService.update(id, data);
      await get().fetchInvoices();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteInvoice: async (id) => {
    try {
      await invoiceService.delete(id);
      set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  markPaid: async (id) => {
    try {
      await invoiceService.markPaid(id);
      await get().fetchInvoices();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  voidInvoice: async (id) => {
    try {
      await invoiceService.void(id);
      await get().fetchInvoices();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },
}));

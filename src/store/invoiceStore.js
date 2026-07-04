import { create } from 'zustand';
import { invoiceService } from '../services/invoiceService';

export const useInvoiceStore = create((set, get) => ({
  invoices: [],
<<<<<<< HEAD
  loading: false,
  error: null,

  fetchInvoices: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await invoiceService.getAll(params);
      set({ invoices: data.data || [], loading: false });
=======
  currentInvoice: null,
  loading: false,
  error: null,

  fetchInvoices: async () => {
    set({ loading: true });
    try {
      const data = await invoiceService.getAll();
      set({ invoices: data.data || [], loading: false, error: null });
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

<<<<<<< HEAD
=======
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

>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
  addInvoice: async (data) => {
    try {
      const res = await invoiceService.create(data);
      await get().fetchInvoices();
<<<<<<< HEAD
      return res;
=======
      return res.data;
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateInvoice: async (id, data) => {
    try {
<<<<<<< HEAD
      await invoiceService.update(id, data);
      await get().fetchInvoices();
=======
      const res = await invoiceService.update(id, data);
      await get().fetchInvoices();
      return res.data;
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteInvoice: async (id) => {
    try {
      await invoiceService.delete(id);
<<<<<<< HEAD
      set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
=======
      set(state => ({
        invoices: state.invoices.filter(inv => inv.id !== id)
      }));
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

<<<<<<< HEAD
  markPaid: async (id) => {
    try {
      await invoiceService.markPaid(id);
      await get().fetchInvoices();
=======
  bulkDeleteInvoices: async (ids) => {
    try {
      const res = await invoiceService.bulkDelete(ids);
      await get().fetchInvoices();
      return res;
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

<<<<<<< HEAD
  voidInvoice: async (id) => {
    try {
      await invoiceService.void(id);
      await get().fetchInvoices();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },
=======
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
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
}));

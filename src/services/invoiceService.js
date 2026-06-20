import api from './api';

export const invoiceService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/invoices${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  getById: (id) => api.get(`/api/v1/invoices?id=${id}`).then((r) => r.data.data),
  create: (data) => api.post('/api/v1/invoices', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/invoices?id=${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/api/v1/invoices?id=${id}`).then((r) => r.data),
  markPaid: (id) => api.patch(`/api/v1/invoices/pay?id=${id}`).then((r) => r.data.data),
  void: (id) => api.patch(`/api/v1/invoices/void?id=${id}`).then((r) => r.data.data),
};

import api from './api';

export const invoiceService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/invoices${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  getById: (id) => api.get(`/api/v1/invoices?id=${id}`).then((r) => r.data),
  create: (data) => api.post('/api/v1/invoices', data).then((r) => r.data),
  update: (id, data) => api.put(`/api/v1/invoices?id=${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/api/v1/invoices?id=${id}`).then((r) => r.data),
  bulkDelete: (ids) => api.delete('/api/v1/invoices', { data: { ids } }).then(res => res.data),
  post: (id, revenueAccountId) => api.post(`/api/v1/invoices?action=post`, { id, revenueAccountId }).then(res => res.data),
  pay: (id, data) => api.post(`/api/v1/invoices?action=pay`, { id, ...data }).then(res => res.data),
  cancel: (id, revenueAccountId) => api.post(`/api/v1/invoices?action=cancel`, { id, revenueAccountId }).then(res => res.data),
  markPaid: (id) => api.patch(`/api/v1/invoices/pay?id=${id}`).then((r) => r.data),
  void: (id) => api.patch(`/api/v1/invoices/void?id=${id}`).then((r) => r.data),
};

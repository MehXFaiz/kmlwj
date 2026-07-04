import api from './api';

export const invoiceService = {
<<<<<<< HEAD
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
=======
  getAll: () => api.get('/api/v1/invoices').then(res => res.data),
  getById: (id) => api.get(`/api/v1/invoices?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/invoices', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/invoices?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/invoices?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/invoices', { data: { ids } }).then(res => res.data),
  post: (id, revenueAccountId) => api.post(`/api/v1/invoices?action=post`, { id, revenueAccountId }).then(res => res.data),
  pay: (id, data) => api.post(`/api/v1/invoices?action=pay`, { id, ...data }).then(res => res.data),
  cancel: (id, revenueAccountId) => api.post(`/api/v1/invoices?action=cancel`, { id, revenueAccountId }).then(res => res.data),
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83
};

import api from './api';

export const customerService = {
  getAll: () => api.get('/api/v1/customers').then(res => res.data),
  create: (data) => api.post('/api/v1/customers', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/customers?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/customers?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/customers', { data: { ids } }).then(res => res.data),
};

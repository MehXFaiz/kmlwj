import api from './api';

export const donorService = {
  getAll: (search = '') => api.get(`/api/v1/donors${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(res => res.data),
  create: (data) => api.post('/api/v1/donors', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/donors?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/donors?id=${id}`).then(res => res.data),
};

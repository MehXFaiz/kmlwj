import api from './api';

export const zakatCardService = {
  getAll: () => api.get('/api/v1/zakat-cards').then(res => res.data),
  getById: (id) => api.get(`/api/v1/zakat-cards?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/zakat-cards', data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/zakat-cards?id=${id}`).then(res => res.data),
};

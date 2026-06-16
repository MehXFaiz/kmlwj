import api from './api';

export const beneficiaryService = {
  getAll: () => api.get('/api/v1/beneficiaries').then(res => res.data),
  create: (data) => api.post('/api/v1/beneficiaries', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/beneficiaries?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/beneficiaries?id=${id}`).then(res => res.data),
};

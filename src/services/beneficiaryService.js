import api from './api';

export const beneficiaryService = {
  getAll: () => api.get('/v1/beneficiaries').then(res => res.data),
  create: (data) => api.post('/v1/beneficiaries', data).then(res => res.data),
  update: (id, data) => api.put(`/v1/beneficiaries?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/v1/beneficiaries?id=${id}`).then(res => res.data),
};

import api from './api';

export const donationService = {
  getAll: () => api.get('/api/v1/donations').then(res => res.data),
  create: (data) => api.post('/api/v1/donations', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/donations?id=${id}`, data).then(res => res.data),
  approve: (id) => api.post(`/api/v1/donations?action=approve`, { id }).then(res => res.data),
};

import api from './api';

export const donationService = {
  getAll: () => api.get('/v1/donations').then(res => res.data),
  create: (data) => api.post('/v1/donations', data).then(res => res.data),
  update: (id, data) => api.put(`/v1/donations?id=${id}`, data).then(res => res.data),
  approve: (id) => api.post(`/v1/donations?action=approve`, { id }).then(res => res.data),
};

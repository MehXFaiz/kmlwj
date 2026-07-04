import api from './api';

export const memberService = {
  getAll: () => api.get('/api/v1/members').then(res => res.data),
  getById: (id) => api.get(`/api/v1/members?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/members', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/members?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/members?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/members', { data: { ids } }).then(res => res.data),
};

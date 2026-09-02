import api from './api';

export const donationService = {
  getAll: (params) => api.get('/api/v1/donations', { params }).then(res => res.data),
  checkDuplicate: (disbursementMonth, donationType, bankAccountId) =>
    api.get(`/api/v1/donations?action=check-duplicate&disbursementMonth=${encodeURIComponent(disbursementMonth)}&donationType=${encodeURIComponent(donationType)}&bankAccountId=${encodeURIComponent(bankAccountId)}`).then(res => res.data),
  create: (data) => api.post('/api/v1/donations', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/donations?id=${id}`, data).then(res => res.data),
  approve: (id) => api.post(`/api/v1/donations?action=approve`, { id }).then(res => res.data),
  revert: (id, reason) => api.post('/api/v1/ledger-post?action=revert', { module: 'donations', recordId: id, reason }).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/donations?id=${id}&permanent=true`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/donations', { data: { ids, permanent: true } }).then(res => res.data),
};

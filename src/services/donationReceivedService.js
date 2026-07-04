import api from './api';

export const donationReceivedService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.donationType) query.append('donationType', params.donationType);
    if (params.paymentMethod) query.append('paymentMethod', params.paymentMethod);
    if (params.donorId) query.append('donorId', params.donorId);
    
    const queryString = query.toString();
    return api.get(`/api/v1/donations-received${queryString ? `?${queryString}` : ''}`).then(res => res.data);
  },
  create: (data) => api.post('/api/v1/donations-received', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/donations-received?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/donations-received?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/donations-received', { data: { ids } }).then(res => res.data),
};

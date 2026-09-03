import api from './api';

export const donationReceivedService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.donationType && params.donationType !== 'ALL') query.append('donationType', params.donationType);
    if (params.paymentMethod && params.paymentMethod !== 'ALL') query.append('paymentMethod', params.paymentMethod);
    if (params.donorId && params.donorId !== 'ALL') query.append('donorId', params.donorId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.date) query.append('date', params.date);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    
    const queryString = query.toString();
    return api.get(`/api/donations${queryString ? `?${queryString}` : ''}`).then(res => res.data);
  },
  getById: (id) => api.get(`/api/donations/${id}`).then(res => res.data),
  create: (data) => api.post('/api/donations', data).then(res => res.data),
  update: (id, data) => api.put(`/api/donations/${id}`, data).then(res => res.data),
  delete: (id, permanent = false) => api.delete(`/api/donations/${id}${permanent ? '?permanent=true' : ''}`).then(res => res.data),
  bulkDelete: (ids, permanent = false) => api.delete('/api/donations', { data: { ids, permanent } }).then(res => res.data),
};

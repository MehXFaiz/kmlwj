import api from './api';

export const accountService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/accounts${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  getTree: () => api.get('/api/v1/accounts/tree').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/accounts', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/accounts?id=${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/api/v1/accounts?id=${id}`).then((r) => r.data),
};

export const revenueService = {
  getAll: () => api.get('/api/v1/revenue-heads').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/revenue-heads', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/revenue-heads?id=${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/api/v1/revenue-heads?id=${id}`).then((r) => r.data),
};

export const expenseService = {
  getAll: () => api.get('/api/v1/expense-heads').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/expense-heads', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/expense-heads?id=${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/api/v1/expense-heads?id=${id}`).then((r) => r.data),
};

export const userService = {
  getAll: () => api.get('/api/v1/users').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/users', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/users?id=${id}`, data).then((r) => r.data.data),
};

export const roleService = {
  getAll: () => api.get('/api/v1/roles').then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/roles?id=${id}`, data).then((r) => r.data),
};

export const dashboardService = {
  getStats: () => api.get('/api/v1/dashboard/stats').then((r) => r.data.data),
};

export const auditService = {
  getAll: () => api.get('/api/v1/audit-logs').then((r) => r.data.data),
};

export const reservedCodeService = {
  getAll: () => api.get('/api/v1/reserved-codes').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/reserved-codes', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/reserved-codes?id=${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/api/v1/reserved-codes?id=${id}`).then((r) => r.data),
};

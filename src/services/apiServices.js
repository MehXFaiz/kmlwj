import api from './api';

export const accountService = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/accounts${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  getTree: () => api.get('/api/v1/accounts/tree').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/accounts', data).then((r) => {
    const rawAcc = r.data.data;
    return {
      id: rawAcc.id,
      code: rawAcc.glCode,
      name: rawAcc.accountName,
      level: rawAcc.accountLevel,
      detailType: rawAcc.detailType,
      currency: rawAcc.currency,
      initialBalance: rawAcc.initialBalance,
      currentBalance: rawAcc.currentBalance,
    };
  }),
  update: (id, data) => api.put(`/api/v1/accounts?id=${id}`, data).then((r) => {
    const rawAcc = r.data.data;
    return {
      id: rawAcc.id,
      code: rawAcc.glCode,
      name: rawAcc.accountName,
      level: rawAcc.accountLevel,
      detailType: rawAcc.detailType,
      currency: rawAcc.currency,
      initialBalance: rawAcc.initialBalance,
      currentBalance: rawAcc.currentBalance,
    };
  }),
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
  delete: (id) => api.delete(`/api/v1/users?id=${id}`).then((r) => r.data),
};

export const roleService = {
  getAll: () => api.get('/api/v1/roles').then((r) => r.data.data),
  create: (data) => api.post('/api/v1/roles', data).then((r) => r.data.data),
  update: (id, data) => api.put(`/api/v1/roles?id=${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/api/v1/roles?id=${id}`).then((r) => r.data),
};

export const dashboardService = {
  getStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/dashboard/stats${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  },
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

export const reportsService = {
  getTrialBalance: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/reports/trial-balance${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  },
  getIncomeStatement: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/reports/income-statement${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  },
  getBalanceSheet: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/reports/balance-sheet${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  },
  getCashFlow: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/reports/cash-flow${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  },
  getGeneralLedger: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/general-ledger${qs ? `?${qs}` : ''}`).then((r) => r.data.data);
  }
};

export const searchService = {
  search: (q) => api.get(`/api/v1/search?q=${encodeURIComponent(q)}`).then((r) => r.data.data),
};

export { customerService } from './customerService';
export { invoiceService } from './invoiceService';

export const accountingHealthService = {
  getCheck: () => api.get('/api/v1/accounting-health').then((r) => r.data),
  rebuildBalances: () => api.post('/api/v1/accounting-health').then((r) => r.data),
};

export const aiAccountingService = {
  getIssues: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/ai-accounting/issues${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
  runAudit: () => api.post('/api/v1/ai-accounting/audit').then((r) => r.data),
  analyze: (issueIds) => api.post('/api/v1/ai-accounting/analyze', issueIds ? { issueIds } : {}).then((r) => r.data),
  autoRepair: () => api.post('/api/v1/ai-accounting/auto-repair').then((r) => r.data),
  applyRepair: (issueId, decision, notes) => api.post('/api/v1/ai-accounting/repair', { issueId, decision, notes }).then((r) => r.data),
  getHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/v1/ai-accounting/history${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },
};

export const ledgerService = {
  postToLedger: (module, recordId) =>
    api.post('/api/v1/ledger-post?action=post', { module, recordId }).then((r) => r.data),
  revertPosting: (module, recordId, reason) =>
    api.post('/api/v1/ledger-post?action=revert', { module, recordId, reason }).then((r) => r.data),
};


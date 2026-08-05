import api from './api';

export const addIncomeService = {
  // Income Categories
  getCategories: async (includeDeleted = false) => {
    const response = await api.get(`/api/v1/income-categories${includeDeleted ? '?includeDeleted=true' : ''}`);
    return response.data;
  },

  createCategory: async (data) => {
    const response = await api.post('/api/v1/income-categories', data);
    return response.data;
  },

  updateCategory: async (id, data) => {
    const response = await api.put('/api/v1/income-categories', { id, ...data });
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await api.delete(`/api/v1/income-categories?id=${id}`);
    return response.data;
  },

  // Income Records
  getRecords: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const response = await api.get(`/api/v1/add-income?${searchParams.toString()}`);
    return response.data;
  },

  createRecord: async (data) => {
    const response = await api.post('/api/v1/add-income', data);
    return response.data;
  },

  updateRecord: async (id, data) => {
    const response = await api.put('/api/v1/add-income', { id, ...data });
    return response.data;
  },

  deleteRecord: async (id) => {
    const response = await api.delete(`/api/v1/add-income?id=${id}`);
    return response.data;
  }
};

import axios from 'axios';
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

  getRecordById: async (id) => {
    const response = await api.get(`/api/v1/add-income?id=${id}`);
    const data = response.data.data;
    if (Array.isArray(data)) {
      return data.find(r => r.id === id) || null;
    }
    return data;
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
  },

  bulkDeleteRecords: async (ids) => {
    const response = await api.delete('/api/v1/add-income', { data: { ids } });
    return response.data;
  },

  uploadFile: async (fieldName, file, onProgress) => {
    try {
      const signResult = (await api.post('/api/v1/upload/sign')).data.data;

      if (signResult.mode === 'cloud') {
        const { cloudName, apiKey, timestamp, signature, folder } = signResult;

        const form = new FormData();
        form.append('file', file);
        form.append('api_key', apiKey);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        form.append('folder', folder);

        const cloudRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          form,
          {
            headers: { 'Content-Type': null },
            onUploadProgress: (e) => {
              if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
            },
          }
        );

        return { attachmentUrl: cloudRes.data.secure_url };
      }

      const form = new FormData();
      form.append(fieldName, file);

      const res = await api.post('/api/v1/upload', form, {
        headers: { 'Content-Type': null },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      const resData = res.data.data;
      return { attachmentUrl: resData?.attachmentUrl || resData?.fileUrl || resData?.url || null };
    } catch (e) {
      console.error('File upload error:', e);
      throw e;
    }
  }
};

import api from './api';

export const memberService = {
  getAll: () => api.get('/api/v1/members').then(res => res.data),
  getById: (id) => api.get(`/api/v1/members?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/members', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/members?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/members?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/members', { data: { ids } }).then(res => res.data),

  /**
   * Upload one or more member images.
   * @param {FormData} formData - fields: photo, cnicFront, cnicBack (File objects)
   * @param {(pct: number) => void} [onProgress] - called with 0-100 percent
   * @returns {{ photoUrl?, cnicFrontUrl?, cnicBackUrl? }}
   */
  uploadFiles: (formData, onProgress) =>
    api.post('/api/v1/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }).then(res => res.data.data),
};

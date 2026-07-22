import api from './api';
import { memberService } from './memberService';

export const beneficiaryService = {
  // SQA fix: same pagination gap as memberService.getAll — loops every page
  // so any org with more than 100 beneficiaries doesn't silently lose access
  // to the rest, while preserving the { status, data } shape callers expect.
  getAll: async () => {
    const PAGE_SIZE = 500;
    let page = 1;
    let all = [];
    let total = Infinity;

    while (all.length < total) {
      const res = await api.get('/api/v1/beneficiaries', { params: { page, limit: PAGE_SIZE } });
      const { data, meta } = res.data;
      all = all.concat(data || []);
      total = meta?.total ?? all.length;
      if (!data || data.length === 0) break;
      page += 1;
    }

    return { status: 200, data: all };
  },
  create: (data) => api.post('/api/v1/beneficiaries', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/beneficiaries?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/beneficiaries?id=${id}`).then(res => res.data),

  /**
   * Upload a single beneficiary file — reuses the shared upload pipeline
   * used by the member form (Cloudinary in prod, local disk in dev).
   * @param {string} fieldName - 'photo' | 'cnicFront' | 'cnicBack'
   */
  uploadFile: (fieldName, file, onProgress) =>
    memberService.uploadFile(fieldName, file, onProgress),
};

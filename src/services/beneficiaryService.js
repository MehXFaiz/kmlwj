import api from './api';
import { memberService } from './memberService';

export const beneficiaryService = {
  getAll: () => api.get('/api/v1/beneficiaries').then(res => res.data),
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

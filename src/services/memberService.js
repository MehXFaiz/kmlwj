import axios from 'axios';
import api from './api';

const FIELD_TO_URL_KEY = {
  photo: 'photoUrl',
  cnicFront: 'cnicFrontUrl',
  cnicBack: 'cnicBackUrl',
};

export const memberService = {
  getAll: async () => {
    const PAGE_SIZE = 500;
    let page = 1;
    let all = [];
    let total = Infinity;

    while (all.length < total) {
      const res = await api.get('/api/v1/members', { params: { page, limit: PAGE_SIZE } });
      const { data, meta } = res.data;
      all = all.concat(data || []);
      total = meta?.total ?? all.length;
      if (!data || data.length === 0) break;
      page += 1;
    }

    return { status: 200, data: all };
  },
  getById: (id) => api.get(`/api/v1/members?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/members', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/members?id=${id}`, data).then(res => res.data),
  delete: (id, permanent = false) =>
    api.delete(`/api/v1/members?id=${id}${permanent ? '&permanent=true' : ''}`).then(res => res.data),
  bulkDelete: (ids, permanent = false) =>
    api.delete('/api/v1/members', { data: { ids, permanent } }).then(res => res.data),

  uploadFile: async (fieldName, file, onProgress) => {
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

      return { [FIELD_TO_URL_KEY[fieldName] || fieldName]: cloudRes.data.secure_url };
    }

    const form = new FormData();
    form.append(fieldName, file);

    const res = await api.post('/api/v1/upload', form, {
      headers: { 'Content-Type': null },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });

    return res.data.data;
  },
};

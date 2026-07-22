import axios from 'axios';
import api from './api';

const FIELD_TO_URL_KEY = {
  photo: 'photoUrl',
  cnicFront: 'cnicFrontUrl',
  cnicBack: 'cnicBackUrl',
};

export const memberService = {
  // SQA fix: the API paginates (default limit 100) but this previously fetched
  // only the first page — any org with more than 100 members silently lost
  // visibility into the rest, with no pagination UI to reach them either.
  // This loops every page and returns the full combined list, preserving the
  // { status, data } shape callers already expect.
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
      if (!data || data.length === 0) break; // safety net against an infinite loop
      page += 1;
    }

    return { status: 200, data: all };
  },
  getById: (id) => api.get(`/api/v1/members?id=${id}`).then(res => res.data),
  create: (data) => api.post('/api/v1/members', data).then(res => res.data),
  update: (id, data) => api.put(`/api/v1/members?id=${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/api/v1/members?id=${id}`).then(res => res.data),
  bulkDelete: (ids) => api.delete('/api/v1/members', { data: { ids } }).then(res => res.data),

  /**
   * Upload a single member file (profile photo or CNIC image).
   *
   * When Cloudinary is configured on the backend, the file is uploaded directly
   * from the browser to Cloudinary using a short-lived signature — the raw bytes
   * never pass through our own server. This matters because our API runs as a
   * Vercel serverless function, and Vercel caps request bodies at 4.5 MB at the
   * platform level; proxying uploads through our own endpoint would fail for any
   * real photo regardless of application code.
   *
   * When Cloudinary isn't configured (local dev), the file is posted to our own
   * /api/v1/upload endpoint, which writes it to the local disk instead.
   *
   * @param {string} fieldName - 'photo' | 'cnicFront' | 'cnicBack'
   * @param {File} file
   * @param {(pct: number) => void} [onProgress] - called with 0-100 percent
   * @returns {Promise<{ photoUrl?, cnicFrontUrl?, cnicBackUrl? }>}
   */
  uploadFile: async (fieldName, file, onProgress) => {
    // Response body shape: { status: 200, data: { mode, ... } } — unwrap both
    // the axios envelope and the API envelope to get the sign payload itself.
    const signResult = (await api.post('/api/v1/upload/sign')).data.data;

    if (signResult.mode === 'cloud') {
      const { cloudName, apiKey, timestamp, signature, folder } = signResult;

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      form.append('folder', folder);

      // Plain axios (not our `api` instance) — this request goes straight to
      // Cloudinary's API, not our backend, so it must skip our auth/refresh interceptors.
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

    // Local fallback (development)
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

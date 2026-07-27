import axios from 'axios';
import { tokenStorage } from './authService';
import { syncEngine } from './syncEngine';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh, unauthorized, and sync events
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toUpperCase();
    const headers = response.headers || {};
    const hasSyncHeader = headers['x-erp-sync-version'] || headers['X-ERP-Sync-Version'];
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || hasSyncHeader) {
      syncEngine.notifyTransactionEvent({
        action: method,
        url: response.config?.url,
        syncVersion: hasSyncHeader
      });
    }
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The refresh token travels via the httpOnly cookie automatically —
        // no token is read from or written to localStorage here.
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = res.data.data;

        tokenStorage.setAccessToken(accessToken);

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        if (refreshError.response && (refreshError.response.status === 401 || refreshError.response.status === 403)) {
          tokenStorage.clear();
          window.dispatchEvent(new Event('auth_session_expired'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

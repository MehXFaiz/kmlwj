const API_BASE_URL = '/api';

// SQA fix: the refresh token is no longer persisted in localStorage — it now
// lives exclusively in an httpOnly cookie set by the server (see api/_auth/
// login.ts, refresh.ts, logout.ts), so it's unreadable by any script running
// on the page. Only the short-lived (15 min) access token and non-sensitive
// user metadata remain client-side.
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('access_token'),
  setAccessToken: (token) => localStorage.setItem('access_token', token),
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_meta');
  },
  getUserMeta: () => {
    const meta = localStorage.getItem('user_meta');
    return meta ? JSON.parse(meta) : null;
  },
  setUserMeta: (user) => localStorage.setItem('user_meta', JSON.stringify(user)),
};

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

// Request interceptor and fetch wrapper
export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const accessToken = tokenStorage.getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers, credentials: 'include' });

  // Handle unauthorized errors
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        // The refresh token travels via the httpOnly cookie automatically —
        // no token is read from or written to localStorage here.
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.data.accessToken;

          tokenStorage.setAccessToken(newAccessToken);

          isRefreshing = false;
          onRefreshed(newAccessToken);
        } else {
          isRefreshing = false;
          tokenStorage.clear();
          window.dispatchEvent(new Event('auth_session_expired'));
          throw { status: 401, message: 'Session expired' };
        }
      } catch (error) {
        isRefreshing = false;
        // Check if error is a Response object and has status property
        if (error.status === 401 || error.status === 403) {
          tokenStorage.clear();
          window.dispatchEvent(new Event('auth_session_expired'));
        }
        throw error;
      }
    }

    // Wait for token refresh to complete
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        headers['Authorization'] = `Bearer ${newToken}`;
        resolve(fetch(url, { ...options, headers }));
      });
    });
  }

  return response;
}

const safeJson = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(text.slice(0, 100) || `Server error (${res.status})`);
  }
};

export const authService = {
  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Login failed');
    }

    const { accessToken, user } = data.data;
    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setUserMeta(user);
    return user;
  },

  register: async (email, password, name) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Registration failed');
    }
    return data;
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      tokenStorage.clear();
    }
  },

  forgotPassword: async (email) => {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Forgot password request failed');
    }
    return data;
  },

  resetPassword: async (token, newPassword) => {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Password reset failed');
    }
    return data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error?.message || 'Change password failed');
    }
    return data;
  },
};

// src/api/axiosInstance.js
import axios from 'axios';

// Prefer HTTPS in prod; trim trailing slashes
const baseURL = (process.env.REACT_APP_API_URL || 'https://fadztrack.onrender.com/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Plain client for refresh (no interceptors to avoid recursion)
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];
let refreshTimer = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

const setAuthHeader = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

const isAuthFailure = (err) => {
  const s = err?.response?.status;
  return s === 401 || s === 403;
};

const decodeJwtExpMs = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    return (payload?.exp ? payload.exp * 1000 : 0);
  } catch { return 0; }
};

const scheduleProactiveRefresh = (token) => {
  clearTimeout(refreshTimer);
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return;
  const delay = Math.max(0, expMs - Date.now() - 60_000); // refresh ~60s early
  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch(() => {}); // ignore transient failures
  }, delay);
};

// Attach access token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config._retryCount == null) config._retryCount = 0;
    return config;
  },
  (error) => Promise.reject(error)
);

async function refreshAccessToken() {
  if (isRefreshing) {
    return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
  }
  isRefreshing = true;
  try {
    const { data } = await refreshClient.post('/auth/refresh-token', {});
    const newToken = data?.accessToken;
    if (!newToken) throw new Error('No accessToken in refresh response');

    localStorage.setItem('token', newToken);
    setAuthHeader(newToken);
    scheduleProactiveRefresh(newToken);
    processQueue(null, newToken);
    return newToken;
  } catch (err) {
    processQueue(err, null);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

// Handle 401s -> refresh once -> replay queued requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    // canceled requests: just bubble up
    if (error?.name === 'CanceledError' || axios.isCancel?.(error)) {
      return Promise.reject(error);
    }

    // Network/CORS/timeout (no response): let caller handle (don’t log out)
    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const isRefreshCall = /\/auth\/refresh-token\/?$/.test(originalRequest.url || '');

    // For normal requests that 401, try a single refresh
    if (!isRefreshCall && status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount > 1) return Promise.reject(error);

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        if (isAuthFailure(refreshErr)) {
          cleanupAndRedirect();
        }
        return Promise.reject(refreshErr);
      }
    }

    // If the refresh call itself failed
    if (isRefreshCall && isAuthFailure(error)) {
      cleanupAndRedirect();
    }

    return Promise.reject(error);
  }
);

function cleanupAndRedirect() {
  clearTimeout(refreshTimer);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  refreshClient.post('/auth/logout').catch(() => {});
  window.location.replace('/');
}

// Initialize from existing token (if any)
const existing = localStorage.getItem('token');
if (existing) {
  setAuthHeader(existing);
  scheduleProactiveRefresh(existing);
}

export default api;

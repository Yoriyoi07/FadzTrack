// src/api/axiosInstance.js
import axios from 'axios';

// Prefer HTTPS in prod; trim trailing slashes
// Compute API base with safety: if hosted on fadztrack.online, prefer same-origin /api to avoid cookie/host mismatch even if env is stale.
function computeApiBase() {
  const fromEnv = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '';
      const origin = window.location.origin || '';
      const onFadzDomain = /(^|\.)fadztrack\.online$/.test(host);
      // Allow opt-out if explicitly forced via REACT_APP_FORCE_API_URL
      const forceEnv = (process.env.REACT_APP_FORCE_API_URL || '').trim().length > 0;
      if (isProd && onFadzDomain && !forceEnv) {
        return `${origin.replace(/\/+$/, '')}/api`;
      }
    }
  } catch {}
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return (isProd ? 'https://www.fadztrack.online/api' : 'http://localhost:5000/api');
}

export const API_BASE_URL = computeApiBase().replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send cookies (refresh, trust)
});

// Debug: Log the base URL being used
console.log('API Base URL:', API_BASE_URL);

// Plain client for refresh (no interceptors to avoid recursion)
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];
let refreshTimer = null;

/* -------------------------- tiny helpers -------------------------- */
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

const setAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

const decodeJwtExpMs = (token) => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    return payload?.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const isAuthFailure = (err) => {
  const s = err?.response?.status;
  return s === 401 || s === 403;
};

/* -------------------- proactive refresh handling ------------------- */
let explicitExpiryMs = 0; // if backend supplies accessTokenExpiresAt use it
const scheduleProactiveRefresh = (token) => {
  clearTimeout(refreshTimer);
  const expMs = explicitExpiryMs || decodeJwtExpMs(token);
  if (!expMs) return;
  const delay = Math.max(0, expMs - Date.now() - 60_000); // refresh ~60s early
  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch(() => {
      // ignore transient errors; normal 401 flow will retry
    });
  }, delay);
};

async function refreshAccessToken() {
  if (isRefreshing) {
    return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
  }
  isRefreshing = true;
  try {
    const { data } = await refreshClient.post('/auth/refresh-token', {});
  const newToken = data?.accessToken;
    if (!newToken) throw new Error('No accessToken in refresh response');
  explicitExpiryMs = data?.accessTokenExpiresAt || 0;

    // persist & apply
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

/* --------------------------- public helpers -------------------------- */
export function setAccessToken(token, meta) {
  if (!token) return;
  localStorage.setItem('token', token);
  explicitExpiryMs = meta?.accessTokenExpiresAt || 0;
  setAuthHeader(token);
  scheduleProactiveRefresh(token);
}

export function clearAuth() {
  try { clearTimeout(refreshTimer); } catch {}
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  setAuthHeader(null);
  // tell server to clear cookies (refresh & trust); ignore result
  refreshClient.post('/auth/logout').catch(() => {});
}

/* ---------------------------- interceptors --------------------------- */
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

// 401 handler -> try single refresh -> replay queued requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    // canceled requests
    if (error?.name === 'CanceledError' || axios.isCancel?.(error)) {
      return Promise.reject(error);
    }

    // Network/CORS/timeout (no response)
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
          clearAuth();
          // hard redirect to login
          window.location.replace('/');
        }
        return Promise.reject(refreshErr);
      }
    }

    // If the refresh call itself failed
    if (isRefreshCall && isAuthFailure(error)) {
      clearAuth();
      window.location.replace('/');
    }

    return Promise.reject(error);
  }
);

/* -------------------- init from existing token (if any) -------------------- */
(async function bootstrapAuth() {
  const existing = localStorage.getItem('token');
  if (existing) {
    setAuthHeader(existing);
    scheduleProactiveRefresh(existing);
    return;
  }
  try {
    // If a valid refresh cookie exists (HTTP-only), get a new access token
    const { data } = await refreshClient.post('/auth/refresh-token', {});
    const newToken = data?.accessToken;
    if (newToken) {
      localStorage.setItem('token', newToken);
      setAuthHeader(newToken);
      scheduleProactiveRefresh(newToken);
    }
  } catch {
    // no refresh cookie or it’s expired — user will see login
  }
})();

// Refresh when user returns to the tab or regains connectivity
window.addEventListener('online', () => {
  refreshAccessToken().catch(() => {});
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshAccessToken().catch(() => {});
  }
});

// Optional: export a manual trigger if you want to call it elsewhere
export async function triggerRefresh() {
  try { return await refreshAccessToken(); } catch { return null; }
}
 
 export default api;

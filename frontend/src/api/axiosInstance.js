// src/api/axiosInstance.js
import axios from 'axios';

// Prefer HTTPS in prod; trim trailing slashes
const baseURL = (
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://fadztrack.onrender.com/api'
).replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  withCredentials: true, // send cookies (refresh, trust)
});

// Plain client for refresh (no interceptors to avoid recursion)
const refreshClient = axios.create({
  baseURL,
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
const scheduleProactiveRefresh = (token) => {
  clearTimeout(refreshTimer);
  const expMs = decodeJwtExpMs(token);
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
export function setAccessToken(token) {
  if (!token) return;
  localStorage.setItem('token', token);
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

import axios from 'axios';

const baseURL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// ⚠️ Use a *plain* instance for refresh to avoid interceptor recursion.
const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

// Small helper to resolve/reject all queued requests after refresh completes
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// Attach access token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // prevent infinite retry per request
    if (config._retryCount == null) config._retryCount = 0;
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401s -> refresh once -> replay queued requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    // If there is no response or no config, just fail
    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    // Never try to refresh for the refresh call itself
    const isRefreshCall = /\/auth\/refresh-token\/?$/.test(originalRequest.url || '');

    // Only handle 401s for non-refresh requests, and only retry once
    if (status === 401 && !isRefreshCall && !originalRequest._retry) {
      originalRequest._retry = true;
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount > 1) {
        // hard stop: don't let a single request retry forever
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // queue the request until the ongoing refresh finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      try {
        // IMPORTANT: use the *plain* client here (no interceptors)
        const { data } = await refreshClient.post('/auth/refresh-token', {});
        const newToken = data?.accessToken;

        if (!newToken) {
          throw new Error('No accessToken in refresh response');
        }

        // Persist token
        localStorage.setItem('token', newToken);

        // Set for future requests + current retry
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Clean up and bounce to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          // optional: tell server to clear cookies
          await refreshClient.post('/auth/logout').catch(() => {});
        } finally {
          window.location.href = '/';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

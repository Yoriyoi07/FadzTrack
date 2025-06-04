console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true 
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Response interceptor: Handles 401, refreshes, retries
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }
      isRefreshing = true;
      try {
        const { data } = await api.post(
          '/auth/refresh-token',
          {}, // empty body
          { withCredentials: true }
        );
        // Save new accessToken
        localStorage.setItem('token', data.accessToken);
        // Set as default for new requests
        api.defaults.headers.common["Authorization"] = "Bearer " + data.accessToken;
        // Set for this retry
        originalRequest.headers["Authorization"] = "Bearer " + data.accessToken;
        processQueue(null, data.accessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Request interceptor: Attaches access token to all requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers["Authorization"] = "Bearer " + token;
    }
    return config;
  },
  error => Promise.reject(error)
);

export default api;

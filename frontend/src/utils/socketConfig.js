// Centralized Socket.IO client configuration
// Derives the socket base from API_BASE_URL, with optional overrides via env.
import { API_BASE_URL } from '../api/axiosInstance';

// 1) Allow explicit override
let base = (process.env.REACT_APP_SOCKET_URL || '').trim();

// 2) Derive from API base if not provided (strip trailing /api)
if (!base) {
  const api = (API_BASE_URL || '').trim();
  if (api) base = api.replace(/\/?api\/?$/, '');
}

// 3) Fallback to current origin as last resort (useful for local dev with proxied backend)
if (!base && typeof window !== 'undefined') base = window.location.origin;

// Normalize
if (base && base.endsWith('/')) base = base.replace(/\/+$/, '');

export const SOCKET_URL = base || '/';
export const SOCKET_PATH = process.env.REACT_APP_SOCKET_PATH || '/socket.io';

// Small helper for debugging in production if needed
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[socketConfig] Using', { SOCKET_URL, SOCKET_PATH });
}

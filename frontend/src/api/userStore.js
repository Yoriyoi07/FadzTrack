// src/api/userStore.js
const KEY = 'user';

export function normalizeUser(u) {
  if (!u || typeof u !== 'object') return null;
  const id = u._id || u.id || null;
  return id ? { ...u, _id: id, id } : { ...u };
}

export function setUser(u) {
  const n = normalizeUser(u);
  if (!n) {
    try { localStorage.removeItem(KEY); } catch {}
    return null;
  }
  try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {}
  return n;
}

export function getUser() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const n = normalizeUser(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(n)) {
      // keep storage normalized
      localStorage.setItem(KEY, JSON.stringify(n));
    }
    return n;
  } catch {
    return null;
  }
}

export function clearUser() {
  try { localStorage.removeItem(KEY); } catch {}
}

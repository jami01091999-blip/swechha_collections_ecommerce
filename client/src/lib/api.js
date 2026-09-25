// React → Express API (fetch) with TanStack Query caching, so going "back" renders instantly
// and scroll position is restored. Hooks keep the old { data, error, loading, reload } shape.
// Sign-in uses httpOnly cookies set by the API; nothing about the session is stored in JavaScript.
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './queryClient';

export class ApiError extends Error {
  /** `data` is the JSON error body (code, fields, retryAfter, attemptsLeft…). */
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = data?.code;
  }
}

/* ── query keys ───────────────────────────────────────────── */
export const keys = {
  products: ['products'],
  product: (slug) => ['product', slug],
  settings: ['settings'],
  me: ['me'],
  addresses: ['me', 'addresses'],
  adminProducts: ['admin', 'products'],
  adminProduct: (id) => ['admin', 'product', id],
  team: ['admin', 'team'],
};

/* ── session helpers (used by lib/auth.jsx too) ───────────── */
/** Drops everything that belongs to one person (account, admin data). */
export function clearUserQueries() {
  queryClient.removeQueries({ queryKey: ['admin'] });
  queryClient.removeQueries({ queryKey: keys.addresses });
}

export function setSignedIn(user) {
  clearUserQueries();
  queryClient.setQueryData(keys.me, user);
}

export function setSignedOut() {
  clearUserQueries();
  queryClient.setQueryData(keys.me, null);
}

async function send(path, { method = 'GET', body } = {}) {
  // Every request carries this header: the API rejects state-changing requests without it (CSRF rule).
  const headers = { 'X-Requested-With': 'swechha' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    // Relative URL: Vite proxies /api in dev, Vercel rewrites it to Render in production.
    // credentials: 'include' so the session cookies are sent.
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { res, data };
}

// One refresh at a time: parallel requests that hit an expired token all wait for the same promise.
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = send('/auth/refresh', { method: 'POST' })
      .then(({ res, data }) => {
        if (!res.ok) return false;
        queryClient.setQueryData(keys.me, data.user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const SIGNED_OUT_CODES = new Set(['AUTH_REQUIRED', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'BLOCKED']);

export async function api(path, options = {}) {
  let { res, data } = await send(path, options);
  if (res.status === 401 && data?.code === 'TOKEN_EXPIRED') {
    // Access token expired: refresh once, then retry the original request.
    if (await refreshSession()) ({ res, data } = await send(path, options));
    else setSignedOut();
  }
  if (!res.ok) {
    // Signed out elsewhere, blocked, or the role changed: bring the cached user up to date.
    if (SIGNED_OUT_CODES.has(data?.code) && queryClient.getQueryData(keys.me)) setSignedOut();
    if (data?.code === 'FORBIDDEN') queryClient.invalidateQueries({ queryKey: keys.me });
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data);
  }
  return data;
}

function useResource(queryKey, queryFn, enabled = true) {
  const q = useQuery({ queryKey, queryFn, enabled });
  return {
    data: q.data,
    error: q.error || null,
    loading: enabled && (q.data === undefined ? !q.error : q.isFetching),
    reload: q.refetch,
  };
}

/* ── public hooks ─────────────────────────────────────────── */
export const useProducts = () => useResource(keys.products, () => api('/products'));
export const useSettings = () => useResource(keys.settings, () => api('/settings'));

export function useProduct(slug) {
  const list = useProducts();
  const fromList = list.data?.find((p) => p.slug === slug);
  const single = useResource(keys.product(slug), () => api(`/products/${encodeURIComponent(slug)}`), !fromList && !!slug);
  return fromList ? { data: fromList, loading: false, error: null } : single;
}

/* ── account ──────────────────────────────────────────────── */
/** The signed-in user, or null. 200 even when signed out, so there is no console noise. */
export const fetchMe = () => api('/auth/me').then((d) => d.user);

export const requestCode = (email) => api('/auth/otp/request', { method: 'POST', body: { email } });

export async function verifyCode(email, code) {
  const data = await api('/auth/otp/verify', { method: 'POST', body: { email, code } });
  setSignedIn(data.user);
  return data;
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    setSignedOut();
  }
}

export async function logoutAll() {
  await api('/auth/logout-all', { method: 'POST' });
  setSignedOut();
}

export async function updateMe(body) {
  const { user } = await api('/users/me', { method: 'PATCH', body });
  queryClient.setQueryData(keys.me, user);
  return user;
}

export const useAddresses = (enabled = true) =>
  useResource(keys.addresses, () => api('/users/me/addresses').then((d) => d.addresses), enabled);

const saveAddresses = (data) => {
  queryClient.setQueryData(keys.addresses, data.addresses);
  return data;
};
export const addAddress = (body) => api('/users/me/addresses', { method: 'POST', body }).then(saveAddresses);
export const updateAddress = (id, body) => api(`/users/me/addresses/${id}`, { method: 'PATCH', body }).then(saveAddresses);
export const deleteAddress = (id) => api(`/users/me/addresses/${id}`, { method: 'DELETE' }).then(saveAddresses);
export const makeDefaultAddress = (id) => api(`/users/me/addresses/${id}/default`, { method: 'POST' }).then(saveAddresses);

/* ── admin hooks ──────────────────────────────────────────── */
export const useAdminProducts = () => useResource(keys.adminProducts, () => api('/products?all=1'));

export function useAdminProduct(id) {
  const list = useAdminProducts();
  const fromList = list.data?.find((p) => p._id === id);
  const single = useResource(keys.adminProduct(id), () => api(`/products/${id}`), !fromList && !!id && !list.loading);
  return fromList ? { data: fromList, loading: false, error: null } : { ...single, loading: single.loading || list.loading };
}

export const useTeam = () => useResource(keys.team, () => api('/admin/team').then((d) => d.team));
const refreshTeam = (data) => {
  queryClient.invalidateQueries({ queryKey: keys.team });
  return data;
};
export const addTeamMember = (email, role) => api('/admin/team', { method: 'POST', body: { email, role } }).then(refreshTeam);
export const changeTeamRole = (userId, role) => api(`/admin/team/${userId}`, { method: 'PATCH', body: { role } }).then(refreshTeam);
export const removeTeamMember = (userId) => api(`/admin/team/${userId}`, { method: 'DELETE' }).then(refreshTeam);

/* ── mutations ────────────────────────────────────────────── */
// Public caches are dropped after an admin write so the shop shows fresh data next time.
function afterWrite() {
  queryClient.removeQueries({ queryKey: keys.products });
  queryClient.removeQueries({ queryKey: ['product'] });
}

const patchAdminList = (fn) => {
  if (queryClient.getQueryData(keys.adminProducts)) queryClient.setQueryData(keys.adminProducts, fn);
};

export async function createProduct(body) {
  const p = await api('/products', { method: 'POST', body });
  patchAdminList((list) => [p, ...list]);
  afterWrite();
  return p;
}

export async function updateProduct(id, body) {
  const p = await api(`/products/${id}`, { method: 'PATCH', body });
  patchAdminList((list) => list.map((x) => (x._id === id ? p : x)));
  afterWrite();
  return p;
}

export async function deleteProduct(id) {
  await api(`/products/${id}`, { method: 'DELETE' });
  patchAdminList((list) => list.filter((x) => x._id !== id));
  afterWrite();
}

export async function saveSettings(body) {
  const s = await api('/settings', { method: 'PUT', body });
  queryClient.setQueryData(keys.settings, s);
  return s;
}

/* ── Cloudinary direct upload with progress ───────────────── */
export async function uploadImage(file, onProgress) {
  const sig = await api('/upload-signature', { method: 'POST' });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve({ url: data.secure_url, publicId: data.public_id });
        else reject(new ApiError(data?.error?.message || 'Upload failed.', xhr.status));
      } catch {
        reject(new ApiError('Upload failed.', xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError('Upload failed. Check your connection.', 0));
    xhr.send(form);
  });
}

// React → serverless API (fetch). Small in-memory cache so going "back" renders instantly
// and scroll position is restored.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const KEY_STORAGE = 'swechha_admin_key';

export const adminKey = {
  get: () => {
    try {
      return localStorage.getItem(KEY_STORAGE) || '';
    } catch {
      return '';
    }
  },
  set: (k) => {
    try {
      localStorage.setItem(KEY_STORAGE, k);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const authListeners = new Set();
export const onAuthFailure = (fn) => (authListeners.add(fn), () => authListeners.delete(fn));

export async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-key'] = adminKey.get();
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && admin) authListeners.forEach((fn) => fn());
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}

/* ── tiny cache store ─────────────────────────────────────── */
const store = new Map(); // key → { data, error, loading, at }
const subs = new Set();
const notify = () => subs.forEach((s) => s());
const setEntry = (key, patch) => {
  store.set(key, { ...(store.get(key) || {}), ...patch });
  notify();
};
const inflight = new Map();

function load(key, fetcher, force = false) {
  const entry = store.get(key);
  const fresh = entry?.data !== undefined && Date.now() - entry.at < 60_000;
  if (!force && (fresh || inflight.has(key))) return inflight.get(key);
  setEntry(key, { loading: true, error: null });
  const p = fetcher()
    .then((data) => setEntry(key, { data, loading: false, error: null, at: Date.now() }))
    .catch((error) => setEntry(key, { loading: false, error }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidate(prefix) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
  notify();
}

export function setCached(key, data) {
  setEntry(key, { data, at: Date.now(), loading: false, error: null });
}

function useResource(key, fetcher, enabled = true) {
  const entry = useSyncExternalStore(
    (s) => (subs.add(s), () => subs.delete(s)),
    () => store.get(key)
  );
  useEffect(() => {
    if (enabled && key) load(key, fetcher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  const reload = useCallback(() => load(key, fetcher, true), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    data: entry?.data,
    error: entry?.error || null,
    loading: enabled && (entry?.data === undefined ? !entry?.error : !!entry?.loading),
    reload,
  };
}

/* ── public hooks ─────────────────────────────────────────── */
export const useProducts = () => useResource('products', () => api('/products'));
export const useSettings = () => useResource('settings', () => api('/settings'));

export function useProduct(slug) {
  const list = useProducts();
  const fromList = list.data?.find((p) => p.slug === slug);
  const single = useResource(`product:${slug}`, () => api(`/products/${encodeURIComponent(slug)}`), !fromList && !!slug);
  return fromList ? { data: fromList, loading: false, error: null } : single;
}

/* ── admin hooks ──────────────────────────────────────────── */
export const useAdminProducts = () => useResource('admin:products', () => api('/products?all=1', { admin: true }));

export function useAdminProduct(id) {
  const list = useAdminProducts();
  const fromList = list.data?.find((p) => p._id === id);
  const single = useResource(`admin:product:${id}`, () => api(`/products/${id}`, { admin: true }), !fromList && !!id && !list.loading);
  return fromList ? { data: fromList, loading: false, error: null } : { ...single, loading: single.loading || list.loading };
}

function afterWrite() {
  invalidate('products');
  invalidate('product:');
}

export async function createProduct(body) {
  const p = await api('/products', { method: 'POST', body, admin: true });
  const list = store.get('admin:products')?.data;
  if (list) setCached('admin:products', [p, ...list]);
  afterWrite();
  return p;
}

export async function updateProduct(id, body) {
  const p = await api(`/products/${id}`, { method: 'PATCH', body, admin: true });
  const list = store.get('admin:products')?.data;
  if (list) setCached('admin:products', list.map((x) => (x._id === id ? p : x)));
  afterWrite();
  return p;
}

export async function deleteProduct(id) {
  await api(`/products/${id}`, { method: 'DELETE', admin: true });
  const list = store.get('admin:products')?.data;
  if (list) setCached('admin:products', list.filter((x) => x._id !== id));
  afterWrite();
}

export async function saveSettings(body) {
  const s = await api('/settings', { method: 'PUT', body, admin: true });
  setCached('settings', s);
  return s;
}

/* ── Cloudinary direct upload with progress ───────────────── */
export async function uploadImage(file, onProgress) {
  const sig = await api('/upload-signature', { method: 'POST', admin: true });
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

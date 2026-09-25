// React → Express API (fetch) with TanStack Query caching, so going "back" renders instantly
// and scroll position is restored. Hooks keep the old { data, error, loading, reload } shape.
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './queryClient';

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
    // Relative URL: Vite proxies /api in dev, Vercel rewrites it to Render in production.
    // credentials: 'include' so the login cookie from Phase 1 is sent.
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
  if (!res.ok) {
    if (res.status === 401 && admin) authListeners.forEach((fn) => fn());
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}

/* ── query keys ───────────────────────────────────────────── */
export const keys = {
  products: ['products'],
  product: (slug) => ['product', slug],
  settings: ['settings'],
  adminProducts: ['admin', 'products'],
  adminProduct: (id) => ['admin', 'product', id],
};

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

/* ── admin hooks ──────────────────────────────────────────── */
export const useAdminProducts = () => useResource(keys.adminProducts, () => api('/products?all=1', { admin: true }));

export function useAdminProduct(id) {
  const list = useAdminProducts();
  const fromList = list.data?.find((p) => p._id === id);
  const single = useResource(keys.adminProduct(id), () => api(`/products/${id}`, { admin: true }), !fromList && !!id && !list.loading);
  return fromList ? { data: fromList, loading: false, error: null } : { ...single, loading: single.loading || list.loading };
}

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
  const p = await api('/products', { method: 'POST', body, admin: true });
  patchAdminList((list) => [p, ...list]);
  afterWrite();
  return p;
}

export async function updateProduct(id, body) {
  const p = await api(`/products/${id}`, { method: 'PATCH', body, admin: true });
  patchAdminList((list) => list.map((x) => (x._id === id ? p : x)));
  afterWrite();
  return p;
}

export async function deleteProduct(id) {
  await api(`/products/${id}`, { method: 'DELETE', admin: true });
  patchAdminList((list) => list.filter((x) => x._id !== id));
  afterWrite();
}

export async function saveSettings(body) {
  const s = await api('/settings', { method: 'PUT', body, admin: true });
  queryClient.setQueryData(keys.settings, s);
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

// React → Express API (fetch) with TanStack Query caching, so going "back" renders instantly
// and scroll position is restored. Hooks keep the old { data, error, loading, reload } shape.
// Sign-in uses httpOnly cookies set by the API; nothing about the session is stored in JavaScript.
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
  home: ['home'],
  catalog: (qs) => ['catalog', qs],
  catalogCount: (qs) => ['catalog-count', qs],
  product: (slug) => ['product', slug],
  related: (slug) => ['related', slug],
  suggest: (q) => ['suggest', q],
  settings: ['settings'],
  me: ['me'],
  addresses: ['me', 'addresses'],
  wishlist: ['me', 'wishlist'],
  bag: ['me', 'bag'],
  orders: (page) => ['me', 'orders', page],
  order: (n) => ['me', 'order', n],
  pincode: (pin) => ['pincode', pin],
  adminOrders: (qs) => ['admin', 'orders', qs],
  adminOrder: (id) => ['admin', 'order', id],
  sales: (range) => ['admin', 'sales', range],
  coupons: ['admin', 'coupons'],
  customers: (qs) => ['admin', 'customers', qs],
  customer: (id) => ['admin', 'customer', id],
  shopRules: ['admin', 'shop'],
  audit: (page) => ['admin', 'audit', page],
  adminList: (qs) => ['admin', 'products', qs],
  adminProduct: (id) => ['admin', 'product', id],
  adminOptions: ['admin', 'options'],
  adminStats: ['admin', 'stats'],
  team: ['admin', 'team'],
};

/* ── session helpers (used by lib/auth.jsx too) ───────────── */
/** Drops everything that belongs to one person (account, admin data). */
export function clearUserQueries() {
  queryClient.removeQueries({ queryKey: ['admin'] });
  queryClient.removeQueries({ queryKey: keys.addresses });
  queryClient.removeQueries({ queryKey: keys.wishlist });
  queryClient.removeQueries({ queryKey: ['me'], predicate: (q) => q.queryKey.length > 1 });
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

/* ── public catalogue ─────────────────────────────────────── */
export const useSettings = () => useResource(keys.settings, () => api('/settings'));

/** Home page in one request: { newArrivals, featured, categories: [{ key, count, cover }] }. */
export const useHome = () => useResource(keys.home, () => api('/home'));

export const useProduct = (slug) => useResource(keys.product(slug), () => api(`/products/${encodeURIComponent(slug)}`), !!slug);

export const useRelated = (slug) =>
  useResource(keys.related(slug), () => api(`/products/${encodeURIComponent(slug)}/related`).then((d) => d.items), !!slug);

/** Search-box suggestions (2+ characters). Keeps the previous result on screen while typing. */
export function useSuggest(term) {
  const q = (term || '').trim();
  const r = useQuery({
    queryKey: keys.suggest(q.toLowerCase()),
    queryFn: () => api(`/search/suggest?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  return { data: q.length >= 2 ? r.data : undefined, loading: r.isFetching };
}

/** Query string for /api/products from a plain object (empty values dropped, stable order). */
export const catalogQs = (params) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
      .sort(([a], [b]) => a.localeCompare(b))
  ).toString();

/**
 * Infinite product list for the collection page. Pages stay cached, so coming back from a product
 * shows the same items (and ScrollRestoration puts you where you were).
 */
export function useCatalog(params) {
  const qs = catalogQs(params);
  const q = useInfiniteQuery({
    queryKey: keys.catalog(qs),
    queryFn: ({ pageParam }) => api(`/products?${qs ? `${qs}&` : ''}page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const pages = q.data?.pages || [];
  return {
    items: pages.flatMap((p) => p.items),
    total: pages[0]?.total,
    facets: pages[0]?.facets,
    loading: q.isPending,
    error: q.error || null,
    reload: q.refetch,
    fetchNext: q.fetchNextPage,
    hasMore: Boolean(q.hasNextPage),
    loadingMore: q.isFetchingNextPage,
  };
}

/** Result count + facets for filters that are not applied yet (the filter sheet's "Show N designs"). */
export function useCatalogCount(params, enabled = true) {
  const qs = catalogQs({ ...params, limit: 1 });
  const q = useQuery({
    queryKey: keys.catalogCount(qs),
    queryFn: () => api(`/products?${qs}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return { total: q.data?.total, facets: q.data?.facets, loading: q.isFetching };
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
/** Paginated admin product list (infinite). params: q, category, status, stock, sort. */
export function useAdminProductList(params) {
  const qs = catalogQs(params);
  const q = useInfiniteQuery({
    queryKey: keys.adminList(qs),
    queryFn: ({ pageParam }) => api(`/admin/products?${qs ? `${qs}&` : ''}page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const pages = q.data?.pages || [];
  return {
    items: pages.flatMap((p) => p.items),
    total: pages[0]?.total,
    loading: q.isPending,
    error: q.error || null,
    reload: q.refetch,
    fetchNext: q.fetchNextPage,
    hasMore: Boolean(q.hasNextPage),
    loadingMore: q.isFetchingNextPage,
  };
}

/** Dashboard numbers + needs-attention + recently added, and the header's alert count. */
export const useAdminStats = () => useResource(keys.adminStats, () => api('/admin/stats'));

/** Full product (incl. drafts and admin fields) for the edit form. */
export const useAdminProduct = (id) => useResource(keys.adminProduct(id), () => api(`/admin/products/${id}`), !!id);

/** Up to 100 products (by name) for pickers such as "colour opens product". */
export const useAdminProductOptions = () =>
  useResource(keys.adminOptions, () => api('/admin/products?limit=100&sort=name').then((d) => d.items));

export const useTeam = (enabled = true) => useResource(keys.team, () => api('/admin/team').then((d) => d.team), enabled);
const refreshTeam = (data) => {
  queryClient.invalidateQueries({ queryKey: keys.team });
  return data;
};
export const addTeamMember = (email, role) => api('/admin/team', { method: 'POST', body: { email, role } }).then(refreshTeam);
export const changeTeamRole = (userId, role) => api(`/admin/team/${userId}`, { method: 'PATCH', body: { role } }).then(refreshTeam);
export const removeTeamMember = (userId) => api(`/admin/team/${userId}`, { method: 'DELETE' }).then(refreshTeam);

/* ── mutations ────────────────────────────────────────────── */
// After a catalogue write: public caches are dropped (fresh data next time), admin views refetch.
function afterWrite(product) {
  for (const key of [['home'], ['catalog'], ['catalog-count'], ['product'], ['related'], ['suggest']]) {
    queryClient.removeQueries({ queryKey: key });
  }
  if (product?._id) queryClient.setQueryData(keys.adminProduct(product._id), (old) => (old ? { ...old, ...product } : product));
  queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
  queryClient.invalidateQueries({ queryKey: keys.adminStats });
  queryClient.invalidateQueries({ queryKey: keys.adminOptions });
}

export async function createProduct(body) {
  const p = await api('/products', { method: 'POST', body });
  afterWrite(p);
  return p;
}

export async function updateProduct(id, body) {
  const p = await api(`/products/${id}`, { method: 'PATCH', body });
  afterWrite(p);
  return p;
}

export async function deleteProduct(id) {
  await api(`/products/${id}`, { method: 'DELETE' });
  queryClient.removeQueries({ queryKey: keys.adminProduct(id) });
  afterWrite();
}

/** Stock per size (stock − reserved rules are checked on the server). */
export async function updateStock(id, sizes) {
  const p = await api(`/admin/products/${id}/stock`, { method: 'PATCH', body: { sizes } });
  afterWrite(p);
  return p;
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

/* ── checkout and orders (Phases 3–7) ─────────────────────── */
/** Live checkout quote: totals, delivery, COD/online availability and every problem to fix before ordering. */
export const fetchQuote = (body) => api('/checkout/quote', { method: 'POST', body });

/** Places the order. `idempotencyKey` must stay the same for retries of one checkout. Returns { order, payment? }. */
export async function placeOrder(body) {
  const out = await api('/orders', { method: 'POST', body });
  queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
  queryClient.invalidateQueries({ queryKey: keys.bag });
  return out;
}

export const useMyOrders = (page = 1) => useResource(keys.orders(page), () => api(`/orders?page=${page}`));
export const useMyOrder = (orderNumber) => useResource(keys.order(orderNumber), () => api(`/orders/${orderNumber}`), !!orderNumber);

const saveOrder = (order) => {
  queryClient.setQueryData(keys.order(order.orderNumber), order);
  queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
  queryClient.invalidateQueries({ queryKey: keys.bag });
  return order;
};
export const cancelMyOrder = (n, reason) => api(`/orders/${n}/cancel`, { method: 'POST', body: { reason } }).then(saveOrder);
export const requestReturn = (n, body) => api(`/orders/${n}/returns`, { method: 'POST', body }).then(saveOrder);
export const retryPayment = (n) => api(`/payments/${n}/retry`, { method: 'POST' }).then((d) => d.payment);
export const verifyRazorpay = (body) => api('/payments/razorpay/verify', { method: 'POST', body }).then(saveOrder);
export const mockPay = (n, outcome) => api(`/payments/${n}/mock`, { method: 'POST', body: { outcome } }).then(saveOrder);
export const reportPaymentFailure = (n, reason) => api(`/payments/${n}/failed`, { method: 'POST', body: { reason } }).then(saveOrder);

/** PIN code delivery check: { serviceable, cod, etaDays, etaDate, message? }. */
export const usePincode = (pin) =>
  useResource(keys.pincode(pin), () => api(`/shipping/serviceability?pincode=${encodeURIComponent(pin)}`), /^[1-9]\d{5}$/.test(pin || ''));

/* ── admin commerce (Phase 7) ─────────────────────────────── */
export const useAdminOrders = (params) => {
  const qs = catalogQs(params);
  return useResource(keys.adminOrders(qs), () => api(`/admin/orders?${qs}`));
};
export const useAdminOrder = (id) => useResource(keys.adminOrder(id), () => api(`/admin/orders/${id}`), !!id);

const saveAdminOrder = (o) => {
  queryClient.setQueryData(keys.adminOrder(o._id), o);
  queryClient.setQueryData(keys.adminOrder(o.orderNumber), o);
  queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'sales'] });
  // Stock moved (ship / return / cancel): catalogue numbers are stale.
  queryClient.invalidateQueries({ queryKey: keys.adminStats });
  return o;
};
export const orderAction = (id, action, note) =>
  api(`/admin/orders/${id}/status`, { method: 'POST', body: { action, note } }).then(saveAdminOrder);
export const shipOrder = (id, body) => api(`/admin/orders/${id}/ship`, { method: 'POST', body }).then(saveAdminOrder);
export const adminCancelOrder = (id, reason) =>
  api(`/admin/orders/${id}/cancel`, { method: 'POST', body: { reason } }).then(saveAdminOrder);
export const refundOrder = (id, body) => api(`/admin/orders/${id}/refund`, { method: 'POST', body }).then(saveAdminOrder);
export const returnAction = (id, body) => api(`/admin/orders/${id}/return`, { method: 'POST', body }).then(saveAdminOrder);

export const useSales = (range, enabled = true) => useResource(keys.sales(range), () => api(`/admin/sales?range=${range}`), enabled);

export const useCoupons = () => useResource(keys.coupons, () => api('/admin/coupons'));
const refreshCoupons = (d) => {
  queryClient.invalidateQueries({ queryKey: keys.coupons });
  return d;
};
export const createCoupon = (body) => api('/admin/coupons', { method: 'POST', body }).then(refreshCoupons);
export const updateCoupon = (id, body) => api(`/admin/coupons/${id}`, { method: 'PATCH', body }).then(refreshCoupons);
export const deleteCoupon = (id) => api(`/admin/coupons/${id}`, { method: 'DELETE' }).then(refreshCoupons);

export const useCustomers = (params) => {
  const qs = catalogQs(params);
  return useResource(keys.customers(qs), () => api(`/admin/customers?${qs}`));
};
export const useCustomer = (id) => useResource(keys.customer(id), () => api(`/admin/customers/${id}`), !!id);
export const setCustomerBlocked = (id, isBlocked) =>
  api(`/admin/customers/${id}`, { method: 'PATCH', body: { isBlocked } }).then((c) => {
    queryClient.setQueryData(keys.customer(id), c);
    queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    return c;
  });

export const useShopRules = () => useResource(keys.shopRules, () => api('/admin/shop-settings'));
export const saveShopRules = (body) =>
  api('/admin/shop-settings', { method: 'PUT', body }).then((s) => {
    queryClient.setQueryData(keys.shopRules, s);
    queryClient.invalidateQueries({ queryKey: keys.settings });
    return s;
  });

export const useAudit = (page) => useResource(keys.audit(page), () => api(`/admin/audit?page=${page}`));

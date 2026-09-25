// In-memory stand-in for the Express API, following the same rules (drafts hidden, roles, sign-in, 404s).
import { GOOD_CODE, SETTINGS, USERS } from './fixtures.js';
import * as catalog from './mockCatalog.js';

/**
 * @param user        signed-in user at start (one of USERS) or null
 * @param failProducts make GET /api/products fail with 500
 */
export function createMockApi({ failProducts = false, user = null } = {}) {
  const state = { pending: 0, calls: [], user, addresses: [], team: [USERS.admin, USERS.staff], wishlist: [] };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const staff = () => state.user && ['admin', 'staff'].includes(state.user.role);
  const needStaff = () =>
    !state.user
      ? json(401, { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' })
      : json(403, { error: "You don't have access to this.", code: 'FORBIDDEN' });

  function handle(url, { method = 'GET', body } = {}) {
    const u = new URL(url, 'http://localhost');
    const path = u.pathname;
    const data = body ? JSON.parse(body) : {};

    if (path === '/api/auth/me') return json(200, { user: state.user });
    if (path === '/api/auth/otp/request') {
      if (!/@/.test(data.email || '')) return json(400, { error: 'Enter a valid email address.' });
      return json(200, { ok: true, resendIn: 60, expiresIn: 600 });
    }
    if (path === '/api/auth/otp/verify') {
      if (data.code !== GOOD_CODE) return json(400, { error: "That code isn't right. 4 tries left.", code: 'OTP_WRONG', attemptsLeft: 4 });
      const known = Object.values(USERS).find((x) => x.email === data.email);
      state.user = known || { _id: '64c0000000000000000000ff', email: data.email, name: '', phone: '', role: 'customer' };
      return json(200, { user: state.user, isNew: !known });
    }
    if (path === '/api/auth/logout') {
      state.user = null;
      return json(200, { ok: true });
    }
    if (path === '/api/users/me' && method === 'PATCH') {
      state.user = { ...state.user, ...data };
      return json(200, { user: state.user });
    }
    if (path === '/api/auth/logout-all') {
      state.user = null;
      return json(200, { ok: true });
    }
    if (path.startsWith('/api/users/me/addresses')) {
      if (!state.user) return needStaff();
      const list = () => json(method === 'POST' && path.endsWith('/addresses') ? 201 : 200, { addresses: state.addresses });
      const id = path.split('/')[5];
      if (method === 'POST' && !id) {
        const address = { ...data, _id: `a${state.addresses.length + 1}`, isDefault: data.isDefault || state.addresses.length === 0 };
        if (address.isDefault) state.addresses = state.addresses.map((a) => ({ ...a, isDefault: false }));
        state.addresses = [...state.addresses, address].sort((a, b) => b.isDefault - a.isDefault);
        return list();
      }
      if (method === 'DELETE') state.addresses = state.addresses.filter((a) => a._id !== id);
      if (method === 'PATCH') state.addresses = state.addresses.map((a) => (a._id === id ? { ...a, ...data } : a));
      if (method === 'POST' && path.endsWith('/default'))
        state.addresses = state.addresses.map((a) => ({ ...a, isDefault: a._id === id })).sort((a, b) => b.isDefault - a.isDefault);
      return list();
    }
    if (path === '/api/admin/team') return state.user?.role === 'admin' ? json(200, { team: state.team }) : needStaff();
    if (path === '/api/settings') return json(200, SETTINGS);
    const fail = () => json(500, { error: 'The server could not complete the request. Try again in a moment.' });
    const sp = u.searchParams;
    if (path === '/api/home') return failProducts ? fail() : json(200, catalog.home());
    if (path === '/api/search/suggest') return json(200, catalog.suggest(sp.get('q') || ''));
    if (path === '/api/products' && method === 'GET') return failProducts ? fail() : json(200, catalog.listProducts(sp));
    const rel = path.match(/^\/api\/products\/([^/]+)\/related$/);
    if (rel) {
      const items = catalog.related(decodeURIComponent(rel[1]));
      return items ? json(200, { items }) : json(404, { error: 'Product not found.' });
    }
    const m = path.match(/^\/api\/products\/([^/]+)$/);
    if (m) {
      if (method === 'DELETE') return staff() ? json(200, { deleted: true }) : needStaff();
      const p = catalog.publicProduct(decodeURIComponent(m[1]));
      return p ? json(200, p) : json(404, { error: 'Product not found.' });
    }
    if (path === '/api/admin/products') return staff() ? json(200, catalog.adminList(sp)) : needStaff();
    if (path === '/api/admin/stats') return staff() ? json(200, catalog.adminStats()) : needStaff();
    const adm = path.match(/^\/api\/admin\/products\/([^/]+)(\/stock)?$/);
    if (adm) {
      if (!staff()) return needStaff();
      const p = catalog.adminProduct(adm[1]);
      if (!p) return json(404, { error: 'Product not found.' });
      if (adm[2]) {
        const next = new Map(data.sizes.map((s) => [s.label, s.stock]));
        return json(200, { ...p, sizes: p.sizes.map((s) => (next.has(s.label) ? { ...s, stock: next.get(s.label) } : s)) });
      }
      return json(200, p);
    }
    if (path.startsWith('/api/wishlist')) {
      if (!state.user) return json(401, { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' });
      const all = catalog.shaped();
      if (path === '/api/wishlist/items' && method === 'POST') {
        if (!state.wishlist.includes(data.productId)) state.wishlist.unshift(data.productId);
      } else if (path.startsWith('/api/wishlist/items/') && method === 'DELETE') {
        const id = path.split('/').pop();
        state.wishlist = state.wishlist.filter((x) => x !== id);
      } else if (path === '/api/wishlist/merge') {
        const ids = (data.slugs || []).map((s) => all.find((p) => p.slug === s && p.status === 'published')?._id).filter(Boolean);
        state.wishlist = [...new Set([...ids, ...state.wishlist])];
        state.merged = (state.merged || 0) + 1;
      }
      const items = state.wishlist.map((id) => {
        const p = all.find((x) => x._id === id);
        if (!p) return { _id: id, unavailable: true };
        return p.status === 'published' ? catalog.card(p) : { ...catalog.card(p), unavailable: true };
      });
      return json(200, { items, count: items.length });
    }
    return json(404, { error: 'Unknown API route.' });
  }

  const fetch = async (url, init = {}) => {
    state.calls.push({ url: String(url), ...init });
    state.pending++;
    try {
      await new Promise((r) => setTimeout(r, 5));
      return handle(String(url), init);
    } finally {
      state.pending--;
    }
  };
  return { fetch, state };
}

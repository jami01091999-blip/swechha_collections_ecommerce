// In-memory stand-in for the Express API, following the same rules (drafts hidden, roles, sign-in, 404s).
import { GOOD_CODE, PRODUCTS, SETTINGS, USERS } from './fixtures.js';

/**
 * @param user        signed-in user at start (one of USERS) or null
 * @param failProducts make GET /api/products fail with 500
 */
export function createMockApi({ failProducts = false, user = null } = {}) {
  const state = { pending: 0, calls: [], user, addresses: [], team: [USERS.admin, USERS.staff] };
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
    if (path === '/api/products') {
      if (failProducts) return json(500, { error: 'The server could not complete the request. Try again in a moment.' });
      if (u.searchParams.get('all') === '1') return staff() ? json(200, PRODUCTS) : needStaff();
      return json(
        200,
        PRODUCTS.filter((p) => p.status === 'published')
      );
    }
    const m = path.match(/^\/api\/products\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      const p = PRODUCTS.find((x) => x._id === id || x.slug === id);
      if (!p || (p.status !== 'published' && !staff())) return json(404, { error: 'Product not found.' });
      if (method === 'DELETE') return json(200, { deleted: true });
      return json(200, p);
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

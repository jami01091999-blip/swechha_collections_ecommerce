// In-memory stand-in for the Express API, following the same rules (drafts hidden, admin key, 404s).
import { ADMIN_KEY, PRODUCTS, SETTINGS } from './fixtures.js';

export function createMockApi({ failProducts = false } = {}) {
  const state = { pending: 0, calls: [] };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  function handle(url, { method = 'GET', headers = {} } = {}) {
    const u = new URL(url, 'http://localhost');
    const admin = headers['x-admin-key'] === ADMIN_KEY;
    const path = u.pathname;
    if (path === '/api/admin/verify') return method === 'GET' ? json(200, { required: true }) : json(admin ? 200 : 401, { ok: admin });
    if (path === '/api/settings') return json(200, SETTINGS);
    if (path === '/api/products') {
      if (failProducts) return json(500, { error: 'The server could not complete the request. Try again in a moment.' });
      if (u.searchParams.get('all') === '1') return admin ? json(200, PRODUCTS) : json(401, { error: 'Admin key is missing or incorrect.' });
      return json(200, PRODUCTS.filter((p) => p.status === 'published'));
    }
    const m = path.match(/^\/api\/products\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      const p = PRODUCTS.find((x) => x._id === id || x.slug === id);
      if (!p || (p.status !== 'published' && !admin)) return json(404, { error: 'Product not found.' });
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

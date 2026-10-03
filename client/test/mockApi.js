// In-memory stand-in for the Express API, following the same rules (drafts hidden, roles, sign-in, 404s).
import { GOOD_CODE, SETTINGS, USERS } from './fixtures.js';
import * as catalog from './mockCatalog.js';

/**
 * @param user        signed-in user at start (one of USERS) or null
 * @param failProducts make GET /api/products fail with 500
 */
export function createMockApi({ failProducts = false, user = null } = {}) {
  const state = { pending: 0, calls: [], user, addresses: [], team: [USERS.admin, USERS.staff], wishlist: [], cart: [], orders: [] };
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
    const commerce = handleCommerce(path, method, data, sp);
    if (commerce) return commerce;
    return json(404, { error: 'Unknown API route.' });
  }

  /* ── bag, checkout, orders, admin sales (simplified versions of the real rules) ── */
  function priceLines(lines) {
    const all = catalog.shaped();
    const items = lines.map((l) => {
      const p = all.find((x) => x._id === l.productId && x.status === 'published');
      if (!p)
        return {
          _id: l._id || l.key,
          productId: l.productId,
          size: l.size,
          qty: l.qty,
          name: 'This design',
          status: 'unavailable',
          message: 'No longer available',
          buyQty: 0,
          price: 0,
          lineTotal: 0,
        };
      const row = p.sizes.find((s) => s.label === l.size);
      const left = row ? row.stock - (row.reserved || 0) : 0;
      const base = {
        _id: l._id || l.key,
        productId: p._id,
        slug: p.slug,
        name: p.name,
        fabric: p.fabric,
        image: p.images?.[0]?.url || '',
        size: l.size,
        sizeLabel: l.size === 'FREE' ? 'Free Size' : l.size,
        qty: l.qty,
        price: p.price,
        mrp: p.mrp || p.price,
        sku: row?.sku,
        sizes: p.sizes.map((s) => ({
          label: s.label,
          sizeLabel: s.label === 'FREE' ? 'Free Size' : s.label,
          available: s.stock - (s.reserved || 0),
        })),
      };
      if (left <= 0) return { ...base, status: 'out_of_stock', message: 'Sold out', buyQty: 0, lineTotal: 0, available: 0, maxQty: 0 };
      const maxQty = Math.min(5, left);
      const buyQty = Math.min(l.qty, maxQty);
      return {
        ...base,
        status: buyQty < l.qty ? 'qty_reduced' : 'ok',
        message: buyQty < l.qty ? `Only ${left} left` : '',
        buyQty,
        available: left,
        maxQty,
        lineTotal: p.price * buyQty,
      };
    });
    const ok = items.filter((i) => i.status === 'ok' || i.status === 'qty_reduced');
    const subtotal = ok.reduce((s, i) => s + i.price * i.buyQty, 0);
    const mrpTotal = ok.reduce((s, i) => s + i.mrp * i.buyQty, 0);
    return {
      items,
      summary: {
        itemCount: ok.reduce((s, i) => s + i.buyQty, 0),
        lineCount: items.length,
        subtotal,
        mrpTotal,
        savings: mrpTotal - subtotal,
      },
    };
  }
  const authRequired = () => json(401, { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' });

  function handleCommerce(path, method, data, sp) {
    if (path === '/api/cart/preview') return json(200, priceLines(data.items || []));
    if (path.startsWith('/api/cart')) {
      if (!state.user) return authRequired();
      if (path === '/api/cart/items' && method === 'POST') {
        const ex = state.cart.find((l) => l.productId === data.productId && l.size === data.size);
        if (ex) ex.qty += data.qty || 1;
        else state.cart.unshift({ _id: `c${state.cart.length + 1}`, productId: data.productId, size: data.size, qty: data.qty || 1 });
      } else if (path === '/api/cart/merge') {
        for (const l of data.items || []) state.cart.unshift({ _id: `c${state.cart.length + 1}`, ...l });
      } else if (path.startsWith('/api/cart/items/') && method === 'DELETE') {
        const id = path.split('/').pop();
        state.cart = state.cart.filter((l) => l._id !== id);
      } else if (path.startsWith('/api/cart/items/') && method === 'PATCH') {
        const id = path.split('/').pop();
        state.cart = state.cart.map((l) => (l._id === id ? { ...l, ...data } : l));
      } else if (path === '/api/cart' && method === 'DELETE') state.cart = [];
      return json(200, priceLines(state.cart));
    }
    if (path === '/api/shipping/serviceability')
      return json(200, { serviceable: true, cod: true, etaDays: { min: 3, max: 5 }, etaDate: '2026-10-05' });
    if (path === '/api/checkout/quote' || (path === '/api/orders' && method === 'POST')) {
      if (!state.user) return authRequired();
      const lines = data.source === 'buy_now' ? [{ _id: 'b', ...data.item }] : state.cart;
      if (!lines.length) return json(400, { error: 'Your bag is empty.', code: 'EMPTY_BAG' });
      const { items, summary } = priceLines(lines);
      const shipping = summary.subtotal >= 1999 ? 0 : 99;
      const codFee = data.paymentMethod === 'cod' ? 49 : 0;
      const address = state.addresses.find((a) => a._id === data.addressId) || null;
      const pricing = {
        subtotal: summary.subtotal,
        mrpTotal: summary.mrpTotal,
        discount: 0,
        couponCode: '',
        shipping,
        codFee,
        total: summary.subtotal + shipping + codFee,
        taxTotal: 0,
        savings: summary.savings,
      };
      const quote = {
        source: data.source,
        lines: items,
        pricing,
        coupon: null,
        address,
        delivery: address ? { serviceable: true, cod: true, etaDays: { min: 3, max: 5 }, etaDate: '2026-10-05' } : null,
        payment: {
          method: data.paymentMethod || null,
          cod: { available: true, fee: 49 },
          online: { available: true, provider: 'mock', testMode: true },
        },
        shop: { freeShippingAbove: 1999, returnWindowDays: 7 },
        problems: [],
        canPlace: Boolean(address && data.paymentMethod),
      };
      if (path === '/api/checkout/quote') return json(200, quote);
      const order = {
        _id: `o${state.orders.length + 1}`,
        orderNumber: `SW-2026-00000${state.orders.length + 1}`,
        placedAt: '2026-09-30T10:00:00.000Z',
        status: data.paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
        items: items.map((i) => ({ ...i, _id: `i${i._id}`, qty: i.buyQty })),
        address,
        pricing,
        payment: {
          method: data.paymentMethod,
          status: data.paymentMethod === 'cod' ? 'cod_pending' : 'pending',
          refundedTotal: 0,
          refunds: [],
        },
        statusHistory: [{ status: 'confirmed', at: '2026-09-30T10:00:00.000Z', note: 'Order placed' }],
        canCancel: true,
        canPay: data.paymentMethod !== 'cod',
        canReturn: false,
        invoiceAvailable: data.paymentMethod === 'cod',
      };
      state.orders.unshift(order);
      if (data.source === 'cart') state.cart = [];
      return json(
        201,
        data.paymentMethod === 'cod'
          ? { order }
          : {
              order,
              payment: { provider: 'mock', orderNumber: order.orderNumber, amount: pricing.total * 100, currency: 'INR', testMode: true },
            }
      );
    }
    if (path === '/api/orders' && method === 'GET') {
      if (!state.user) return authRequired();
      const items = state.orders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        placedAt: o.placedAt,
        status: o.status,
        total: o.pricing.total,
        payment: o.payment,
        itemCount: o.items.length,
        items: o.items,
        canPay: o.canPay,
      }));
      return json(200, { items, page: 1, limit: 10, total: items.length, totalPages: 1 });
    }
    const om = path.match(/^\/api\/orders\/([^/]+)$/);
    if (om) {
      const o = state.orders.find((x) => x.orderNumber === om[1]);
      return o ? json(200, o) : json(404, { error: 'Order not found.' });
    }
    if (path === '/api/admin/sales') {
      if (state.user?.role !== 'admin') return needStaff();
      return json(200, {
        range: sp.get('range') || '7d',
        orders: 0,
        revenue: 0,
        averageOrder: 0,
        cod: 0,
        online: 0,
        series: [],
        topProducts: [],
        queue: { toPack: 0, toShip: 0, inTransit: 0, returnsOpen: 0, codOutstanding: 0 },
      });
    }
    return null;
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

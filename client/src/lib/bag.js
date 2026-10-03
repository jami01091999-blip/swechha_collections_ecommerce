// The shopping bag, one API for guests and signed-in customers (same pattern as lib/wishlist.js):
//   guests    → lines kept on this device (localStorage), priced live by POST /api/cart/preview
//   signed in → the account's bag on the server (follows them to every device)
// At sign-in the device bag is merged into the account once, then cleared.
// Prices, stock and totals always come from the server; the device only remembers what was chosen.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, keys } from './api';
import { queryClient } from './queryClient';
import { useAuth } from './auth';

const KEY = 'swechha_bag';
const MAX_LINES = 20;
const listeners = new Set();

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list)
      ? list.filter((l) => l && typeof l.productId === 'string' && typeof l.size === 'string' && l.qty > 0).slice(0, MAX_LINES)
      : [];
  } catch {
    return [];
  }
}
let local = read();

function writeLocal(next) {
  local = next;
  try {
    if (next.length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

const useLocalLines = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => local
  );

const lineKey = (productId, size) => `${productId}:${size}`;
const EMPTY = { items: [], summary: { itemCount: 0, lineCount: 0, subtotal: 0, mrpTotal: 0, savings: 0 } };

/**
 * useBag() → { items, summary, count, loading, error, signedIn, add, setQty, setSize, remove, clear, reload }
 * Every mutation throws an ApiError with a customer-readable message (e.g. "Only 1 left in M.").
 */
export function useBag() {
  const { user, loading: authLoading } = useAuth();
  const lines = useLocalLines();
  const server = useQuery({ queryKey: keys.bag, queryFn: () => api('/cart'), enabled: Boolean(user), staleTime: 30_000 });
  const preview = useQuery({
    queryKey: ['bag-preview', lines],
    queryFn: () =>
      api('/cart/preview', {
        method: 'POST',
        body: { items: lines.map((l) => ({ key: lineKey(l.productId, l.size), productId: l.productId, size: l.size, qty: l.qty })) },
      }),
    enabled: !user && !authLoading && lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = user ? server.data : lines.length ? preview.data : EMPTY;
  const setServer = (d) => queryClient.setQueryData(keys.bag, d);

  async function add(product, size, qty = 1) {
    if (user) return setServer(await api('/cart/items', { method: 'POST', body: { productId: product._id, size, qty } }));
    // Guests: check stock with the server before remembering the line.
    const existing = lines.find((l) => l.productId === product._id && l.size === size);
    const wanted = (existing?.qty || 0) + qty;
    const res = await api('/cart/preview', { method: 'POST', body: { items: [{ key: 'x', productId: product._id, size, qty: wanted }] } });
    const line = res.items[0];
    if (line.status === 'out_of_stock' || line.status === 'unavailable')
      throw new Error(line.status === 'out_of_stock' ? `${line.sizeLabel} is sold out.` : 'This design is no longer available.');
    if (line.status === 'qty_reduced')
      throw new Error(
        line.message.startsWith('Up to') ? `You can buy ${line.message.toLowerCase()}.` : `${line.message} in ${line.sizeLabel}.`
      );
    if (!existing && lines.length >= MAX_LINES) throw new Error(`Your bag can hold up to ${MAX_LINES} different items.`);
    writeLocal(
      existing
        ? lines.map((l) => (l === existing ? { ...l, qty: wanted } : l))
        : [{ productId: product._id, slug: product.slug, size, qty }, ...lines]
    );
    return null;
  }

  async function change(line, patch) {
    if (user) return setServer(await api(`/cart/items/${line._id}`, { method: 'PATCH', body: patch }));
    const [productId, size] = line._id.split(':');
    const target = patch.size ?? size;
    const qty = patch.qty ?? line.qty;
    const res = await api('/cart/preview', { method: 'POST', body: { items: [{ key: 'x', productId, size: target, qty }] } });
    const priced = res.items[0];
    if (priced.status !== 'ok')
      throw new Error(priced.status === 'out_of_stock' ? 'That size is sold out.' : priced.message || 'Not available.');
    const others = lines.filter((l) => !(l.productId === productId && l.size === size));
    const twin = others.find((l) => l.productId === productId && l.size === target);
    writeLocal(
      twin
        ? others.map((l) => (l === twin ? { ...l, qty: l.qty + qty } : l))
        : [...lines.map((l) => (l.productId === productId && l.size === size ? { ...l, size: target, qty } : l))]
    );
    return null;
  }

  async function remove(line) {
    if (user) return setServer(await api(`/cart/items/${line._id}`, { method: 'DELETE' }));
    const [productId, size] = line._id.split(':');
    writeLocal(lines.filter((l) => !(l.productId === productId && l.size === size)));
    return null;
  }

  async function clear() {
    if (user) return setServer(await api('/cart', { method: 'DELETE' }));
    writeLocal([]);
    return null;
  }

  const summary = data?.summary || EMPTY.summary;
  return {
    items: data?.items || [],
    summary,
    // Badge: what the customer put in the bag (including lines that need attention).
    count: user ? (data?.items || []).reduce((s, l) => s + l.qty, 0) : lines.reduce((s, l) => s + l.qty, 0),
    loading: user ? server.isPending : lines.length > 0 && preview.isPending,
    error: (user ? server.error : preview.error) || null,
    reload: user ? server.refetch : preview.refetch,
    signedIn: Boolean(user),
    add,
    setQty: (line, qty) => change(line, { qty }),
    setSize: (line, size) => change(line, { size }),
    remove,
    clear,
  };
}

/** Mounted once at the app root: moves the device bag into the account after sign-in. */
export function BagSync() {
  const { user } = useAuth();
  const mergedFor = useRef(null);
  useEffect(() => {
    if (!user) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === user._id) return;
    mergedFor.current = user._id;
    const lines = read();
    if (!lines.length) return;
    api('/cart/merge', { method: 'POST', body: { items: lines.map(({ productId, size, qty }) => ({ productId, size, qty })) } })
      .then((data) => {
        queryClient.setQueryData(keys.bag, data);
        writeLocal([]);
      })
      .catch(() => {
        mergedFor.current = null;
      });
  }, [user]);
  return null;
}

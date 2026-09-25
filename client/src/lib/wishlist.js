// Saved designs ("wishlist"), one API for guests and signed-in customers:
//   guests      → slugs in localStorage on this device
//   signed in   → the account's list on the server (follows them to every device)
// On sign-in the device's slugs are merged into the account once, then cleared.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, keys } from './api';
import { queryClient } from './queryClient';
import { useAuth } from './auth';
import { useToast } from '../context/Toast';

/* ── guest store (localStorage) ───────────────────────────── */
const KEY = 'swechha_saved';
const listeners = new Set();

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
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
    /* storage full or blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

const useLocalSlugs = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => local
  );

/* ── server list ──────────────────────────────────────────── */
export const fetchWishlist = () => api('/wishlist');

/** Card shape used in the cached list while a save is on its way to the server. */
const cardOf = (p) => ({
  _id: p._id,
  slug: p.slug,
  name: p.name,
  fabric: p.fabric,
  price: p.price,
  mrp: p.mrp,
  discountPercent: p.discountPercent,
  badge: p.badge,
  inStock: p.inStock,
  category: p.category,
  images: (p.images || []).slice(0, 1),
  addedAt: new Date().toISOString(),
});

/**
 * useSaved() → { count, isSaved(product), toggle(product), items, loading, signedIn, localSlugs }
 * `items` are server cards for signed-in users (may include { unavailable: true }); guests get `localSlugs`.
 */
export function useSaved() {
  const { user } = useAuth();
  const toast = useToast();
  const slugs = useLocalSlugs();
  const q = useQuery({ queryKey: keys.wishlist, queryFn: fetchWishlist, enabled: Boolean(user), staleTime: 60_000 });
  const items = user ? q.data?.items || [] : [];

  const isSaved = (p) => (user ? items.some((i) => i._id === p?._id) : slugs.includes(p?.slug));

  const toggle = async (p) => {
    if (!user) {
      writeLocal(slugs.includes(p.slug) ? slugs.filter((s) => s !== p.slug) : [p.slug, ...slugs]);
      return;
    }
    const saved = isSaved(p);
    const before = queryClient.getQueryData(keys.wishlist);
    // Optimistic: update the heart immediately, roll back if the server says no.
    queryClient.setQueryData(keys.wishlist, (old) => {
      const list = old?.items || [];
      const next = saved ? list.filter((i) => i._id !== p._id) : [cardOf(p), ...list];
      return { items: next, count: next.length };
    });
    try {
      const fresh = saved
        ? await api(`/wishlist/items/${p._id}`, { method: 'DELETE' })
        : await api('/wishlist/items', { method: 'POST', body: { productId: p._id } });
      queryClient.setQueryData(keys.wishlist, fresh);
    } catch (e) {
      queryClient.setQueryData(keys.wishlist, before);
      toast(e.status === 0 ? e.message : saved ? "Couldn't remove it. Try again." : "Couldn't save it. Try again.");
    }
  };

  return {
    signedIn: Boolean(user),
    count: user ? (q.data?.count ?? items.length) : slugs.length,
    items,
    localSlugs: slugs,
    loading: user ? q.isPending : false,
    error: q.error || null,
    reload: q.refetch,
    isSaved,
    toggle,
  };
}

/** Remove one saved item by id (e.g. "No longer available" rows). */
export async function removeSaved(productId) {
  const fresh = await api(`/wishlist/items/${productId}`, { method: 'DELETE' });
  queryClient.setQueryData(keys.wishlist, fresh);
}

/**
 * Mounted once at the app root: when someone signs in and this device has saved slugs,
 * merge them into the account (once per sign-in) and clear the device list.
 */
export function WishlistSync() {
  const { user } = useAuth();
  const mergedFor = useRef(null);
  useEffect(() => {
    if (!user) {
      mergedFor.current = null; // signed out: a later sign-in merges any new guest saves
      return;
    }
    if (mergedFor.current === user._id) return;
    mergedFor.current = user._id;
    const slugs = read();
    if (!slugs.length) return;
    api('/wishlist/merge', { method: 'POST', body: { slugs } })
      .then((data) => {
        queryClient.setQueryData(keys.wishlist, data);
        writeLocal([]);
      })
      .catch(() => {
        // Keep the device list; the next sign-in tries again.
        mergedFor.current = null;
      });
  }, [user]);
  return null;
}

// Who is signed in, for the whole app. The session itself lives in httpOnly cookies set by the API.
import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMe, keys } from './api';
import { Spinner } from '../components/ui';

/** The signed-in user (or null). Fetched once per visit and updated by login/logout/refresh. */
export function useMe() {
  const q = useQuery({ queryKey: keys.me, queryFn: fetchMe, staleTime: 5 * 60 * 1000 });
  return { user: q.data ?? null, loading: q.isPending, error: q.error || null };
}

const AuthContext = createContext({ user: null, loading: true, error: null });

export function AuthProvider({ children }) {
  const me = useMe();
  return <AuthContext.Provider value={me}>{children}</AuthContext.Provider>;
}

/** { user, loading, error } — user is null for guests. */
export const useAuth = () => useContext(AuthContext);

export const isStaff = (user) => user?.role === 'admin' || user?.role === 'staff';
export const isAdmin = (user) => user?.role === 'admin';

/**
 * Where to go after signing in. Only same-site paths are allowed ("/account", "/adminDivya/products"),
 * never "//evil.com", "/\evil.com" or absolute URLs, so the login page can't be used to redirect elsewhere.
 */
export function safeNext(next, fallback = '/account') {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.startsWith('/\\') || [...next].some((c) => c.charCodeAt(0) < 32)) return fallback;
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return fallback;
  return next;
}

export const loginPath = (location) => `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

export function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center px-gutter-mobile py-16">
      <Spinner />
    </div>
  );
}

/** Sends guests to /login?next=… and brings them back afterwards. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={loginPath(location)} replace />;
  return children;
}

import { QueryClient } from '@tanstack/react-query';

// Matches the old hand-written cache: data is fresh for 60s, kept for the whole visit (so going
// "back" renders instantly and scroll position is restored), no automatic retries or focus refetches.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: false },
  },
});

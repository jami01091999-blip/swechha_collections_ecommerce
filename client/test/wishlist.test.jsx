import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { GOOD_CODE, USERS } from './fixtures.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

let mock;
async function settle() {
  let last = '';
  for (let stable = 0, i = 0; stable < 3 && i < 300; i++) {
    await act(() => new Promise((r) => setTimeout(r, 15)));
    const html = document.body.innerHTML;
    const idle = mock?.state.pending === 0 && !document.querySelector('.animate-spin');
    stable = idle && html === last ? stable + 1 : 0;
    last = html;
  }
}

async function renderAt(path, { user = null, wrapFetch, wishlist } = {}) {
  vi.resetModules();
  mock = createMockApi({ user });
  if (wishlist) mock.state.wishlist = wishlist;
  vi.stubGlobal('fetch', wrapFetch ? wrapFetch(mock.fetch) : mock.fetch);
  const { routes } = await import('../src/App.jsx');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await settle();
  return router;
}

const heart = () => screen.getAllByRole('button', { name: /Save Noor Kurta Set|Remove Noor Kurta Set from saved designs/ })[0];
const savedLink = () => screen.getAllByRole('link', { name: /^Saved designs/ })[0];

describe('saved designs', () => {
  it('guests save on this device; the header count and /saved follow', async () => {
    const router = await renderAt('/product/noor-kurta-set');
    fireEvent.click(heart());
    await settle();
    expect(JSON.parse(localStorage.getItem('swechha_saved'))).toEqual(['noor-kurta-set']);
    expect(heart().getAttribute('aria-pressed')).toBe('true');
    await act(() => router.navigate('/saved'));
    await settle();
    expect(screen.getByText('Log in to keep your saved designs on every device.')).toBeTruthy();
    expect(screen.getAllByText('Noor Kurta Set').length).toBeGreaterThan(0);
    expect(savedLink().getAttribute('aria-label')).toBe('Saved designs (1)');
  });

  it('signing in merges the device list once, then clears it', async () => {
    localStorage.setItem('swechha_saved', JSON.stringify(['noor-kurta-set', 'gulmohar-silk-saree']));
    const router = await renderAt('/login?next=%2Fsaved');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: USERS.customer.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await settle();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: GOOD_CODE } });
    await settle();
    expect(router.state.location.pathname).toBe('/saved');
    expect(mock.state.merged).toBe(1);
    expect(mock.state.wishlist).toHaveLength(2);
    expect(localStorage.getItem('swechha_saved')).toBeNull();
    expect(screen.queryByText('Log in to keep your saved designs on every device.')).toBeNull();
    // Navigating around doesn't merge again.
    await act(() => router.navigate('/'));
    await settle();
    await act(() => router.navigate('/saved'));
    await settle();
    expect(mock.state.merged).toBe(1);
  });

  it('signed-in hearts update at once and roll back with a message when the server fails', async () => {
    let failSaves = false;
    const wrap = (inner) => async (url, init) => {
      if (failSaves && String(url) === '/api/wishlist/items') {
        await new Promise((r) => setTimeout(r, 20)); // like a slow network
        return new Response(JSON.stringify({ error: 'Server is busy' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return inner(url, init);
    };
    await renderAt('/product/noor-kurta-set', { user: USERS.customer, wrapFetch: wrap });
    fireEvent.click(heart());
    await act(() => new Promise((r) => setTimeout(r, 1)));
    expect(heart().getAttribute('aria-pressed')).toBe('true'); // optimistic, before the server answers
    await settle();
    expect(mock.state.wishlist).toHaveLength(1);
    fireEvent.click(heart()); // unsave
    await settle();
    expect(mock.state.wishlist).toHaveLength(0);
    failSaves = true;
    fireEvent.click(heart());
    await act(() => new Promise((r) => setTimeout(r, 1)));
    expect(heart().getAttribute('aria-pressed')).toBe('true');
    await settle();
    expect(heart().getAttribute('aria-pressed')).toBe('false'); // rolled back
    expect(screen.getByText("Couldn't save it. Try again.")).toBeTruthy();
  });

  it('designs no longer available can be removed', async () => {
    await renderAt('/saved', { user: USERS.customer, wishlist: ['64b000000000000000000004', 'deleted-id'] });
    expect(screen.getAllByText('No longer available')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await settle();
    expect(screen.getAllByText('No longer available')).toHaveLength(1);
  });

  it('account shows the saved count', async () => {
    await renderAt('/account', { user: USERS.customer });
    expect(screen.getByText('Saved designs (0)')).toBeTruthy();
  });
});

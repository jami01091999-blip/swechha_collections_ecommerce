import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { GOOD_CODE, USERS } from './fixtures.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let current;
/** Waits until the mock API is idle and the page stops changing. */
async function tick() {
  let last = '';
  for (let stable = 0, i = 0; stable < 3 && i < 300; i++) {
    await act(() => new Promise((r) => setTimeout(r, 15)));
    const html = document.body.innerHTML;
    stable = (current?.state.pending ?? 0) === 0 && html === last ? stable + 1 : 0;
    last = html;
  }
}

describe('safeNext', () => {
  it('allows same-site paths only', async () => {
    const { safeNext } = await import('../src/lib/auth.jsx');
    expect(safeNext('/adminDivya/products?x=1')).toBe('/adminDivya/products?x=1');
    expect(safeNext('/collection')).toBe('/collection');
    for (const bad of [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'http://evil.com/x',
      'javascript:alert(1)',
      'evil.com',
      '',
      null,
      undefined,
      '/login',
      '/login?next=/x',
      '/\nfoo',
    ]) {
      expect(safeNext(bad)).toBe('/account');
    }
  });
});

describe('api() and expired sessions', () => {
  it('refreshes once for parallel 401s, then retries each request', async () => {
    let refreshed = false;
    const calls = [];
    vi.stubGlobal('fetch', async (url) => {
      calls.push(url);
      await new Promise((r) => setTimeout(r, 5));
      if (url === '/api/auth/refresh') {
        await new Promise((r) => setTimeout(r, 20));
        refreshed = true;
        return json(200, { user: USERS.staff });
      }
      if (!refreshed) return json(401, { error: 'Your session needs refreshing.', code: 'TOKEN_EXPIRED' });
      return json(200, { url });
    });
    const { api } = await import('../src/lib/api.js');
    const results = await Promise.all([api('/products?all=1'), api('/admin/team'), api('/users/me/addresses')]);
    expect(results.map((r) => r.url)).toEqual(['/api/products?all=1', '/api/admin/team', '/api/users/me/addresses']);
    expect(calls.filter((c) => c === '/api/auth/refresh')).toHaveLength(1);
    expect(calls).toHaveLength(7); // 3 failed + 1 refresh + 3 retries
  });

  it('retries only once; a failed refresh signs the user out', async () => {
    let count = 0;
    vi.stubGlobal('fetch', async (url) => {
      count++;
      if (url === '/api/auth/refresh') return json(401, { error: 'Your session has ended.', code: 'SESSION_EXPIRED' });
      return json(401, { error: 'Your session needs refreshing.', code: 'TOKEN_EXPIRED' });
    });
    const { api, keys } = await import('../src/lib/api.js');
    const { queryClient } = await import('../src/lib/queryClient.js');
    queryClient.setQueryData(keys.me, USERS.customer);
    queryClient.setQueryData(keys.addresses, [{ _id: 'a' }]);
    await expect(api('/users/me/addresses')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
    expect(count).toBe(2); // original + refresh, no retry loop
    expect(queryClient.getQueryData(keys.me)).toBeNull();
    expect(queryClient.getQueryData(keys.addresses)).toBeUndefined();
  });
});

async function renderAt(path, user = null) {
  vi.resetModules();
  const mock = createMockApi({ user });
  current = mock;
  vi.stubGlobal('fetch', mock.fetch);
  const { routes } = await import('../src/App.jsx');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await tick();
  return { router, mock };
}

describe('/login', () => {
  it('email → code (autofill) → name step → Skip → back to next', async () => {
    const { router } = await renderAt('/login?next=%2Fcollection');
    expect(screen.getByText('Sign in or create an account')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await tick();
    expect(screen.getByText('Enter the code')).toBeTruthy();
    expect(screen.getByText(/You can resend in 1:00|You can resend in 0:5/)).toBeTruthy();
    // SMS/email autofill drops the whole code into the first box; the form submits by itself.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: GOOD_CODE } });
    await tick();
    expect(screen.getByText('What should we call you?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await tick();
    expect(router.state.location.pathname).toBe('/collection');
  });

  it('shows the wrong-code message and clears the boxes', async () => {
    await renderAt('/login');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await tick();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '000000' } });
    await tick();
    expect(screen.getByRole('alert').textContent).toBe("That code isn't right. 4 tries left.");
    expect(screen.getAllByRole('textbox')[0].value).toBe('');
  });

  it('existing named customers skip the name step', async () => {
    const { router } = await renderAt('/login?next=%2Fcollection');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: USERS.customer.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await tick();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: GOOD_CODE } });
    await tick();
    expect(router.state.location.pathname).toBe('/collection');
  });

  it('already signed in → straight to next; unsafe next → /account', async () => {
    const a = await renderAt('/login?next=%2Fcollection', USERS.customer);
    expect(a.router.state.location.pathname).toBe('/collection');
    cleanup();
    const b = await renderAt('/login?next=%2F%2Fevil.com', USERS.customer);
    expect(b.router.state.location.pathname).toBe('/account');
  });

  it('invalid email shows the server message', async () => {
    await renderAt('/login');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await tick();
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid email address.');
  });
});

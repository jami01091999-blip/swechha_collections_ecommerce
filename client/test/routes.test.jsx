// DOM snapshots of every route and key UI state against a mocked API.
// Class lists are sorted before comparing, so only a real markup/style change shows up as a diff.
// Recorded before the Phase 0 refactor: a passing run means the refactor changed nothing visible.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { prettyDOM } from '@testing-library/dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { USERS } from './fixtures.js';

let api;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// Waits until requests are done, lazy admin chunks have loaded (no "Opening atelier…" spinner)
// and the DOM has stopped changing.
async function settle() {
  let last = '';
  for (let stable = 0, i = 0; stable < 3 && i < 400; i++) {
    await act(() => new Promise((r) => setTimeout(r, 15)));
    const html = document.body.innerHTML;
    const idle = api.state.pending === 0 && !html.includes('Opening atelier…') && !document.querySelector('.animate-spin');
    stable = idle && html === last ? stable + 1 : 0;
    last = html;
  }
}

/** `user`: who is signed in (USERS.customer / staff / admin); `admin: true` is shorthand for USERS.admin. */
async function renderRoute(path, { admin = false, user = null, failProducts = false, wait = true } = {}) {
  vi.resetModules();
  api = createMockApi({ failProducts, user: admin ? USERS.admin : user });
  vi.stubGlobal('fetch', api.fetch);
  const { routes } = await import('../src/App.jsx');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<RouterProvider router={router} />);
  if (wait) await settle();
  return { ...utils, router };
}

function snap(node = document.body) {
  const clone = node.cloneNode(true);
  // Sheets and the drawer reset body overflow to '' on close, leaving style="" behind between tests.
  if (clone.getAttribute('style') === '') clone.removeAttribute('style');
  clone.querySelectorAll('[class]').forEach((el) => {
    const sorted = [...new Set(el.getAttribute('class').split(/\s+/).filter(Boolean))].sort().join(' ');
    el.setAttribute('class', sorted);
  });
  return prettyDOM(clone, Infinity, { highlight: false });
}

describe('public site', () => {
  it('home: loading', async () => {
    await renderRoute('/', { wait: false });
    expect(snap()).toMatchSnapshot();
  });
  it('home', async () => {
    await renderRoute('/');
    expect(snap()).toMatchSnapshot();
  });
  it('home: load error', async () => {
    await renderRoute('/', { failProducts: true });
    expect(snap()).toMatchSnapshot();
  });
  it('home: drawer open', async () => {
    await renderRoute('/');
    fireEvent.click(screen.getByLabelText('Open Navigation Drawer'));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('collection', async () => {
    await renderRoute('/collection');
    expect(snap()).toMatchSnapshot();
  });
  it('collection: category + in stock + sort', async () => {
    await renderRoute('/collection?category=Kurti&instock=1&sort=high&filter=new');
    expect(snap()).toMatchSnapshot();
  });
  it('collection: empty', async () => {
    await renderRoute('/collection?q=zzzz');
    expect(snap()).toMatchSnapshot();
  });
  it('product: sized, with size picked', async () => {
    await renderRoute('/product/noor-kurta-set');
    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('product: zoom viewer', async () => {
    await renderRoute('/product/noor-kurta-set');
    fireEvent.click(screen.getByLabelText('Zoom image'));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('product: free size saree', async () => {
    await renderRoute('/product/gulmohar-silk-saree');
    expect(snap()).toMatchSnapshot();
  });
  it('product: out of stock', async () => {
    await renderRoute('/product/chandrika-velvet-lehenga');
    expect(snap()).toMatchSnapshot();
  });
  it('product: draft is not found for customers', async () => {
    await renderRoute('/product/draft-linen-top');
    expect(snap()).toMatchSnapshot();
  });
  it('not found route', async () => {
    await renderRoute('/no-such-page');
    expect(snap()).toMatchSnapshot();
  });
  it('/saved stays unrouted (404)', async () => {
    await renderRoute('/saved');
    expect(snap()).toMatchSnapshot();
  });
});

describe('admin', () => {
  it('guests are sent to sign in, then back', async () => {
    const { router } = await renderRoute('/adminDivya/products');
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2FadminDivya%2Fproducts');
  });
  it('customers see "no access"', async () => {
    await renderRoute('/adminDivya', { user: USERS.customer });
    expect(screen.getByText("You don't have access to the admin area")).toBeTruthy();
    expect(snap()).toMatchSnapshot();
  });
  it('staff can open the admin', async () => {
    await renderRoute('/adminDivya/products', { user: USERS.staff });
    expect(screen.getByText(/Products \(4\)/)).toBeTruthy();
  });
  it('dashboard', async () => {
    await renderRoute('/adminDivya', { admin: true });
    expect(snap()).toMatchSnapshot();
  });
  it('products', async () => {
    await renderRoute('/adminDivya/products', { admin: true });
    expect(snap()).toMatchSnapshot();
  });
  it('products: quick stock sheet', async () => {
    await renderRoute('/adminDivya/products', { admin: true });
    fireEvent.click(screen.getByLabelText('Update stock for Noor Kurta Set'));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('products: delete confirm', async () => {
    await renderRoute('/adminDivya/products', { admin: true });
    fireEvent.click(screen.getByLabelText('Delete Noor Kurta Set'));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('product form: new', async () => {
    await renderRoute('/adminDivya/products/new', { admin: true });
    expect(snap()).toMatchSnapshot();
  });
  it('product form: new, validation errors', async () => {
    await renderRoute('/adminDivya/products/new', { admin: true });
    fireEvent.change(screen.getByLabelText(/MRP/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish Product' }));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('product form: edit', async () => {
    await renderRoute('/adminDivya/products/64b000000000000000000001', { admin: true });
    expect(snap()).toMatchSnapshot();
  });
  it('product form: edit a draft (not in the public list)', async () => {
    await renderRoute('/adminDivya/products/64b000000000000000000004', { admin: true });
    fireEvent.click(screen.getByRole('button', { name: /Delete Product/ }));
    await settle();
    expect(snap()).toMatchSnapshot();
  });
  it('lookbook', async () => {
    await renderRoute('/adminDivya/lookbook', { admin: true });
    expect(snap()).toMatchSnapshot();
  });
});

describe('accounts and team', () => {
  it('login: email step', async () => {
    await renderRoute('/login');
    expect(snap()).toMatchSnapshot();
  });
  it('account (customer)', async () => {
    await renderRoute('/account', { user: USERS.customer });
    expect(snap()).toMatchSnapshot();
  });
  it('drawer when signed in', async () => {
    await renderRoute('/', { user: USERS.customer });
    fireEvent.click(screen.getByLabelText('Open Navigation Drawer'));
    await settle();
    expect(screen.getByText('Hello, Ana Rao')).toBeTruthy();
    expect(snap()).toMatchSnapshot();
  });
  it('team (admin)', async () => {
    await renderRoute('/adminDivya/team', { admin: true });
    expect(screen.getByText('Sita Staff')).toBeTruthy();
    expect(snap()).toMatchSnapshot();
  });
  it('team is closed to staff; lookbook save hidden for staff', async () => {
    await renderRoute('/adminDivya/team', { user: USERS.staff });
    expect(screen.getByText('Only admins can manage the team')).toBeTruthy();
    cleanup();
    await renderRoute('/adminDivya/lookbook', { user: USERS.staff });
    expect(screen.queryByRole('button', { name: 'Save Lookbook' })).toBeNull();
    expect(screen.queryByText('Team')).toBeNull();
  });
  it('admin account menu', async () => {
    await renderRoute('/adminDivya', { admin: true });
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: /My account/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Log out/ })).toBeTruthy();
  });
});

describe('api client', () => {
  it('every request sends cookies and the CSRF header, never an admin key', async () => {
    await renderRoute('/adminDivya/products', { admin: true });
    expect(api.state.calls.length).toBeGreaterThanOrEqual(2);
    for (const c of api.state.calls) {
      expect(c.credentials).toBe('include');
      expect(c.headers['X-Requested-With']).toBe('swechha');
      expect(c.headers['x-admin-key']).toBeUndefined();
    }
    expect(localStorage.getItem('swechha_admin_key')).toBeNull();
  });
});

// DOM snapshots of every route and key UI state against a mocked API.
// Class lists are sorted before comparing, so only a real markup/style change shows up as a diff.
// Recorded before the Phase 0 refactor: a passing run means the refactor changed nothing visible.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { prettyDOM } from '@testing-library/dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { ADMIN_KEY } from './fixtures.js';

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
    const idle = api.state.pending === 0 && !html.includes('Opening atelier…');
    stable = idle && html === last ? stable + 1 : 0;
    last = html;
  }
}

async function renderRoute(path, { admin = false, failProducts = false, wait = true } = {}) {
  vi.resetModules();
  api = createMockApi({ failProducts });
  vi.stubGlobal('fetch', api.fetch);
  if (admin) localStorage.setItem('swechha_admin_key', ADMIN_KEY);
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
  it('gate: asks for the key', async () => {
    await renderRoute('/adminDivya');
    expect(snap()).toMatchSnapshot();
  });
  it('gate: wrong key', async () => {
    await renderRoute('/adminDivya');
    fireEvent.change(screen.getByPlaceholderText('Admin key'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await settle();
    expect(snap()).toMatchSnapshot();
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

describe('api client', () => {
  it('sends the admin key only on admin requests', async () => {
    await renderRoute('/adminDivya/products', { admin: true });
    const list = api.state.calls.find((c) => c.url === '/api/products?all=1');
    expect(list.headers['x-admin-key']).toBe(ADMIN_KEY);
    const settings = await renderRoute('/');
    expect(settings).toBeTruthy();
    for (const c of api.state.calls) expect(c.headers?.['x-admin-key']).toBeUndefined();
  });
});

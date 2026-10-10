// Shopping journey against the mocked API: bag, Buy Now, checkout, orders, and the admin orders screens.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { USERS } from './fixtures.js';

let api;
let router;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

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

async function open(path, user = null) {
  vi.resetModules();
  api = createMockApi({ user });
  vi.stubGlobal('fetch', api.fetch);
  const { routes } = await import('../src/App.jsx');
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await settle();
}
const click = async (el) => {
  fireEvent.click(el);
  await settle();
};
const calls = (path, method = 'GET') => api.state.calls.filter((c) => c.url.startsWith(path) && (c.method || 'GET') === method);

describe('product page buying', () => {
  it('asks for a size before adding a sized design to the bag', async () => {
    await open('/product/noor-kurta-set');
    await click(screen.getAllByRole('button', { name: 'Add to bag' })[0]);
    expect(screen.getByText('Choose a size to continue')).toBeTruthy();
    expect(calls('/api/cart/preview', 'POST')).toHaveLength(0);
  });

  it('guest: Add to bag asks them to sign in and returns to the product afterwards', async () => {
    await open('/product/gulmohar-silk-saree');
    await click(screen.getAllByRole('button', { name: 'Add to bag' })[0]);
    expect(localStorage.getItem('swechha_bag')).toBeNull();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fproduct%2Fgulmohar-silk-saree');
  });

  it('Buy now sends signed-in customers straight to checkout for that one item', async () => {
    await open('/product/gulmohar-silk-saree', USERS.customer);
    await click(screen.getAllByRole('button', { name: 'Buy now' })[0]);
    expect(router.state.location.pathname).toBe('/checkout');
    expect(router.state.location.search).toBe('?buy=64b000000000000000000002&size=FREE&qty=1');
  });
});

describe('checkout', () => {
  it('needs an address, then places a cash-on-delivery order and shows the confirmation', async () => {
    await open('/product/gulmohar-silk-saree', USERS.customer);
    await click(screen.getAllByRole('button', { name: 'Add to bag' })[0]);
    expect(api.state.cart).toHaveLength(1);
    api.state.addresses = [
      {
        _id: 'a1',
        fullName: 'Ana Rao',
        phone: '9876543210',
        line1: '12 Lake View',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        isDefault: true,
      },
    ];
    await act(() => router.navigate('/checkout'));
    await settle();
    expect(screen.getAllByText('Ana Rao', { exact: false }).length).toBeGreaterThan(0);
    await click(screen.getByRole('radio', { name: /Cash on delivery/ }));
    const place = screen.getAllByRole('button', { name: /Place order/ })[0];
    await click(place);
    const sent = JSON.parse(calls('/api/orders', 'POST')[0].body);
    expect(sent).toMatchObject({ source: 'cart', addressId: 'a1', paymentMethod: 'cod' });
    expect(sent.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(router.state.location.pathname).toBe('/account/orders/SW-2026-000001');
    expect(screen.getByText('Thank you! Your order is confirmed.')).toBeTruthy();
  });

  it('online payment opens the test payment screen', async () => {
    await open('/product/gulmohar-silk-saree', USERS.customer);
    api.state.addresses = [
      {
        _id: 'a1',
        fullName: 'Ana Rao',
        phone: '9876543210',
        line1: '12 Lake View',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        isDefault: true,
      },
    ];
    await click(screen.getAllByRole('button', { name: 'Buy now' })[0]);
    await click(screen.getAllByRole('button', { name: /^Pay ₹/ })[0]);
    expect(screen.getByRole('dialog', { name: 'Test payment' })).toBeTruthy();
  });
});

describe('orders and admin', () => {
  it('My orders lists the customer’s orders', async () => {
    await open('/account/orders', USERS.customer);
    expect(screen.getAllByText('No orders yet').length).toBeGreaterThan(0);
  });

  it('admin dashboard shows the sales panel; staff do not see it', async () => {
    await open('/adminDivya', USERS.admin);
    expect(screen.getByText('Sales')).toBeTruthy();
    cleanup();
    await open('/adminDivya', USERS.staff);
    expect(screen.queryByText('Sales')).toBeNull();
  });

  it('policy pages render from the shop settings', async () => {
    await open('/policies/returns');
    expect(screen.getAllByText('Returns & refunds').length).toBeGreaterThan(0);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { EMPTY_FILTERS, appliedFilters, readFilters, toApiParams, writeFilters } from '../src/components/catalog/filters.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

let current;
async function settle() {
  let last = '';
  for (let stable = 0, i = 0; stable < 3 && i < 300; i++) {
    await act(() => new Promise((r) => setTimeout(r, 15)));
    const html = document.body.innerHTML;
    stable = current?.state.pending === 0 && html === last ? stable + 1 : 0;
    last = html;
  }
}

async function renderAt(path) {
  vi.resetModules();
  current = createMockApi();
  vi.stubGlobal('fetch', current.fetch);
  const { routes } = await import('../src/App.jsx');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await settle();
  return router;
}

const productCalls = () => current.state.calls.filter((c) => c.url.startsWith('/api/products?'));

describe('filters ↔ URL', () => {
  it('reads, writes and round-trips every filter', () => {
    const url = new URLSearchParams(
      'category=Sarees&q=silk&sort=price_desc&min=5000&max=9999&sizes=m,XL&instock=1&filter=new&discount=20&junk=1'
    );
    const f = readFilters(url);
    expect(f).toEqual({
      category: 'Sarees',
      q: 'silk',
      sort: 'price_desc',
      min: '5000',
      max: '9999',
      sizes: ['M', 'XL'],
      instock: true,
      filter: 'new',
      discount: '20',
    });
    expect(readFilters(writeFilters(f))).toEqual(f);
    expect(toApiParams(f)).toMatchObject({
      minPrice: '5000',
      maxPrice: '9999',
      sizes: 'M,XL',
      inStock: '1',
      minDiscount: '20',
      sort: 'price_desc',
    });
    expect(writeFilters(EMPTY_FILTERS).toString()).toBe('');
  });

  it('bad values and old links are handled', () => {
    expect(readFilters(new URLSearchParams('sort=low&discount=15&min=abc&filter=x'))).toMatchObject({
      sort: 'price_asc',
      discount: '',
      min: '',
      filter: '',
    });
    expect(readFilters(new URLSearchParams('sort=high')).sort).toBe('price_desc');
  });

  it('applied chips describe the filters and clear one at a time', () => {
    const f = readFilters(new URLSearchParams('category=Sarees&min=5000&max=9999&sizes=FREE&instock=1'));
    const chips = appliedFilters(f);
    expect(chips.map((c) => c.label)).toEqual(['Sarees', '₹5,000–10,000', 'Size Free Size', 'In stock']);
    expect(chips[2].clear(f).sizes).toEqual([]);
  });
});

describe('collection page', () => {
  it('filters from the URL go to the API, and changes update the URL', async () => {
    const router = await renderAt('/collection?category=Kurti&instock=1');
    expect(productCalls().at(-1).url).toContain('category=Kurti');
    expect(productCalls().at(-1).url).toContain('inStock=1');
    expect(screen.getAllByText('1 design').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Remove In stock' }));
    await settle();
    expect(router.state.location.search).toBe('?category=Kurti');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'price_asc' } });
    await settle();
    expect(router.state.location.search).toBe('?category=Kurti&sort=price_asc');
  });

  it('phone filter sheet shows a live count and applies on "Show N designs"', async () => {
    const router = await renderAt('/collection');
    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    await settle();
    const sheet = screen.getByRole('dialog', { name: 'Filter' });
    fireEvent.click(within(sheet).getByRole('button', { name: /^Sarees/ }));
    await settle();
    const show = within(sheet).getByRole('button', { name: /^Show 1 design/ });
    expect(router.state.location.search).toBe(''); // nothing applied yet
    fireEvent.click(show);
    await settle();
    expect(router.state.location.search).toBe('?category=Sarees');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('coming back from a product shows the cached list without refetching', async () => {
    const router = await renderAt('/collection?sort=price_asc');
    const before = productCalls().length;
    const first = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('/product/'));
    await act(() => router.navigate(first.getAttribute('href')));
    await settle();
    await act(() => router.navigate(-1));
    await settle();
    expect(router.state.location.search).toBe('?sort=price_asc');
    expect(productCalls().length).toBe(before); // served from cache → same items, scroll restored
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === first.getAttribute('href'))).toBe(true);
  });

  it('empty results show "Clear filters"', async () => {
    const router = await renderAt('/collection?q=zzzz&instock=1');
    expect(screen.getByText('No designs match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await settle();
    expect(router.state.location.search).toBe('');
  });
});

describe('search suggestions', () => {
  it('shows products and "See all", supports ↓ Enter and Esc, remembers searches', async () => {
    const router = await renderAt('/collection');
    const input = screen.getAllByRole('combobox', { name: 'Search the catalogue' })[0];
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'gul' } });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    await settle();
    const list = screen.getByRole('listbox', { name: 'Suggestions' });
    const options = within(list).getAllByRole('option');
    expect(options[0].textContent).toContain('Gulmohar Silk Saree');
    expect(options.at(-1).textContent).toContain('See all results for “gul”');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();
    expect(router.state.location.search).toBe('?q=gul');
    expect(JSON.parse(localStorage.getItem('swechha_recent_searches'))).toEqual(['gul']);
  });

  it('↓ then Enter opens the highlighted product', async () => {
    const router = await renderAt('/collection');
    const input = screen.getAllByRole('combobox', { name: 'Search the catalogue' })[0];
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'noor' } });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    await settle();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();
    expect(router.state.location.pathname).toBe('/product/noor-kurta-set');
  });
});

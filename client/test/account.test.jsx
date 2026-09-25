import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createMockApi } from './mockApi.js';
import { USERS } from './fixtures.js';
import { INDIAN_STATES as CLIENT_STATES } from '../src/lib/india.js';
import { INDIAN_STATES as SERVER_STATES } from '../../server/src/validators/india.js';
import { MESSAGES as CLIENT_MESSAGES } from '../src/lib/validation.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let current;
/** Waits until the mock API is idle and the page stops changing. */
async function tick() {
  let last = '';
  for (let stable = 0, i = 0; stable < 3 && i < 300; i++) {
    await act(() => new Promise((r) => setTimeout(r, 15)));
    const html = document.body.innerHTML;
    stable = current?.state.pending === 0 && html === last ? stable + 1 : 0;
    last = html;
  }
}

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

describe('shared rules', () => {
  it('client state list matches the server', () => {
    expect(CLIENT_STATES).toEqual(SERVER_STATES);
    expect(CLIENT_STATES).toContain('Telangana');
    expect(CLIENT_STATES).toContain('Ladakh');
  });

  it('client validation messages match the server', async () => {
    const { MESSAGES } = await import('../../server/src/validators/user.js');
    expect(CLIENT_MESSAGES).toEqual(MESSAGES);
  });
});

describe('/account', () => {
  it('guests are sent to /login?next=/account', async () => {
    const { router } = await renderAt('/account');
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Faccount');
  });

  it('shows greeting, details, empty orders and empty addresses', async () => {
    await renderAt('/account', USERS.customer);
    expect(screen.getByText('Hello, Ana Rao')).toBeTruthy();
    expect(screen.getByText('Your orders will appear here.')).toBeTruthy();
    expect(screen.getByText('No saved addresses')).toBeTruthy();
    expect(screen.queryByText('Open admin')).toBeNull();
  });

  it('staff see a link to the admin', async () => {
    await renderAt('/account', USERS.staff);
    expect(screen.getByText('Open admin')).toBeTruthy();
  });

  it('address form: inline errors, then save → listed as default', async () => {
    await renderAt('/account', USERS.customer);
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
    await tick();
    const sheet = screen.getByRole('dialog', { name: 'Add address' });
    fireEvent.change(within(sheet).getByLabelText(/Full name/), { target: { value: '' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save address' }));
    await tick();
    for (const msg of [
      'Enter the full name.',
      'Enter a 10-digit mobile number.',
      'Enter the house number and street.',
      'Enter the city.',
      'Choose a state.',
      'Enter a 6-digit PIN code.',
    ]) {
      expect(within(sheet).getByText(msg)).toBeTruthy();
    }
    fireEvent.change(within(sheet).getByLabelText(/Full name/), { target: { value: 'Ana Rao' } });
    fireEvent.change(within(sheet).getByLabelText(/Mobile number/), { target: { value: '98765 43210' } });
    fireEvent.change(within(sheet).getByLabelText(/House number/), { target: { value: '12 Road No 3' } });
    fireEvent.change(within(sheet).getByLabelText(/City/), { target: { value: 'Hyderabad' } });
    fireEvent.change(within(sheet).getByLabelText(/PIN code/), { target: { value: '500034' } });
    fireEvent.change(within(sheet).getByLabelText(/State/), { target: { value: 'Telangana' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save address' }));
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText(/Hyderabad, Telangana 500034/)).toBeTruthy();
  });

  it('log out → home, signed out', async () => {
    const { router, mock } = await renderAt('/account', USERS.customer);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await tick();
    expect(router.state.location.pathname).toBe('/');
    expect(mock.state.user).toBeNull();
  });

  it('log out of all devices asks first', async () => {
    const { router, mock } = await renderAt('/account', USERS.customer);
    fireEvent.click(screen.getByRole('button', { name: 'Log out of all devices' }));
    await tick();
    fireEvent.click(screen.getByRole('button', { name: 'Log out everywhere' }));
    await tick();
    expect(mock.state.calls.some((c) => c.url === '/api/auth/logout-all')).toBe(true);
    expect(router.state.location.pathname).toBe('/');
  });
});

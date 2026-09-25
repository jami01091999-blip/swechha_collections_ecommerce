import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Button, Chip, OtpInput, PriceBlock } from '../src/components/ui';

afterEach(cleanup);

const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(r)));

function Otp({ onComplete }) {
  const [value, setValue] = useState('');
  return (
    <>
      <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByRole('textbox');
const value = () => screen.getByTestId('value').textContent;

describe('OtpInput', () => {
  it('renders 6 numeric boxes with one-time-code autofill on the first', () => {
    render(<Otp />);
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0].getAttribute('inputmode')).toBe('numeric');
    expect(boxes()[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(boxes()[1].getAttribute('autocomplete')).toBe('off');
  });

  it('auto-advances while typing and ignores non-digits', async () => {
    render(<Otp />);
    fireEvent.change(boxes()[0], { target: { value: '4' } });
    await nextFrame();
    expect(document.activeElement).toBe(boxes()[1]);
    fireEvent.change(boxes()[1], { target: { value: 'x' } });
    expect(value()).toBe('4');
  });

  it('pasting the full code fills every box and completes', async () => {
    const onComplete = vi.fn();
    render(<Otp onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => ' 123-456 ' } });
    await nextFrame();
    expect(value()).toBe('123456');
    expect(boxes().map((b) => b.value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('autofill of several digits into one box spreads forward', () => {
    render(<Otp />);
    fireEvent.change(boxes()[0], { target: { value: '987654' } });
    expect(value()).toBe('987654');
  });

  it('backspace clears the box, then moves back', async () => {
    render(<Otp />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '123' } });
    fireEvent.keyDown(boxes()[2], { key: 'Backspace' });
    expect(value()).toBe('12');
    fireEvent.keyDown(boxes()[2], { key: 'Backspace' });
    await nextFrame();
    expect(value()).toBe('1');
    expect(document.activeElement).toBe(boxes()[1]);
  });
});

describe('kit classes', () => {
  it('Button primary keeps the Stitch maroon style', () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('bg-primary-container');
    expect(b.className).toContain('shadow-luxury');
  });

  it('Chip switches between active and idle styles', () => {
    const { rerender } = render(<Chip active>All</Chip>);
    expect(screen.getByRole('button').className).toContain('bg-primary-container');
    rerender(<Chip>All</Chip>);
    expect(screen.getByRole('button').className).toContain('bg-surface-container-low');
  });

  it('PriceBlock shows the discount only when MRP is higher', () => {
    const { rerender } = render(<PriceBlock variant="pdp" price={12800} mrp={18000} />);
    expect(screen.getByText('29% OFF')).toBeTruthy();
    rerender(<PriceBlock variant="pdp" price={12800} mrp={12800} />);
    expect(screen.queryByText(/% OFF/)).toBeNull();
  });
});

describe('/__ui (dev only)', () => {
  it('renders the kit gallery', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    const { routes } = await import('../src/App.jsx');
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/__ui'] })} />);
    expect(await screen.findByText('UI kit', {}, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText('OtpInput')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

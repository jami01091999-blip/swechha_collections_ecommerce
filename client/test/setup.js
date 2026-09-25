// jsdom gaps used by the UI (carousel, galleries, scroll-to-top on errors, share).
import { vi } from 'vitest';

window.matchMedia =
  window.matchMedia ||
  ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.scrollTo = vi.fn();
Element.prototype.scrollTo = function scrollTo() {};
Element.prototype.scrollBy = function scrollBy() {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

// React Router builds a Request on navigation; Node's Request rejects jsdom's AbortSignal, so drop the signal in tests.
const NativeRequest = globalThis.Request;
globalThis.Request = class TestRequest extends NativeRequest {
  constructor(input, init) {
    if (init?.signal) {
      const { signal: _signal, ...rest } = init;
      super(input, rest);
    } else super(input, init);
  }
};

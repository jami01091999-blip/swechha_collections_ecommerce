// jsdom gaps used by the UI (carousel, galleries, scroll-to-top on errors, share).
import { vi } from 'vitest';

window.matchMedia =
  window.matchMedia ||
  ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.scrollTo = vi.fn();
Element.prototype.scrollTo = function scrollTo() {};
Element.prototype.scrollBy = function scrollBy() {};
Element.prototype.scrollIntoView = function scrollIntoView() {};

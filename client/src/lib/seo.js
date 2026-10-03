import { useEffect } from 'react';

const DEFAULT_TITLE = 'Swechha Collections | Sarees, Kurtis & Festive Wear';

function setMeta(name, content, attr = 'name') {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Page title, description and share preview (Open Graph) for the current route. */
export function usePageMeta({ title, description, image } = {}) {
  useEffect(() => {
    const full = title ? `${title} | Swechha Collections` : DEFAULT_TITLE;
    document.title = full;
    setMeta('description', description);
    setMeta('og:title', full, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:image', image, 'property');
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, image]);
}

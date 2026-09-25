import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scrolls to #id after navigation (used by the "Atelier" tab). */
export default function ScrollToHash({ ready = true }) {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash || !ready) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [hash, key, ready]);
  return null;
}

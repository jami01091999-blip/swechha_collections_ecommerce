import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { CATEGORIES } from '../../lib/constants';
import { useSettings } from '../../lib/api';
import { waLink } from '../../lib/format';

export default function Drawer({ open, onClose }) {
  const { data: settings } = useSettings();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const item = 'flex items-center justify-between py-3 border-b border-outline-variant/20 font-title-md text-[15px] text-on-surface hover:text-primary';
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <button className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px]" aria-label="Close menu" onClick={onClose} />
      <aside className="animate-drawer-in absolute left-0 top-0 bottom-0 w-[82%] max-w-[340px] bg-surface shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-margin-mobile py-3 border-b border-outline-variant/20">
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-medium tracking-wide text-primary">Swechha Collections</span>
            <span className="font-label-md text-label-md tracking-widest text-secondary font-semibold -mt-1">ATELIER</span>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-surface-container">
            <Icon name="close" className="text-2xl" />
          </button>
        </div>
        <nav className="px-margin-mobile pt-3 flex-1" onClick={onClose}>
          <span className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider">Shop by Category</span>
          <Link to="/collection" className={item}>
            All designs <Icon name="chevron_right" className="text-outline" />
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.key} to={`/collection?category=${encodeURIComponent(c.key)}`} className={item}>
              {c.label} <Icon name="chevron_right" className="text-outline" />
            </Link>
          ))}
        </nav>
        {settings?.whatsapp && (
          <div className="p-margin-mobile">
            <a
              href={waLink(settings.whatsapp, 'Hello Swechha Collections, I would like to know more about your collection.')}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#1b4332] hover:bg-[#143225] text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all text-[14px] font-semibold tracking-wide"
            >
              <Icon name="chat" className="text-xl" /> Chat on WhatsApp
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}

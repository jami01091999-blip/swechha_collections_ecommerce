import { Link, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon';

const TABS = [
  { to: '/', label: 'Curation', icon: 'auto_awesome', match: (p, h) => p === '/' && h !== '#atelier' },
  { to: '/collection', label: 'Lookbook', icon: 'menu_book', match: (p) => p.startsWith('/collection') },
];

/** Bottom navigation bar — Stitch home nav. */
export default function BottomNav() {
  const { pathname, hash } = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-gutter-mobile py-space-xs pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur-md max-w-[480px] mx-auto right-0 shadow-[0_-4px_16px_rgba(107,29,47,0.06)] border-t border-outline-variant/20">
      {TABS.map((t) => {
        const active = t.match(pathname, hash);
        return (
          <Link
            key={t.label}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center p-1 min-w-[56px] hover:text-primary transition-colors duration-200 active:scale-95 ${
              active ? 'text-primary font-semibold' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={t.icon} fill={active} className="text-2xl" />
            <span className="font-label-md text-label-md mt-0.5">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

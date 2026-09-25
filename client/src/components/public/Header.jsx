import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';

/** Sticky top app bar — Stitch home header. */
export default function Header({ onMenu }) {
  const navigate = useNavigate();
  return (
    <header className="md:hidden flex justify-between items-center w-full px-gutter-mobile py-space-sm max-w-7xl mx-auto sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
      <button
        aria-label="Open Navigation Drawer"
        onClick={onMenu}
        className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-surface-container-high transition-colors duration-200 active:scale-95"
        type="button"
      >
        <Icon name="menu" className="text-primary text-2xl" />
      </button>
      <Link to="/" className="flex flex-col items-center justify-center text-center">
        <span className="font-headline-sm text-headline-sm font-medium tracking-wide text-primary">Swechha Collections</span>
      </Link>
      <button
        aria-label="Search Catalogue"
        onClick={() => navigate('/collection?search=1')}
        className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-surface-container-high transition-colors duration-200 active:scale-95"
        type="button"
      >
        <Icon name="search" className="text-primary text-2xl" />
      </button>
    </header>
  );
}

/** Back-arrow header used on PDP / collection / saved — Stitch PDP header. */
export function SubHeader({ title, subtitle, right, onBack }) {
  const navigate = useNavigate();
  const back = onBack || (() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/')));
  return (
    <header className="md:hidden sticky top-0 z-40 bg-surface/95 backdrop-blur-md px-margin-mobile py-2.5 border-b border-outline-variant/30 flex items-center justify-between">
      <button
        aria-label="Return to Catalogue"
        className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-primary hover:bg-surface-container transition-colors active:scale-90"
        onClick={back}
        type="button"
      >
        <Icon name="arrow_back" className="text-2xl" />
      </button>
      <div className="flex flex-col items-center justify-center text-center px-2 flex-1 overflow-hidden">
        <span className="font-title-md text-[14px] text-primary truncate max-w-[210px] font-medium">{title}</span>
        {subtitle && <span className="font-label-md text-[10px] text-secondary uppercase tracking-widest -mt-0.5">{subtitle}</span>}
      </div>
      <div className="flex items-center gap-1 min-w-9 justify-end">{right || <span className="w-9" />}</div>
    </header>
  );
}

const DESKTOP_LINKS = [
  { to: '/', label: 'Curation', match: (p, h) => p === '/' && h !== '#atelier' },
  { to: '/collection', label: 'Lookbook', match: (p) => p.startsWith('/collection') },
];

/** Laptop/desktop top bar (768px+). Same brand, colours and nav items as the mobile bottom bar. */
export function DesktopHeader() {
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState(() => new URLSearchParams(search).get('q') || '');
  return (
    <header className="hidden md:block sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
      <div className="max-w-6xl mx-auto px-8 h-[72px] flex items-center justify-between gap-6">
        <Link to="/" className="flex flex-col shrink-0">
          <span className="font-headline-sm text-headline-sm font-medium tracking-wide text-primary">Swechha Collections</span>
        </Link>
        <nav className="flex items-center gap-7">
          {DESKTOP_LINKS.map((l) => {
            const active = l.match(pathname, hash);
            return (
              <Link
                key={l.label}
                to={l.to}
                aria-current={active ? 'page' : undefined}
                className={`font-label-lg text-label-lg uppercase tracking-wider py-1 border-b-2 transition-colors ${
                  active ? 'text-primary border-secondary' : 'text-on-surface-variant border-transparent hover:text-primary'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(q.trim() ? `/collection?q=${encodeURIComponent(q.trim())}` : '/collection');
            }}
            className="relative"
          >
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search designs"
              aria-label="Search the catalogue"
              className="w-44 lg:w-60 rounded-full border border-[#EBE5DD] bg-[#FAF6F0] pl-10 pr-4 py-2 font-body-sm text-[13px] text-on-surface placeholder:text-outline/70 focus:border-[#C59B6A] focus:ring-0"
            />
          </form>
        </div>
      </div>
    </header>
  );
}

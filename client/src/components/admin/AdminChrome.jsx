import { Link, NavLink, useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import { ADMIN_BASE } from '../../lib/constants';

/** Sticky admin header — Stitch dashboard header. */
export function AdminHeader({ alerts = 0 }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md px-gutter-mobile md:px-0 py-3 md:border-b md:border-outline-variant/30 transition-colors duration-200">
      <div className="flex justify-between items-center w-full gap-4 md:max-w-6xl md:mx-auto md:px-8">
        <Link to={ADMIN_BASE} className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-headline-sm font-medium tracking-wide text-primary md:whitespace-nowrap">Swechha Collections</span>
            <span className="bg-primary-container text-surface-container-lowest font-label-md text-label-md px-2 py-0.5 rounded-full tracking-wider shadow-sm">ADMIN</span>
          </div>
          <span className="font-label-md text-label-md text-secondary tracking-widest mt-0.5 md:whitespace-nowrap">ATELIER CONCIERGE &amp; INVENTORY</span>
        </Link>
        <DesktopAdminNav />
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            aria-label={alerts ? `${alerts} stock alerts` : 'Notifications'}
            onClick={() => navigate(`${ADMIN_BASE}#attention`)}
            className="relative p-2 rounded-full hover:bg-surface-container-high transition-colors active:scale-95 duration-150 flex items-center justify-center text-on-surface-variant"
            type="button"
          >
            <Icon name="notifications" className="text-[22px]" />
            {alerts > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-container rounded-full ring-2 ring-background" />}
          </button>
          <div className="w-9 h-9 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary font-title-md text-title-md font-bold shadow-luxury-subtle">
            SC
          </div>
        </div>
      </div>
    </header>
  );
}

/** Back-arrow header for form screens, same tone as the admin header. */
export function AdminSubHeader({ title, subtitle, right, backTo }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md px-gutter-mobile md:px-0 py-2.5 border-b border-outline-variant/30">
      <div className="flex items-center gap-2 md:max-w-6xl md:mx-auto md:px-8">
      <button
        aria-label="Back"
        onClick={() => (backTo ? navigate(backTo) : window.history.state?.idx > 0 ? navigate(-1) : navigate(ADMIN_BASE))}
        className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-primary hover:bg-surface-container transition-colors active:scale-90"
        type="button"
      >
        <Icon name="arrow_back" className="text-2xl" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-headline-sm text-[19px] leading-tight text-primary truncate">{title}</h1>
        {subtitle && <p className="font-label-md text-label-md text-on-surface-variant truncate">{subtitle}</p>}
      </div>
      {right}
      </div>
    </header>
  );
}

const tab = ({ isActive }) =>
  `flex flex-col items-center justify-center p-1 min-w-[56px] transition-all active:scale-95 group ${isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}`;

function Tab({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={tab}>
      {({ isActive }) => (
        <>
          <Icon name={icon} fill={isActive} className="text-[23px]" />
          <span className="font-label-md text-label-md mt-0.5">{label}</span>
          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isActive ? 'bg-primary-container' : 'bg-transparent'}`} />
        </>
      )}
    </NavLink>
  );
}

/** Bottom navigation — Stitch admin nav with the floating + button. */
export function AdminNav() {
  const navigate = useNavigate();
  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-surface/95 backdrop-blur-md px-gutter-mobile py-space-xs pb-[max(0.25rem,env(safe-area-inset-bottom))] flex justify-around items-center border-t border-outline-variant/30 shadow-luxury">
      <Tab to={ADMIN_BASE} end icon="dashboard" label="Dashboard" />
      <Tab to={`${ADMIN_BASE}/products`} icon="styler" label="Products" />
      <div className="-mt-5">
        <button
          aria-label="Add new product"
          onClick={() => navigate(`${ADMIN_BASE}/products/new`)}
          className="w-12 h-12 rounded-full bg-primary-container text-surface-container-lowest flex items-center justify-center shadow-luxury hover:bg-[#541423] active:scale-95 transition-all duration-150 border-2 border-background"
          type="button"
        >
          <Icon name="add" className="text-[26px]" />
        </button>
      </div>
      <Tab to={`${ADMIN_BASE}/lookbook`} icon="auto_awesome" label="Lookbook" />
      <a href="/" target="_blank" rel="noreferrer" className={tab({ isActive: false })}>
        <Icon name="storefront" className="text-[23px]" />
        <span className="font-label-md text-label-md mt-0.5">View Site</span>
        <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-transparent" />
      </a>
    </nav>
  );
}

/** Laptop/tablet navigation inside the admin header (the bottom bar is phone-only). */
function DesktopAdminNav() {
  const navigate = useNavigate();
  const link = ({ isActive }) =>
    `font-label-lg text-label-lg uppercase tracking-wider py-1 border-b-2 transition-colors ${
      isActive ? 'text-primary border-secondary' : 'text-on-surface-variant border-transparent hover:text-primary'
    }`;
  return (
    <nav className="hidden md:flex items-center gap-5 lg:gap-8">
      <NavLink to={ADMIN_BASE} end className={link}>Dashboard</NavLink>
      <NavLink to={`${ADMIN_BASE}/products`} className={link}>Products</NavLink>
      <NavLink to={`${ADMIN_BASE}/lookbook`} className={link}>Lookbook</NavLink>
      <a href="/" target="_blank" rel="noreferrer" aria-label="View Site" className={link({ isActive: false })}>
        <Icon name="storefront" className="text-[20px] lg:hidden" />
        <span className="hidden lg:inline">View Site</span>
      </a>
      <button
        type="button"
        onClick={() => navigate(`${ADMIN_BASE}/products/new`)}
        aria-label="Add Product"
        className="inline-flex items-center gap-1.5 bg-primary-container hover:bg-[#541423] text-surface-container-lowest px-2.5 lg:px-4 py-2 rounded-xl font-label-lg text-label-lg whitespace-nowrap shadow-luxury active:scale-95 transition-all"
      >
        <Icon name="add" className="text-[18px]" /> <span className="hidden lg:inline">Add Product</span>
      </button>
    </nav>
  );
}

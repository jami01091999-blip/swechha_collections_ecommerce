import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import { Avatar, IconButton, Sheet, initials } from '../ui';
import { isAdmin, useAuth } from '../../lib/auth';
import { logout, useAdminStats } from '../../lib/api';
import { ADMIN_BASE } from '../../lib/constants';

/** Sticky admin header — Stitch dashboard header. */
/** `alerts` defaults to the "needs attention" count from /api/admin/stats (shared, cached query). */
export function AdminHeader({ alerts: alertsProp }) {
  const { data: stats } = useAdminStats();
  const alerts = alertsProp ?? stats?.attentionCount ?? 0;
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md px-gutter-mobile md:px-0 py-3 md:border-b md:border-outline-variant/30 transition-colors duration-200">
      <div className="flex justify-between items-center w-full gap-4 md:max-w-6xl md:mx-auto md:px-8">
        <Link to={ADMIN_BASE} className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-headline-sm font-medium tracking-wide text-primary md:whitespace-nowrap">
              Swechha Collections
            </span>
            <span className="bg-primary-container text-surface-container-lowest font-label-md text-label-md px-2 py-0.5 rounded-full tracking-wider shadow-sm">
              ADMIN
            </span>
          </div>
          <span className="font-label-md text-label-md text-secondary tracking-widest mt-0.5 md:whitespace-nowrap">
            ATELIER CONCIERGE &amp; INVENTORY
          </span>
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
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** Initials button with View site / My account / Log out. */
function AccountMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const item =
    'w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg font-body-sm text-[14px] text-on-surface hover:bg-surface-container';
  const signOut = async () => {
    setOpen(false);
    await logout().catch(() => {});
    navigate('/', { replace: true });
  };

  return (
    <div className="relative" ref={box}>
      <button type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar>{initials(user)}</Avatar>
      </button>
      {open && (
        <div role="menu" className="admin-card absolute right-0 top-full mt-2 w-56 p-1.5 z-50 shadow-luxury">
          <div className="px-3 py-2 border-b border-outline-variant/30 mb-1">
            <p className="font-title-md text-[14px] text-primary truncate">{user?.name || 'Signed in'}</p>
            <p className="font-body-sm text-[12px] text-on-surface-variant truncate">{user?.email}</p>
          </div>
          <a role="menuitem" href="/" target="_blank" rel="noreferrer" className={item}>
            <Icon name="storefront" className="text-[18px]" /> View site
          </a>
          <Link role="menuitem" to="/account" className={item}>
            <Icon name="person" className="text-[18px]" /> My account
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className={item}>
            <Icon name="logout" className="text-[18px]" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Back-arrow header for form screens, same tone as the admin header. */
export function AdminSubHeader({ title, subtitle, right, backTo }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md px-gutter-mobile md:px-0 py-2.5 border-b border-outline-variant/30">
      <div className="flex items-center gap-2 md:max-w-6xl md:mx-auto md:px-8">
        <IconButton
          icon="arrow_back"
          label="Back"
          onClick={() => (backTo ? navigate(backTo) : window.history.state?.idx > 0 ? navigate(-1) : navigate(ADMIN_BASE))}
          className="-ml-1 text-primary hover:bg-surface-container transition-colors active:scale-90"
          iconClassName="text-2xl"
        />
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

/** Everything that doesn't fit in the phone tab bar ("More"). Admin-only pages are hidden from staff. */
const MORE_LINKS = [
  ['lookbook', 'Lookbook', 'auto_awesome', false],
  ['customers', 'Customers', 'group', true],
  ['coupons', 'Coupons', 'sell', true],
  ['shop', 'Shop rules', 'tune', false],
  ['team', 'Team', 'badge', true],
  ['activity', 'Activity', 'history', true],
];

function MoreSheet({ onClose }) {
  const { user } = useAuth();
  return (
    <Sheet onClose={onClose} label="More">
      <nav className="grid grid-cols-3 gap-2 pb-2">
        {MORE_LINKS.filter(([, , , adminOnly]) => !adminOnly || isAdmin(user)).map(([to, label, icon]) => (
          <NavLink
            key={to}
            to={`${ADMIN_BASE}/${to}`}
            onClick={onClose}
            className="flex flex-col items-center gap-1 rounded-xl border border-outline-variant/40 py-3 text-on-surface hover:text-primary"
          >
            <Icon name={icon} className="text-[24px]" />
            <span className="font-label-md text-label-md">{label}</span>
          </NavLink>
        ))}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl border border-outline-variant/40 py-3 text-on-surface hover:text-primary"
        >
          <Icon name="storefront" className="text-[24px]" />
          <span className="font-label-md text-label-md">View site</span>
        </a>
      </nav>
    </Sheet>
  );
}

/** Bottom navigation — Stitch admin nav with the floating + button. */
export function AdminNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const moreActive = MORE_LINKS.some(([to]) => pathname.startsWith(`${ADMIN_BASE}/${to}`));
  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-surface/95 backdrop-blur-md px-gutter-mobile py-space-xs pb-[max(0.25rem,env(safe-area-inset-bottom))] flex justify-around items-center border-t border-outline-variant/30 shadow-luxury">
        <Tab to={ADMIN_BASE} end icon="dashboard" label="Dashboard" />
        <Tab to={`${ADMIN_BASE}/orders`} icon="receipt_long" label="Orders" />
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
        <Tab to={`${ADMIN_BASE}/products`} icon="styler" label="Products" />
        <button type="button" onClick={() => setMore(true)} className={tab({ isActive: moreActive })}>
          <Icon name="more_horiz" fill={moreActive} className="text-[23px]" />
          <span className="font-label-md text-label-md mt-0.5">More</span>
          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${moreActive ? 'bg-primary-container' : 'bg-transparent'}`} />
        </button>
      </nav>
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </>
  );
}

/** Laptop/tablet navigation inside the admin header (the bottom bar is phone-only). */
function DesktopAdminNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const link = ({ isActive }) =>
    `font-label-lg text-label-lg uppercase tracking-wider py-1 border-b-2 transition-colors ${
      isActive ? 'text-primary border-secondary' : 'text-on-surface-variant border-transparent hover:text-primary'
    }`;
  return (
    <nav className="hidden md:flex items-center gap-5 lg:gap-8">
      <NavLink to={ADMIN_BASE} end className={link}>
        Dashboard
      </NavLink>
      <NavLink to={`${ADMIN_BASE}/orders`} className={link}>
        Orders
      </NavLink>
      <NavLink to={`${ADMIN_BASE}/products`} className={link}>
        Products
      </NavLink>
      {isAdmin(user) && (
        <NavLink to={`${ADMIN_BASE}/customers`} className={link}>
          Customers
        </NavLink>
      )}
      <details className="relative group">
        <summary className={`${link({ isActive: false })} list-none cursor-pointer flex items-center gap-0.5`}>
          More <Icon name="expand_more" className="text-[18px]" />
        </summary>
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-outline-variant/40 bg-surface shadow-luxury py-1 z-50">
          {MORE_LINKS.filter(([to, , , adminOnly]) => (!adminOnly || isAdmin(user)) && to !== 'customers').map(([to, label]) => (
            <NavLink
              key={to}
              to={`${ADMIN_BASE}/${to}`}
              className="block px-4 py-2 font-body-sm text-[14px] text-on-surface hover:bg-surface-container-low hover:text-primary"
            >
              {label}
            </NavLink>
          ))}
        </div>
      </details>
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

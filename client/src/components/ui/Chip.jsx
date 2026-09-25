import { cx } from './cx';

const IDLE = 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container';

// Each kind matches one chip row from the design.
const KINDS = {
  /** Home / collection category row. */
  category: {
    active: 'shrink-0 bg-primary-container text-white px-4 py-1.5 rounded-full font-label-md text-label-md font-semibold shadow-sm active:scale-95 transition-transform',
    idle: `shrink-0 border ${IDLE} px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors active:scale-95`,
  },
  /** Admin product filters. */
  filter: {
    base: 'shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors active:scale-95 border',
    active: 'bg-primary-container text-white border-primary-container font-semibold shadow-sm',
    idle: IDLE,
  },
  /** Small on/off pill (e.g. "In stock only"). */
  toggle: {
    base: 'shrink-0 px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors active:scale-95 border',
    active: 'bg-primary-container text-white border-primary-container',
    idle: IDLE,
  },
  /** Square-ish size picker in the product form. */
  size: {
    base: 'min-w-11 px-3 py-2 rounded-xl font-label-lg text-label-lg border transition-all active:scale-95',
    active: 'bg-primary-container text-white border-primary-container',
    idle: 'bg-surface-container-low text-on-surface-variant border-outline-variant/40',
  },
};

export const chipClass = (active, kind = 'filter') => {
  const k = KINDS[kind];
  return cx(k.base, active ? k.active : k.idle);
};

/** Selectable chip. Pass `aria-pressed` when it toggles a filter. */
export default function Chip({ active = false, kind = 'filter', className, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={cx(chipClass(active, kind), className)} {...rest}>
      {children}
    </button>
  );
}

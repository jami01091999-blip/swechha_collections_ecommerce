import { cx } from './cx';

// Classes are the exact ones used across the Stitch screens; `className` adds layout (width, margins).
const BASE = 'rounded-xl active:scale-95 transition-all';

const VARIANTS = {
  /** Maroon filled — main action (Save, Publish, Continue). */
  primary: `${BASE} bg-primary-container hover:bg-[#541423] text-surface-container-lowest shadow-luxury disabled:opacity-60`,
  /** Gold hairline border — Cancel, Auto, + Add. */
  secondary: `${BASE} border border-[#C59B6A] text-on-surface`,
  /** Text link — "Try again". */
  ghost: 'text-primary underline',
  /** Destructive confirm. */
  danger: `${BASE} bg-error text-white disabled:opacity-60`,
  /** WhatsApp green with icon. */
  whatsapp: `${BASE} bg-[#1b4332] hover:bg-[#143225] text-white shadow-md flex items-center justify-center gap-2`,
};

const SIZES = {
  default: {
    sm: 'py-3 font-label-lg text-label-lg',
    md: 'py-3 font-title-md text-[15px] font-semibold',
    lg: 'py-3.5 font-title-md text-title-md font-semibold',
  },
  ghost: { sm: 'font-label-lg text-label-lg', md: 'font-label-lg text-label-lg', lg: 'font-label-lg text-label-lg' },
  whatsapp: {
    sm: 'py-3 px-4 text-[14px] font-semibold tracking-wide',
    md: 'py-3 px-4 text-[14px] font-semibold tracking-wide',
    lg: 'py-3.5 px-4 text-[15px] font-semibold tracking-wide',
  },
};

export function buttonClass({ variant = 'primary', size = 'md', className } = {}) {
  const sizes = SIZES[variant] || SIZES.default;
  return cx(VARIANTS[variant], size && sizes[size], className);
}

/**
 * Button. Renders a <button type="button"> by default; pass `as="a"` or `as={Link}` for links.
 * Variants: primary · secondary · ghost · danger · whatsapp. Sizes: sm · md · lg.
 */
export default function Button({ as: As = 'button', variant = 'primary', size = 'md', className, type, children, ...rest }) {
  const props = As === 'button' ? { type: type || 'button' } : {};
  return (
    <As className={buttonClass({ variant, size, className })} {...props} {...rest}>
      {children}
    </As>
  );
}

import Icon from './Icon';
import { IconButton } from '../ui';
import { useSaved } from '../../lib/wishlist';

/**
 * Heart that saves / unsaves a design (guests: this device; signed in: the account).
 * `boxed`: a plain button styled entirely by `className` (e.g. next to the laptop WhatsApp button).
 */
export default function SaveButton({ product, className, iconClassName = 'text-xl', size = 'md', boxed = false }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(product);
  const label = saved ? `Remove ${product.name} from saved designs` : `Save ${product.name}`;
  const iconClass = saved ? `${iconClassName} text-primary` : iconClassName;
  if (boxed) {
    return (
      <button type="button" aria-label={label} aria-pressed={saved} onClick={() => toggle(product)} className={className}>
        <Icon name="favorite" fill={saved} className={iconClass} />
      </button>
    );
  }
  return (
    <IconButton
      icon="favorite"
      fill={saved}
      size={size}
      label={label}
      aria-pressed={saved}
      onClick={() => toggle(product)}
      className={className}
      iconClassName={iconClass}
    />
  );
}

/** Heart link with the saved count (headers). */
export function SavedCountBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary-container text-white text-[10px] font-semibold flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}

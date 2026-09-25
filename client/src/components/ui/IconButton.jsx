import Icon from '../shared/Icon';
import { cx } from './cx';

const SIZES = { sm: 'w-8 h-8', md: 'w-9 h-9', lg: 'w-10 h-10' };

/** Round icon-only button (header menu/search/back/share, close). `label` is required for screen readers. */
export default function IconButton({ icon, label, size = 'md', className, iconClassName, fill, type = 'button', ...rest }) {
  return (
    <button type={type} aria-label={label} className={cx(SIZES[size], 'rounded-full flex items-center justify-center', className)} {...rest}>
      <Icon name={icon} fill={fill} className={iconClassName} />
    </button>
  );
}

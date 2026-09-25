import Icon from '../shared/Icon';
import { cx } from './cx';

/** Centered icon + title + one line of help, with optional actions underneath (children). */
export default function EmptyState({ icon, title, body, bodyClassName, children }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <Icon name={icon} className="text-4xl text-outline" />
      <p className="font-headline-sm text-[18px] text-primary mt-2">{title}</p>
      {body && <p className={cx('font-body-sm text-body-sm text-on-surface-variant mt-1', bodyClassName)}>{body}</p>}
      {children}
    </div>
  );
}

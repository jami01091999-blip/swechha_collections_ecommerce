import { cx } from './cx';

const TITLE = 'font-headline-sm text-headline-sm md:text-headline-md text-primary font-medium';
const SUBTITLE = 'font-body-sm text-body-sm text-on-surface-variant';

/** Serif section title with a one-line subtitle and an optional action (e.g. "View all") on the right. */
export default function SectionHeader({ title, subtitle, action, className }) {
  if (!action) {
    return (
      <div className={className}>
        <h2 className={TITLE}>{title}</h2>
        {subtitle && <p className={SUBTITLE}>{subtitle}</p>}
      </div>
    );
  }
  return (
    <div className={cx('flex items-baseline justify-between', className)}>
      <div>
        <h2 className={TITLE}>{title}</h2>
        {subtitle && <p className={cx(SUBTITLE, '-mt-0.5')}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

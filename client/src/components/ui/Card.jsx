import { cx } from './cx';

/** White card with hairline border and soft shadow (`.admin-card` in index.css). */
export default function Card({ as: As = 'div', className, children, ...rest }) {
  return (
    <As className={cx('admin-card', className)} {...rest}>
      {children}
    </As>
  );
}

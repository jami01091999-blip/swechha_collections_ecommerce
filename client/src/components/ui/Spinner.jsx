import { cx } from './cx';

/** Maroon spinning circle (loading). */
export default function Spinner({ className }) {
  return <span className={cx('w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin', className)} />;
}

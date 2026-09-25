import { DESK } from '../../lib/constants';
import { cx } from './cx';

/**
 * Laptop content width (`DESK`): phones are untouched, from md: the content is centred at max-w-6xl.
 * Renders a <div> by default; use `as="main"`, `as="section"`, etc.
 */
export default function PageContainer({ as: As = 'div', className, children, ...rest }) {
  return (
    <As className={cx(className, DESK)} {...rest}>
      {children}
    </As>
  );
}

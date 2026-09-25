import { cx } from './cx';

const TONES = {
  default: 'bg-surface-container',
  low: 'bg-surface-container-low',
  lowest: 'bg-surface-container-lowest',
  none: '',
};

/** Pulsing placeholder block. Size and shape come from `className`. */
export default function Skeleton({ className, tone = 'default', ...rest }) {
  return <div className={cx(className, TONES[tone], 'animate-pulse')} {...rest} />;
}

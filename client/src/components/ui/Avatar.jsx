import { cx } from './cx';

/** "Divya Rao" → "DR", "" + "ana@x.com" → "A". `max` = how many letters. */
export function initials(user, max = 2) {
  const words = String(user?.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length)
    return words
      .slice(0, max)
      .map((w) => w[0].toUpperCase())
      .join('');
  return String(user?.email || '?')[0].toUpperCase();
}

/** Gold-ringed initials circle (the admin header's "SC" badge). */
export default function Avatar({ children, className }) {
  return (
    <span
      className={cx(
        'w-9 h-9 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary font-title-md text-title-md font-bold shadow-luxury-subtle',
        className
      )}
    >
      {children}
    </span>
  );
}

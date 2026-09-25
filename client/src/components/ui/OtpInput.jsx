import { useRef } from 'react';
import { cx } from './cx';

const BOX =
  'w-10 h-12 rounded-xl border border-[#EBE5DD] bg-[#FAF6F0] text-center font-title-md text-[18px] text-on-surface focus:border-[#C59B6A] focus:ring-0 disabled:opacity-60';

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

/**
 * One-time code boxes (default 6). `value` is a digits-only string.
 * Supports paste of the whole code, SMS/email autofill, auto-advance, backspace to the previous box,
 * arrow keys, and opens the numeric keypad on phones. Calls onComplete(code) once every box is filled.
 */
export default function OtpInput({
  value = '',
  onChange,
  onComplete,
  length = 6,
  invalid = false,
  disabled = false,
  autoFocus = false,
  label = 'One-time code',
}) {
  const refs = useRef([]);
  const code = onlyDigits(value).slice(0, length);
  const focus = (i) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next, focusAt) => {
    const clean = onlyDigits(next).slice(0, length);
    onChange?.(clean);
    if (focusAt !== undefined) requestAnimationFrame(() => focus(focusAt));
    if (clean.length === length && clean !== code) onComplete?.(clean);
  };

  const handleChange = (i, raw) => {
    const typed = onlyDigits(raw);
    if (!typed) return;
    // Autofill or fast typing can deliver several digits into one box: spread them forward.
    const start = Math.min(i, code.length);
    const next = code.slice(0, start) + typed;
    commit(next, start + typed.length);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (code[i]) commit(code.slice(0, i) + code.slice(i + 1), i);
      else if (i > 0) commit(code.slice(0, i - 1) + code.slice(i), i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(Math.min(i + 1, code.length));
    }
  };

  const handlePaste = (e) => {
    const pasted = onlyDigits(e.clipboardData?.getData('text'));
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.slice(0, length);
    commit(next, Math.min(next.length, length - 1));
  };

  return (
    <div role="group" aria-label={label} className="flex items-center justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          value={code[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => {
            // Never leave a gap: jump to the first empty box.
            if (i > code.length) focus(code.length);
            else e.target.select();
          }}
          className={cx(BOX, invalid && 'field-error')}
        />
      ))}
    </div>
  );
}

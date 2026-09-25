import { forwardRef } from 'react';
import { cx } from './cx';

/** Label + control + error (or hint) underneath. */
export function Field({ label, required, error, hint, children, htmlFor }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="font-body-sm text-[12px] text-error mt-1">{error}</p>
      ) : (
        hint && <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">{hint}</p>
      )}
    </div>
  );
}

// Ivory field with hairline border and gold focus (`.field` in index.css). `invalid` adds the error tint.
const fieldClass = (invalid, className) => cx('field', className, invalid && 'field-error');

export const Input = forwardRef(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={fieldClass(invalid, className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={fieldClass(invalid, className)} {...rest} />;
});

export const Select = forwardRef(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={fieldClass(invalid, className)} {...rest}>
      {children}
    </select>
  );
});

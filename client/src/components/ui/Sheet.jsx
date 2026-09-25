import { useEffect } from 'react';
import Button from './Button';

/** Bottom sheet container: slides up on phones, centred dialog from md:. Closes on Escape or backdrop tap; locks page scroll. */
export default function Sheet({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="animate-sheet-up relative w-full max-w-[480px] md:max-w-md max-h-[88vh] overflow-y-auto bg-background rounded-t-[24px] md:rounded-[24px] shadow-luxury border-t md:border border-outline-variant/30 px-gutter-mobile md:px-5 pt-2 md:pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="md:hidden w-10 h-1 rounded-full bg-outline-variant mx-auto mb-3" />
        {children}
      </div>
    </div>
  );
}

/** "Are you sure?" sheet with Cancel + a destructive confirm button. */
export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose, busy }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{body}</p>
      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

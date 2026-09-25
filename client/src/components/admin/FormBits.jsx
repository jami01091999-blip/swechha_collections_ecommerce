import Icon from '../shared/Icon';
import { Card } from '../ui';

// Field, Segmented and Switch moved to components/ui.

export function Section({ title, hint, children, id, action }) {
  return (
    <Card as="section" id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-headline-sm text-[18px] leading-tight text-primary">{title}</h2>
          {hint && <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">{hint}</p>}
        </div>
        {action && <div className="flex items-center gap-1 shrink-0">{action}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

export function ErrorSummary({ errors }) {
  const list = Object.values(errors).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-error/30 bg-error-container/40 p-3 flex gap-2" role="alert">
      <Icon name="error" className="text-error text-[20px] shrink-0" />
      <div className="font-body-sm text-[13px] text-on-error-container">
        <p className="font-semibold">Fix {list.length === 1 ? 'this' : 'these'} before saving:</p>
        <ul className="list-disc list-inside">
          {list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

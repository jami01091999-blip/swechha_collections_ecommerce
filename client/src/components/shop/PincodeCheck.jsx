import { useState } from 'react';
import { Button, Input } from '../ui';
import Icon from '../shared/Icon';
import { usePincode } from '../../lib/api';
import { etaText } from './ShopBits';

const KEY = 'swechha_pincode';
const saved = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

/** "Check delivery": delivery date and COD availability for a PIN code (remembered on this device). */
export default function PincodeCheck() {
  const [input, setInput] = useState(saved);
  const [pin, setPin] = useState(saved);
  const { data, loading } = usePincode(pin);
  const check = (e) => {
    e.preventDefault();
    const v = input.trim();
    setPin(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-2">
      <span className="font-label-md text-[12px] font-semibold text-on-surface">Check delivery</span>
      <form onSubmit={check} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter PIN code"
          aria-label="PIN code"
        />
        <Button type="submit" variant="secondary" size="sm" className="px-4 shrink-0" disabled={input.length !== 6}>
          Check
        </Button>
      </form>
      {pin && /^\d{6}$/.test(pin) && (
        <div className="font-body-sm text-[12px]" aria-live="polite">
          {loading && !data ? (
            <span className="text-on-surface-variant">Checking…</span>
          ) : !data ? null : data.serviceable ? (
            <div className="space-y-0.5">
              <p className="text-emerald-700 font-semibold flex items-center gap-1">
                <Icon name="local_shipping" className="text-[16px]" /> {etaText(data)}
              </p>
              <p className="text-on-surface-variant">{data.cod ? 'Cash on delivery available' : 'Online payment only for this PIN code'}</p>
            </div>
          ) : (
            <p className="text-error">{data.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

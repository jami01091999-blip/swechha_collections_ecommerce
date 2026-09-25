import { useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import { adminKey, api, onAuthFailure } from '../../lib/api';

/**
 * Not a login: the admin key is asked once per device and remembered.
 * It is what stops strangers from calling the add/edit/delete APIs directly.
 */
export default function AdminGate({ children }) {
  const [state, setState] = useState('checking'); // checking | locked | ok | error
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setState('checking');
    try {
      const { required } = await api('/admin/verify');
      if (!required) return setState('ok');
      if (!adminKey.get()) return setState('locked');
      await api('/admin/verify', { method: 'POST', admin: true });
      setState('ok');
    } catch (e) {
      if (e.status === 401) {
        adminKey.clear();
        setState('locked');
      } else {
        setErr(e.message);
        setState('error');
      }
    }
  };

  useEffect(() => {
    check();
    return onAuthFailure(() => {
      adminKey.clear();
      setErr('Your admin key changed. Enter the new one.');
      setState('locked');
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return setErr('Enter the admin key.');
    setBusy(true);
    setErr('');
    adminKey.set(value.trim());
    try {
      await api('/admin/verify', { method: 'POST', admin: true });
      setState('ok');
    } catch (e2) {
      adminKey.clear();
      setErr(e2.status === 401 ? 'Incorrect key' : e2.message);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'ok') return children;

  return (
    <div className="flex-1 flex items-center justify-center px-gutter-mobile py-16">
      {state === 'checking' ? (
        <div className="flex flex-col items-center gap-2 text-on-surface-variant">
          <span className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          <span className="font-label-md text-label-md">Opening atelier…</span>
        </div>
      ) : state === 'error' ? (
        <div className="admin-card text-center w-full md:max-w-sm">
          <p className="font-body-sm text-body-sm text-on-surface">{err}</p>
          <button onClick={check} className="mt-3 font-label-lg text-label-lg text-primary underline" type="button">
            Try again
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="admin-card w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5">
          <div className="w-12 h-12 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary">
            <Icon name="lock" className="text-[24px]" />
          </div>
          <h1 className="font-headline-sm text-headline-sm text-primary mt-3">Enter Admin Key</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Asked once on this device.</p>
          <label className="relative w-full mt-4 text-left">
            <span className="sr-only">Admin key</span>
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className={`field pr-11 ${err ? 'field-error' : ''}`}
              placeholder="Admin key"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant"
            >
              <Icon name={show ? 'visibility_off' : 'visibility'} className="text-[20px]" />
            </button>
          </label>
          {err && <p className="w-full text-left font-body-sm text-[12px] text-error mt-1.5">{err}</p>}
          <button
            disabled={busy}
            className="w-full mt-4 bg-primary-container hover:bg-[#541423] text-surface-container-lowest py-3 rounded-xl font-title-md text-[15px] font-semibold shadow-luxury active:scale-95 transition-all disabled:opacity-60"
            type="submit"
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import { Button, Card, Input } from '../ui';
import { AdminPageLoading } from './AdminLoading';
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

  if (state === 'checking') return <AdminPageLoading />;

  return (
    <div className="flex-1 flex items-center justify-center px-gutter-mobile py-16">
      {state === 'error' ? (
        <Card className="text-center w-full md:max-w-sm">
          <p className="font-body-sm text-body-sm text-on-surface">{err}</p>
          <Button variant="ghost" size="sm" onClick={check} className="mt-3">
            Try again
          </Button>
        </Card>
      ) : (
        <Card as="form" onSubmit={submit} className="w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5">
          <div className="w-12 h-12 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary">
            <Icon name="lock" className="text-[24px]" />
          </div>
          <h1 className="font-headline-sm text-headline-sm text-primary mt-3">Enter Admin Key</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Asked once on this device.</p>
          <label className="relative w-full mt-4 text-left">
            <span className="sr-only">Admin key</span>
            <Input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="pr-11"
              invalid={!!err}
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
          <Button type="submit" disabled={busy} className="w-full mt-4">
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import Icon from '../../components/shared/Icon';
import { Button, Card, Input, OtpInput } from '../../components/ui';
import { requestCode, updateMe, verifyCode } from '../../lib/api';
import { PageSpinner, safeNext, useAuth } from '../../lib/auth';

/** Seconds left on a countdown that can be (re)started. */
export function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function StepIcon({ name }) {
  return (
    <div className="w-12 h-12 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary">
      <Icon name={name} className="text-[24px]" />
    </div>
  );
}

const ErrorLine = ({ children }) =>
  children ? (
    <p className="w-full text-left font-body-sm text-[12px] text-error mt-1.5" role="alert">
      {children}
    </p>
  ) : null;

/** Email step. */
export function EmailStep({ email, setEmail, onSent, initialError = '' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr('Enter your email address.');
    setBusy(true);
    setErr('');
    try {
      const res = await requestCode(email);
      onSent(res.resendIn || 60);
    } catch (e2) {
      // Still inside the cool-down from an earlier request: the code already sent is valid, so move on.
      if (e2.status === 429 && e2.data?.code === 'OTP_RATE_LIMIT' && /^Wait/.test(e2.message)) onSent(e2.data.retryAfter);
      else setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={submit} noValidate className="w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5">
      <StepIcon name="person" />
      <h1 className="font-headline-sm text-headline-sm text-primary mt-3">Sign in or create an account</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">We'll email you a 6-digit code.</p>
      <label className="w-full mt-4 text-left">
        <span className="sr-only">Email address</span>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          invalid={!!err}
        />
      </label>
      <ErrorLine>{err}</ErrorLine>
      <Button type="submit" disabled={busy} className="w-full mt-4">
        {busy ? 'Sending…' : 'Continue'}
      </Button>
    </Card>
  );
}

/** Code step: OTP boxes, auto-submit on the 6th digit, resend with countdown. */
export function CodeStep({ email, resendIn, onChangeEmail, onVerified, initialError = '' }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError);
  const [left, setLeft] = useCountdown();
  const busyRef = useRef(false);

  useEffect(() => setLeft(resendIn), [resendIn, setLeft]);

  const verify = async (value = code) => {
    if (busyRef.current) return;
    if (!/^\d{6}$/.test(value)) return setErr('Enter the 6-digit code.');
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      onVerified(await verifyCode(email, value));
    } catch (e) {
      setErr(e.message);
      setCode('');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr('');
    try {
      const res = await requestCode(email);
      setCode('');
      setLeft(res.resendIn || 60);
    } catch (e) {
      setErr(e.message);
      if (e.data?.retryAfter) setLeft(e.data.retryAfter);
    }
  };

  return (
    <Card
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
      className="w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5"
    >
      <StepIcon name="mark_email_read" />
      <h1 className="font-headline-sm text-headline-sm text-primary mt-3">Enter the code</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
        Sent to <span className="font-semibold text-on-surface break-all">{email}</span>.{' '}
        <Button variant="ghost" size="sm" onClick={onChangeEmail}>
          Change
        </Button>
      </p>
      <div className="w-full mt-4">
        <OtpInput value={code} onChange={setCode} onComplete={verify} invalid={!!err} disabled={busy} autoFocus label="Sign-in code" />
      </div>
      <ErrorLine>{err}</ErrorLine>
      <Button type="submit" disabled={busy || code.length < 6} className="w-full mt-4">
        {busy ? 'Checking…' : 'Sign in'}
      </Button>
      <p className="font-body-sm text-[12px] text-on-surface-variant mt-3">
        {left > 0 ? (
          `Didn't get it? You can resend in ${mmss(left)}.`
        ) : (
          <>
            Didn't get it?{' '}
            <Button variant="ghost" size="sm" onClick={resend}>
              Resend code
            </Button>
          </>
        )}
      </p>
    </Card>
  );
}

/** Optional name step for new accounts. */
export function NameStep({ onDone }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return onDone();
    setBusy(true);
    setErr('');
    try {
      await updateMe({ name });
      onDone();
    } catch (e2) {
      setErr(e2.data?.fields?.name || e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={save} className="w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5">
      <StepIcon name="waving_hand" />
      <h1 className="font-headline-sm text-headline-sm text-primary mt-3">What should we call you?</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">You can change this later in your account.</p>
      <label className="w-full mt-4 text-left">
        <span className="sr-only">Your name</span>
        <Input
          autoComplete="name"
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          invalid={!!err}
        />
      </label>
      <ErrorLine>{err}</ErrorLine>
      <Button type="submit" disabled={busy} className="w-full mt-4">
        {busy ? 'Saving…' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDone} className="mt-3">
        Skip
      </Button>
    </Card>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState('email'); // email | code | name
  const [email, setEmail] = useState('');
  const [resendIn, setResendIn] = useState(60);
  const inFlow = useRef(false);

  const finish = () => navigate(next, { replace: true });

  let body;
  if (!inFlow.current && loading) body = <PageSpinner />;
  else if (!inFlow.current && user) return <Navigate to={next} replace />;
  else if (step === 'email')
    body = (
      <EmailStep
        email={email}
        setEmail={setEmail}
        onSent={(s) => {
          // From here on, signing in must not trigger the "already signed in" redirect (the name step comes first).
          inFlow.current = true;
          setResendIn(s);
          setStep('code');
        }}
      />
    );
  else if (step === 'code')
    body = (
      <CodeStep
        email={email}
        resendIn={resendIn}
        onChangeEmail={() => setStep('email')}
        onVerified={({ user: u, isNew }) => {
          if (isNew || !u.name) setStep('name');
          else finish();
        }}
      />
    );
  else body = <NameStep onDone={finish} />;

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="Account" subtitle="Sign in" />
      <main className="flex-1 flex items-center justify-center px-gutter-mobile py-10 md:py-16">{body}</main>
      <BottomNav />
    </div>
  );
}

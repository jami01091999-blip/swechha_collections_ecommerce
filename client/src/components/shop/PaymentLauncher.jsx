// Opens the right payment screen for a `payment` payload from the API:
//   razorpay → Razorpay Checkout (loaded on demand from checkout.razorpay.com)
//   mock     → a built-in test sheet with "Pay" / "Fail" (only offered while the shop is in test mode)
// Calls onPaid(order) when the order is confirmed, onClosed() when the customer backs out.
import { useEffect, useRef, useState } from 'react';
import { mockPay, reportPaymentFailure, verifyRazorpay } from '../../lib/api';
import { formatINR } from '../../lib/format';
import { Button, Sheet } from '../ui';
import Icon from '../shared/Icon';

let scriptPromise = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't open the payment screen. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

function RazorpayCheckout({ payment, onPaid, onClosed, onError }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let settled = false;
    loadRazorpay()
      .then((Razorpay) => {
        const rz = new Razorpay({
          key: payment.keyId,
          order_id: payment.providerOrderId,
          amount: payment.amount,
          currency: payment.currency,
          name: payment.name,
          description: payment.description,
          prefill: payment.prefill,
          theme: { color: '#6b1d2f' },
          handler: async (resp) => {
            settled = true;
            try {
              onPaid(await verifyRazorpay({ orderNumber: payment.orderNumber, ...resp }));
            } catch (e) {
              onError(e.message);
            }
          },
          modal: {
            ondismiss: () => {
              if (!settled) onClosed();
            },
          },
        });
        rz.on('payment.failed', (resp) => {
          reportPaymentFailure(payment.orderNumber, resp?.error?.description).catch(() => {});
        });
        rz.open();
      })
      .catch((e) => onError(e.message));
  }, [payment, onPaid, onClosed, onError]);
  return null;
}

function MockCheckout({ payment, onPaid, onClosed, onError }) {
  const [busy, setBusy] = useState(null);
  const go = async (outcome) => {
    setBusy(outcome);
    try {
      const order = await mockPay(payment.orderNumber, outcome);
      if (outcome === 'success') onPaid(order);
      else onError('The test payment failed. You can try again.');
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet onClose={onClosed} label="Test payment">
      <div className="flex items-center gap-2 text-secondary">
        <Icon name="science" className="text-[20px]" />
        <span className="font-label-md text-label-md font-semibold uppercase tracking-wider">Test payment</span>
      </div>
      <h2 className="font-headline-sm text-headline-sm text-primary mt-1">Pay {formatINR(payment.amount / 100)}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
        The shop is in test mode, so no money moves. Choose what should happen to this payment.
      </p>
      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <Button variant="secondary" size="sm" onClick={() => go('failure')} disabled={Boolean(busy)}>
          {busy === 'failure' ? 'Working…' : 'Make it fail'}
        </Button>
        <Button size="sm" onClick={() => go('success')} disabled={Boolean(busy)}>
          {busy === 'success' ? 'Paying…' : 'Pay now'}
        </Button>
      </div>
    </Sheet>
  );
}

export default function PaymentLauncher({ payment, onPaid, onClosed, onError }) {
  if (!payment) return null;
  const Screen = payment.provider === 'razorpay' ? RazorpayCheckout : MockCheckout;
  return <Screen payment={payment} onPaid={onPaid} onClosed={onClosed} onError={onError} />;
}

import { useState } from 'react';
import { Button, Field, Input, Segmented, Select, Sheet, Switch } from '../ui';
import { addAddress, updateAddress } from '../../lib/api';
import { INDIAN_STATES } from '../../lib/india';
import { addressErrors } from '../../lib/validation';
import { useToast } from '../../context/Toast';

const EMPTY = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  type: 'home',
  isDefault: false,
};
const TYPES = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
];

/** Add or edit an address: bottom sheet on phones, dialog from md:. */
export default function AddressSheet({ address, defaultName = '', defaultPhone = '', onClose }) {
  const toast = useToast();
  const editing = Boolean(address?._id);
  const [form, setForm] = useState(() => (editing ? { ...EMPTY, ...address } : { ...EMPTY, fullName: defaultName, phone: defaultPhone }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const found = addressErrors(form);
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { _id, createdAt, updatedAt, ...body } = form;
      if (editing) await updateAddress(address._id, body);
      else await addAddress(body);
      toast(editing ? 'Address updated' : 'Address saved');
      onClose();
    } catch (err) {
      if (err.data?.fields) setErrors(err.data.fields);
      else setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = (name, props = {}) => (
    <Input id={`addr-${name}`} value={form[name]} onChange={(e) => set({ [name]: e.target.value })} invalid={!!errors[name]} {...props} />
  );

  return (
    <Sheet onClose={onClose} label={editing ? 'Edit address' : 'Add address'}>
      <form onSubmit={save} noValidate className="space-y-3">
        <h2 className="font-headline-sm text-headline-sm text-primary">{editing ? 'Edit address' : 'Add address'}</h2>
        <Field label="Full name" required error={errors.fullName} htmlFor="addr-fullName">
          {input('fullName', { autoComplete: 'name', maxLength: 60 })}
        </Field>
        <Field label="Mobile number" required error={errors.phone} htmlFor="addr-phone" hint="10 digits, for delivery updates.">
          {input('phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel-national', maxLength: 16 })}
        </Field>
        <Field label="House number and street" required error={errors.line1} htmlFor="addr-line1">
          {input('line1', { autoComplete: 'address-line1', maxLength: 120 })}
        </Field>
        <Field label="Area or locality" error={errors.line2} htmlFor="addr-line2">
          {input('line2', { autoComplete: 'address-line2', maxLength: 120 })}
        </Field>
        <Field label="Landmark" error={errors.landmark} htmlFor="addr-landmark">
          {input('landmark', { maxLength: 80 })}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" required error={errors.city} htmlFor="addr-city">
            {input('city', { autoComplete: 'address-level2', maxLength: 60 })}
          </Field>
          <Field label="PIN code" required error={errors.pincode} htmlFor="addr-pincode">
            {input('pincode', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 6 })}
          </Field>
        </div>
        <Field label="State" required error={errors.state} htmlFor="addr-state">
          <Select id="addr-state" value={form.state} onChange={(e) => set({ state: e.target.value })} invalid={!!errors.state}>
            <option value="">Choose a state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Segmented label="Address type" value={form.type} options={TYPES} onChange={(type) => set({ type })} />
        {!(editing && address.isDefault) && (
          <Switch checked={form.isDefault} onChange={(isDefault) => set({ isDefault })} label="Make this my default address" />
        )}
        {serverError && (
          <p className="font-body-sm text-[12px] text-error" role="alert">
            {serverError}
          </p>
        )}
        <div className="grid grid-cols-[1fr_2fr] gap-2.5 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save address'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

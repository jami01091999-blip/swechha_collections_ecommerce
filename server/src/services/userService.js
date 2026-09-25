import { MAX_ADDRESSES, User, publicUser } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { sanitizeAddress, sanitizeProfile, validateAddress } from '../validators/user.js';

const notFound = () => new HttpError(404, 'Address not found.');

export async function updateProfile(userId, body) {
  const changes = sanitizeProfile(body);
  const user = await User.findByIdAndUpdate(userId, { $set: changes }, { new: true }).lean();
  return publicUser(user);
}

/* ── addresses ────────────────────────────────────────────── */
const publicAddress = (a) => ({
  _id: String(a._id),
  fullName: a.fullName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2 || '',
  landmark: a.landmark || '',
  city: a.city,
  state: a.state,
  pincode: a.pincode,
  type: a.type,
  isDefault: Boolean(a.isDefault),
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

/** Default first, then most recently changed. */
const sorted = (list) =>
  [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || new Date(b.updatedAt) - new Date(a.updatedAt)).map(publicAddress);

async function loadUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'Please sign in to continue.', { code: 'AUTH_REQUIRED' });
  return user;
}

/** Exactly one default whenever any address exists. */
function ensureOneDefault(user, preferredId) {
  const list = user.addresses;
  if (!list.length) return;
  const target = (preferredId && list.id(preferredId)) || list.find((a) => a.isDefault) || mostRecent(list);
  for (const a of list) a.isDefault = a._id.equals(target._id);
}

const mostRecent = (list) => [...list].sort((a, b) => b.createdAt - a.createdAt)[0];

export async function listAddresses(userId) {
  const user = await User.findById(userId).select('addresses').lean();
  return sorted(user?.addresses || []);
}

export async function addAddress(userId, body) {
  const data = sanitizeAddress(body);
  validateAddress(data);
  const user = await loadUser(userId);
  if (user.addresses.length >= MAX_ADDRESSES) throw new HttpError(400, 'You can save up to 10 addresses.');
  const makeDefault = data.isDefault || user.addresses.length === 0;
  user.addresses.push({ ...data, isDefault: false });
  const added = user.addresses[user.addresses.length - 1];
  ensureOneDefault(user, makeDefault ? added._id : null);
  await user.save();
  return { address: publicAddress(added), addresses: sorted(user.addresses) };
}

export async function updateAddress(userId, addressId, body) {
  const user = await loadUser(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw notFound();
  const changes = sanitizeAddress(body, { partial: true });
  const merged = { ...address.toObject(), ...changes };
  validateAddress(merged);
  const { isDefault, ...rest } = changes;
  address.set(rest);
  // Turning the default off is ignored: there must always be one. Turning it on moves it here.
  ensureOneDefault(user, isDefault ? address._id : null);
  await user.save();
  return { address: publicAddress(address), addresses: sorted(user.addresses) };
}

export async function removeAddress(userId, addressId) {
  const user = await loadUser(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw notFound();
  address.deleteOne();
  // If the default was removed, the most recent remaining address becomes the default.
  ensureOneDefault(user);
  await user.save();
  return { addresses: sorted(user.addresses) };
}

export async function makeDefault(userId, addressId) {
  const user = await loadUser(userId);
  if (!user.addresses.id(addressId)) throw notFound();
  ensureOneDefault(user, addressId);
  await user.save();
  return { addresses: sorted(user.addresses) };
}

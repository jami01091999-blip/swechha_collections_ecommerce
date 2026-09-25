import mongoose from 'mongoose';
import * as users from '../services/userService.js';
import { HttpError } from '../utils/HttpError.js';
import { noStore } from '../utils/cache.js';

// The user id always comes from the session (req.user), never from the request body or URL.
const addressId = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Address not found.');
  return req.params.id;
};

export async function updateMe(req, res) {
  noStore(res);
  res.status(200).json({ user: await users.updateProfile(req.user._id, req.body || {}) });
}

export async function listAddresses(req, res) {
  noStore(res);
  res.status(200).json({ addresses: await users.listAddresses(req.user._id) });
}

export async function addAddress(req, res) {
  noStore(res);
  res.status(201).json(await users.addAddress(req.user._id, req.body || {}));
}

export async function updateAddress(req, res) {
  noStore(res);
  res.status(200).json(await users.updateAddress(req.user._id, addressId(req), req.body || {}));
}

export async function removeAddress(req, res) {
  noStore(res);
  res.status(200).json(await users.removeAddress(req.user._id, addressId(req)));
}

export async function makeDefault(req, res) {
  noStore(res);
  res.status(200).json(await users.makeDefault(req.user._id, addressId(req)));
}

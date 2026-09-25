import mongoose from 'mongoose';
import { User, publicUser } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { parseEmail } from './otpService.js';

const TEAM_ROLES = ['staff', 'admin'];
const member = (u) => ({ ...publicUser(u), lastLoginAt: u.lastLoginAt || null });

function parseRole(role) {
  if (!TEAM_ROLES.includes(role)) throw new HttpError(400, 'Choose a role: staff or admin.');
  return role;
}

async function findMember(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(404, 'Team member not found.');
  const user = await User.findOne({ _id: userId, role: { $in: TEAM_ROLES } }).lean();
  if (!user) throw new HttpError(404, 'Team member not found.');
  return user;
}

async function assertNotLastAdmin(user) {
  if (user.role !== 'admin') return;
  const admins = await User.countDocuments({ role: 'admin' });
  if (admins <= 1) throw new HttpError(400, 'Keep at least one admin.');
}

export async function listTeam() {
  const users = await User.find({ role: { $in: TEAM_ROLES } })
    .sort({ role: 1, email: 1 })
    .lean();
  return users.map(member);
}

/** Adds (or re-roles) someone by email. Creates the account if they have never signed in. */
export async function addMember({ email: rawEmail, role: rawRole }) {
  const email = parseEmail(rawEmail);
  const role = parseRole(rawRole);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role }, $setOnInsert: { email } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return member(user);
}

export async function changeRole(actor, userId, rawRole) {
  const role = parseRole(rawRole);
  const user = await findMember(userId);
  if (String(user._id) === String(actor._id)) throw new HttpError(400, "You can't change your own role.");
  if (role !== 'admin') await assertNotLastAdmin(user);
  const updated = await User.findByIdAndUpdate(user._id, { $set: { role } }, { new: true }).lean();
  return member(updated);
}

/** Removes someone from the team (they stay a customer). */
export async function removeMember(actor, userId) {
  const user = await findMember(userId);
  if (String(user._id) === String(actor._id)) throw new HttpError(400, "You can't remove yourself.");
  await assertNotLastAdmin(user);
  await User.updateOne({ _id: user._id }, { $set: { role: 'customer' } });
}

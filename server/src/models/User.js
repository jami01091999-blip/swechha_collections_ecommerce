import mongoose from 'mongoose';
import { EMAIL_RE, INDIAN_STATES, PHONE_RE, PINCODE_RE } from '../validators/india.js';

const { Schema } = mongoose;

export const ROLES = ['customer', 'staff', 'admin'];
export const ADDRESS_TYPES = ['home', 'work', 'other'];
export const MAX_ADDRESSES = 10;

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, required: true, match: PHONE_RE },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120, default: '' },
    landmark: { type: String, trim: true, maxlength: 80, default: '' },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, enum: INDIAN_STATES },
    pincode: { type: String, required: true, match: PINCODE_RE },
    type: { type: String, enum: ADDRESS_TYPES, default: 'home' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: EMAIL_RE, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 60, default: '' },
    phone: { type: String, default: '', validate: { validator: (v) => !v || PHONE_RE.test(v) } },
    role: { type: String, enum: ROLES, default: 'customer' },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: { validator: (list) => list.length <= MAX_ADDRESSES, message: 'You can save up to 10 addresses.' },
    },
    isBlocked: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { collection: 'users', versionKey: false, timestamps: true }
);

userSchema.index({ role: 1 });

/** The only user shape that leaves the server. */
export function publicUser(u) {
  if (!u) return null;
  return {
    _id: String(u._id),
    email: u.email,
    name: u.name || '',
    phone: u.phone || '',
    role: u.role,
    createdAt: u.createdAt,
  };
}

export const User = mongoose.models.User || mongoose.model('User', userSchema);

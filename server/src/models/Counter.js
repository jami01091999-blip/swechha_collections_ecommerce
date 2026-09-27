import mongoose from 'mongoose';

// Sequences for human-readable numbers (orders, invoices). One document per sequence per year.
const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: 'counters', versionKey: false }
);

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/** Next value of a named sequence, e.g. nextNumber('SW') → "SW-2026-000042". */
export async function nextNumber(prefix, date = new Date()) {
  const year = date.getFullYear();
  const doc = await Counter.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true, lean: true });
  return `${prefix}-${year}-${String(doc.seq).padStart(6, '0')}`;
}

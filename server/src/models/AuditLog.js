import mongoose from 'mongoose';

const { Schema } = mongoose;

// Who changed what in the admin (orders, refunds, stock, products, coupons, team, settings, staff sign-ins).
const auditSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    summary: String,
    meta: Schema.Types.Mixed,
    ip: String,
    at: { type: Date, default: Date.now },
  },
  { collection: 'audit_logs', versionKey: false }
);
auditSchema.index({ at: -1 });
auditSchema.index({ entity: 1, entityId: 1, at: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditSchema);

import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

/** Records an admin action. Never throws: an audit failure must not break the action itself. */
export async function audit(req, action, { entity, entityId, summary, meta } = {}) {
  try {
    await AuditLog.create({
      actorId: req?.user?._id,
      actorEmail: req?.user?.email || 'system',
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      meta,
      ip: req?.ip,
    });
  } catch (e) {
    logger.warn({ action, reason: e.message }, 'Audit log write failed');
  }
}

export async function listAudit({ page = 1, limit = 50, entity, entityId }) {
  const filter = {};
  if (entity) filter.entity = entity;
  if (entityId) filter.entityId = entityId;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

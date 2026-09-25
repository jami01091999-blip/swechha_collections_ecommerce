import { adminKeyRequired, isAdmin } from '../middlewares/adminKey.js';
import { noStore } from '../utils/cache.js';

// GET → does this deployment need a key at all?
export function keyRequired(req, res) {
  noStore(res);
  res.status(200).json({ required: adminKeyRequired() });
}

// POST with x-admin-key → is the key correct?
export function verifyKey(req, res) {
  noStore(res);
  const ok = isAdmin(req);
  res.status(ok ? 200 : 401).json({ ok });
}

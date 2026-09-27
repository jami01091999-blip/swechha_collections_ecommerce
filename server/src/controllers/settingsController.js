import { audit } from '../services/auditService.js';
import * as settings from '../services/settingsService.js';
import { noStore, publicCache } from '../utils/cache.js';

export async function get(req, res) {
  const data = await settings.getSettings();
  publicCache(res, 60);
  res.status(200).json(data);
}

export async function put(req, res) {
  noStore(res);
  const saved = await settings.saveSettings(req.body || {});
  await audit(req, 'settings.lookbook', { entity: 'settings', entityId: 'site', summary: 'Lookbook and boutique details updated' });
  res.status(200).json(saved);
}

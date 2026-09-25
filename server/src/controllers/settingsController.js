import * as settings from '../services/settingsService.js';
import { noStore, publicCache } from '../utils/cache.js';

export async function get(req, res) {
  const data = await settings.getSettings();
  publicCache(res, 60);
  res.status(200).json(data);
}

export async function put(req, res) {
  noStore(res);
  res.status(200).json(await settings.saveSettings(req.body || {}));
}

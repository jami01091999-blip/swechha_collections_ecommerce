import { Setting } from '../models/Setting.js';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../validators/settings.js';

const SITE = 'site';

export async function getSettings() {
  const doc = await Setting.findById(SITE).lean();
  // eslint-disable-next-line no-unused-vars
  const { _id, ...rest } = doc || {};
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function saveSettings(body) {
  const data = sanitizeSettings(body);
  await Setting.updateOne({ _id: SITE }, { $set: data }, { upsert: true });
  return data;
}

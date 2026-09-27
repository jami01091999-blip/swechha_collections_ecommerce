import { Setting } from '../models/Setting.js';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../validators/settings.js';
import { DEFAULT_SHOP, sanitizeShop } from '../validators/shop.js';

const SITE = 'site';

export async function getSettings() {
  const doc = await Setting.findById(SITE).lean();
  const { _id, ...rest } = doc || {};
  return { ...DEFAULT_SETTINGS, ...rest, shop: { ...DEFAULT_SHOP, ...(rest.shop || {}) } };
}

/** Checkout/delivery/returns rules with defaults filled in. */
export async function getShop() {
  const doc = await Setting.findById(SITE, { shop: 1 }).lean();
  return { ...DEFAULT_SHOP, ...(doc?.shop || {}) };
}

export async function saveShop(body) {
  const shop = sanitizeShop(body);
  await Setting.updateOne({ _id: SITE }, { $set: { shop } }, { upsert: true });
  return shop;
}

export async function saveSettings(body) {
  const data = sanitizeSettings(body);
  await Setting.updateOne({ _id: SITE }, { $set: data }, { upsert: true });
  return data;
}

// Migration 002 — sizes with SKUs, shipping/tax fields, denormalised stock fields.
//
//   npm run migrate:002 -w server               dry run: prints what would change, writes nothing
//   npm run migrate:002 -w server -- --apply    backs up every product to server/backups/, then applies
//
// Safe to run again: a second --apply reports "0 to change".
// Only needs MONGO_URI (and optionally MONGO_DB) from server/.env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { commerceDefaults, DEFAULT_TAX_RATE_PERCENT } from '../../validators/product.js';
import { derive, makeSku, normalizeSizes } from '../../services/productShape.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_BACKUP_DIR = path.resolve(here, '../../../backups');

const COMMERCE_FIELDS = ['weightGrams', 'dimensionsCm', 'hsnCode', 'taxRatePercent', 'isCodAllowed', 'isReturnable', 'maxQtyPerOrder'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Works out the target document for one product. Returns { set, unset, notes }. */
function plan(doc, taken, taxRate) {
  const notes = [];
  const sizeType = doc.sizeType === 'sized' ? 'sized' : 'free';
  const set = {};
  const unset = {};

  let sizes = normalizeSizes({ ...doc, sizeType }, doc.sizes);
  if (sizeType === 'sized' && doc.freeSizeStock !== undefined) {
    if (Number(doc.freeSizeStock) > 0) notes.push(`dropped stale freeSizeStock ${doc.freeSizeStock} (sized product)`);
  } else if (sizeType === 'free' && doc.freeSizeStock !== undefined && !(doc.sizes || []).some((s) => s.label === 'FREE')) {
    notes.push(`free size stock ${doc.freeSizeStock} → FREE row`);
  }

  // SKU collisions across products: keep the first owner, suffix later ones with -2, -3 …
  sizes = sizes.map((s) => {
    let sku = s.sku || makeSku(doc.code, s.label);
    if (taken.has(sku)) {
      const base = sku;
      for (let i = 2; taken.has(sku); i++) sku = `${base}-${i}`;
      notes.push(`SKU collision: ${base} → ${sku}`);
    }
    taken.add(sku);
    return { ...s, sku };
  });

  if (doc.sizeType !== sizeType) set.sizeType = sizeType;
  if (!same(doc.sizes, sizes)) set.sizes = sizes;
  const defaults = commerceDefaults(doc.category, taxRate);
  for (const key of COMMERCE_FIELDS) if (doc[key] === undefined) set[key] = defaults[key];
  const derived = derive({ ...doc, sizes });
  for (const [key, value] of Object.entries(derived)) if (!same(doc[key], value)) set[key] = value;
  if (doc.freeSizeStock !== undefined) unset.freeSizeStock = '';
  return { set, unset, notes };
}

/**
 * Runs the migration against a connected `db` (native driver). Returns a report object.
 * With apply=false nothing is written.
 */
export async function migrate002({ db, apply = false, backupDir = DEFAULT_BACKUP_DIR, log = console.log }) {
  const col = db.collection('products');
  const products = await col.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
  const settings = await db.collection('settings').findOne({ _id: 'site' });
  const taxRate = settings?.defaultTaxRatePercent ?? DEFAULT_TAX_RATE_PERCENT;

  // Oldest product first: when two products would get the same SKU, the older one keeps it.
  const assigned = new Set();
  const changes = [];
  for (const doc of products) {
    const { set, unset, notes } = plan(doc, assigned, taxRate);
    if (Object.keys(set).length || Object.keys(unset).length) changes.push({ doc, set, unset, notes });
  }

  log(`Products: ${products.length} · to change: ${changes.length}${apply ? '' : ' (dry run — nothing written)'}`);
  for (const { doc, set, unset, notes } of changes) {
    const fields = [...Object.keys(set), ...Object.keys(unset).map((k) => `-${k}`)].join(', ');
    log(`  ${doc.code || doc._id} "${doc.name}": ${fields}${notes.length ? `\n      ${notes.join('\n      ')}` : ''}`);
  }
  const collisions = changes.flatMap((c) => c.notes.filter((n) => n.startsWith('SKU collision')));
  if (collisions.length) log(`SKU collisions resolved: ${collisions.length}`);

  let backupFile = null;
  if (apply && changes.length) {
    fs.mkdirSync(backupDir, { recursive: true });
    backupFile = path.join(backupDir, `products-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupFile, mongoose.mongo.BSON.EJSON.stringify(products, null, 2, { relaxed: false }));
    log(`Backup written: ${backupFile}`);
    const ops = changes.map(({ doc, set, unset }) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      },
    }));
    const res = await col.bulkWrite(ops, { ordered: true });
    log(`Updated: ${res.modifiedCount}`);
    log('Next: npm run db:indexes -w server   (builds the new catalogue and SKU indexes)');
  }
  return { total: products.length, toChange: changes.length, changes, collisions, backupFile, applied: apply };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: path.resolve(here, '../../../.env') });
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing (server/.env).');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'swechha', serverSelectionTimeoutMS: 15000 });
    console.log(`Database: ${mongoose.connection.db.databaseName}`);
    await migrate002({ db: mongoose.connection.db, apply });
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

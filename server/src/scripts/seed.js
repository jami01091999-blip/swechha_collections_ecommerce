// Usage:  npm run seed          → adds sample products that don't exist yet (matched by code)
//         npm run seed:reset    → deletes ALL products first, then adds the samples
import { connectDb, disconnectDb } from '../db/mongoose.js';
import { Product } from '../models/Product.js';
import { Setting } from '../models/Setting.js';
import { PRODUCT_DEFAULTS } from '../validators/product.js';
import { DEFAULT_SETTINGS } from '../validators/settings.js';
import { SEED_PRODUCTS } from './seed-data.js';

const reset = process.argv.includes('--reset');

try {
  await connectDb();
  if (reset) {
    const { deletedCount } = await Product.deleteMany({});
    console.log(`Removed ${deletedCount} products.`);
  }
  let added = 0;
  const base = Date.now();
  for (const [i, p] of SEED_PRODUCTS.entries()) {
    const at = new Date(base - i * 60_000);
    const r = await Product.updateOne(
      { code: p.code },
      { $setOnInsert: { ...PRODUCT_DEFAULTS, ...p, status: 'published', displayOrder: 0, createdAt: at, updatedAt: at } },
      { upsert: true, timestamps: false }
    );
    if (r.upsertedCount) added++;
  }
  await Setting.updateOne({ _id: 'site' }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true, timestamps: false });
  console.log(`Added ${added} sample products (${SEED_PRODUCTS.length - added} already existed). Settings ready.`);
  await disconnectDb();
  process.exit(0);
} catch (e) {
  console.error('Seed failed:', e.message);
  process.exit(1);
}

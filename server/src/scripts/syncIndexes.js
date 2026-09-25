// Builds the indexes declared in the Mongoose models. Needed once per database in production,
// where autoIndex is off.
//   npm run db:indexes              → create missing indexes (never drops anything)
//   npm run db:indexes -- --drop    → also drop indexes that are not declared in the models
import { connectDb, disconnectDb } from '../db/mongoose.js';
import { Product } from '../models/Product.js';
import { Setting } from '../models/Setting.js';

const drop = process.argv.includes('--drop');

try {
  await connectDb();
  for (const Model of [Product, Setting]) {
    if (drop) {
      const dropped = await Model.syncIndexes();
      console.log(`${Model.modelName}: indexes in sync${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}.`);
    } else {
      await Model.createIndexes();
      const { toDrop } = await Model.diffIndexes();
      console.log(`${Model.modelName}: indexes created.${toDrop.length ? ` Not declared (kept): ${toDrop.join(', ')}` : ''}`);
    }
  }
  await disconnectDb();
  process.exit(0);
} catch (e) {
  console.error('Index sync failed:', e.message);
  process.exit(1);
}

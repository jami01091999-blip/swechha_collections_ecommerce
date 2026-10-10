// Copies the catalogue (products) and site settings from the old `swechha` database into MONGO_DB.
//   npm run migrate:003             → dry run: counts only, nothing is written
//   npm run migrate:003 -- --apply  → upsert every document by _id into the target
// The source is only ever read. The target is never emptied: existing documents with the same _id are replaced,
// everything else is left alone, so the script can be run again safely.
// Needs MONGO_URI and MONGO_DB (the target) from server/.env. Source database: --source=<name> (default "swechha").
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const here = path.dirname(fileURLToPath(import.meta.url));
const COLLECTIONS = ['products', 'settings'];

export async function migrate003({ source, target, apply, log = console.log }) {
  const report = {};
  for (const name of COLLECTIONS) {
    const docs = await source.collection(name).find({}).toArray();
    const before = await target.collection(name).countDocuments();
    log(`${name}: source ${docs.length}, target before ${before}`);
    if (apply && docs.length) {
      const res = await target
        .collection(name)
        .bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })), { ordered: true });
      log(`${name}: inserted ${res.upsertedCount}, replaced ${res.modifiedCount}, unchanged ${res.matchedCount - res.modifiedCount}`);
    }
    const after = await target.collection(name).countDocuments();
    report[name] = { source: docs.length, before, after };
  }
  if (!apply) log('Dry run only. Re-run with --apply to write.');
  return report;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: path.resolve(here, '../../../.env') });
  const apply = process.argv.includes('--apply');
  const sourceName = (process.argv.find((a) => a.startsWith('--source=')) || '--source=swechha').split('=')[1];
  const targetName = process.env.MONGO_DB;
  if (!process.env.MONGO_URI || !targetName) {
    console.error('MONGO_URI and MONGO_DB are required (server/.env).');
    process.exit(1);
  }
  if (sourceName === targetName) {
    console.error(`Source and target are both "${sourceName}". Refusing to run.`);
    process.exit(1);
  }
  try {
    const opts = { serverSelectionTimeoutMS: 15000 };
    const src = await mongoose.createConnection(process.env.MONGO_URI, { ...opts, dbName: sourceName }).asPromise();
    const dst = await mongoose.createConnection(process.env.MONGO_URI, { ...opts, dbName: targetName }).asPromise();
    console.log(`Source: ${sourceName} (read-only)  →  Target: ${targetName}`);
    await migrate003({ source: src.db, target: dst.db, apply });
    await src.close();
    await dst.close();
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

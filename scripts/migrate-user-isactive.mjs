import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function migrateCollection(db, collectionName) {
  const col = db.collection(collectionName);
  console.log(`\n======================================================`);
  console.log(`  MIGRATING COLLECTION: [${collectionName}]`);
  console.log(`======================================================`);

  // Step 1: Query affected documents BEFORE executing updates
  const num1Count = await col.countDocuments({ isActive: 1 });
  const num0Count = await col.countDocuments({ isActive: 0 });
  const str1Count = await col.countDocuments({ isActive: '1' });
  const str0Count = await col.countDocuments({ isActive: '0' });
  const nullCount = await col.countDocuments({ isActive: null });
  const missingCount = await col.countDocuments({ isActive: { $exists: false } });
  const boolTrueBefore = await col.countDocuments({ isActive: true });
  const boolFalseBefore = await col.countDocuments({ isActive: false });

  console.log(`[${collectionName}] PRE-MIGRATION AUDIT:`);
  console.log(`  - Documents with isActive: 1 (number): ${num1Count}`);
  console.log(`  - Documents with isActive: 0 (number): ${num0Count}`);
  console.log(`  - Documents with isActive: "1" (string): ${str1Count}`);
  console.log(`  - Documents with isActive: "0" (string): ${str0Count}`);
  console.log(`  - Documents with isActive: null: ${nullCount}`);
  console.log(`  - Documents with isActive missing ($exists: false): ${missingCount}`);
  console.log(`  - Documents already boolean true: ${boolTrueBefore}`);
  console.log(`  - Documents already boolean false: ${boolFalseBefore}`);

  const totalToConvert = num1Count + num0Count + str1Count + str0Count + nullCount + missingCount;
  console.log(`  => Total documents requiring conversion: ${totalToConvert}`);

  if (totalToConvert === 0) {
    console.log(`  => No migration needed for [${collectionName}]. All records already valid Booleans.`);
  } else {
    // Step 2: Perform atomic idempotent updates
    console.log(`\n[${collectionName}] EXECUTING UPDATES:`);

    // 1 -> true
    if (num1Count > 0) {
      const resNum1 = await col.updateMany({ isActive: 1 }, { $set: { isActive: true } });
      console.log(`  ✓ Converted isActive: 1 -> true (matched: ${resNum1.matchedCount}, modified: ${resNum1.modifiedCount})`);
    }

    // 0 -> false
    if (num0Count > 0) {
      const resNum0 = await col.updateMany({ isActive: 0 }, { $set: { isActive: false } });
      console.log(`  ✓ Converted isActive: 0 -> false (matched: ${resNum0.matchedCount}, modified: ${resNum0.modifiedCount})`);
    }

    // "1" -> true
    if (str1Count > 0) {
      const resStr1 = await col.updateMany({ isActive: '1' }, { $set: { isActive: true } });
      console.log(`  ✓ Converted isActive: "1" -> true (matched: ${resStr1.matchedCount}, modified: ${resStr1.modifiedCount})`);
    }

    // "0" -> false
    if (str0Count > 0) {
      const resStr0 = await col.updateMany({ isActive: '0' }, { $set: { isActive: false } });
      console.log(`  ✓ Converted isActive: "0" -> false (matched: ${resStr0.matchedCount}, modified: ${resStr0.modifiedCount})`);
    }

    // null -> true
    if (nullCount > 0) {
      const resNull = await col.updateMany({ isActive: null }, { $set: { isActive: true } });
      console.log(`  ✓ Converted isActive: null -> true (matched: ${resNull.matchedCount}, modified: ${resNull.modifiedCount})`);
    }

    // missing -> true
    if (missingCount > 0) {
      const resMissing = await col.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
      console.log(`  ✓ Added missing isActive -> true (matched: ${resMissing.matchedCount}, modified: ${resMissing.modifiedCount})`);
    }
  }

  // Step 3: POST-MIGRATION VERIFICATION
  const postBoolTrue = await col.countDocuments({ isActive: true });
  const postBoolFalse = await col.countDocuments({ isActive: false });
  const postNumCount = await col.countDocuments({ isActive: { $type: 'number' } });
  const postStrCount = await col.countDocuments({ isActive: { $type: 'string' } });
  const postNullCount = await col.countDocuments({ isActive: null });
  const postMissingCount = await col.countDocuments({ isActive: { $exists: false } });

  console.log(`\n[${collectionName}] POST-MIGRATION VERIFICATION:`);
  console.log(`  - Boolean true: ${postBoolTrue}`);
  console.log(`  - Boolean false: ${postBoolFalse}`);
  console.log(`  - Numeric isActive (should be 0): ${postNumCount}`);
  console.log(`  - String isActive (should be 0): ${postStrCount}`);
  console.log(`  - Null isActive (should be 0): ${postNullCount}`);
  console.log(`  - Missing isActive (should be 0): ${postMissingCount}`);

  if (postNumCount === 0 && postStrCount === 0 && postNullCount === 0 && postMissingCount === 0) {
    console.log(`  ★ SUCCESS: All documents in [${collectionName}] have consistent Boolean isActive!`);
  } else {
    throw new Error(`Migration verification failed for collection [${collectionName}]!`);
  }
}

async function runMigration() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB Atlas: ${db.databaseName}`);

    // Migrate User first (primary target)
    await migrateCollection(db, 'User');

    // Also migrate other master data collections that had 1/0 from MySQL migration
    await migrateCollection(db, 'IncomeCategory');
    await migrateCollection(db, 'ExpenseHead');
    await migrateCollection(db, 'RevenueHead');

    console.log('\n======================================================');
    console.log('  ALL MIGRATIONS COMPLETED SUCCESSFULLY & VERIFIED');
    console.log('======================================================\n');
  } finally {
    await client.close();
  }
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

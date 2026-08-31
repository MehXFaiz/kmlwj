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

// Definitions of collections and their boolean fields (with their schema default: true or false)
const migrations = [
  { collection: 'User', field: 'isActive', defaultVal: true },
  { collection: 'User', field: 'isDeleted', defaultVal: false },
  { collection: 'Role', field: 'isPrivileged', defaultVal: false },
  { collection: 'Account', field: 'isLocked', defaultVal: false },
  { collection: 'Account', field: 'isReserved', defaultVal: false },
  { collection: 'Account', field: 'isSystemDefined', defaultVal: false },
  { collection: 'Account', field: 'isDeleted', defaultVal: false },
  { collection: 'RevenueHead', field: 'isActive', defaultVal: true },
  { collection: 'RevenueHead', field: 'isDeleted', defaultVal: false },
  { collection: 'ExpenseHead', field: 'isActive', defaultVal: true },
  { collection: 'ExpenseHead', field: 'isDeleted', defaultVal: false },
  { collection: 'IncomeCategory', field: 'isActive', defaultVal: true },
  { collection: 'IncomeCategory', field: 'isDeleted', defaultVal: false },
  { collection: 'JournalEntry', field: 'isDeleted', defaultVal: false },
  { collection: 'RevenueCollection', field: 'isDeleted', defaultVal: false },
  { collection: 'HallBooking', field: 'isDeleted', defaultVal: false },
  { collection: 'HallBooking', field: 'isForJamaat', defaultVal: false },
  { collection: 'FinancialYear', field: 'isClosed', defaultVal: false },
  { collection: 'FinancialYear', field: 'isAutoRolled', defaultVal: false },
];

async function runAllBooleanMigrations() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log('=== RUNNING COMPREHENSIVE IDEMPOTENT BOOLEAN MIGRATION ===\n');

    for (const item of migrations) {
      const col = db.collection(item.collection);
      const { field, defaultVal } = item;

      // Audit counts
      const num1 = await col.countDocuments({ [field]: 1 });
      const num0 = await col.countDocuments({ [field]: 0 });
      const str1 = await col.countDocuments({ [field]: '1' });
      const str0 = await col.countDocuments({ [field]: '0' });
      const nulls = await col.countDocuments({ [field]: null });

      const totalToFix = num1 + num0 + str1 + str0 + nulls;
      if (totalToFix > 0) {
        console.log(`Migrating [${item.collection}.${field}] -> total to fix: ${totalToFix} (1: ${num1}, 0: ${num0}, "1": ${str1}, "0": ${str0}, null: ${nulls})`);

        if (num1 > 0) await col.updateMany({ [field]: 1 }, { $set: { [field]: true } });
        if (num0 > 0) await col.updateMany({ [field]: 0 }, { $set: { [field]: false } });
        if (str1 > 0) await col.updateMany({ [field]: '1' }, { $set: { [field]: true } });
        if (str0 > 0) await col.updateMany({ [field]: '0' }, { $set: { [field]: false } });
        if (nulls > 0) await col.updateMany({ [field]: null }, { $set: { [field]: defaultVal } });

        console.log(`  ✓ Successfully migrated [${item.collection}.${field}]`);
      } else {
        console.log(`[${item.collection}.${field}] already consistent.`);
      }
    }

    console.log('\n=== ALL BOOLEAN FIELDS MIGRATED SUCCESSFULLY ===');
  } finally {
    await client.close();
  }
}

runAllBooleanMigrations().catch(console.error);

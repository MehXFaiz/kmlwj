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

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim().replace(' ', 'T') + 'Z';
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(val) : d;
}

async function fixData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log('=== FIXING OPENING BALANCES & ACCOUNTS IN MONGODB ===');

    // 1. Fix Account glCode from number to string
    const numGlAccounts = await db.collection('Account').find({ glCode: { $type: 'number' } }).toArray();
    console.log(`Found ${numGlAccounts.length} accounts with numeric glCode. Converting to string...`);
    for (const a of numGlAccounts) {
      await db.collection('Account').updateOne(
        { _id: a._id },
        { $set: { glCode: String(a.glCode) } }
      );
    }
    console.log('✓ Converted all numeric glCodes to string in Account.');

    // 2. Fix OpeningBalanceBatch fields
    const batches = await db.collection('OpeningBalanceBatch').find({}).toArray();
    console.log(`Found ${batches.length} OpeningBalanceBatch docs. Converting fields...`);
    for (const b of batches) {
      const update = {};
      if (typeof b.openingDate === 'string') update.openingDate = parseDate(b.openingDate);
      if (typeof b.sourceClosingDate === 'string') update.sourceClosingDate = parseDate(b.sourceClosingDate);
      if (typeof b.adjustedAt === 'string') update.adjustedAt = parseDate(b.adjustedAt);
      if (typeof b.createdAt === 'string') update.createdAt = parseDate(b.createdAt);
      if (typeof b.updatedAt === 'string') update.updatedAt = parseDate(b.updatedAt);
      if (typeof b.isAutoRolled === 'number') update.isAutoRolled = b.isAutoRolled === 1;

      if (Object.keys(update).length > 0) {
        await db.collection('OpeningBalanceBatch').updateOne({ _id: b._id }, { $set: update });
      }
    }
    console.log('✓ Converted all OpeningBalanceBatch dates and booleans.');

    // 3. Fix OpeningBalanceLine dates
    const lines = await db.collection('OpeningBalanceLine').find({}).toArray();
    console.log(`Found ${lines.length} OpeningBalanceLine docs. Converting dates...`);
    for (const l of lines) {
      const update = {};
      if (typeof l.createdAt === 'string') update.createdAt = parseDate(l.createdAt);
      if (typeof l.updatedAt === 'string') update.updatedAt = parseDate(l.updatedAt);
      if (Object.keys(update).length > 0) {
        await db.collection('OpeningBalanceLine').updateOne({ _id: l._id }, { $set: update });
      }
    }
    console.log('✓ Converted all OpeningBalanceLine dates.');

    // 4. Convert all remaining string dates in Account
    const dateAccounts = await db.collection('Account').find({
      $or: [
        { createdAt: { $type: 'string' } },
        { updatedAt: { $type: 'string' } },
        { deletedAt: { $type: 'string' } }
      ]
    }).toArray();
    console.log(`Found ${dateAccounts.length} accounts with string dates. Converting...`);
    for (const a of dateAccounts) {
      const update = {};
      if (typeof a.createdAt === 'string') update.createdAt = parseDate(a.createdAt);
      if (typeof a.updatedAt === 'string') update.updatedAt = parseDate(a.updatedAt);
      if (typeof a.deletedAt === 'string') update.deletedAt = parseDate(a.deletedAt);
      if (Object.keys(update).length > 0) {
        await db.collection('Account').updateOne({ _id: a._id }, { $set: update });
      }
    }
    console.log('✓ Converted all Account dates.');

    // 5. Convert any remaining string dates across ALL collections in bulk
    const collections = await db.listCollections().toArray();
    const dateKeys = ['openingDate', 'sourceClosingDate', 'adjustedAt', 'createdAt', 'updatedAt', 'deletedAt', 'date', 'reconciliationDate', 'startDate', 'endDate', 'closedAt', 'reopenedAt', 'postedAt', 'revertedAt', 'approvedAt', 'expiresAt', 'revokedAt'];

    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const col = db.collection(c.name);
      for (const field of dateKeys) {
        const count = await col.countDocuments({ [field]: { $type: 'string' } });
        if (count > 0) {
          console.log(`Converting ${count} string dates in [${c.name}.${field}]...`);
          const docs = await col.find({ [field]: { $type: 'string' } }, { projection: { [field]: 1 } }).toArray();
          for (const d of docs) {
            const parsed = parseDate(d[field]);
            if (parsed) {
              await col.updateOne({ _id: d._id }, { $set: { [field]: parsed } });
            }
          }
          console.log(`  ✓ Converted [${c.name}.${field}]`);
        }
      }
    }

    console.log('\n=== ALL DATA FIXES COMPLETED SUCCESSFULLY ===');
  } finally {
    await client.close();
  }
}

fixData().catch(console.error);

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

async function fixJournalDates() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    // 1. JournalEntry
    const jeDocs = await db.collection('JournalEntry').find({}).toArray();
    console.log(`Checking ${jeDocs.length} JournalEntry docs...`);
    for (const d of jeDocs) {
      const update = {};
      for (const f of ['postingDate', 'createdAt', 'updatedAt', 'deletedAt', 'revertedAt']) {
        if (typeof d[f] === 'string') update[f] = parseDate(d[f]);
      }
      if (Object.keys(update).length > 0) {
        await db.collection('JournalEntry').updateOne({ _id: d._id }, { $set: update });
      }
    }
    console.log('✓ Converted JournalEntry dates.');

    // 2. JournalEntryLine
    const jelDocs = await db.collection('JournalEntryLine').find({}).toArray();
    console.log(`Checking ${jelDocs.length} JournalEntryLine docs...`);
    for (const d of jelDocs) {
      const update = {};
      for (const f of ['postingDate', 'createdAt', 'updatedAt']) {
        if (typeof d[f] === 'string') update[f] = parseDate(d[f]);
      }
      if (Object.keys(update).length > 0) {
        await db.collection('JournalEntryLine').updateOne({ _id: d._id }, { $set: update });
      }
    }
    console.log('✓ Converted JournalEntryLine dates.');
  } finally {
    await client.close();
  }
}

fixJournalDates().catch(console.error);

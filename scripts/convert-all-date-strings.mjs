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

const dateFields = ['createdAt', 'updatedAt', 'deletedAt', 'postedAt', 'revertedAt', 'approvedAt', 'closedAt', 'reopenedAt', 'openingDate', 'sourceClosingDate', 'adjustedAt', 'date', 'reconciliationDate', 'startDate', 'endDate', 'expiresAt', 'revokedAt'];

async function convertAllDates() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('=== CONVERTING STRING DATES TO BSON DATES IN ALL COLLECTIONS ===');

    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const col = db.collection(c.name);

      for (const field of dateFields) {
        const strCount = await col.countDocuments({ [field]: { $type: 'string' } });
        if (strCount > 0) {
          console.log(`Converting ${strCount} string dates in [${c.name}.${field}]...`);
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
    console.log('\n=== ALL DATES CONVERTED TO BSON DATES ===');
  } finally {
    await client.close();
  }
}

convertAllDates().catch(console.error);

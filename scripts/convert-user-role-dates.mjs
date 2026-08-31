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

function parseSqlDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  // Format could be "2026-07-16 03:34:09" -> convert to ISO string
  const str = String(val).trim().replace(' ', 'T') + 'Z';
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(val) : d;
}

async function convertUserAndRoleDates() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    for (const name of ['User', 'Role']) {
      const col = db.collection(name);
      const docs = await col.find({
        $or: [
          { createdAt: { $type: 'string' } },
          { updatedAt: { $type: 'string' } }
        ]
      }).toArray();

      console.log(`Converting dates for ${docs.length} docs in [${name}]...`);
      for (const d of docs) {
        const update = {};
        if (typeof d.createdAt === 'string') {
          update.createdAt = parseSqlDate(d.createdAt);
        }
        if (typeof d.updatedAt === 'string') {
          update.updatedAt = parseSqlDate(d.updatedAt);
        }
        if (Object.keys(update).length > 0) {
          await col.updateOne({ _id: d._id }, { $set: update });
        }
      }
      console.log(`✓ Completed [${name}] date conversion.`);
    }
  } finally {
    await client.close();
  }
}

convertUserAndRoleDates().catch(console.error);

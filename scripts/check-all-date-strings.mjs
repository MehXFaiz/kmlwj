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

async function checkAllDateStrings() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log('=== CHECKING STRING DATES IN ALL COLLECTIONS ===');
    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const col = db.collection(c.name);
      const strCreated = await col.countDocuments({ createdAt: { $type: 'string' } });
      const strUpdated = await col.countDocuments({ updatedAt: { $type: 'string' } });
      if (strCreated > 0 || strUpdated > 0) {
        console.log(`[${c.name}] createdAt strings: ${strCreated}, updatedAt strings: ${strUpdated}`);
      }
    }
  } finally {
    await client.close();
  }
}

checkAllDateStrings().catch(console.error);

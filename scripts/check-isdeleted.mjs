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

async function checkIsDeleted() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log(`Checking 'isDeleted' in collections...`);
    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const col = db.collection(c.name);
      const hasIsDeleted = await col.countDocuments({ isDeleted: { $exists: true } });
      if (hasIsDeleted > 0) {
        const numCount = await col.countDocuments({ isDeleted: { $type: 'number' } });
        const boolCount = await col.countDocuments({ isDeleted: { $type: 'bool' } });
        console.log(`Collection [${c.name}]: total=${hasIsDeleted}, number=${numCount}, bool=${boolCount}`);
      }
    }
  } finally {
    await client.close();
  }
}

checkIsDeleted().catch(console.error);

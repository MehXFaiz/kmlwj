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

async function checkDateStrings() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    const collections = ['User', 'Role'];
    for (const name of collections) {
      const col = db.collection(name);
      const strCreatedAt = await col.countDocuments({ createdAt: { $type: 'string' } });
      const strUpdatedAt = await col.countDocuments({ updatedAt: { $type: 'string' } });
      console.log(`[${name}]: createdAt strings=${strCreatedAt}, updatedAt strings=${strUpdatedAt}`);
    }
  } finally {
    await client.close();
  }
}

checkDateStrings().catch(console.error);

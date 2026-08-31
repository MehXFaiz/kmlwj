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

async function scanAllCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log(`Scanning ${collections.length} collections for 'isActive' types...`);

    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const col = db.collection(c.name);
      
      const hasIsActive = await col.countDocuments({ isActive: { $exists: true } });
      if (hasIsActive === 0) continue;

      const numCount = await col.countDocuments({ isActive: { $type: 'number' } });
      const strCount = await col.countDocuments({ isActive: { $type: 'string' } });
      const boolCount = await col.countDocuments({ isActive: { $type: 'bool' } });
      const nullCount = await col.countDocuments({ isActive: null });
      const missingCount = await col.countDocuments({ isActive: { $exists: false } });

      console.log(`\nCollection [${c.name}]:`);
      console.log(`  Total docs with isActive: ${hasIsActive}`);
      console.log(`  Boolean (true/false): ${boolCount}`);
      console.log(`  Number (1/0): ${numCount}`);
      console.log(`  String ("1"/"0"/etc): ${strCount}`);
      console.log(`  Null: ${nullCount}`);
      console.log(`  Missing: ${missingCount}`);
    }
  } finally {
    await client.close();
  }
}

scanAllCollections().catch(console.error);

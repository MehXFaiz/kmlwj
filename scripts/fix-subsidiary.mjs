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

async function fixSubsidiary() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('Account');

    const strDocs = await col.find({ subsidiary: { $type: 'string' } }).toArray();
    console.log(`Converting ${strDocs.length} Account documents with string subsidiary to array...`);

    for (const d of strDocs) {
      const arr = Array.isArray(d.subsidiary) ? d.subsidiary : [d.subsidiary || 'Global'];
      await col.updateOne({ _id: d._id }, { $set: { subsidiary: arr } });
    }

    console.log('✓ Successfully converted all Account subsidiary fields to array!');
  } finally {
    await client.close();
  }
}

fixSubsidiary().catch(console.error);

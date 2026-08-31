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

async function checkSubsidiary() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const strSubsidiary = await db.collection('Account').countDocuments({ subsidiary: { $type: 'string' } });
    const arrSubsidiary = await db.collection('Account').countDocuments({ subsidiary: { $type: 'array' } });
    console.log(`Account subsidiary: string=${strSubsidiary}, array=${arrSubsidiary}`);
  } finally {
    await client.close();
  }
}

checkSubsidiary().catch(console.error);

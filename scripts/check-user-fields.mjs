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

async function checkDateTimes() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const user = await db.collection('User').findOne({ email: 'admin@erp.com' });
    console.log('admin@erp.com fields:');
    for (const [k, v] of Object.entries(user)) {
      console.log(`- ${k}: ${JSON.stringify(v)} (type: ${typeof v}, isDate: ${v instanceof Date})`);
    }
  } finally {
    await client.close();
  }
}

checkDateTimes().catch(console.error);

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

async function checkOtherModels() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const targets = ['ReservedCode', 'Beneficiary', 'Donor', 'Customer', 'Member'];
    for (const t of targets) {
      const col = db.collection(t);
      const total = await col.countDocuments({});
      const sample = await col.findOne({});
      console.log(`${t}: total docs = ${total}, sample isActive = ${sample ? JSON.stringify(sample.isActive) : 'no docs'}`);
    }
  } finally {
    await client.close();
  }
}

checkOtherModels().catch(console.error);

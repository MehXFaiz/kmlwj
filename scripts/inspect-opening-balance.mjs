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

async function inspectOpeningBalance() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    console.log('=== INSPECTING OpeningBalanceBatch ===');
    const batches = await db.collection('OpeningBalanceBatch').find({}).toArray();
    console.log(`Total batches: ${batches.length}`);
    batches.forEach(b => {
      console.log(JSON.stringify(b, null, 2));
    });

    console.log('\n=== INSPECTING OpeningBalanceLine ===');
    const lines = await db.collection('OpeningBalanceLine').find({}).toArray();
    console.log(`Total lines: ${lines.length}`);
    lines.forEach(l => {
      console.log(JSON.stringify(l, null, 2));
    });

    console.log('\n=== CHECKING glCode IN Account ===');
    const numGlCodes = await db.collection('Account').countDocuments({ glCode: { $type: 'number' } });
    const strGlCodes = await db.collection('Account').countDocuments({ glCode: { $type: 'string' } });
    console.log(`Account glCode: number=${numGlCodes}, string=${strGlCodes}`);
    if (numGlCodes > 0) {
      const sampleNum = await db.collection('Account').findOne({ glCode: { $type: 'number' } });
      console.log('Sample numeric glCode account:', sampleNum);
    }
  } finally {
    await client.close();
  }
}

inspectOpeningBalance().catch(console.error);

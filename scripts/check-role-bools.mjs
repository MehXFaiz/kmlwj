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

async function checkRole() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const roles = await db.collection('Role').find({}).toArray();
    console.log('Roles:');
    roles.forEach(r => {
      console.log(`- Role: ${r.name}, isPrivileged: ${JSON.stringify(r.isPrivileged)} (${typeof r.isPrivileged})`);
    });
  } finally {
    await client.close();
  }
}

checkRole().catch(console.error);

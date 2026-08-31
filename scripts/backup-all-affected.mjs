import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const uri = process.env.MONGODB_URI;

async function backupAll() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const backupDir = path.resolve(__dirname, '../backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-all-collections-${timestamp}.json`);

    const collections = ['User', 'Role', 'Account', 'RevenueHead', 'ExpenseHead', 'IncomeCategory', 'JournalEntry', 'RevenueCollection', 'HallBooking', 'FinancialYear'];
    const snapshot = {};

    console.log('--- Backing up all affected collections ---');
    for (const name of collections) {
      const docs = await db.collection(name).find({}).toArray();
      snapshot[name] = docs;
      console.log(`Backed up [${name}]: ${docs.length} docs`);
    }

    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`Snapshot saved to: ${backupPath}`);
  } finally {
    await client.close();
  }
}

backupAll().catch(console.error);

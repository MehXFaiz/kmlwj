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
if (!uri) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function backup() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-before-isactive-migration-${timestamp}.json`);

    const collectionsToBackup = ['User', 'IncomeCategory', 'ExpenseHead', 'RevenueHead'];
    const snapshot = {};

    console.log('--- Starting MongoDB Pre-Migration Snapshot ---');
    for (const name of collectionsToBackup) {
      const docs = await db.collection(name).find({}).toArray();
      snapshot[name] = docs;
      console.log(`Backed up collection [${name}]: ${docs.length} documents.`);
    }

    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`\nSuccessfully created backup snapshot at:`);
    console.log(backupPath);

    return backupPath;
  } finally {
    await client.close();
  }
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

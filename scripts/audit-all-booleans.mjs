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

// Map of collection -> array of Boolean field names defined in schema.prisma
const booleanFieldsByCollection = {
  User: ['isActive', 'isDeleted'],
  Role: ['isPrivileged'],
  Account: ['isLocked', 'isReserved', 'isSystemDefined', 'isDeleted'],
  ReservedCode: ['isActive', 'isDeleted'],
  RevenueHead: ['isActive', 'isDeleted'],
  ExpenseHead: ['isActive', 'isDeleted'],
  IncomeCategory: ['isActive', 'isDeleted'],
  JournalEntry: ['isDeleted'],
  RevenueCollection: ['isDeleted'],
  HallBooking: ['isDeleted', 'isForJamaat'],
  Beneficiary: ['isActive', 'isDeleted'],
  Donor: ['isActive', 'isDeleted'],
  Customer: ['isActive', 'isDeleted'],
  Member: ['isActive', 'isDeleted'],
  FinancialYear: ['isClosed', 'isAutoRolled'],
  AiRepairLog: ['isDeleted'],
  AiRepairIssue: ['isDeleted']
};

async function auditAllBooleans() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log('=== AUDITING ALL BOOLEAN FIELDS IN DATABASE ===');

    for (const [colName, fields] of Object.entries(booleanFieldsByCollection)) {
      const col = db.collection(colName);
      const totalDocs = await col.countDocuments({});
      if (totalDocs === 0) continue;

      for (const field of fields) {
        const numCount = await col.countDocuments({ [field]: { $type: 'number' } });
        const strCount = await col.countDocuments({ [field]: { $type: 'string' } });
        const boolCount = await col.countDocuments({ [field]: { $type: 'bool' } });
        const missingCount = await col.countDocuments({ [field]: { $exists: false } });

        if (numCount > 0 || strCount > 0) {
          console.log(`[${colName}.${field}] HAS NON-BOOLEANS -> total: ${totalDocs}, num: ${numCount}, str: ${strCount}, bool: ${boolCount}, missing: ${missingCount}`);
        } else {
          console.log(`[${colName}.${field}] OK (bool: ${boolCount}, missing: ${missingCount})`);
        }
      }
    }
  } finally {
    await client.close();
  }
}

auditAllBooleans().catch(console.error);

/**
 * Clear all MongoDB collections
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function clearCollections() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  try {
    await client.connect();
    const db = client.db('kmlwj');

    console.log('🗑️  Clearing all collections...');
    const collections = await db.listCollections().toArray();

    let totalDeleted = 0;
    for (const col of collections) {
      const result = await db.collection(col.name).deleteMany({});
      console.log(`  ✓ ${col.name}: Deleted ${result.deletedCount} documents`);
      totalDeleted += result.deletedCount;
    }

    console.log(`\n✅ All collections cleared successfully (${totalDeleted} total documents removed)`);
  } finally {
    await client.close();
  }
}

clearCollections().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

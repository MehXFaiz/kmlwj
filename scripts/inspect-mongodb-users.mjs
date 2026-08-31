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
if (!uri) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

async function inspect() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas successfully.');

    const db = client.db();
    console.log('Database Name:', db.databaseName);

    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));

    const userCollectionName = collections.some(c => c.name === 'User') ? 'User' : 'users';
    console.log('Target User collection:', userCollectionName);
    const col = db.collection(userCollectionName);

    const totalUsers = await col.countDocuments({});
    console.log('Total documents in', userCollectionName, ':', totalUsers);

    const users = await col.find({}, { projection: { email: 1, fullName: 1, isActive: 1, isDeleted: 1, roleId: 1 } }).toArray();
    console.log('\n--- All User Documents in MongoDB ---');
    users.forEach(u => {
      console.log(`- ID: ${u._id} | Email: ${u.email} | Name: ${u.fullName} | isActive: ${JSON.stringify(u.isActive)} (type: ${typeof u.isActive})`);
    });

    const countNumber1 = await col.countDocuments({ isActive: 1 });
    const countNumber0 = await col.countDocuments({ isActive: 0 });
    const countString1 = await col.countDocuments({ isActive: "1" });
    const countString0 = await col.countDocuments({ isActive: "0" });
    const countBoolTrue = await col.countDocuments({ isActive: true });
    const countBoolFalse = await col.countDocuments({ isActive: false });
    const countNull = await col.countDocuments({ isActive: null });
    const countMissing = await col.countDocuments({ isActive: { $exists: false } });

    console.log('\n--- Breakdown of isActive values in User collection ---');
    console.log(`isActive === 1 (number): ${countNumber1}`);
    console.log(`isActive === 0 (number): ${countNumber0}`);
    console.log(`isActive === "1" (string): ${countString1}`);
    console.log(`isActive === "0" (string): ${countString0}`);
    console.log(`isActive === true (boolean): ${countBoolTrue}`);
    console.log(`isActive === false (boolean): ${countBoolFalse}`);
    console.log(`isActive === null: ${countNull}`);
    console.log(`isActive missing ($exists: false): ${countMissing}`);

    console.log('\n--- Checking other collections for numeric/string isActive ---');
    for (const c of collections) {
      if (c.name.startsWith('system.')) continue;
      const otherCol = db.collection(c.name);
      const num1 = await otherCol.countDocuments({ isActive: 1 });
      const num0 = await otherCol.countDocuments({ isActive: 0 });
      const str1 = await otherCol.countDocuments({ isActive: "1" });
      const str0 = await otherCol.countDocuments({ isActive: "0" });
      const totalNonBool = num1 + num0 + str1 + str0;
      if (totalNonBool > 0) {
        console.log(`Collection [${c.name}] has non-boolean isActive: 1:${num1}, 0:${num0}, "1":${str1}, "0":${str0}`);
      }
    }
  } finally {
    await client.close();
  }
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});

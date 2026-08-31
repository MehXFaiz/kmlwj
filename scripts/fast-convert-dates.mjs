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

async function fastDateConversion() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    // Priority targets needed for auth and login
    const collections = ['Permission', 'RolePermission', 'Role', 'User', 'AuditLog'];

    for (const name of collections) {
      const col = db.collection(name);
      for (const field of ['createdAt', 'updatedAt']) {
        const count = await col.countDocuments({ [field]: { $type: 'string' } });
        if (count > 0) {
          console.log(`Converting ${count} dates in ${name}.${field} via bulk...`);
          const docs = await col.find({ [field]: { $type: 'string' } }, { projection: { [field]: 1 } }).toArray();
          const ops = docs.map(d => {
            const str = String(d[field]).trim().replace(' ', 'T') + 'Z';
            const parsed = new Date(str);
            return {
              updateOne: {
                filter: { _id: d._id },
                update: { $set: { [field]: isNaN(parsed.getTime()) ? new Date(d[field]) : parsed } }
              }
            };
          });
          if (ops.length > 0) {
            await col.bulkWrite(ops);
            console.log(`✓ Converted ${ops.length} docs in ${name}.${field}`);
          }
        }
      }
    }
  } finally {
    await client.close();
  }
}

fastDateConversion().catch(console.error);

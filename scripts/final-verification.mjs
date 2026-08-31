import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { prisma } from '../api/_prisma.js';
import * as authService from '../api/_services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const uri = process.env.MONGODB_URI;

async function runFinalVerification() {
  console.log('===============================================================');
  console.log('         ERP DATABASE & AUTHENTICATION VERIFICATION            ');
  console.log('===============================================================\n');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('User');

    // 1. Exact count requirements
    const countBoolTrue = await col.countDocuments({ isActive: true });
    const countBoolFalse = await col.countDocuments({ isActive: false });
    const countNumeric = await col.countDocuments({ isActive: { $type: 'number' } });
    const countString = await col.countDocuments({ isActive: { $type: 'string' } });
    const countMissing = await col.countDocuments({ isActive: { $exists: false } });
    const countNull = await col.countDocuments({ isActive: null });
    const totalUsers = await col.countDocuments({});

    console.log('--- USER COLLECTION "isActive" AUDIT ---');
    console.log(`- Total User Documents:           ${totalUsers}`);
    console.log(`- Count isActive === Boolean true: ${countBoolTrue}`);
    console.log(`- Count isActive === Boolean false: ${countBoolFalse}`);
    console.log(`- Count isActive === Numeric:      ${countNumeric}`);
    console.log(`- Count isActive === String:       ${countString}`);
    console.log(`- Count isActive === Null:         ${countNull}`);
    console.log(`- Count isActive === Missing:      ${countMissing}\n`);

    // 2. Prisma findUnique verification
    console.log('--- TESTING PRISMA findUnique() FOR admin@erp.com ---');
    const user = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' },
      include: { role: true }
    });

    if (user) {
      console.log('✓ prisma.user.findUnique() succeeded without any type conversion errors!');
      console.log(`  - User ID:   ${user.id}`);
      console.log(`  - Email:     ${user.email}`);
      console.log(`  - Name:      ${user.fullName}`);
      console.log(`  - isActive:  ${user.isActive} (${typeof user.isActive})`);
      console.log(`  - isDeleted: ${user.isDeleted} (${typeof user.isDeleted})`);
      console.log(`  - Role:      ${user.role?.name}`);
      console.log(`  - isPrivileged: ${user.role?.isPrivileged} (${typeof user.role?.isPrivileged})`);
    } else {
      throw new Error('User admin@erp.com not found!');
    }

    // 3. Auth service login verification
    console.log('\n--- TESTING AUTH SERVICE LOGIN ---');
    const loginResult = await authService.login({
      email: 'admin@erp.com',
      password: 'admin123'
    });

    console.log('✓ authService.login() succeeded!');
    console.log(`  - Access Token Generated: ${Boolean(loginResult.accessToken)}`);
    console.log(`  - Authenticated User:    ${loginResult.user.email} (${loginResult.user.role})`);

    console.log('\n===============================================================');
    console.log('                 ALL VERIFICATION CHECKS PASSED                ');
    console.log('===============================================================');
  } finally {
    await prisma.$disconnect();
    await client.close();
  }
}

runFinalVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

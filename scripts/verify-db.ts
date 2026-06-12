import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Verify environment variables are loaded
console.log('--- Phase 1: Environment Variables Check ---');
dotenv.config({ override: true });

const dbUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set in environment.');
  process.exit(1);
}
console.log('✅ DATABASE_URL environment variable is set.');

if (!directUrl) {
  console.warn('⚠️ DIRECT_URL is not set in environment (required for Prisma v7 migrations, recommended for v6).');
} else {
  console.log('✅ DIRECT_URL environment variable is set.');
}

// 2. Print active DATABASE_URL host
try {
  // Simple regex or URL parser to extract host
  const match = dbUrl.match(/@([^/?:#]+)/);
  const host = match ? match[1] : 'unknown';
  console.log(`ℹ️ Active Database Host: ${host}`);
} catch (e: any) {
  console.error('❌ Failed to parse host from DATABASE_URL:', e.message);
}

// 3. Test raw PostgreSQL connection
async function testRawPostgres() {
  console.log('\n--- Phase 2: Raw PostgreSQL Connection Test ---');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl?.includes('sslmode=require') || dbUrl?.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    console.log('Connecting via raw pg Pool...');
    const res = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Raw PostgreSQL connection successful!');
    console.log('🕒 Server Time:', res.rows[0].now);
    console.log('💿 Version:', res.rows[0].version.split(',')[0]);
    await pool.end();
    return true;
  } catch (error: any) {
    console.error('❌ Raw PostgreSQL connection failed:', error.message);
    await pool.end();
    return false;
  }
}

// 4. Test Prisma connection
async function testPrisma() {
  console.log('\n--- Phase 3: Prisma Connection Test ---');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl?.includes('sslmode=require') || dbUrl?.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Connecting via Prisma Client (using driver adapter)...');
    const res = await prisma.$queryRaw`SELECT NOW() as now`;
    console.log('✅ Prisma connection successful!');
    console.log('Query Result:', res);
    await prisma.$disconnect();
    await pool.end();
    return true;
  } catch (error: any) {
    console.error('❌ Prisma connection failed:', error.message);
    await prisma.$disconnect();
    await pool.end();
    return false;
  }
}

async function run() {
  const pgOk = await testRawPostgres();
  const prismaOk = await testPrisma();
  
  console.log('\n--- Verification Summary ---');
  if (pgOk && prismaOk) {
    console.log('🎉 Database verification PASSED! All connections established successfully.');
    process.exit(0);
  } else {
    console.error('❌ Database verification FAILED.');
    process.exit(1);
  }
}

run();

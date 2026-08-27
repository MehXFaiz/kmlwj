import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      isPrivileged: true,
      rolePermissions: {
        select: {
          permission: {
            select: { name: true }
          }
        }
      }
    }
  });

  console.log('=== ROLES IN DATABASE ===');
  for (const r of roles) {
    const deletePerms = r.rolePermissions
      .map(rp => rp.permission.name)
      .filter(p => p.toLowerCase().includes('delete'));
    console.log(`Role: "${r.name}" | isPrivileged: ${r.isPrivileged} | Total perms: ${r.rolePermissions.length} | Delete perms: [${deletePerms.join(', ')}]`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);

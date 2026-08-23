import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: { select: { id: true, name: true } }, isActive: true }
  });
  console.log('--- USERS ---', JSON.stringify(users, null, 2));

  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { users: true, rolePermissions: true } },
      rolePermissions: { include: { permission: true } }
    }
  });
  console.log('--- ROLES ---', JSON.stringify(roles.map(r => ({
    id: r.id,
    name: r.name,
    userCount: r._count.users,
    permCount: r._count.rolePermissions,
    perms: r.rolePermissions.map(rp => rp.permission.name)
  })), null, 2));

  const permissions = await prisma.permission.findMany();
  console.log('--- TOTAL PERMISSIONS IN DB ---', permissions.length);
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

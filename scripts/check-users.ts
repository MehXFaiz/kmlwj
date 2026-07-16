import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      fullName: true,
      isActive: true,
      role: { select: { name: true } }
    }
  });
  console.log('=== Users in database ===');
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

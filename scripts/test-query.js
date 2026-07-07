import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    include: { accountType: true }
  });
  console.log('--- ACCOUNTS ---');
  accounts.forEach(a => {
    console.log(`${a.glCode} - ${a.accountName} - Type: ${a.accountType?.name} - Level: ${a.accountLevel} - Locked: ${a.isLocked}`);
  });
  
  const donations = await prisma.donation.findMany();
  console.log('--- DONATIONS ---');
  console.log(donations);
}

main().catch(console.error).finally(() => prisma.$disconnect());

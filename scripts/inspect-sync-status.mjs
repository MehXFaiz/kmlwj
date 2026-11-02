import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const je = await prisma.journalEntry.findUnique({
    where: { id: '1b38b745-8839-4e10-8ac9-f68d3b219d3c' }
  });
  console.log('Journal Entry:', je);
  await prisma.$disconnect();
}
run();

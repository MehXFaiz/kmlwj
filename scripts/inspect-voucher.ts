import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const je1 = await prisma.journalEntry.findUnique({
    where: { id: '1762e3f3-e38c-42bb-9c27-a5297066a6bd' },
    include: { lines: { include: { account: true } } }
  });
  console.log('--- JOURNAL ENTRY 1 ---');
  console.log(JSON.stringify(je1, null, 2));

  const je2 = await prisma.journalEntry.findUnique({
    where: { id: '43286196-d987-46cf-ba14-fdeb4585f4d3' },
    include: { lines: { include: { account: true } } }
  });
  console.log('--- JOURNAL ENTRY 2 ---');
  console.log(JSON.stringify(je2, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

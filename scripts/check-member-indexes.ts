import { prisma } from '../api/_prisma.js';

async function main() {
  const indexes = await prisma.$runCommandRaw({
    listIndexes: 'Member'
  });
  console.log('Member indexes:', JSON.stringify(indexes, null, 2));
}

main().finally(() => prisma.$disconnect());

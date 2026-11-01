import { prisma } from '../api/_prisma.js';

async function main() {
  const fees = await prisma.revenueCollection.findMany({
    where: { category: 'Membership Fee' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Found ${fees.length} Membership Fee records:`);
  for (const f of fees) {
    console.log(`ID: ${f.id} | Receipt: ${f.receiptNo} | Title: "${f.title}" | SubTitle: "${f.subTitle}" | Mobile: "${f.mobile}" | Amount: ${f.amount} | Rate: ${f.rate} | Status: "${f.status}" | Remarks: "${f.remarks}" | Date: ${f.eventDate}`);
  }
}

main().finally(() => prisma.$disconnect());

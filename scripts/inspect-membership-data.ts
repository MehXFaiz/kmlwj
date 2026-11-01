import { prisma } from '../api/_prisma.js';

async function main() {
  const membersCount = await prisma.member.count({ where: { isDeleted: false } });
  const sampleMembers = await prisma.member.findMany({
    where: { isDeleted: false },
    take: 5
  });

  const membershipFeesCount = await prisma.revenueCollection.count({
    where: { category: 'Membership Fee', isDeleted: false }
  });

  const sampleFees = await prisma.revenueCollection.findMany({
    where: { category: 'Membership Fee', isDeleted: false },
    take: 5
  });

  console.log(`Active Members: ${membersCount}`);
  console.log('Sample Members:', JSON.stringify(sampleMembers, null, 2));

  console.log(`\nActive Membership Fee Collections: ${membershipFeesCount}`);
  console.log('Sample Fees:', JSON.stringify(sampleFees, null, 2));
}

main().finally(() => prisma.$disconnect());

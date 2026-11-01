import { prisma } from '../api/_prisma.js';

async function scanHeads() {
  const expenseHeads = await prisma.expenseHead.findMany({
    include: { account: true }
  });
  console.log(`--- EXPENSE HEADS (${expenseHeads.length}) ---`);
  for (const h of expenseHeads) {
    console.log(`Head ID: ${h.id} | Name: "${h.name}" | Category: "${h.category}" | AccountId: ${h.accountId} | Account GL: ${h.account?.glCode} (${h.account?.accountName})`);
  }

  const revenueHeads = await prisma.revenueHead.findMany({
    include: { account: true }
  });
  console.log(`\n--- REVENUE HEADS (${revenueHeads.length}) ---`);
  for (const r of revenueHeads) {
    console.log(`Head ID: ${r.id} | Name: "${r.name}" | Category: "${r.category}" | AccountId: ${r.accountId} | Account GL: ${r.account?.glCode} (${r.account?.accountName})`);
  }

  const incomeCategories = await prisma.incomeCategory.findMany({
    include: { account: true }
  });
  console.log(`\n--- INCOME CATEGORIES (${incomeCategories.length}) ---`);
  for (const c of incomeCategories) {
    console.log(`Cat ID: ${c.id} | Name: "${c.name}" | AccountId: ${c.accountId} | Account GL: ${c.account?.glCode} (${c.account?.accountName})`);
  }

  await prisma.$disconnect();
}

scanHeads();

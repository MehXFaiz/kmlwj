import { PrismaClient, Prisma } from '@prisma/client';
const p = new PrismaClient();
const accts = await p.account.findMany({ where: { accountLevel: { in: ['GL','SUBSIDIARY'] } }, include: { accountType: true } });
let n = 0;
for (const a of accts) {
  const g = await p.journalEntryLine.aggregate({ where: { accountId: a.id, journalEntry: { status:'Posted', isDeleted:false } }, _sum: { debit:true, credit:true } });
  const d = new Prisma.Decimal(g._sum.debit ?? 0), c = new Prisma.Decimal(g._sum.credit ?? 0);
  const init = new Prisma.Decimal(a.initialBalance ?? 0);
  const dn = ['ASSET','EXPENSE'].includes((a.accountType?.name||'').toUpperCase());
  const exp = dn ? init.plus(d).minus(c) : init.plus(c).minus(d);
  const st = new Prisma.Decimal(a.currentBalance ?? 0);
  if (!exp.equals(st)) { n++; console.log(`  DRIFT ${a.glCode} ${a.accountName}: stored=${st} ledger=${exp}`); }
}
console.log('drifted accounts:', n);
await p.$disconnect();

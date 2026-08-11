// READ-ONLY reproduction of the reported "Available Cash: -486,000,366,500,017,900,000,000".
// Replays the exact API payload shape through the CURRENT client-side
// calculateAccountBalances() to prove the string-concatenation root cause.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Verbatim copy of src/store/journalStore.js calculateAccountBalances (buggy) ──
const buggyCalc = (accounts, journals, subsidiary = 'Global') => {
  const baseBalances = {};
  accounts.forEach((acc) => {
    baseBalances[acc.code] = { code: acc.code, initial: 0, debits: 0, credits: 0 };
    const appliesToSubsidiary = subsidiary === 'Global' || (acc.subsidiary && acc.subsidiary.includes(subsidiary));
    if (appliesToSubsidiary) baseBalances[acc.code].initial = acc.initialBalance || 0;
  });
  journals.forEach((je) => {
    if (subsidiary !== 'Global' && je.subsidiary !== subsidiary) return;
    if (je.status !== 'Posted') return;
    je.lines.forEach((line) => {
      if (baseBalances[line.accountCode]) {
        baseBalances[line.accountCode].debits += line.debit;
        baseBalances[line.accountCode].credits += line.credit;
      }
    });
  });
  const localBalances = {};
  accounts.forEach((acc) => {
    const { initial, debits, credits } = baseBalances[acc.code] || { initial: 0, debits: 0, credits: 0 };
    let balance = 0;
    if (acc.type === 'Asset' || acc.type === 'Expense') balance = initial + debits - credits;
    else if (acc.type === 'Liability' || acc.type === 'Equity' || acc.type === 'Revenue') balance = initial + credits - debits;
    localBalances[acc.code] = balance;
  });
  return { localBalances, baseBalances };
};

async function main() {
  // Exactly what api/_v1/accounts.ts GET returns (JSON round-trip = the wire).
  const dbAccounts = await prisma.account.findMany({ include: { accountType: true, parent: true } });
  const accounts = JSON.parse(JSON.stringify(dbAccounts.map((acc) => ({
    id: acc.id,
    code: acc.glCode,
    name: acc.accountName,
    type: acc.accountType ? acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase() : 'Asset',
    parentCode: acc.parent ? acc.parent.glCode : null,
    subsidiary: acc.subsidiary,
    initialBalance: acc.initialBalance,
  }))));

  // Exactly what api/_v1/journal-entries.ts GET returns for the form's
  // fetchJournals('Global', 1, 1000) call.
  const entries = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    include: { lines: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const journals = JSON.parse(JSON.stringify(entries.map((je) => ({
    id: je.voucherNo,
    subsidiary: je.subsidiary,
    status: je.status,
    lines: je.lines.map((l) => ({ accountCode: l.account.glCode, debit: l.debit, credit: l.credit })),
  }))));

  console.log('Accounts on wire :', accounts.length, '| Journals on wire:', journals.length);
  console.log('typeof line.debit on the wire     :', typeof journals[0]?.lines[0]?.debit);
  console.log('typeof acc.initialBalance on wire :', typeof accounts[0]?.initialBalance);

  const { localBalances, baseBalances } = buggyCalc(accounts, journals, 'Global');

  const b = baseBalances['1010103'];
  console.log('\n=== CURRENT (BUGGY) CLIENT CALCULATION FOR 1010103 ===');
  console.log('accumulated debits  :', typeof b.debits, String(b.debits).slice(0, 90) + (String(b.debits).length > 90 ? '…' : ''));
  console.log('accumulated credits :', typeof b.credits, String(b.credits).slice(0, 90) + (String(b.credits).length > 90 ? '…' : ''));
  const avail = localBalances['1010103'];
  console.log('localBalances["1010103"] =', avail);
  console.log('rendered as            =', Number(avail).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  console.log('\nvalidation verdict for a Rs 1,000 voucher: 1000 > avail ?', 1000 > avail, '=> BLOCKED');
  console.log('shortfall shown        =', (1000 - Number(avail)).toLocaleString('en-US', { maximumFractionDigits: 2 }));
}

main()
  .catch((e) => { console.error('REPRO FAILED:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

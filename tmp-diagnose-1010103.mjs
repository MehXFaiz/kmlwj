// READ-ONLY diagnostic for GL 1010103 (Cash in Hand).
// Performs zero writes. Verifies opening balance, debits, credits, closing
// balance, duplicate-line detection and value sanity straight from Postgres.
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const money = (d) => new Prisma.Decimal(d ?? 0).toFixed(2);

async function main() {
  const acc = await prisma.account.findFirst({
    where: { glCode: '1010103' },
    include: { accountType: true, children: { select: { id: true, glCode: true, accountName: true } } },
  });

  if (!acc) {
    console.log('NO ACCOUNT WITH glCode 1010103');
    return;
  }

  console.log('=== ACCOUNT 1010103 ===');
  console.log({
    id: acc.id,
    glCode: acc.glCode,
    accountName: acc.accountName,
    accountType: acc.accountType?.name,
    accountLevel: acc.accountLevel,
    detailType: acc.detailType,
    initialBalance: money(acc.initialBalance),
    currentBalance_cache: money(acc.currentBalance),
    childCount: acc.children.length,
  });

  // A. opening / B. debit / C. credit / D. closing — POSTED, not deleted
  const agg = await prisma.journalEntryLine.aggregate({
    where: { accountId: acc.id, journalEntry: { status: 'Posted', isDeleted: false } },
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });

  const initial = new Prisma.Decimal(acc.initialBalance ?? 0);
  const debit = new Prisma.Decimal(agg._sum.debit ?? 0);
  const credit = new Prisma.Decimal(agg._sum.credit ?? 0);
  const closing = initial.plus(debit).minus(credit); // ASSET = debit-normal

  console.log('\n=== A-D  LEDGER TRUTH (Posted, not deleted) ===');
  console.log('A. Opening (initialBalance) :', money(initial));
  console.log('B. Total Debit             :', money(debit));
  console.log('C. Total Credit            :', money(credit));
  console.log('D. Closing (A + B - C)     :', money(closing));
  console.log('   Posted line count       :', agg._count._all);
  console.log('   Cache matches ledger?   :', new Prisma.Decimal(acc.currentBalance ?? 0).equals(closing));

  // Status breakdown — is anything being counted that should not be?
  const byStatus = await prisma.$queryRaw`
    SELECT j."status", j."isDeleted", COUNT(*)::int AS lines,
           SUM(l."debit")::text AS debit, SUM(l."credit")::text AS credit
    FROM "JournalEntryLine" l
    JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
    WHERE l."accountId" = ${acc.id}::uuid
    GROUP BY j."status", j."isDeleted" ORDER BY j."status"`;
  console.log('\n=== LINES BY JOURNAL STATUS ===');
  console.table(byStatus);

  // 5. Duplicate detection — identical voucher/amount/date fingerprints
  const dupes = await prisma.$queryRaw`
    SELECT j."voucherNo", j."postingDate"::date::text AS date,
           l."debit"::text, l."credit"::text, COUNT(*)::int AS copies
    FROM "JournalEntryLine" l
    JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
    WHERE l."accountId" = ${acc.id}::uuid
      AND j."status" = 'Posted' AND j."isDeleted" = false
    GROUP BY j."voucherNo", j."postingDate", l."debit", l."credit"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC LIMIT 25`;
  console.log('\n=== 5. DUPLICATE LINE FINGERPRINTS (same voucher+amount) ===');
  console.log(dupes.length ? dupes : 'none');

  // 10/11. Sanity: impossible stored values anywhere in the ledger
  const insane = await prisma.$queryRaw`
    SELECT l."id", j."voucherNo", a."glCode", a."accountName",
           l."debit"::text, l."credit"::text, j."postingDate"::date::text AS date, j."status"
    FROM "JournalEntryLine" l
    JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
    JOIN "Account" a ON a."id" = l."accountId"
    WHERE l."debit" < 0 OR l."credit" < 0
       OR l."debit" > 100000000 OR l."credit" > 100000000
       OR (l."debit" > 0 AND l."credit" > 0)
    ORDER BY GREATEST(l."debit", l."credit") DESC LIMIT 25`;
  console.log('\n=== 10/11. OUT-OF-RANGE OR MALFORMED LINE AMOUNTS (whole ledger) ===');
  console.log(insane.length ? insane : 'none');

  // Accounts whose cached balance disagrees with the posted ledger
  const drift = await prisma.$queryRaw`
    SELECT a."glCode", a."accountName", a."currentBalance"::text AS cached,
           (a."initialBalance" + CASE WHEN UPPER(COALESCE(t."name",'ASSET')) IN ('ASSET','EXPENSE')
              THEN COALESCE(s.d,0) - COALESCE(s.c,0) ELSE COALESCE(s.c,0) - COALESCE(s.d,0) END)::text AS ledger
    FROM "Account" a
    LEFT JOIN "AccountType" t ON t."id" = a."accountTypeId"
    LEFT JOIN (SELECT l."accountId", SUM(l."debit") d, SUM(l."credit") c
               FROM "JournalEntryLine" l JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
               WHERE j."status"='Posted' AND j."isDeleted"=false GROUP BY l."accountId") s
      ON s."accountId" = a."id"
    WHERE a."currentBalance" <> (a."initialBalance" + CASE WHEN UPPER(COALESCE(t."name",'ASSET')) IN ('ASSET','EXPENSE')
              THEN COALESCE(s.d,0) - COALESCE(s.c,0) ELSE COALESCE(s.c,0) - COALESCE(s.d,0) END)
    ORDER BY a."glCode" LIMIT 25`;
  console.log('\n=== CACHED currentBalance vs LEDGER DRIFT (all accounts) ===');
  console.log(drift.length ? drift : 'none');

  // What the API literally puts on the wire today
  console.log('\n=== JSON ON THE WIRE (what the browser receives) ===');
  const line = await prisma.journalEntryLine.findFirst({
    where: { accountId: acc.id, journalEntry: { status: 'Posted', isDeleted: false } },
  });
  console.log('accounts.ts  initialBalance ->', JSON.stringify(acc.initialBalance), typeof JSON.parse(JSON.stringify({ v: acc.initialBalance })).v);
  if (line) {
    console.log('journal-entries.ts debit  ->', JSON.stringify(line.debit), typeof JSON.parse(JSON.stringify({ v: line.debit })).v);
  }
}

main()
  .catch((e) => { console.error('DIAGNOSTIC FAILED:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

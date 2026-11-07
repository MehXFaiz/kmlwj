import prisma from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

interface OfficialParentDef {
  glCode: string;
  name: string;
  description: string;
  subsidiaries: {
    glCode: string;
    name: string;
    description: string;
  }[];
}

export const OFFICIAL_EXPENSE_COA: OfficialParentDef[] = [
  {
    glCode: '4010100',
    name: 'SALARIES AND OTHER BENEFITS',
    description: 'Salaries and other staff benefits',
    subsidiaries: [
      { glCode: '4010101', name: 'SALARY', description: 'Staff salary disbursements' },
      { glCode: '4010102', name: 'BONUS TO STAFF', description: 'Bonus to staff' },
    ],
  },
  {
    glCode: '4020100',
    name: 'RENT, RATES AND TAXES',
    description: 'Rent, rates and property taxes',
    subsidiaries: [
      { glCode: '4020101', name: 'RENT', description: 'Rent expense' },
      { glCode: '4020102', name: 'TAXES - INCLUDE PROPERTY TAX', description: 'Taxes including property tax' },
    ],
  },
  {
    glCode: '4030100',
    name: 'FUEL AND POWER',
    description: 'Fuel and power expenses',
    subsidiaries: [
      { glCode: '4030101', name: 'BUS DIESEL', description: 'Bus diesel expense' },
      { glCode: '4030102', name: 'GENERATOR DIESEL - MAIN', description: 'Generator diesel - main' },
      { glCode: '4030103', name: 'GENERATOR PETROL - OFFICE USE', description: 'Generator petrol - office use' },
    ],
  },
  {
    glCode: '4040100',
    name: 'REPAIR AND MAINTENANCE',
    description: 'Repair and maintenance expenses',
    subsidiaries: [
      { glCode: '4040101', name: 'BUS REPAIRING', description: 'Bus repairing expense' },
      { glCode: '4040102', name: 'GENERATOR REPAIRING', description: 'Generator repairing expense' },
      { glCode: '4040103', name: 'HALL REPAIRING', description: 'Hall repairing expense' },
      { glCode: '4040104', name: 'DAILY REPAIR AND MAINTENANCE', description: 'Daily repair and maintenance expense' },
    ],
  },
  {
    glCode: '4050100',
    name: 'COMPUTER EXPENSES',
    description: 'Computer and internet expenses',
    subsidiaries: [
      { glCode: '4050101', name: 'COMPUTER EXPENSE', description: 'Computer expense' },
      { glCode: '4050102', name: 'INTERNET FEE', description: 'Internet fee expense' },
    ],
  },
  {
    glCode: '4060100',
    name: 'PRINTING AND STATIONERY',
    description: 'Printing, stationery, postage and telegram expenses',
    subsidiaries: [
      { glCode: '4060101', name: 'PRINTING AND STATIONERY', description: 'Printing and stationery expense' },
      { glCode: '4060102', name: 'POSTAGE AND TELEGRAM', description: 'Postage and telegram expense' },
    ],
  },
  {
    glCode: '4070100',
    name: 'DONATION',
    description: 'Donation and charitable disbursements',
    subsidiaries: [
      { glCode: '4070101', name: 'MONTHLY DONATION', description: 'Monthly donation expense' },
      { glCode: '4070102', name: 'MARRIAGE DONATION', description: 'Marriage donation expense' },
      { glCode: '4070103', name: 'OTHER THAN GENERAL DONATION', description: 'Other than general donation expense' },
      { glCode: '4070104', name: 'MEDICAL DONATION', description: 'Medical donation expense' },
    ],
  },
  {
    glCode: '4080100',
    name: 'LEGAL AND PROFESSIONAL',
    description: 'Legal and professional charges',
    subsidiaries: [
      { glCode: '4080101', name: 'LEGAL CHARGES', description: 'Legal charges' },
    ],
  },
  {
    glCode: '4090100',
    name: 'AUDITOR REMUNERATION',
    description: 'Auditor remuneration and audit fees',
    subsidiaries: [
      { glCode: '4090101', name: 'AUDIT FEE', description: 'Audit fee expense' },
    ],
  },
  {
    glCode: '4100100',
    name: 'TRAVELLING AND CONVEYANCE',
    description: 'Travelling and conveyance expenses',
    subsidiaries: [
      { glCode: '4100101', name: 'CONVEYANCE CHARGES', description: 'Conveyance charges' },
      { glCode: '4100102', name: 'TRAVELLING EXPENSE', description: 'Travelling expense' },
    ],
  },
  {
    glCode: '4110100',
    name: 'GENERAL OFFICE EXPENSE',
    description: 'General office expenses',
    subsidiaries: [
      { glCode: '4110101', name: 'ENTERTAINMENT', description: 'Entertainment expense' },
    ],
  },
  {
    glCode: '4120100',
    name: 'RECEPTION, MEETING AND FUNCTIONS',
    description: 'Reception, meeting and function expenses',
    subsidiaries: [
      { glCode: '4120101', name: 'MEETING EXPENSE', description: 'Meeting expense' },
      { glCode: '4120102', name: 'FUNCTION EXPENSE', description: 'Function expense' },
      { glCode: '4120103', name: 'OTHER RECEPTION EXPENSE', description: 'Other reception expense' },
    ],
  },
  {
    glCode: '4130100',
    name: 'SECURITY EXPENSE',
    description: 'Security expenses',
    subsidiaries: [
      { glCode: '4130101', name: 'SECURITY EXPENSE', description: 'Security expense' },
    ],
  },
  {
    glCode: '4140100',
    name: 'SUBSCRIPTION FEE',
    description: 'Subscription fee expenses',
    subsidiaries: [
      { glCode: '4140101', name: 'SUBSCRIPTION FEE', description: 'Subscription fee expense' },
    ],
  },
  {
    glCode: '4150100',
    name: 'OTHER EXPENSE',
    description: 'Miscellaneous and other expenses',
    subsidiaries: [
      { glCode: '4150101', name: 'MISCELLANEOUS EXPENSE', description: 'Miscellaneous expense' },
      { glCode: '4150102', name: 'OTHER EXPENSE', description: 'Other expense' },
    ],
  },
  {
    glCode: '4160100',
    name: 'FINANCIAL CHARGES',
    description: 'Financial and bank charges',
    subsidiaries: [
      { glCode: '4160101', name: 'BANK CHARGES', description: 'Bank charges' },
      { glCode: '4160102', name: 'OTHER CHARGES', description: 'Other financial charges' },
    ],
  },
];

// Legacy-to-New GL code mapping for all known legacy expense codes
const LEGACY_TO_OFFICIAL_MAP: Record<string, string> = {
  // Salaries and Other Benefits
  '4010000': '4010100',
  '4011000': '4010100',
  '4010101': '4010101',
  '4011001': '4010101',
  '4080111': '4010101',
  '4010102': '4010102',
  '4011002': '4010102',
  '4080112': '4010102',
  '4080110': '4010102',

  // Rent, Rates and Taxes
  '4020000': '4020100',
  '4040000': '4040100',
  '4040101': '4020101',
  '4021001': '4020101',
  '4040200': '4020102',
  '4040201': '4020102',
  '4040202': '4020102',
  '4040203': '4020102',
  '4021002': '4020102',

  // Fuel and Power
  '4030000': '4030100',
  '4030101': '4030101',
  '4031001': '4030101',
  '4031002': '4030102',
  '4080104': '4030102',
  '4080130': '4030102',
  '4031003': '4030103',
  '4080126': '4030103',
  '4080122': '4030102',
  '4080123': '4030102',
  '4080124': '4030102',
  '4080128': '4030102',

  // Repair and Maintenance
  '4050000': '4050100',
  '4050101': '4040101',
  '4041001': '4040101',
  '4050102': '4040102',
  '4041002': '4040102',
  '4050103': '4040103',
  '4041003': '4040103',
  '4050119': '4040103',
  '4050120': '4040103',
  '4050121': '4040103',
  '4050122': '4040103',
  '4041004': '4040104',
  '4041005': '4040104',
  '4050123': '4040104',
  '4080121': '4040104',
  '4080127': '4040104',

  // Computer Expenses
  '4051001': '4060102',

  // Printing and Stationery
  '4060000': '4060100',
  '4061001': '4060101',
  '4080107': '4060101',
  '4061002': '4060102',

  // Donation
  '4070000': '4070100',
  '4060101': '4070101',
  '4071001': '4070101',
  '4080114': '4070101',
  '4060102': '4070102',
  '4071002': '4070102',
  '4071004': '4070103',
  '4060106': '4070103',
  '4060107': '4070103',
  '4060108': '4070103',
  '4060103': '4070104',
  '4071003': '4070104',
  '4080117': '4070104',
  '4080125': '4070104',

  // Legal and Professional
  '4080000': '4080100',
  '4070101': '4080101',
  '4070103': '4080101',
  '4081001': '4080101',
  '4081002': '4080101',

  // Auditor Remuneration
  '4090000': '4090100',
  '4070102': '4090101',
  '4091001': '4090101',

  // Travelling and Conveyance
  '4100000': '4100100',
  '4101001': '4100101',
  '4080120': '4100101',
  '4110000': '4100100',
  '4111001': '4100102',

  // General Office Expense
  '4120000': '4110100',
  '4121001': '4110101',
  '4130000': '4110100',
  '4131001': '4110101',
  '4080101': '4110101',
  '4080118': '4110101',
  '4080119': '4110101',

  // Reception, Meeting and Functions
  '4140000': '4120100',
  '4141001': '4120101',
  '4080105': '4120101',
  '4080129': '4120101',
  '4080108': '4120102',
  '4080131': '4120102',

  // Security Expense
  '4150000': '4130100',
  '4151001': '4130101',
  '4080102': '4130101',

  // Subscription Fee
  '4160000': '4140100',
  '4161001': '4140101',

  // Other Expense
  '4170000': '4150100',
  '4080109': '4150101',
  '4171001': '4150102',
  '4080113': '4150102',
  '4080116': '4150102',

  // Financial Charges
  '4180000': '4160100',
  '4181001': '4160101',
  '4190000': '4160100',
  '4191001': '4160101',
  '4080103': '4160101',
  '4200000': '4160100',
  '4201001': '4160102',
};

async function withRetry<T>(fn: () => Promise<T>, label = 'DB Op', maxRetries = 6): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isTransient =
        msg.includes('No such host is known') ||
        msg.includes('Server selection timeout') ||
        msg.includes('TransientTransactionError') ||
        err?.code === 'P2010' ||
        err?.code === 'P1001';
      if (isTransient && attempt < maxRetries) {
        console.warn(`⚠️ Transient DB/DNS error during ${label} (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 1500}ms...`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Max retries exceeded for ${label}`);
}

function getOriginalGlCode(rawCode: string): string {
  // Strip any "OLD-<code>-<suffix>" wrapper if interrupted previously
  const match = /^OLD-(\d{7})-[a-z0-9]+$/i.exec(rawCode);
  if (match) return match[1];
  return rawCode;
}

async function migrateOfficialExpenseCOA() {
  console.log('=== STARTING OFFICIAL EXPENSE COA MIGRATION ===');

  // 1. Ensure EXPENSE AccountType and 4000000 EXPENSES MAIN account exist
  let expenseType = await withRetry(() =>
    prisma.accountType.findFirst({
      where: { name: { equals: 'EXPENSE', mode: 'insensitive' } },
    })
  );
  if (!expenseType) {
    expenseType = await withRetry(() =>
      prisma.accountType.create({
        data: { name: 'EXPENSE', description: 'Outflows or depletion of assets for business operations' },
      })
    );
  }

  const mainExpense = await withRetry(() =>
    prisma.account.upsert({
      where: { glCode: '4000000' },
      update: {
        accountName: 'EXPENSES',
        accountLevel: 'MAIN',
        accountTypeId: expenseType!.id,
        parentId: null,
        detailType: 'Header',
        isLocked: true,
        isSystemDefined: true,
        isDeleted: false,
        description: 'Root control account for all Expense accounts',
      },
      create: {
        glCode: '4000000',
        accountName: 'EXPENSES',
        accountLevel: 'MAIN',
        accountTypeId: expenseType!.id,
        parentId: null,
        detailType: 'Header',
        isLocked: true,
        isSystemDefined: true,
        isDeleted: false,
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0,
        description: 'Root control account for all Expense accounts',
      },
    })
  );
  console.log(`✅ Verified MAIN Account: 4000000 - EXPENSES (${mainExpense.id})`);

  // 2. Clean up soft-deleted dummy TB-MATRIX-TEST entries and *99 test accounts
  const dummyJEs = await withRetry(() =>
    prisma.journalEntry.findMany({
      where: {
        isDeleted: true,
        OR: [{ reference: 'TB-MATRIX-TEST' }, { description: 'tb-matrix-test' }],
      },
    })
  );
  if (dummyJEs.length > 0) {
    const dummyIds = dummyJEs.map((j) => j.id);
    await withRetry(() => prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: dummyIds } } }));
    await withRetry(() => prisma.journalEntry.deleteMany({ where: { id: { in: dummyIds } } }));
    console.log(`🧹 Permanently removed ${dummyJEs.length} soft-deleted dummy test journal entries (TB-MATRIX-TEST)`);
  }

  const dummyTestCodes = ['1010199', '3030199', '4010199', '5010199', '1010199-TEST', '3030199-TEST', '4010199-TEST', '5010199-TEST'];
  const deletedDummyAccs = await withRetry(() =>
    prisma.account.deleteMany({
      where: {
        glCode: { in: dummyTestCodes },
        journalEntryLines: { none: {} },
        openingBalanceLines: { none: {} },
      },
    })
  );
  if (deletedDummyAccs.count > 0) {
    console.log(`🧹 Removed ${deletedDummyAccs.count} dummy test accounts (*99)`);
  }

  // 3. Fetch all existing 4-series accounts (including any OLD-4... from an interrupted run)
  const all4Series = await withRetry(() =>
    prisma.account.findMany({
      where: {
        OR: [{ glCode: { startsWith: '4' } }, { glCode: { startsWith: 'OLD-4' } }],
        NOT: { glCode: '4000000' },
      },
      include: {
        _count: {
          select: {
            journalEntryLines: true,
            openingBalanceLines: true,
            pettyCashExpenseAccounts: true,
            expenseHeads: true,
          },
        },
      },
    })
  );

  // Separate accounts that HAVE financial data/references vs those that have 0 references
  const accountsWithRefs = all4Series.filter(
    (a) =>
      a._count.journalEntryLines > 0 ||
      a._count.openingBalanceLines > 0 ||
      a._count.pettyCashExpenseAccounts > 0 ||
      a._count.expenseHeads > 0 ||
      Math.abs(a.initialBalance || 0) > 0.001
  );
  const emptyAccounts = all4Series.filter((a) => !accountsWithRefs.some((r) => r.id === a.id));

  console.log(
    `📦 Found ${all4Series.length} existing 4-series accounts (${accountsWithRefs.length} with references/data, ${emptyAccounts.length} empty).`
  );

  // Detach all parentId links in a single updateMany call so MongoDB allows deleting empty accounts immediately
  await withRetry(() =>
    prisma.account.updateMany({
      where: { id: { in: all4Series.map((a) => a.id) } },
      data: { parentId: null },
    })
  );

  // Delete all empty 4-series accounts in a single native MongoDB command (avoids Prisma P2014 self-relation check)
  if (emptyAccounts.length > 0) {
    const emptyIds = emptyAccounts.map((a) => a.id);
    const delEmpty: any = await withRetry(() =>
      prisma.$runCommandRaw({
        delete: 'Account',
        deletes: [{ q: { _id: { $in: emptyIds } }, limit: 0 }],
      })
    );
    console.log(`🧹 Deleted ${delEmpty?.n ?? emptyIds.length} empty legacy 4-series accounts in bulk.`);
  }

  // Temporarily rename only the few accounts that have references so their glCodes don't collide
  const oldCodeById = new Map<string, string>();
  for (const acc of accountsWithRefs) {
    const origCode = getOriginalGlCode(acc.glCode);
    oldCodeById.set(acc.id, origCode);
    if (!acc.glCode.startsWith('OLD-')) {
      await withRetry(() =>
        prisma.account.update({
          where: { id: acc.id },
          data: {
            glCode: `OLD-${origCode}-${acc.id.slice(0, 4)}`,
            parentId: null,
          },
        })
      );
    }
  }

  // 4. Upsert the 16 Official Parent Categories and 31 Official Subsidiary Accounts
  const officialByCode = new Map<string, { id: string; glCode: string; name: string; parentName?: string }>();

  for (const parentDef of OFFICIAL_EXPENSE_COA) {
    const parentAcc = await withRetry(() =>
      prisma.account.upsert({
        where: { glCode: parentDef.glCode },
        update: {
          accountName: parentDef.name,
          accountLevel: 'PARENT',
          parentId: mainExpense.id,
          accountTypeId: expenseType!.id,
          detailType: 'Header',
          description: parentDef.description,
          isLocked: false,
          isSystemDefined: true,
          isDeleted: false,
        },
        create: {
          glCode: parentDef.glCode,
          accountName: parentDef.name,
          accountLevel: 'PARENT',
          parentId: mainExpense.id,
          accountTypeId: expenseType!.id,
          detailType: 'Header',
          description: parentDef.description,
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isLocked: false,
          isSystemDefined: true,
          isDeleted: false,
        },
      })
    );
    officialByCode.set(parentDef.glCode, { id: parentAcc.id, glCode: parentDef.glCode, name: parentDef.name });
    console.log(`✅ Ready PARENT: ${parentDef.glCode} - ${parentDef.name}`);

    for (const subDef of parentDef.subsidiaries) {
      const subAcc = await withRetry(() =>
        prisma.account.upsert({
          where: { glCode: subDef.glCode },
          update: {
            accountName: subDef.name,
            accountLevel: 'SUBSIDIARY',
            parentId: parentAcc.id,
            accountTypeId: expenseType!.id,
            detailType: 'Expense',
            description: subDef.description,
            isLocked: false,
            isSystemDefined: true,
            isDeleted: false,
          },
          create: {
            glCode: subDef.glCode,
            accountName: subDef.name,
            accountLevel: 'SUBSIDIARY',
            parentId: parentAcc.id,
            accountTypeId: expenseType!.id,
            detailType: 'Expense',
            description: subDef.description,
            currency: 'PKR',
            subsidiary: ['Global'],
            initialBalance: 0,
            currentBalance: 0,
            isLocked: false,
            isSystemDefined: true,
            isDeleted: false,
          },
        })
      );
      officialByCode.set(subDef.glCode, {
        id: subAcc.id,
        glCode: subDef.glCode,
        name: subDef.name,
        parentName: parentDef.name,
      });
      console.log(`   ↳ Ready SUBSIDIARY: ${subDef.glCode} - ${subDef.name}`);
    }
  }

  // 5. Remap all existing financial records from the remaining legacy accounts to the new Official Subsidiary Accounts
  const fallbackSub = officialByCode.get('4150102')!;

  for (const oldAcc of accountsWithRefs) {
    const origCode = oldCodeById.get(oldAcc.id)!;
    let targetCode = LEGACY_TO_OFFICIAL_MAP[origCode] || origCode;
    if (targetCode.endsWith('00')) {
      const parentDef = OFFICIAL_EXPENSE_COA.find((p) => p.glCode === targetCode);
      if (parentDef && parentDef.subsidiaries.length > 0) {
        targetCode = parentDef.subsidiaries[0].glCode;
      }
    }
    const targetInfo = officialByCode.get(targetCode) || fallbackSub;
    if (targetInfo.id === oldAcc.id) continue;

    const jeLinesMoved = await withRetry(() =>
      prisma.journalEntryLine.updateMany({
        where: { accountId: oldAcc.id },
        data: { accountId: targetInfo.id },
      })
    );
    if (jeLinesMoved.count > 0) {
      console.log(
        `🔄 Remapped ${jeLinesMoved.count} JournalEntryLine(s) from legacy ${origCode} (${oldAcc.accountName}) -> ${targetInfo.glCode} (${targetInfo.name})`
      );
    }

    const obLinesMoved = await withRetry(() =>
      prisma.openingBalanceLine.updateMany({
        where: { accountId: oldAcc.id },
        data: { accountId: targetInfo.id },
      })
    );
    if (obLinesMoved.count > 0) {
      console.log(`🔄 Remapped ${obLinesMoved.count} OpeningBalanceLine(s) from legacy ${origCode} -> ${targetInfo.glCode}`);
    }

    const pcMoved = await withRetry(() =>
      prisma.pettyCashTransaction.updateMany({
        where: { expenseAccountId: oldAcc.id },
        data: { expenseAccountId: targetInfo.id },
      })
    );
    if (pcMoved.count > 0) {
      console.log(`🔄 Remapped ${pcMoved.count} PettyCashTransaction(s) from legacy ${origCode} -> ${targetInfo.glCode}`);
    }

    await withRetry(() =>
      prisma.expenseHead.updateMany({
        where: { accountId: oldAcc.id },
        data: { accountId: targetInfo.id },
      })
    );

    if (oldAcc.initialBalance && Math.abs(oldAcc.initialBalance) > 0.001) {
      await withRetry(() =>
        prisma.account.update({
          where: { id: targetInfo.id },
          data: { initialBalance: { increment: oldAcc.initialBalance } },
        })
      );
      console.log(`🔄 Carried over initialBalance ${oldAcc.initialBalance} from ${origCode} -> ${targetInfo.glCode}`);
    }
  }

  // 6. Delete the remaining old 4-series accounts now that 100% of references have been migrated
  const officialIds = Array.from(officialByCode.values()).map((v) => v.id);
  const oldRefIds = accountsWithRefs.map((a) => a.id).filter((id) => !officialIds.includes(id));
  if (oldRefIds.length > 0) {
    const deletedOld: any = await withRetry(() =>
      prisma.$runCommandRaw({
        delete: 'Account',
        deletes: [{ q: { _id: { $in: oldRefIds } }, limit: 0 }],
      })
    );
    console.log(`🧹 Deleted ${deletedOld?.n ?? oldRefIds.length} migrated legacy 4-series accounts.`);
  }

  // 7. Synchronize ExpenseHead table with the exact 31 Official Subsidiary Accounts
  const existingHeads = await withRetry(() =>
    prisma.expenseHead.findMany({
      include: {
        _count: { select: { simpleExpenses: true, pettyCashTransactions: true } },
      },
    })
  );

  const unusedHeadIds = existingHeads
    .filter((h) => h._count.simpleExpenses === 0 && h._count.pettyCashTransactions === 0)
    .map((h) => h.id);

  if (unusedHeadIds.length > 0) {
    await withRetry(() =>
      prisma.expenseHead.deleteMany({
        where: { id: { in: unusedHeadIds } },
      })
    );
    console.log(`🧹 Cleaned up ${unusedHeadIds.length} unused legacy ExpenseHead records.`);
  }

  for (const parentDef of OFFICIAL_EXPENSE_COA) {
    for (const subDef of parentDef.subsidiaries) {
      const subInfo = officialByCode.get(subDef.glCode)!;
      const existing = await withRetry(() =>
        prisma.expenseHead.findFirst({
          where: {
            OR: [
              { accountId: subInfo.id },
              { name: { equals: subDef.name, mode: 'insensitive' }, category: { equals: parentDef.name, mode: 'insensitive' } },
            ],
          },
        })
      );

      if (existing) {
        await withRetry(() =>
          prisma.expenseHead.update({
            where: { id: existing.id },
            data: {
              name: subDef.name,
              category: parentDef.name,
              accountId: subInfo.id,
              isActive: true,
              isDeleted: false,
            },
          })
        );
      } else {
        await withRetry(() =>
          prisma.expenseHead.create({
            data: {
              name: subDef.name,
              category: parentDef.name,
              accountId: subInfo.id,
              isActive: true,
              isDeleted: false,
            },
          })
        );
      }
    }
  }
  console.log(`✅ Synchronized 31 Official ExpenseHead records with 16 Parent Categories.`);

  // 8. Recalculate all account balances from posted journal entry lines
  const rebuildRes = await withRetry(() => AccountingService.recalculateAllBalances(prisma));
  console.log(`✅ Recalculated all account balances (${rebuildRes.updated} accounts updated).`);

  console.log('=== OFFICIAL EXPENSE COA MIGRATION COMPLETED SUCCESSFULLY ===');
}

migrateOfficialExpenseCOA()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

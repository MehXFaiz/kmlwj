import prisma from '../api/_prisma.js';

interface AccountDef {
  glCode: string;
  name: string;
  level: 'MAIN' | 'PARENT' | 'SUBSIDIARY' | 'GL';
  accountType: 'REVENUE' | 'EXPENSE' | 'ASSET';
  parentCode?: string;
  isLocked?: boolean;
  isSystemDefined?: boolean;
  detailType?: string;
  description?: string;
}

const ACCOUNTS_TO_SEED: AccountDef[] = [
  // ── REVENUE MAIN ──────────────────────────────────────────────────────────
  { glCode: '3000000', name: 'REVENUE', level: 'MAIN', accountType: 'REVENUE', isLocked: true, isSystemDefined: true, detailType: 'Header', description: 'Root control account for all Revenue accounts' },

  // ── REVENUE PARENTS & SUBSIDIARIES ─────────────────────────────────────────
  // 3010000 INCOME (Hall Bookings)
  { glCode: '3010000', name: 'INCOME', level: 'PARENT', accountType: 'REVENUE', parentCode: '3000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Income from Hall Bookings' },
  { glCode: '3011001', name: 'BAGH-E-HAJIANI - GARDEN', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3010000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Bagh-e-Hajiani Garden booking income' },
  { glCode: '3011002', name: 'SADAYA - HALL', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3010000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Sadaya Hall booking income' },
  { glCode: '3011003', name: 'ZIKARYA - HALL', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3010000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Zikarya Hall booking income' },
  { glCode: '3011004', name: 'ANEXY - HALL', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3010000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Anexy Hall booking income' },

  // 3020000 OTHER INCOME
  { glCode: '3020000', name: 'OTHER INCOME', level: 'PARENT', accountType: 'REVENUE', parentCode: '3000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Other income sources and collections' },
  { glCode: '3021001', name: 'BUS BOOKING', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Bus booking income' },
  { glCode: '3021002', name: 'MEMBERSHIP FEE', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Membership fee income' },
  { glCode: '3021003', name: 'QURBANI SPACE', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Qurbani space fee income' },
  { glCode: '3021004', name: 'ZAKAT', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Zakat collection income' },
  { glCode: '3021005', name: 'FITRA', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Fitra collection income' },
  { glCode: '3021006', name: 'MARRIAGE DONATION', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Marriage donation received' },
  { glCode: '3021007', name: 'DECORATION / LIGHTING COMMISSION', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3020000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Decoration and lighting commission income' },

  // 3030000 DECORATION COMMISSION
  { glCode: '3030000', name: 'DECORATION COMMISSION', level: 'PARENT', accountType: 'REVENUE', parentCode: '3000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Commission income for decoration and lighting' },
  { glCode: '3031001', name: 'DECORATION COMMISSION', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3030000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Decoration commission' },
  { glCode: '3031002', name: 'LIGHTING COMMISSION', level: 'SUBSIDIARY', accountType: 'REVENUE', parentCode: '3030000', isLocked: false, isSystemDefined: true, detailType: 'Revenue', description: 'Lighting commission' },

  // ── EXPENSES MAIN ─────────────────────────────────────────────────────────
  { glCode: '4000000', name: 'EXPENSES', level: 'MAIN', accountType: 'EXPENSE', isLocked: true, isSystemDefined: true, detailType: 'Header', description: 'Root control account for all Expense accounts' },

  // ── EXPENSES PARENTS & SUBSIDIARIES ───────────────────────────────────────
  // 4010000 ADMINISTRATIVE EXPENSE
  { glCode: '4010000', name: 'ADMINISTRATIVE EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Administrative and operational expenses' },
  { glCode: '4011000', name: 'SALARIES AND OTHER BENEFITS', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4010000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Salaries and other staff benefits' },
  { glCode: '4011001', name: 'SALARY', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4010000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Staff salary disbursements' },
  { glCode: '4011002', name: 'BONUS TO STAFF', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4010000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Bonus to staff' },

  // 4020000 RENT, RATES AND TAXES
  { glCode: '4020000', name: 'RENT, RATES AND TAXES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Rent, rates and property taxes' },
  { glCode: '4021001', name: 'RENT', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4020000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Building rent' },
  { glCode: '4021002', name: 'PROPERTY TAX / LOCAL PROPERTY TAX', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4020000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Property tax and local property tax' },

  // 4030000 FUEL AND POWER
  { glCode: '4030000', name: 'FUEL AND POWER', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Fuel and power costs' },
  { glCode: '4031001', name: 'BUS DIESEL', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4030000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Bus diesel expenses' },
  { glCode: '4031002', name: 'GENERATOR DIESEL', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4030000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Generator diesel expenses' },
  { glCode: '4031003', name: 'GENERATOR PETROL / OFFICE USE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4030000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Generator petrol and office use fuel' },

  // 4040000 REPAIR AND MAINTENANCE
  { glCode: '4040000', name: 'REPAIR AND MAINTENANCE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Repair and maintenance expenses' },
  { glCode: '4041001', name: 'BUS REPAIR', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4040000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Bus repair and maintenance' },
  { glCode: '4041002', name: 'GENERATOR REPAIR', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4040000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Generator repair and maintenance' },
  { glCode: '4041003', name: 'HALL REPAIR', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4040000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Hall repair and maintenance' },
  { glCode: '4041004', name: 'SMALL REPAIR', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4040000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Small and minor repairs' },
  { glCode: '4041005', name: 'OTHER REPAIR / MAINTENANCE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4040000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Other repair and maintenance costs' },

  // 4050000 COURIER EXPENSE
  { glCode: '4050000', name: 'COURIER EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Courier and parcel expense' },
  { glCode: '4051001', name: 'COURIER EXPENSE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4050000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Courier and delivery charges' },

  // 4060000 PRINTING AND STATIONERY
  { glCode: '4060000', name: 'PRINTING AND STATIONERY', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Printing, stationery and postage expenses' },
  { glCode: '4061001', name: 'PRINTING AND STATIONERY', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4060000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Printing and stationery supplies' },
  { glCode: '4061002', name: 'POSTAGE AND COURIER', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4060000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Postage and courier expenses' },

  // 4070000 DONATION
  { glCode: '4070000', name: 'DONATION', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Donation and charitable disbursements' },
  { glCode: '4071001', name: 'MONTHLY DONATION', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4070000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Monthly donation payments' },
  { glCode: '4071002', name: 'MARRIAGE DONATION', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4070000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Marriage assistance donations' },
  { glCode: '4071003', name: 'MEDICAL DONATION', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4070000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Medical aid donations' },
  { glCode: '4071004', name: 'OTHER DONATION', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4070000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Other charitable donations and distributions' },

  // 4080000 LEGAL AND PROFESSIONAL
  { glCode: '4080000', name: 'LEGAL AND PROFESSIONAL', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Legal and professional services' },
  { glCode: '4081001', name: 'LEGAL FEES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4080000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Legal and attorney fees' },
  { glCode: '4081002', name: 'PROFESSIONAL FEES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4080000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Professional consulting fees' },

  // 4090000 AUDITOR / AUDIT EXPENSE
  { glCode: '4090000', name: 'AUDITOR / AUDIT EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'External audit and auditor fees' },
  { glCode: '4091001', name: 'AUDIT FEE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4090000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Annual and periodic audit fees' },

  // 4100000 COMPANY CHARGES
  { glCode: '4100000', name: 'COMPANY CHARGES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Corporate and company charges' },
  { glCode: '4101001', name: 'COMPANY CHARGES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4100000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Company filing and registration charges' },

  // 4110000 TRAVELLING EXPENSE
  { glCode: '4110000', name: 'TRAVELLING EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Travel and transport charges' },
  { glCode: '4111001', name: 'TRAVELLING EXPENSE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4110000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Staff and official travelling expenses' },

  // 4120000 CENTRAL OFFICE EXPENSE
  { glCode: '4120000', name: 'CENTRAL OFFICE EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Central office administrative expenses' },
  { glCode: '4121001', name: 'CENTRAL OFFICE EXPENSE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4120000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Central office operations' },

  // 4130000 ENTERTAINMENT
  { glCode: '4130000', name: 'ENTERTAINMENT', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Entertainment and guest refreshment expenses' },
  { glCode: '4131001', name: 'ENTERTAINMENT', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4130000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Entertainment and refreshment' },

  // 4140000 RECEPTION, MEETING AND FUNCTIONS
  { glCode: '4140000', name: 'RECEPTION, MEETING AND FUNCTIONS', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Reception, meeting and official function expenses' },
  { glCode: '4141001', name: 'RECEPTION, MEETING AND FUNCTIONS', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4140000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Meeting and function arrangement costs' },

  // 4150000 SECURITY EXPENSE
  { glCode: '4150000', name: 'SECURITY EXPENSE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Premises security services' },
  { glCode: '4151001', name: 'SECURITY EXPENSE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4150000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Security guards and equipment charges' },

  // 4160000 SUBSCRIPTION FEE
  { glCode: '4160000', name: 'SUBSCRIPTION FEE', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Membership and subscription fees paid' },
  { glCode: '4161001', name: 'SUBSCRIPTION FEE', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4160000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Organizational subscription fees' },

  // 4170000 OTHER EXPENSES
  { glCode: '4170000', name: 'OTHER EXPENSES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'General miscellaneous expenses' },
  { glCode: '4171001', name: 'OTHER EXPENSES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4170000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Miscellaneous expenses' },

  // 4180000 FINANCIAL CHARGES
  { glCode: '4180000', name: 'FINANCIAL CHARGES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Financial charges and processing fees' },
  { glCode: '4181001', name: 'FINANCIAL CHARGES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4180000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Financial fees and charges' },

  // 4190000 BANK CHARGES
  { glCode: '4190000', name: 'BANK CHARGES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Bank maintenance and transactional fees' },
  { glCode: '4191001', name: 'BANK CHARGES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4190000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Bank charges and deduction fees' },

  // 4200000 OTHER CHARGES
  { glCode: '4200000', name: 'OTHER CHARGES', level: 'PARENT', accountType: 'EXPENSE', parentCode: '4000000', isLocked: false, isSystemDefined: true, detailType: 'Header', description: 'Other regulatory and sundry charges' },
  { glCode: '4201001', name: 'OTHER CHARGES', level: 'SUBSIDIARY', accountType: 'EXPENSE', parentCode: '4200000', isLocked: false, isSystemDefined: true, detailType: 'Expense', description: 'Other sundry charges' },
];

async function migrate() {
  console.log('=== STARTING INCOME & EXPENSE COA MIGRATION ===');

  // Step 1: Ensure AccountTypes exist
  const typeMap: Record<string, string> = {};
  const types = ['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY'];
  for (const t of types) {
    let rec = await prisma.accountType.findFirst({
      where: { name: { equals: t, mode: 'insensitive' } }
    });
    if (!rec) {
      rec = await prisma.accountType.create({ data: { name: t, description: `${t} account category` } });
    }
    typeMap[t] = rec.id;
  }
  console.log('✅ Account Types verified:', Object.keys(typeMap));

  // Step 2: Ensure the TWO banks are canonical
  // 1010101 -> "National Bank of Pakistan"
  const bank1 = await prisma.account.findUnique({ where: { glCode: '1010101' } });
  if (bank1) {
    await prisma.account.update({
      where: { id: bank1.id },
      data: {
        accountName: 'National Bank of Pakistan',
        detailType: 'Bank',
        isLocked: false,
        isDeleted: false
      }
    });
    console.log('✅ Bank 1 updated: 1010101 -> National Bank of Pakistan');
  }

  // 1010102 -> "NBP-Zakat Account"
  const bank2 = await prisma.account.findUnique({ where: { glCode: '1010102' } });
  if (bank2) {
    await prisma.account.update({
      where: { id: bank2.id },
      data: {
        accountName: 'NBP-Zakat Account',
        detailType: 'Bank',
        isLocked: false,
        isDeleted: false
      }
    });
    console.log('✅ Bank 2 updated: 1010102 -> NBP-Zakat Account');
  }

  // Ensure Cash in Hand is active
  const cash = await prisma.account.findUnique({ where: { glCode: '1010103' } });
  if (cash) {
    await prisma.account.update({
      where: { id: cash.id },
      data: {
        accountName: 'Cash in Hand',
        detailType: 'Cash',
        isLocked: false,
        isDeleted: false
      }
    });
  }

  // Deactivate any test bank or test accounts
  await prisma.account.updateMany({
    where: {
      glCode: { in: ['1010199-TEST', '5010199-TEST', '3030199-TEST', '4010199-TEST'] }
    },
    data: { isDeleted: true }
  });
  console.log('✅ Deactivated test accounts');

  // Step 3: Handle in-place mapping for the 4 Hall booking accounts
  // Old codes: 3010101, 3010102, 3010103, 3010104
  // New codes: 3011001, 3011002, 3011003, 3011004
  const hallCodeMapping: Record<string, { newCode: string; newName: string }> = {
    '3010101': { newCode: '3011001', newName: 'BAGH-E-HAJIANI - GARDEN' },
    '3010102': { newCode: '3011002', newName: 'SADAYA - HALL' },
    '3010103': { newCode: '3011003', newName: 'ZIKARYA - HALL' },
    '3010104': { newCode: '3011004', newName: 'ANEXY - HALL' },
  };

  for (const [oldCode, info] of Object.entries(hallCodeMapping)) {
    const existingOld = await prisma.account.findUnique({ where: { glCode: oldCode } });
    const existingNew = await prisma.account.findUnique({ where: { glCode: info.newCode } });

    if (existingOld && !existingNew) {
      await prisma.account.update({
        where: { id: existingOld.id },
        data: {
          glCode: info.newCode,
          accountName: info.newName,
          accountLevel: 'SUBSIDIARY',
          detailType: 'Revenue',
          isLocked: false,
          isDeleted: false
        }
      });
      console.log(`✅ In-place mapped hall account ${oldCode} -> ${info.newCode} (${info.newName})`);
    } else if (existingOld && existingNew && existingOld.id !== existingNew.id) {
      await prisma.journalEntryLine.updateMany({
        where: { accountId: existingOld.id },
        data: { accountId: existingNew.id }
      });
      await prisma.hallBooking.updateMany({
        where: { hallId: existingOld.id },
        data: { hallId: existingNew.id }
      });
      await prisma.account.delete({ where: { id: existingOld.id } });
      console.log(`✅ Merged old hall account ${oldCode} into ${info.newCode}`);
    }
  }

  // Map 4010101 (Staff Salary) to 4011001 (SALARY)
  const oldSalary = await prisma.account.findUnique({ where: { glCode: '4010101' } });
  const newSalary = await prisma.account.findUnique({ where: { glCode: '4011001' } });
  if (oldSalary && !newSalary) {
    await prisma.account.update({
      where: { id: oldSalary.id },
      data: {
        glCode: '4011001',
        accountName: 'SALARY',
        accountLevel: 'SUBSIDIARY',
        detailType: 'Expense',
        isLocked: false,
        isDeleted: false
      }
    });
    console.log('✅ In-place mapped salary account 4010101 -> 4011001');
  }

  // Map 4010102 (Staff Bonus) to 4011002 (BONUS TO STAFF)
  const oldBonus = await prisma.account.findUnique({ where: { glCode: '4010102' } });
  const newBonus = await prisma.account.findUnique({ where: { glCode: '4011002' } });
  if (oldBonus && !newBonus) {
    await prisma.account.update({
      where: { id: oldBonus.id },
      data: {
        glCode: '4011002',
        accountName: 'BONUS TO STAFF',
        accountLevel: 'SUBSIDIARY',
        detailType: 'Expense',
        isLocked: false,
        isDeleted: false
      }
    });
    console.log('✅ In-place mapped bonus account 4010102 -> 4011002');
  }

  // Step 4: Upsert MAIN accounts first
  const mainDefs = ACCOUNTS_TO_SEED.filter(a => a.level === 'MAIN');
  const mainAccountMap: Record<string, string> = {};

  for (const def of mainDefs) {
    const typeId = typeMap[def.accountType];
    const acc = await prisma.account.upsert({
      where: { glCode: def.glCode },
      update: {
        accountName: def.name,
        accountLevel: 'MAIN',
        accountTypeId: typeId,
        isLocked: true, // MAIN accounts MUST BE LOCKED
        isSystemDefined: true,
        detailType: def.detailType || 'Header',
        description: def.description,
        isDeleted: false,
      },
      create: {
        glCode: def.glCode,
        accountName: def.name,
        accountLevel: 'MAIN',
        accountTypeId: typeId,
        isLocked: true,
        isSystemDefined: true,
        detailType: def.detailType || 'Header',
        description: def.description,
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0
      }
    });
    mainAccountMap[def.glCode] = acc.id;
    console.log(`✅ MAIN Account ready: ${def.glCode} - ${def.name} (ID: ${acc.id}, LOCKED: true)`);
  }

  // Step 5: Upsert PARENT accounts next
  const parentDefs = ACCOUNTS_TO_SEED.filter(a => a.level === 'PARENT');
  const parentAccountMap: Record<string, string> = {};

  for (const def of parentDefs) {
    const typeId = typeMap[def.accountType];
    const parentId = def.parentCode ? mainAccountMap[def.parentCode] : null;

    const acc = await prisma.account.upsert({
      where: { glCode: def.glCode },
      update: {
        accountName: def.name,
        accountLevel: 'PARENT',
        parentId,
        accountTypeId: typeId,
        isLocked: false,
        isSystemDefined: true,
        detailType: def.detailType || 'Header',
        description: def.description,
        isDeleted: false,
      },
      create: {
        glCode: def.glCode,
        accountName: def.name,
        accountLevel: 'PARENT',
        parentId,
        accountTypeId: typeId,
        isLocked: false,
        isSystemDefined: true,
        detailType: def.detailType || 'Header',
        description: def.description,
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0
      }
    });
    parentAccountMap[def.glCode] = acc.id;
    console.log(`✅ PARENT Account ready: ${def.glCode} - ${def.name} (Parent: ${def.parentCode})`);
  }

  // Step 6: Upsert SUBSIDIARY accounts
  const subsidiaryDefs = ACCOUNTS_TO_SEED.filter(a => a.level === 'SUBSIDIARY');

  for (const def of subsidiaryDefs) {
    const typeId = typeMap[def.accountType];
    const parentId = def.parentCode ? parentAccountMap[def.parentCode] : null;

    if (!parentId) {
      console.warn(`⚠️ Parent not found for subsidiary ${def.glCode} (parentCode: ${def.parentCode})`);
    }

    const acc = await prisma.account.upsert({
      where: { glCode: def.glCode },
      update: {
        accountName: def.name,
        accountLevel: 'SUBSIDIARY',
        parentId,
        accountTypeId: typeId,
        isLocked: false,
        isSystemDefined: true,
        detailType: def.detailType || (def.accountType === 'REVENUE' ? 'Revenue' : 'Expense'),
        description: def.description,
        isDeleted: false,
      },
      create: {
        glCode: def.glCode,
        accountName: def.name,
        accountLevel: 'SUBSIDIARY',
        parentId,
        accountTypeId: typeId,
        isLocked: false,
        isSystemDefined: true,
        detailType: def.detailType || (def.accountType === 'REVENUE' ? 'Revenue' : 'Expense'),
        description: def.description,
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0
      }
    });
    console.log(`✅ SUBSIDIARY Account ready: ${def.glCode} - ${def.name} (Parent: ${def.parentCode})`);
  }

  // Step 7: Update RevenueHeads to point to new canonical hall accounts
  const hallHeads = [
    { name: 'Bagh-e-Hajiani Kareema', glCode: '3011001' },
    { name: 'Sadaya Hall', glCode: '3011002' },
    { name: 'Zikarya Hall', glCode: '3011003' },
    { name: 'Annexy Hall', glCode: '3011004' }
  ];
  for (const h of hallHeads) {
    const acc = await prisma.account.findUnique({ where: { glCode: h.glCode } });
    if (acc) {
      await prisma.revenueHead.updateMany({
        where: {
          OR: [
            { name: { contains: h.name.split(' ')[0], mode: 'insensitive' } },
            { category: 'Hall Bookings' }
          ]
        },
        data: { accountId: acc.id }
      }).catch(() => {});
    }
  }

  console.log('=== INCOME & EXPENSE COA MIGRATION COMPLETED SUCCESSFULLY ===');
}

migrate()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

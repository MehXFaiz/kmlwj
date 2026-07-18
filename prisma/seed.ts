
import { PrismaClient, AccountLevel } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Neither DIRECT_URL nor DATABASE_URL environment variables are defined');
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  // 1. Seed Permissions
  const permissionsList = [
    { name: 'CREATE_ACCOUNT', description: 'Create new chart of accounts' },
    { name: 'UPDATE_ACCOUNT', description: 'Update existing chart of accounts' },
    { name: 'DELETE_ACCOUNT', description: 'Soft delete or delete accounts' },
    { name: 'LOCK_ACCOUNT', description: 'Lock or unlock accounts' },
    { name: 'VIEW_REPORTS', description: 'View financial reports and audit logs' },
    { name: 'MANAGE_USERS', description: 'Manage users, roles, and permissions' },
    { name: 'MANAGE_ROLES', description: 'Manage system roles and their permissions' },
    { name: 'MANAGE_RESERVED_CODES', description: 'Manage reserved account codes' },
    { name: 'POST_JOURNAL', description: 'Post journal entries and transactions' },
    { name: 'RECORD_INCOME', description: 'Record income and revenue collections that post to the General Ledger' },
    { name: 'RECORD_EXPENSE', description: 'Record expenses and disbursements that post to the General Ledger' },
  ];

  console.log('Seeding Permissions...');
  const seededPermissions: Record<string, any> = {};
  for (const perm of permissionsList) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    seededPermissions[perm.name] = record;
  }

  // 2. Seed Roles
  const rolesList = [
    { name: 'Super Admin', description: 'Full access to all system modules and actions' },
    { name: 'Accountant', description: 'Manage charts of accounts and view reports' },
    { name: 'Auditor', description: 'Read-only access to reports and audit logs' },
    { name: 'Data Entry Operator', description: 'Create and update accounts but cannot delete or lock' },
    { name: 'Donation and Zakat Manager', description: 'Manage donations and Zakat distributions' },
  ];

  console.log('Seeding Roles...');
  const seededRoles: Record<string, any> = {};
  for (const role of rolesList) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    seededRoles[role.name] = record;
  }

  // 3. Seed RolePermissions Many-to-Many Relationships
  console.log('Linking Roles and Permissions...');
  
  // Super Admin gets all permissions
  for (const permName of Object.keys(seededPermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seededRoles['Super Admin'].id,
          permissionId: seededPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: seededRoles['Super Admin'].id,
        permissionId: seededPermissions[permName].id,
      },
    });
  }

  // Accountant permissions: CREATE_ACCOUNT, UPDATE_ACCOUNT, VIEW_REPORTS, POST_JOURNAL, RECORD_INCOME, RECORD_EXPENSE
  const accountantPerms = ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'VIEW_REPORTS', 'POST_JOURNAL', 'RECORD_INCOME', 'RECORD_EXPENSE'];
  for (const permName of accountantPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seededRoles['Accountant'].id,
          permissionId: seededPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: seededRoles['Accountant'].id,
        permissionId: seededPermissions[permName].id,
      },
    });
  }

  // Auditor permissions: VIEW_REPORTS
  const auditorPerms = ['VIEW_REPORTS'];
  for (const permName of auditorPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seededRoles['Auditor'].id,
          permissionId: seededPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: seededRoles['Auditor'].id,
        permissionId: seededPermissions[permName].id,
      },
    });
  }

  // Data Entry Operator permissions: CREATE_ACCOUNT
  const dePerms = ['CREATE_ACCOUNT'];
  for (const permName of dePerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seededRoles['Data Entry Operator'].id,
          permissionId: seededPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: seededRoles['Data Entry Operator'].id,
        permissionId: seededPermissions[permName].id,
      },
    });
  }

  // Donation and Zakat Manager permissions: VIEW_REPORTS, RECORD_INCOME, RECORD_EXPENSE
  // (this role previously had zero permissions granted despite its stated purpose)
  const donationManagerPerms = ['VIEW_REPORTS', 'RECORD_INCOME', 'RECORD_EXPENSE'];
  for (const permName of donationManagerPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seededRoles['Donation and Zakat Manager'].id,
          permissionId: seededPermissions[permName].id,
        },
      },
      update: {},
      create: {
        roleId: seededRoles['Donation and Zakat Manager'].id,
        permissionId: seededPermissions[permName].id,
      },
    });
  }

  // 4. Seed Admin User
  console.log('Seeding Admin User...');
  const adminEmail = 'admin@erp.com';
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Admin',
      password: hashedPassword,
      roleId: seededRoles['Super Admin'].id,
      isActive: true,
    },
    create: {
      fullName: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      roleId: seededRoles['Super Admin'].id,
      isActive: true,
    },
  });

  // Seed Guest User
  console.log('Seeding Guest User...');
  const guestEmail = 'guest@erp.com';
  const hashedGuestPassword = await bcrypt.hash('guest123', 12);
  
  await prisma.user.upsert({
    where: { email: guestEmail },
    update: {
      fullName: 'Guest Visitor',
      password: hashedGuestPassword,
      roleId: seededRoles['Auditor'].id,
      isActive: true,
    },
    create: {
      fullName: 'Guest Visitor',
      email: guestEmail,
      password: hashedGuestPassword,
      roleId: seededRoles['Auditor'].id,
      isActive: true,
    },
  });

  // 5. Seed AccountTypes
  const accountTypesList = [
    { name: 'ASSET', description: 'Economic resources owned or controlled' },
    { name: 'LIABILITY', description: 'Present obligations arising from past events' },
    { name: 'EQUITY', description: 'Residual interest in assets after deducting liabilities' },
    { name: 'REVENUE', description: 'Inflows of economic benefits from core operations' },
    { name: 'EXPENSE', description: 'Outflows or depletion of assets for business operations' },
  ];

  console.log('Seeding Account Types...');
  const seededAccountTypes: Record<string, any> = {};
  for (const type of accountTypesList) {
    const record = await prisma.accountType.upsert({
      where: { name: type.name },
      update: { description: type.description },
      create: type,
    });
    seededAccountTypes[type.name] = record;
  }

  // 6. Seed Level 1 — MAIN Chart of Accounts
  console.log('Seeding Main Chart of Accounts...');
  const mainAccounts = [
    { glCode: '1000000', accountName: 'Assets',      accountTypeName: 'ASSET',     description: 'Root control account for all Asset accounts' },
    { glCode: '2000000', accountName: 'Liabilities', accountTypeName: 'LIABILITY', description: 'Root control account for all Liability accounts' },
    { glCode: '3000000', accountName: 'Revenue',     accountTypeName: 'REVENUE',   description: 'Root control account for all Revenue accounts' },
    { glCode: '4000000', accountName: 'Expenses',    accountTypeName: 'EXPENSE',   description: 'Root control account for all Expense accounts' },
  ];

  const seededMainAccounts: Record<string, any> = {};
  for (const acc of mainAccounts) {
    const record = await prisma.account.upsert({
      where: { glCode: acc.glCode },
      update: {
        accountName: acc.accountName,
        accountLevel: AccountLevel.MAIN,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
      },
      create: {
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountLevel: AccountLevel.MAIN,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
        isLocked: false,
        isReserved: false,
      },
    });
    seededMainAccounts[acc.glCode] = record;
  }

  // 7. Seed Level 2 — PARENT Accounts
  console.log('Seeding Level 2 Parent Accounts...');
  const parentAccounts = [
    // Under Assets (1000000)
    { glCode: '1010000', accountName: 'Current Assets',         parentCode: '1000000', accountTypeName: 'ASSET',     description: 'Short-term assets convertible to cash within 12 months' },
    { glCode: '1020000', accountName: 'Non-Current Assets',     parentCode: '1000000', accountTypeName: 'ASSET',     description: 'Long-term assets held for more than 12 months' },
    // Under Liabilities (2000000)
    { glCode: '2010000', accountName: 'Current Liabilities',    parentCode: '2000000', accountTypeName: 'LIABILITY', description: 'Obligations due within 12 months' },
    { glCode: '2020000', accountName: 'Non-Current Liabilities',parentCode: '2000000', accountTypeName: 'LIABILITY', description: 'Long-term financial obligations' },
    // Under Revenue (3000000)
    { glCode: '3010000', accountName: 'Hall & Garden Income',   parentCode: '3000000', accountTypeName: 'REVENUE',   description: 'Revenue from hall and garden bookings' },
    { glCode: '3020000', accountName: 'Donations & Other Income',parentCode: '3000000', accountTypeName: 'REVENUE',   description: 'Zakat, Fitra, Qurbani and other donations' },
    // Under Expenses (4000000)
    { glCode: '4010000', accountName: 'Salaries & Wages',       parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'All payroll related expenses' },
    { glCode: '4020000', accountName: 'Hall Expenses',          parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Operational costs for hall management' },
    { glCode: '4030000', accountName: 'Transport',              parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Transportation and vehicle expenses' },
    { glCode: '4040000', accountName: 'Rent, Rates & Taxes',    parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Rent, rates, and tax expenses' },
    { glCode: '4050000', accountName: 'Repair & Maintenance',   parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Repair and maintenance costs' },
    { glCode: '4060000', accountName: 'Donations Paid',         parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Donations distributed' },
    { glCode: '4070000', accountName: 'Professional Fees',      parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Legal, audit, and professional fees' },
    { glCode: '4080000', accountName: 'Administrative Expenses',parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Other administrative costs' },
  ];

  const seededParentAccounts: Record<string, any> = {};
  for (const acc of parentAccounts) {
    const parentRecord = seededMainAccounts[acc.parentCode];
    const record = await prisma.account.upsert({
      where: { glCode: acc.glCode },
      update: {
        accountName: acc.accountName,
        accountLevel: AccountLevel.PARENT,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
      },
      create: {
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountLevel: AccountLevel.PARENT,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
        isLocked: false,
        isReserved: false,
      },
    });
    seededParentAccounts[acc.glCode] = record;
  }

  // 8. Seed Level 3 — SUBSIDIARY Header Accounts (locked, admin-only)
  console.log('Seeding Level 3 Subsidiary Accounts...');
  const subsidiaryAccounts = [
    // Under Current Assets (1010000)
    { glCode: '1010100', accountName: 'Cash & Bank Balances', parentCode: '1010000', accountTypeName: 'ASSET',     detailType: 'Header', description: 'All cash and bank balance accounts' },
    { glCode: '1010200', accountName: 'Accounts Receivable',  parentCode: '1010000', accountTypeName: 'ASSET',     detailType: 'Header', description: 'Amounts owed to the organization' },
    // Under Non-Current Assets (1020000)
    { glCode: '1020100', accountName: 'Fixed Assets',         parentCode: '1020000', accountTypeName: 'ASSET',     detailType: 'Header', description: 'Property, plant and equipment' },
    // Under Current Liabilities (2010000)
    { glCode: '2010100', accountName: 'Accounts Payable',     parentCode: '2010000', accountTypeName: 'LIABILITY', detailType: 'Header', description: 'Amounts owed to vendors and suppliers' },
    // Under Non-Current Liabilities (2020000)
    { glCode: '2020100', accountName: 'Long Term Loans',      parentCode: '2020000', accountTypeName: 'LIABILITY', detailType: 'Header', description: 'Loans repayable beyond 12 months' },
    // Under Hall & Garden Income (3010000)
    { glCode: '3010100', accountName: 'Hall Booking',         parentCode: '3010000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Revenue categorized by individual hall' },
    // Under Donations & Other Income (3020000)
    { glCode: '3020100', accountName: 'Zakat',                parentCode: '3020000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Islamic charitable contribution income' },
    { glCode: '3020200', accountName: 'Fitra',                parentCode: '3020000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Fitra collection' },
    { glCode: '3020300', accountName: 'Qurbani',              parentCode: '3020000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Qurbani space/fees' },
    { glCode: '3020400', accountName: 'Other Income',         parentCode: '3020000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Bus booking, membership fee, decoration commission, etc.' },
    // Under Salaries & Wages (4010100)
    { glCode: '4010100', accountName: 'Salaries Expense',     parentCode: '4010000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Monthly payroll cost' },
    // Under Hall Expenses (4020000)
    { glCode: '4020100', accountName: 'Hall Operating Costs', parentCode: '4020000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Day-to-day operational costs for halls' },
    // Under Transport (4030000)
    { glCode: '4030100', accountName: 'Bus Expenses',         parentCode: '4030000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Bus maintenance and fuel' },
    // Under Rent, Rates & Taxes (4040000)
    { glCode: '4040100', accountName: 'Rent',                 parentCode: '4040000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Rent expenses' },
    { glCode: '4040200', accountName: 'Rates & Taxes',        parentCode: '4040000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Rates and taxes' },
    // Under Repair & Maintenance (4050000)
    { glCode: '4050100', accountName: 'Repairs',              parentCode: '4050000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'All repair costs' },
    // Under Donations Paid (4060000)
    { glCode: '4060100', accountName: 'Donations',            parentCode: '4060000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Monthly, marriage, medical donations' },
    // Under Professional Fees (4070000)
    { glCode: '4070100', accountName: 'Professional Fees',    parentCode: '4070000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Legal, audit, professional fees' },
    // Under Administrative Expenses (4080000)
    { glCode: '4080100', accountName: 'Admin Costs',          parentCode: '4080000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Entertainment, security, bank charges, etc.' },
  ];

  const seededSubsidiaryAccounts: Record<string, any> = {};
  for (const acc of subsidiaryAccounts) {
    const parentRecord = seededParentAccounts[acc.parentCode];
    const record = await prisma.account.upsert({
      where: { glCode: acc.glCode },
      update: {
        accountName: acc.accountName,
        accountLevel: AccountLevel.SUBSIDIARY,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        detailType: acc.detailType,
        description: acc.description,
        isSystemDefined: true,
      },
      create: {
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountLevel: AccountLevel.SUBSIDIARY,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        detailType: acc.detailType,
        description: acc.description,
        isSystemDefined: true,
        isLocked: false,
        isReserved: false,
      },
    });
    seededSubsidiaryAccounts[acc.glCode] = record;
  }

  // 9. Seed Level 4 — GL Accounts (user-editable, posting-level)
  console.log('Seeding Level 4 GL Accounts...');
  const glAccounts = [
    // Under Cash & Bank Balances (1010100)
    { glCode: '1010101', accountName: 'National Bank of Pakistan', parentCode: '1010100', accountTypeName: 'ASSET',   detailType: 'Cash', description: 'National Bank of Pakistan — main current account' },
    { glCode: '1010102', accountName: 'NBP Zakat Bank',            parentCode: '1010100', accountTypeName: 'ASSET',   detailType: 'Cash', description: 'NBP Zakat Bank — dedicated zakat collection account' },
    // Under Hall Booking (3010100)
    { glCode: '3010101', accountName: 'Bagh-e-Hajiani Garden', parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Bagh-e-Hajiani Garden booking income — rate: Rs 43,000' },
    { glCode: '3010102', accountName: 'Sadaya Hall',           parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Sadaya Hall booking income — rate: Rs 28,000' },
    { glCode: '3010103', accountName: 'Zikarya Hall',          parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Zikarya Hall booking income — rate: Rs 28,000' },
    { glCode: '3010104', accountName: 'Annexy Hall',           parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Annexy Hall booking income — rate: Rs 33,000' },
    // Under Zakat (3020100)
    { glCode: '3020101', accountName: 'Zakat 2024-25',         parentCode: '3020100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Zakat collected for the year 2024-25' },
    // Under Fitra (3020200)
    { glCode: '3020201', accountName: 'Fitra Collection',      parentCode: '3020200', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Fitra collected' },
    // Under Qurbani (3020300)
    { glCode: '3020301', accountName: 'Qurbani Fees',          parentCode: '3020300', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Qurbani space/fees' },
    // Under Other Income (3020400)
    { glCode: '3020401', accountName: 'Bus Booking Income',    parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Bus booking income' },
    { glCode: '3020402', accountName: 'Membership Fee',        parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Membership fee income' },
    { glCode: '3020403', accountName: 'Decoration Commission', parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Decoration/lighting commission' },
    { glCode: '3020404', accountName: 'Marriage Donation Received', parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Marriage donation received' },
    { glCode: '3020405', accountName: 'Coconut Income', parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Coconut income' },
    { glCode: '3020406', accountName: 'Qurbani Cow Hide Income', parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Qurbani cow hide income' },
    { glCode: '3020407', accountName: 'Lighting Commission', parentCode: '3020400', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Lighting commission' },
    // Under Salaries Expense (4010100)
    { glCode: '4010101', accountName: 'Staff Salary',         parentCode: '4010100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Monthly staff salary disbursement' },
    { glCode: '4010102', accountName: 'Staff Bonus',          parentCode: '4010100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Staff bonus' },
    // Under Bus Expenses (4030100)
    { glCode: '4030101', accountName: 'Bus Diesel',           parentCode: '4030100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Bus diesel expenses' },
    // Under Rent (4040100)
    { glCode: '4040101', accountName: 'Building Rent',         parentCode: '4040100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Building rent expense' },
    // Under Rates & Taxes (4040200)
    { glCode: '4040201', accountName: 'Rates & Taxes',         parentCode: '4040200', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Rates and taxes paid' },
    // Under Repairs (4050100)
    { glCode: '4050101', accountName: 'Bus Repairs',           parentCode: '4050100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Bus repair costs' },
    { glCode: '4050102', accountName: 'Generator Repairs',     parentCode: '4050100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Generator repair costs' },
    { glCode: '4050103', accountName: 'Hall Repairs',          parentCode: '4050100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Hall repair costs' },
    // Under Donations (4060100)
    { glCode: '4060101', accountName: 'Monthly Donations',     parentCode: '4060100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Monthly donations paid' },
    { glCode: '4060102', accountName: 'Marriage Donations',    parentCode: '4060100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Marriage donations paid' },
    { glCode: '4060103', accountName: 'Medical Donations',     parentCode: '4060100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Medical donations paid' },
    // Under Professional Fees (4070100)
    { glCode: '4070101', accountName: 'Legal Fees',            parentCode: '4070100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Legal fees paid' },
    { glCode: '4070102', accountName: 'Audit Fees',            parentCode: '4070100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Audit fees paid' },
    { glCode: '4070103', accountName: 'Professional Fees',     parentCode: '4070100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Other professional fees' },
    // Under Admin Costs (4080100)
    { glCode: '4080101', accountName: 'Entertainment',         parentCode: '4080100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Entertainment expenses' },
    { glCode: '4080102', accountName: 'Security',              parentCode: '4080100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Security expenses' },
    { glCode: '4080103', accountName: 'Bank Charges',          parentCode: '4080100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Bank charges' },
    { glCode: '4080104', accountName: 'Generator Fuel',        parentCode: '4080100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Generator diesel/petrol' },
    { glCode: '4080105', accountName: 'Meeting Expenses',      parentCode: '4080100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Meeting expenses' },
  ];

  const seededGLAccounts: Record<string, any> = {};
  for (const acc of glAccounts) {
    const parentRecord = seededSubsidiaryAccounts[acc.parentCode];
    const record = await prisma.account.upsert({
      where: { glCode: acc.glCode },
      update: {
        accountName: acc.accountName,
        accountLevel: AccountLevel.GL,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        detailType: acc.detailType,
        description: acc.description,
        isSystemDefined: false,
      },
      create: {
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountLevel: AccountLevel.GL,
        parentId: parentRecord.id,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        detailType: acc.detailType,
        description: acc.description,
        isSystemDefined: false,
        isLocked: false,
        isReserved: false,
      },
    });
    seededGLAccounts[acc.accountName] = record;
  }

  // 10. Seed Revenue Heads and link to GL accounts
  console.log('Seeding Revenue Heads...');
  const revenueCategories = [
    {
      category: 'Hall Bookings',
      heads: [
        { name: 'Bagh-e-Hajiani Garden', glAccountName: 'Bagh-e-Hajiani Garden' },
        { name: 'Sadaya Hall', glAccountName: 'Sadaya Hall' },
        { name: 'Zikarya Hall', glAccountName: 'Zikarya Hall' },
        { name: 'Annexy Hall', glAccountName: 'Annexy Hall' }
      ]
    },
    {
      category: 'Other Income & Donations',
      heads: [
        { name: 'Bus Booking', glAccountName: 'Bus Booking Income' },
        { name: 'Membership Fee', glAccountName: 'Membership Fee' },
        { name: 'Qurbani Space', glAccountName: 'Qurbani Fees' },
        { name: 'Qurbani Cow Hide', glAccountName: 'Qurbani Cow Hide Income' },
        { name: 'Zakat', glAccountName: 'Zakat 2024-25' },
        { name: 'Fitra', glAccountName: 'Fitra Collection' },
        { name: 'Coconut Income', glAccountName: 'Coconut Income' },
        { name: 'Marriage Donation Received', glAccountName: 'Marriage Donation Received' }
      ]
    },
    {
      category: 'Commission Income',
      heads: [
        { name: 'Decoration Commission', glAccountName: 'Decoration Commission' },
        { name: 'Lighting Commission', glAccountName: 'Lighting Commission' }
      ]
    }
  ];

  for (const group of revenueCategories) {
    for (const head of group.heads) {
      const glAccount = seededGLAccounts[head.glAccountName];
      const existingHead = await prisma.revenueHead.findFirst({
        where: { name: head.name, category: group.category }
      });
      if (!existingHead) {
        await prisma.revenueHead.create({
          data: {
            name: head.name,
            category: group.category,
            isActive: true,
            accountId: glAccount?.id
          }
        });
      } else {
        await prisma.revenueHead.update({
          where: { id: existingHead.id },
          data: {
            accountId: glAccount?.id
          }
        });
      }
    }
  }

  // 11. Seed Expense Heads and link to GL accounts
  console.log('Seeding Expense Heads...');
  const expenseCategories = [
    {
      category: 'Salaries & Benefits',
      heads: [
        { name: 'Salary', glAccountName: 'Staff Salary' },
        { name: 'Bonus', glAccountName: 'Staff Bonus' }
      ]
    },
    {
      category: 'Rent, Rates, and Taxes',
      heads: [
        { name: 'Rent', glAccountName: 'Building Rent' },
        { name: 'Rates', glAccountName: 'Rates & Taxes' },
        { name: 'Taxes', glAccountName: 'Rates & Taxes' }
      ]
    },
    {
      category: 'Fuel and Power',
      heads: [
        { name: 'Bus diesel', glAccountName: 'Bus Diesel' },
        { name: 'Generator diesel/petrol', glAccountName: 'Generator Fuel' }
      ]
    },
    {
      category: 'Repair and Maintenance',
      heads: [
        { name: 'Bus repair', glAccountName: 'Bus Repairs' },
        { name: 'Generator repair', glAccountName: 'Generator Repairs' },
        { name: 'Hall repair', glAccountName: 'Hall Repairs' }
      ]
    },
    {
      category: 'Donations',
      heads: [
        { name: 'Monthly donations', glAccountName: 'Monthly Donations' },
        { name: 'Marriage donations', glAccountName: 'Marriage Donations' },
        { name: 'Medical donations', glAccountName: 'Medical Donations' }
      ]
    },
    {
      category: 'Legal, Professional, and Audit Fees',
      heads: [
        { name: 'Legal Fees', glAccountName: 'Legal Fees' },
        { name: 'Professional Fees', glAccountName: 'Professional Fees' },
        { name: 'Audit Fees', glAccountName: 'Audit Fees' }
      ]
    },
    {
      category: 'Other Administrative Expenses',
      heads: [
        { name: 'Entertainment', glAccountName: 'Entertainment' },
        { name: 'Meetings', glAccountName: 'Meeting Expenses' },
        { name: 'Security', glAccountName: 'Security' },
        { name: 'Bank Charges', glAccountName: 'Bank Charges' }
      ]
    }
  ];

  for (const group of expenseCategories) {
    for (const head of group.heads) {
      const glAccount = seededGLAccounts[head.glAccountName];
      const existingHead = await prisma.expenseHead.findFirst({
        where: { name: head.name, category: group.category }
      });
      if (!existingHead) {
        await prisma.expenseHead.create({
          data: {
            name: head.name,
            category: group.category,
            isActive: true,
            accountId: glAccount?.id
          }
        });
      } else {
        await prisma.expenseHead.update({
          where: { id: existingHead.id },
          data: {
            accountId: glAccount?.id
          }
        });
      }
    }
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

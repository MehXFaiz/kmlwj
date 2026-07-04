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

  // Accountant permissions: CREATE_ACCOUNT, UPDATE_ACCOUNT, VIEW_REPORTS
  const accountantPerms = ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'VIEW_REPORTS'];
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
    { glCode: '3020000', accountName: 'Donations',              parentCode: '3000000', accountTypeName: 'REVENUE',   description: 'Zakat, Fitra, Qurbani and other donations' },
    // Under Expenses (4000000)
    { glCode: '4010000', accountName: 'Salaries & Wages',       parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'All payroll related expenses' },
    { glCode: '4020000', accountName: 'Hall Expenses',          parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Operational costs for hall management' },
    { glCode: '4030000', accountName: 'Transport',              parentCode: '4000000', accountTypeName: 'EXPENSE',   description: 'Transportation and vehicle expenses' },
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
    // Under Donations Income (3020000)
    { glCode: '3020100', accountName: 'Zakat',                parentCode: '3020000', accountTypeName: 'REVENUE',   detailType: 'Header', description: 'Islamic charitable contribution income' },
    // Under Salaries & Wages (4010000)
    { glCode: '4010100', accountName: 'Salaries Expense',     parentCode: '4010000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Monthly payroll cost' },
    // Under Hall Expenses (4020000)
    { glCode: '4020100', accountName: 'Hall Operating Costs', parentCode: '4020000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Day-to-day operational costs for halls' },
    // Under Transport (4030000)
    { glCode: '4030100', accountName: 'Bus Expenses',         parentCode: '4030000', accountTypeName: 'EXPENSE',   detailType: 'Header', description: 'Bus maintenance and fuel' },
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
    { glCode: '1010101', accountName: 'Meezan Bank Account', parentCode: '1010100', accountTypeName: 'ASSET',   detailType: 'Cash', description: 'Main Meezan Islamic Bank current account' },
    { glCode: '1010102', accountName: 'HBL Bank Account',    parentCode: '1010100', accountTypeName: 'ASSET',   detailType: 'Cash', description: 'HBL commercial current account' },
    // Under Hall Booking (3010100)
    { glCode: '3010101', accountName: 'Bagh-e-Hajiani Garden', parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Bagh-e-Hajiani Garden booking income — rate: Rs 43,000' },
    { glCode: '3010102', accountName: 'Sadaya Hall',           parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Sadaya Hall booking income — rate: Rs 28,000' },
    { glCode: '3010103', accountName: 'Zikarya Hall',          parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Zikarya Hall booking income — rate: Rs 28,000' },
    { glCode: '3010104', accountName: 'Annexy Hall',           parentCode: '3010100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Annexy Hall booking income — rate: Rs 33,000' },
    // Under Zakat (3020100)
    { glCode: '3020101', accountName: 'Zakat 2024-25',         parentCode: '3020100', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Zakat collected for the year 2024-25' },
    // Under Salaries Expense (4010100)
    { glCode: '4010101', accountName: 'Staff Salary',         parentCode: '4010100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Monthly staff salary disbursement' },
    // Under Bus Expenses (4030100)
    { glCode: '4030101', accountName: 'Diesel - June',        parentCode: '4030100', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Diesel cost for the month of June' },
  ];

  for (const acc of glAccounts) {
    const parentRecord = seededSubsidiaryAccounts[acc.parentCode];
    await prisma.account.upsert({
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
  }




  // 7. Seed Revenue Heads
  console.log('Seeding Revenue Heads...');
  const revenueCategories = [
    {
      category: 'Hall Bookings',
      heads: ['Bagh-e-Hajiani Garden', 'Sadaya-Hall', 'Zikarya-Hall', 'Anexy-Hall']
    },
    {
      category: 'Other Income & Donations',
      heads: ['Bus booking', 'Membership fee', 'Qurbani space', 'Zakat', 'Fitra', 'Marriage donation', 'Decoration/Lighting commission']
    }
  ];

  for (const group of revenueCategories) {
    for (const headName of group.heads) {
      const existingHead = await prisma.revenueHead.findFirst({
        where: { name: headName, category: group.category }
      });
      if (!existingHead) {
        await prisma.revenueHead.create({
          data: {
            name: headName,
            category: group.category,
            isActive: true
          }
        });
      }
    }
  }

  // 8. Seed Expense Heads
  console.log('Seeding Expense Heads...');
  const expenseCategories = [
    {
      category: 'Salaries & Benefits',
      heads: ['Salary', 'Bonus']
    },
    {
      category: 'Rent, Rates, and Taxes',
      heads: ['Rent', 'Rates', 'Taxes']
    },
    {
      category: 'Fuel and Power',
      heads: ['Bus diesel', 'Generator diesel/petrol']
    },
    {
      category: 'Repair and Maintenance',
      heads: ['Bus repair', 'Generator repair', 'Hall repair']
    },
    {
      category: 'Donations',
      heads: ['Monthly donations', 'Marriage donations', 'Medical donations']
    },
    {
      category: 'Legal, Professional, and Audit Fees',
      heads: ['Legal Fees', 'Professional Fees', 'Audit Fees']
    },
    {
      category: 'Other Administrative Expenses',
      heads: ['Entertainment', 'Meetings', 'Security', 'Bank Charges']
    }
  ];

  for (const group of expenseCategories) {
    for (const headName of group.heads) {
      const existingHead = await prisma.expenseHead.findFirst({
        where: { name: headName, category: group.category }
      });
      if (!existingHead) {
        await prisma.expenseHead.create({
          data: {
            name: headName,
            category: group.category,
            isActive: true
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

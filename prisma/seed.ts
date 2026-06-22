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

  // 6. Seed Main Chart of Accounts
  console.log('Seeding Main Chart of Accounts...');
  const mainAccounts = [
    { glCode: '1000000', accountName: 'Assets', accountLevel: AccountLevel.MAIN, accountTypeName: 'ASSET', description: 'Control account for all Asset accounts' },
    { glCode: '2000000', accountName: 'Liabilities', accountLevel: AccountLevel.MAIN, accountTypeName: 'LIABILITY', description: 'Control account for all Liability accounts' },
    { glCode: '3000000', accountName: 'Revenue', accountLevel: AccountLevel.MAIN, accountTypeName: 'REVENUE', description: 'Control account for all Revenue accounts' },
    { glCode: '4000000', accountName: 'Expenses', accountLevel: AccountLevel.MAIN, accountTypeName: 'EXPENSE', description: 'Control account for all Expense accounts' },
  ];

  const seededMainAccounts: Record<string, any> = {};
  for (const acc of mainAccounts) {
    const record = await prisma.account.upsert({
      where: { glCode: acc.glCode },
      update: {
        accountName: acc.accountName,
        accountLevel: acc.accountLevel,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
      },
      create: {
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountLevel: acc.accountLevel,
        accountTypeId: seededAccountTypes[acc.accountTypeName].id,
        description: acc.description,
        isSystemDefined: true,
        isLocked: false,
        isReserved: false,
      },
    });
    seededMainAccounts[acc.glCode] = record;
  }

  // Seeding Level 2 Parent Accounts
  console.log('Seeding Level 2 Parent Accounts...');
  const parentAccounts = [
    { glCode: '1100000', accountName: 'Current Assets', parentCode: '1000000', accountTypeName: 'ASSET', description: 'Current Asset accounts' },
    { glCode: '1200000', accountName: 'Non Current Assets', parentCode: '1000000', accountTypeName: 'ASSET', description: 'Non-Current Asset accounts' },
    { glCode: '2100000', accountName: 'Current Liabilities', parentCode: '2000000', accountTypeName: 'LIABILITY', description: 'Current Liability accounts' },
    { glCode: '2200000', accountName: 'Long Term Liabilities', parentCode: '2000000', accountTypeName: 'LIABILITY', description: 'Long Term Liability accounts' },
    { glCode: '3100000', accountName: 'Hall Income', parentCode: '3000000', accountTypeName: 'REVENUE', description: 'Revenue from hall bookings' },
    { glCode: '3200000', accountName: 'Donations', parentCode: '3000000', accountTypeName: 'REVENUE', description: 'Donation revenue' },
    { glCode: '3300000', accountName: 'Other Income', parentCode: '3000000', accountTypeName: 'REVENUE', description: 'Other miscellaneous income' },
    { glCode: '4100000', accountName: 'Administrative Expenses', parentCode: '4000000', accountTypeName: 'EXPENSE', description: 'Administrative and operational expenses' },
    { glCode: '4200000', accountName: 'Utility Expenses', parentCode: '4000000', accountTypeName: 'EXPENSE', description: 'Utility bills and energy costs' },
    { glCode: '4300000', accountName: 'Donation Expenses', parentCode: '4000000', accountTypeName: 'EXPENSE', description: 'Disbursement of donations and charity' },
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

  // Seeding Level 3 Subsidiary Accounts
  console.log('Seeding Level 3 Subsidiary Accounts...');
  const subsidiaryAccounts = [
    // under Hall Income (3100000)
    { glCode: '3100001', accountName: 'Bagh-e-Hajiani Garden', parentCode: '3100000', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Bagh-e-Hajiani Garden Hall Income' },
    { glCode: '3100002', accountName: 'Sadaya Hall', parentCode: '3100000', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Sadaya Hall Income' },
    { glCode: '3100003', accountName: 'Zikarya Hall', parentCode: '3100000', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Zikarya Hall Income' },
    { glCode: '3100004', accountName: 'Annexy Hall', parentCode: '3100000', accountTypeName: 'REVENUE', detailType: 'Revenue', description: 'Annexy Hall Income' },
    // under Administrative Expenses (4100000)
    { glCode: '4100001', accountName: 'Salary', parentCode: '4100000', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Staff salaries expense' },
    { glCode: '4100002', accountName: 'Bonus', parentCode: '4100000', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Staff bonuses expense' },
    { glCode: '4100003', accountName: 'Rent', parentCode: '4100000', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Office/Hall rent expense' },
    { glCode: '4100004', accountName: 'Audit Fee', parentCode: '4100000', accountTypeName: 'EXPENSE', detailType: 'Expense', description: 'Professional audit fees expense' },
  ];

  for (const acc of subsidiaryAccounts) {
    const parentRecord = seededParentAccounts[acc.parentCode];
    await prisma.account.upsert({
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

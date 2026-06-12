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

  for (const acc of mainAccounts) {
    await prisma.account.upsert({
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

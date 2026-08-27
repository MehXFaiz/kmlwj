import jwt from 'jsonwebtoken';
import { prisma } from '../api/_prisma.js';
import { loadPermissions } from '../api/_services/permission.service.js';
import { hasPermission, canAccessModule, normalizePermissions } from '../src/utils/permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_key_change_in_production_32chars';

function createMockReqRes(userId: string, userRole: string, isPrivileged: boolean = false) {
  const req: any = {
    user: { id: userId, email: '', role: userRole },
    headers: {},
    method: 'GET',
    query: {},
    body: {},
  };

  let statusCode = 200;
  let responseData: any = null;

  const headersMap: Record<string, string> = {};

  const res: any = {
    setHeader(key: string, val: string) {
      headersMap[key] = val;
      return this;
    },
    getHeader(key: string) {
      return headersMap[key];
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    }
  };


  return { req, res };
}

async function runTests() {
  console.log('=== STARTING RBAC VERIFICATION SUITE ===\n');

  // 1. Fetch the 4 test users from the database
  const donationUser = await prisma.user.findFirst({
    where: { email: 'donation@erp.com' },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  if (!donationUser) throw new Error('donation@erp.com not found');

  const accountantUser = await prisma.user.findFirst({
    where: { email: { in: ['account@erp.com', 'accountant@gmail.com'] } },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  if (!accountantUser) throw new Error('Accountant user not found');

  const dataEntryUser = await prisma.user.findFirst({
    where: { email: { in: ['data@erp.com', 'data.@erp.com'] } },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  if (!dataEntryUser) throw new Error('Data entry user not found');

  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@erp.com' },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  if (!adminUser) throw new Error('admin@erp.com not found');

  console.log(`[PASS] Found test users in database:`);
  console.log(`  - Donation Manager: ${donationUser.email} (Role: ${donationUser.role.name})`);
  console.log(`  - Accountant: ${accountantUser.email} (Role: ${accountantUser.role.name})`);
  console.log(`  - Data Entry: ${dataEntryUser.email} (Role: ${dataEntryUser.role.name})`);
  console.log(`  - Super Admin: ${adminUser.email} (Role: ${adminUser.role.name}, Privileged: ${adminUser.role.isPrivileged})`);

  // 2. Test Permission Loading for Donation & Zakat Manager
  console.log('\n--- Testing Donation and Zakat Manager Permissions ---');
  const { req: donReq, res: donRes } = createMockReqRes(donationUser.id, donationUser.role.name, donationUser.role.isPrivileged);
  const donPermSet = await loadPermissions(donReq);
  const donPermArray = Array.from(donPermSet);

  console.log(`Total expanded permissions for Donation Manager: ${donPermArray.length}`);
  console.log(`Permissions: ${donPermArray.join(', ')}`);

  // Critical Verification: Must NOT contain circular leaks!
  const leaks = ['ledger.post', 'POST_JOURNAL', 'coa.view', 'openingBalances.view', 'generalLedger.view', 'hallBookings.view', 'members.view'];
  for (const leak of leaks) {
    if (donPermSet.has(leak)) {
      throw new Error(`CRITICAL FAULT: Donation Manager has leaked permission '${leak}'!`);
    }
  }
  console.log('[PASS] Circular permission leaks eliminated: no POST_JOURNAL, ledger.post, coa.view, etc.');

  // Must have donations.post and donations.view
  if (!donPermSet.has('donations.post')) throw new Error('Missing donations.post');
  if (!donPermSet.has('donations.view')) throw new Error('Missing donations.view');
  if (!donPermSet.has('revenueCollections.view')) throw new Error('Missing revenueCollections.view');
  if (!donPermSet.has('donors.view')) throw new Error('Missing donors.view');
  if (!donPermSet.has('zakat.view')) throw new Error('Missing zakat.view');
  if (!donPermSet.has('zakatCards.view')) throw new Error('Missing zakatCards.view');
  console.log('[PASS] All 5 assigned operational modules (and view permissions) correctly expanded.');

  // 3. Test /api/v1/auth/me response structure
  console.log('\n--- Testing /api/v1/auth/me Handler for Donation Manager ---');
  const authMeModule = await import('../api/_v1/auth/me.js');
  const authMeHandler = authMeModule.default || authMeModule;

  // Mock verifyAuth to inject req.user
  const { req: meReq, res: meRes } = createMockReqRes(donationUser.id, donationUser.role.name);
  meReq.headers.authorization = `Bearer ${jwt.sign({ sub: donationUser.id, email: donationUser.email, role: donationUser.role.name }, JWT_SECRET, { expiresIn: '1h' })}`;


  await authMeHandler(meReq, meRes);
  const meResult = meRes.getData();

  if (meRes.getStatusCode() !== 200) {
    throw new Error(`/api/v1/auth/me returned status ${meRes.getStatusCode()}`);
  }

  const meData = meResult.data;
  console.log('User in me:', meData.user);
  console.log('Role in me:', meData.role);
  console.log('Structured permissions count:', meData.permissions.length);

  // Verify structure: { user, role, permissions: [ { module, action } ] }
  if (!meData.user?.id || !meData.role?.name || !Array.isArray(meData.permissions)) {
    throw new Error('Invalid /api/v1/auth/me response structure');
  }

  const accessibleModules = new Set(meData.permissions.map((p: any) => p.module));
  console.log(`Accessible modules from /auth/me:`, Array.from(accessibleModules).join(', '));

  const expectedModules = ['donations', 'revenueCollections', 'donors', 'zakat', 'zakatCards'];
  for (const m of expectedModules) {
    if (!accessibleModules.has(m)) throw new Error(`Expected module ${m} missing from /auth/me`);
  }

  const forbiddenModules = ['coa', 'openingBalances', 'revenue', 'expenses', 'generalLedger', 'journalEntries', 'hallBookings', 'membership', 'members', 'customers', 'invoices', 'reports', 'audit', 'users', 'roles', 'settings'];
  for (const m of forbiddenModules) {
    if (accessibleModules.has(m)) throw new Error(`Forbidden module ${m} was returned in /auth/me!`);
  }
  console.log('[PASS] /api/v1/auth/me contains EXACTLY the 5 assigned modules and NO unauthorized modules.');

  // 4. Test Frontend Permission Helpers & Dynamic Sidebar Filtering
  console.log('\n--- Testing Frontend Permissions & Sidebar Logic ---');
  const normalized = normalizePermissions(meData.permissions);

  // Test canAccessModule
  console.log('canAccessModule donations:', canAccessModule(normalized, false, 'donations'));
  console.log('canAccessModule collections:', canAccessModule(normalized, false, 'revenueCollections'));
  console.log('canAccessModule donors:', canAccessModule(normalized, false, 'donors'));
  console.log('canAccessModule zakat:', canAccessModule(normalized, false, 'zakat'));
  console.log('canAccessModule zakatCards:', canAccessModule(normalized, false, 'zakatCards'));
  console.log('canAccessModule coa:', canAccessModule(normalized, false, 'coa'));
  console.log('canAccessModule expenses:', canAccessModule(normalized, false, 'expenses'));
  console.log('canAccessModule hallBookings:', canAccessModule(normalized, false, 'hallBookings'));
  console.log('canAccessModule members:', canAccessModule(normalized, false, 'members'));

  if (!canAccessModule(normalized, false, 'donations')) throw new Error('Failed canAccessModule donations');
  if (!canAccessModule(normalized, false, 'revenueCollections')) throw new Error('Failed canAccessModule revenueCollections');
  if (!canAccessModule(normalized, false, 'donors')) throw new Error('Failed canAccessModule donors');
  if (!canAccessModule(normalized, false, 'zakat')) throw new Error('Failed canAccessModule zakat');
  if (!canAccessModule(normalized, false, 'zakatCards')) throw new Error('Failed canAccessModule zakatCards');

  if (canAccessModule(normalized, false, 'coa')) throw new Error('Should NOT access coa');
  if (canAccessModule(normalized, false, 'openingBalances')) throw new Error('Should NOT access openingBalances');
  if (canAccessModule(normalized, false, 'expenses')) throw new Error('Should NOT access expenses');
  if (canAccessModule(normalized, false, 'generalLedger')) throw new Error('Should NOT access generalLedger');
  if (canAccessModule(normalized, false, 'journalEntries')) throw new Error('Should NOT access journalEntries');
  if (canAccessModule(normalized, false, 'hallBookings')) throw new Error('Should NOT access hallBookings');
  if (canAccessModule(normalized, false, 'members')) throw new Error('Should NOT access members');
  if (canAccessModule(normalized, false, 'customers')) throw new Error('Should NOT access customers');
  if (canAccessModule(normalized, false, 'reports')) throw new Error('Should NOT access reports');
  if (canAccessModule(normalized, false, 'users')) throw new Error('Should NOT access users');
  if (canAccessModule(normalized, false, 'roles')) throw new Error('Should NOT access roles');
  if (canAccessModule(normalized, false, 'settings')) throw new Error('Should NOT access settings');
  console.log('[PASS] Frontend canAccessModule accurately allows only the 5 modules and blocks all others.');

  // Test action permissions
  if (!hasPermission(normalized, false, 'donations', 'create')) throw new Error('Missing donations.create');
  if (!hasPermission(normalized, false, 'donations', 'post')) throw new Error('Missing donations.post');
  if (!hasPermission(normalized, false, 'donations', 'print')) throw new Error('Missing donations.print');
  if (hasPermission(normalized, false, 'donations', 'delete')) throw new Error('Should NOT have donations.delete (not assigned in DB)');
  console.log('[PASS] Granular action permissions (create, post, print) work and unassigned delete is denied.');

  // 5. Test Super Admin full access
  console.log('\n--- Testing Super Admin Full Access ---');
  const { req: adminReq, res: adminRes } = createMockReqRes(adminUser.id, adminUser.role.name, true);
  adminReq.headers.authorization = `Bearer ${jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role.name }, JWT_SECRET, { expiresIn: '1h' })}`;

  await authMeHandler(adminReq, adminRes);
  const adminData = adminRes.getData().data;

  if (!adminData.role.isPrivileged) throw new Error('Super Admin must be privileged');
  if (adminData.permissions.length < 50) throw new Error('Super Admin should have all module permissions');
  if (!hasPermission(adminData.permissions, true, 'coa', 'delete')) throw new Error('Super admin coa delete failed');
  if (!hasPermission(adminData.permissions, true, 'roles', 'update')) throw new Error('Super admin roles update failed');
  console.log(`[PASS] Super Admin holds full access (${adminData.permissions.length} actions across all modules).`);

  console.log('\n=== ALL RBAC TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ RBAC TEST FAILED:', err);
  process.exit(1);
});

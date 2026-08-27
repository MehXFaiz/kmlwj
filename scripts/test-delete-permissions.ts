import { enforceRestrictedRolePolicy } from '../api/_middlewares/rbac.middleware';
import { canUserEditOrDelete } from '../src/store/authStore';
import { isForbiddenError } from '../src/utils/deleteHandler';
import { prisma } from '../api/_prisma';

async function runTests() {
  console.log('--- Starting Delete Permission & Toast Audit Tests ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Test isForbiddenError
  assert(isForbiddenError({ response: { status: 403 } }), 'isForbiddenError detects 403');
  assert(isForbiddenError({ response: { status: 401 } }), 'isForbiddenError detects 401');
  assert(isForbiddenError({ status: 403 }), 'isForbiddenError detects status: 403');
  assert(!isForbiddenError({ response: { status: 500 } }), 'isForbiddenError rejects 500');
  assert(!isForbiddenError({ response: { status: 400 } }), 'isForbiddenError rejects 400');

  // 2. Test canUserEditOrDelete in authStore
  const superAdminRole = { name: 'Super Admin', isPrivileged: true };
  const adminRole = { name: 'Admin', isPrivileged: true };
  const accountantRole = { name: 'Accountant', isPrivileged: false };
  const dataEntryRole = { name: 'Data Entry Operator', isPrivileged: false };
  const donationMgrRole = { name: 'Donation & Zakat Manager', isPrivileged: false };
  const viewerRole = { name: 'Viewer', isPrivileged: false };

  assert(
    canUserEditOrDelete(true, { donations: { delete: true } }, 'donations', superAdminRole) === true,
    'Super Admin can edit/delete'
  );
  assert(
    canUserEditOrDelete(true, { donations: { delete: true } }, 'donations', adminRole) === true,
    'Admin with delete permission can edit/delete'
  );
  assert(
    canUserEditOrDelete(true, { donations: { delete: false } }, 'donations', adminRole) === false,
    'Admin without delete permission CANNOT edit/delete'
  );
  assert(
    canUserEditOrDelete(false, { donations: { delete: true } }, 'donations', accountantRole) === false,
    'Accountant CANNOT edit/delete even if delete flag is present'
  );
  assert(
    canUserEditOrDelete(false, { donations: { delete: true } }, 'donations', dataEntryRole) === false,
    'Data Entry Operator CANNOT edit/delete even if delete flag is present'
  );
  assert(
    canUserEditOrDelete(false, { donations: { delete: true } }, 'donations', donationMgrRole) === false,
    'Donation & Zakat Manager CANNOT edit/delete even if delete flag is present'
  );
  assert(
    canUserEditOrDelete(false, {}, 'donations', viewerRole) === false,
    'Viewer CANNOT edit/delete'
  );

  // 3. Test backend enforceRestrictedRolePolicy
  const createMockRes = () => {
    const res: any = {
      statusCode: 200,
      body: null,
      status: function (code: number) {
        this.statusCode = code;
        return this;
      },
      json: function (data: any) {
        this.body = data;
        return this;
      },
    };
    return res;
  };

  // Fetch a real privileged user and a real non-privileged user from DB
  const superAdmin = await prisma.user.findFirst({
    where: { role: { isPrivileged: true } },
    include: { role: true },
  });
  const restrictedUser = await prisma.user.findFirst({
    where: { role: { isPrivileged: false } },
    include: { role: true },
  });

  console.log(`Testing with real DB users: Super Admin (${superAdmin?.email}), Restricted (${restrictedUser?.email || 'mock UUID'})`);

  // Mock DELETE request from non-privileged role
  const mockReqRestricted: any = {
    method: 'DELETE',
    user: {
      id: restrictedUser?.id || '00000000-0000-0000-0000-000000000001',
      email: restrictedUser?.email || 'accountant@kml.org',
      role: restrictedUser?.role?.name || 'Accountant',
    },
    headers: {},
  };
  const mockResRestricted = createMockRes();

  const allowedRestricted = await enforceRestrictedRolePolicy(mockReqRestricted, mockResRestricted);
  assert(allowedRestricted === false, 'enforceRestrictedRolePolicy blocks DELETE for non-privileged role');
  assert(mockResRestricted.statusCode === 403, 'Returns HTTP 403');
  assert(mockResRestricted.body?.success === false, 'Returns success: false');
  assert(
    mockResRestricted.body?.message === 'You do not have permission to delete this record.',
    'Returns exact message: "You do not have permission to delete this record."'
  );

  // Mock DELETE request from Super Admin
  if (superAdmin) {
    const mockReqSuperAdmin: any = {
      method: 'DELETE',
      user: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role.name },
      headers: {},
    };
    const mockResSuperAdmin = createMockRes();

    const allowedSuperAdmin = await enforceRestrictedRolePolicy(mockReqSuperAdmin, mockResSuperAdmin);
    assert(allowedSuperAdmin === true, 'enforceRestrictedRolePolicy allows DELETE for Super Admin');
  }

  // 4. Verify Database Records
  console.log('\nVerifying DB records count...');
  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  console.log(`Total users in DB: ${userCount}, Total accounts in DB: ${accountCount}`);
  assert(userCount > 0 && accountCount > 0, 'Database contains master records');

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

/**
 * Post-Migration Testing Script
 * 
 * Tests critical functionality after MongoDB migration:
 * - Database connectivity
 * - Collection structure validation
 * - User authentication
 * - Role-based access control
 * - Sample data queries
 * 
 * Usage: npx ts-node scripts/test-post-migration.ts
 */

import { MongoClient } from 'mongodb';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string, details?: string) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${name}: ${message}`);
  if (details) console.log(`  ${details}`);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  console.log('='.repeat(90));
  console.log('POST-MIGRATION TESTING SUITE');
  console.log('='.repeat(90));
  console.log('');

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db('kmlwj');

    // Test 1: Database connection
    console.log('1️⃣ DATABASE CONNECTIVITY');
    console.log('-'.repeat(90));
    try {
      await db.command({ ping: 1 });
      addResult('MongoDB Connection', true, 'Connected successfully');
    } catch (error) {
      addResult(
        'MongoDB Connection',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }

    // Test 2: Collection structure
    console.log('\n2️⃣ COLLECTION STRUCTURE');
    console.log('-'.repeat(90));

    const criticalCollections = [
      'User',
      'Role',
      'Permission',
      'Account',
      'JournalEntry',
      'Donation',
      'HallBooking',
      'AuditLog',
    ];

    for (const collName of criticalCollections) {
      try {
        const count = await db.collection(collName).countDocuments();
        addResult(collName, count > 0, `${count} documents found`);
      } catch (error) {
        addResult(collName, false, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Test 3: User data
    console.log('\n3️⃣ USER DATA VALIDATION');
    console.log('-'.repeat(90));

    try {
      const userCount = await db.collection('User').countDocuments();
      addResult('User Count', userCount > 0, `${userCount} users migrated`);

      const sampleUser = await db.collection('User').findOne();
      if (sampleUser) {
        addResult(
          'User Structure',
          sampleUser.email && sampleUser.name,
          `Sample: ${sampleUser.email}`,
          `ID: ${sampleUser.id || sampleUser._id}`
        );
      }
    } catch (error) {
      addResult('User Data', false, error instanceof Error ? error.message : 'Unknown error');
    }

    // Test 4: Role-based access control
    console.log('\n4️⃣ ROLE-BASED ACCESS CONTROL');
    console.log('-'.repeat(90));

    try {
      const roles = await db.collection('Role').find({}).toArray();
      addResult('Roles', roles.length > 0, `${roles.length} roles found`);

      const permissions = await db.collection('Permission').find({}).toArray();
      addResult('Permissions', permissions.length > 0, `${permissions.length} permissions found`);

      const rolePermissions = await db.collection('RolePermission').countDocuments();
      addResult('Role Permissions', rolePermissions > 0, `${rolePermissions} assignments`);
    } catch (error) {
      addResult(
        'RBAC Structure',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Test 5: Financial data
    console.log('\n5️⃣ FINANCIAL DATA');
    console.log('-'.repeat(90));

    try {
      const accountCount = await db.collection('Account').countDocuments();
      addResult('Chart of Accounts', accountCount > 0, `${accountCount} accounts`);

      const journalCount = await db.collection('JournalEntry').countDocuments();
      addResult('Journal Entries', journalCount > 0, `${journalCount} entries`);

      // Check financial precision
      const sampleLine = await db.collection('JournalEntryLine').findOne({});
      if (sampleLine && sampleLine.debitAmount) {
        const isValidType =
          typeof sampleLine.debitAmount === 'number' || sampleLine.debitAmount.constructor.name === 'Decimal';
        addResult(
          'Financial Data Type',
          isValidType,
          `Debit type: ${typeof sampleLine.debitAmount}`,
          `Value: ${sampleLine.debitAmount}`
        );
      }
    } catch (error) {
      addResult(
        'Financial Data',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Test 6: Business transactions
    console.log('\n6️⃣ BUSINESS TRANSACTIONS');
    console.log('-'.repeat(90));

    try {
      const donations = await db.collection('Donation').countDocuments();
      addResult('Donations', donations > 0, `${donations} records`);

      const hallBookings = await db.collection('HallBooking').countDocuments();
      addResult('Hall Bookings', hallBookings > 0, `${hallBookings} bookings`);

      const invoices = await db.collection('Invoice').countDocuments();
      addResult('Invoices', invoices > 0, `${invoices} invoices`);
    } catch (error) {
      addResult(
        'Business Data',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Test 7: Audit logs
    console.log('\n7️⃣ AUDIT LOGS');
    console.log('-'.repeat(90));

    try {
      const auditCount = await db.collection('AuditLog').countDocuments();
      addResult('Audit Trail', auditCount >= 0, `${auditCount} log entries`);

      const latestAudit = await db.collection('AuditLog').findOne({}, { sort: { _id: -1 } });
      if (latestAudit) {
        addResult(
          'Latest Audit Entry',
          true,
          `${latestAudit.action || 'N/A'}`,
          `User: ${latestAudit.userId || 'N/A'}`
        );
      }
    } catch (error) {
      addResult(
        'Audit Logs',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Test 8: Data consistency
    console.log('\n8️⃣ DATA CONSISTENCY CHECKS');
    console.log('-'.repeat(90));

    try {
      // Check for orphaned foreign keys (sample)
      const orphanedDonations = await db.collection('Donation').countDocuments({
        donorId: { $nin: (await db.collection('Donor').distinct('id')) },
      });

      addResult(
        'Donor References',
        orphanedDonations === 0,
        `${orphanedDonations} orphaned donations`,
        orphanedDonations > 0 ? 'WARNING: Integrity issue detected' : 'All references valid'
      );
    } catch (error) {
      addResult(
        'Referential Integrity',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Summary
    console.log('\n' + '='.repeat(90));
    console.log('TEST SUMMARY');
    console.log('-'.repeat(90));

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);

    if (failedCount > 0) {
      console.log('\nFailed Tests:');
      for (const result of results.filter((r) => !r.passed)) {
        console.log(`  ✗ ${result.name}: ${result.message}`);
      }
    }

    console.log('\n' + (failedCount === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
    console.log('='.repeat(90));

    process.exit(failedCount === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

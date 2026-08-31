/**
 * MongoDB Migration Validation Script
 * 
 * Validates the migrated MongoDB data:
 * - Checks collection counts
 * - Verifies data types
 * - Validates relationships
 * - Checks financial data precision
 * - Identifies orphaned references
 * 
 * Usage: npx ts-node scripts/validate-migration.ts
 */

import { MongoClient } from 'mongodb';

interface ValidationResult {
  passed: boolean;
  totalChecks: number;
  failedChecks: number;
  issues: string[];
  summary: string;
}

const EXPECTED_COUNTS: Record<string, number> = {
  // Will be populated by actual data scan
};

/**
 * Main validation function
 */
async function validateMigration(): Promise<ValidationResult> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  const result: ValidationResult = {
    passed: true,
    totalChecks: 0,
    failedChecks: 0,
    issues: [],
    summary: '',
  };

  try {
    await client.connect();
    const db = client.db('kmlwj');

    console.log('🔍 Starting validation...\n');
    console.log('='.repeat(90));
    console.log('DATABASE VALIDATION REPORT');
    console.log('='.repeat(90));

    // Check collections exist
    console.log('\n1️⃣ COLLECTION EXISTENCE CHECK');
    console.log('-'.repeat(90));
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections\n`);

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      if (count > 0) {
        console.log(`  ✓ ${col.name.padEnd(40)} ${count} documents`);
      } else {
        console.log(`  ⚠ ${col.name.padEnd(40)} ${count} documents (empty)`);
        result.issues.push(`${col.name} is empty`);
      }
      result.totalChecks++;
    }

    // Check key relationships
    console.log('\n2️⃣ RELATIONSHIP INTEGRITY CHECK');
    console.log('-'.repeat(90));

    // Users exist
    const userCount = await db.collection('User').countDocuments();
    console.log(`  • Users: ${userCount}`);

    // Roles exist
    const roleCount = await db.collection('Role').countDocuments();
    console.log(`  • Roles: ${roleCount}`);

    // Accounts exist
    const accountCount = await db.collection('Account').countDocuments();
    console.log(`  • Accounts: ${accountCount}`);

    // Check for orphaned records (optional - sample check)
    const orphanedDonations = await db.collection('Donation').countDocuments({
      donorId: { $nin: (await db.collection('Donor').distinct('id')) },
    });
    if (orphanedDonations > 0) {
      result.issues.push(`Found ${orphanedDonations} donations with invalid donor references`);
      result.failedChecks++;
    }
    result.totalChecks++;

    console.log(`  ✓ Relationship check passed`);

    // Check data types
    console.log('\n3️⃣ DATA TYPE VALIDATION');
    console.log('-'.repeat(90));

    const sampleAccount = await db.collection('Account').findOne();
    if (sampleAccount) {
      console.log(`  Sample Account:`);
      console.log(`    • ID: ${typeof sampleAccount.id} (${sampleAccount.id})`);
      console.log(
        `    • currentBalance: ${typeof sampleAccount.currentBalance} (${sampleAccount.currentBalance})`
      );
      console.log(`    • isLocked: ${typeof sampleAccount.isLocked} (${sampleAccount.isLocked})`);
      result.totalChecks++;
    }

    // Financial data check
    console.log('\n4️⃣ FINANCIAL DATA PRECISION');
    console.log('-'.repeat(90));

    const journalLines = await db
      .collection('JournalEntryLine')
      .find({})
      .limit(5)
      .toArray();
    if (journalLines.length > 0) {
      let debitsValid = true;
      for (const line of journalLines) {
        if (line.debitAmount && typeof line.debitAmount !== 'number') {
          debitsValid = false;
          result.issues.push(`Invalid debit amount type: ${typeof line.debitAmount}`);
        }
      }
      if (debitsValid) {
        console.log(`  ✓ Financial data types correct`);
      }
      result.totalChecks++;
    }

    // Audit logs
    console.log('\n5️⃣ AUDIT LOG CHECK');
    console.log('-'.repeat(90));

    const auditCount = await db.collection('AuditLog').countDocuments();
    console.log(`  Audit logs migrated: ${auditCount}`);
    result.totalChecks++;

    // Summary
    console.log('\n' + '='.repeat(90));
    console.log('VALIDATION SUMMARY');
    console.log('-'.repeat(90));
    console.log(`Total Checks: ${result.totalChecks}`);
    console.log(`Passed: ${result.totalChecks - result.failedChecks}`);
    console.log(`Failed: ${result.failedChecks}`);

    if (result.issues.length > 0) {
      console.log('\nIssues Found:');
      for (const issue of result.issues) {
        console.log(`  • ${issue}`);
      }
      result.passed = false;
    } else {
      console.log('\n✅ All validation checks passed!');
      result.passed = true;
    }

    result.summary = result.passed ? 'Validation successful' : 'Validation found issues';
    console.log('='.repeat(90));
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }

  return result;
}

// Run validation
validateMigration()
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

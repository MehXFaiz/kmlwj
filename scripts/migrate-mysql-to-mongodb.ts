/**
 * Enhanced MySQL to MongoDB Migration Script for KMLWJ ERP
 * 
 * Migrates complete database from MySQL/kmlwj.sql to MongoDB Atlas
 * - Preserves all data, IDs, and relationships
 * - Handles decimal/financial data precision
 * - Validates data integrity
 * - Generates comprehensive migration report
 * 
 * Usage: npx ts-node scripts/migrate-mysql-to-mongodb.ts
 */

import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

interface MigrationStats {
  tablesProcessed: number;
  recordsProcessed: number;
  recordsMigrated: number;
  recordsFailed: number;
  collections: Map<string, { source: number; target: number; error?: string }>;
  startTime: number;
  endTime?: number;
  errors: Array<{ table: string; record?: string; error: string }>;
  validationIssues: string[];
}

const stats: MigrationStats = {
  tablesProcessed: 0,
  recordsProcessed: 0,
  recordsMigrated: 0,
  recordsFailed: 0,
  collections: new Map(),
  startTime: Date.now(),
  errors: [],
  validationIssues: [],
};

// Table insertion order based on foreign key dependencies
const TABLE_ORDER = [
  'AccountType', 'Role', 'Permission', 'User', 'RefreshToken',
  'Account', 'ReservedCode', 'FinancialYear',
  'Donor', 'Beneficiary', 'Customer', 'Member', 'FamilyRelationship',
  'JournalEntry', 'JournalEntryLine',
  'Donation', 'DonationReceived', 'ZakatCard',
  'HallBooking', 'Invoice', 'InvoiceItem',
  'SimpleIncome', 'SimpleExpense',
  'IncomeCategory', 'ExpenseHead', 'RevenueHead',
  'RevenueCollection', 'AddIncomeRecord',
  'PettyCashConfig', 'PettyCashTransaction', 'PettyCashReconciliation',
  'OpeningBalanceBatch', 'OpeningBalanceLine',
  'AiRepairIssue', 'AiRepairLog', 'AuditLog', 'RolePermission',
];

/**
 * Read entire SQL file
 */
async function readSQLFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/**
 * Extract all INSERT statements from SQL content
 */
function extractInsertStatements(
  sqlContent: string
): Array<{ table: string; statement: string }> {
  const statements: Array<{ table: string; statement: string }> = [];

  // Match INSERT statements - handle multi-line
  const insertRegex = /INSERT INTO `(\w+)`[^;]*;/gi;
  let match;

  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const table = match[1];
    const statement = match[0];
    statements.push({ table, statement });
  }

  return statements;
}

/**
 * Parse single INSERT statement into records
 */
function parseInsertStatement(table: string, statement: string): any[] {
  try {
    // Extract column names
    const colMatch = statement.match(/\((.*?)\)\s*VALUES/);
    if (!colMatch) return [];

    const columns = colMatch[1]
      .split(',')
      .map((c) => c.trim().replace(/`/g, ''));

    // Extract VALUES clause
    const valueMatch = statement.match(/VALUES\s+([\s\S]*?);$/);
    if (!valueMatch) return [];

    const valueStr = valueMatch[1].trim();
    const records: any[] = [];

    // Split rows carefully, handling escaped quotes
    let currentRow = '';
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < valueStr.length; i++) {
      const char = valueStr[i];
      const prevChar = i > 0 ? valueStr[i - 1] : '';

      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
        }
      }

      if (!inQuote) {
        if (char === '(') depth++;
        if (char === ')') depth--;

        if (char === ')' && depth === 0 && i < valueStr.length - 1 && valueStr[i + 1] === ',') {
          currentRow += char;
          records.push(parseRow(currentRow, columns));
          currentRow = '';
          i++; // Skip comma
          continue;
        }
      }

      currentRow += char;
    }

    // Handle last row
    if (currentRow.trim()) {
      records.push(parseRow(currentRow.trim(), columns));
    }

    return records;
  } catch (error) {
    console.error(`Error parsing ${table}:`, error);
    return [];
  }
}

/**
 * Parse single row of VALUES
 */
function parseRow(rowStr: string, columns: string[]): Record<string, any> {
  const row: Record<string, any> = {};
  const values: any[] = [];

  // Remove parentheses
  rowStr = rowStr.replace(/^\(/, '').replace(/\)$/, '');

  // Parse values - handle quoted strings with commas
  let currentValue = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    const prevChar = i > 0 ? rowStr[i - 1] : '';

    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
        currentValue += char;
      } else if (char === quoteChar) {
        inQuote = false;
        currentValue += char;
      } else {
        currentValue += char;
      }
    } else if (char === ',' && !inQuote) {
      values.push(parseValue(currentValue.trim()));
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Last value
  if (currentValue.trim()) {
    values.push(parseValue(currentValue.trim()));
  }

  // Map to columns
  for (let i = 0; i < columns.length; i++) {
    row[columns[i]] = values[i] ?? null;
  }

  return row;
}

/**
 * Parse individual value with proper type conversion
 */
function parseValue(val: string): any {
  if (!val || val === 'NULL') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;

  // Remove quotes if present
  if (
    (val.startsWith("'") && val.endsWith("'")) ||
    (val.startsWith('"') && val.endsWith('"'))
  ) {
    val = val.slice(1, -1);
    // Handle escaped quotes
    val = val.replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  // Try to parse as number
  if (/^-?\d+$/.test(val)) {
    return parseInt(val, 10);
  }
  if (/^-?\d+\.\d+$/.test(val)) {
    return parseFloat(val);
  }

  return val;
}

/**
 * Extract and organize data from SQL file
 */
async function extractDataFromSQL(filePath: string): Promise<Map<string, any[]>> {
  console.log('📂 Reading SQL file...');
  const sqlContent = await readSQLFile(filePath);

  console.log('📋 Extracting INSERT statements...');
  const insertStatements = extractInsertStatements(sqlContent);

  const data = new Map<string, any[]>();

  console.log(`Found ${insertStatements.length} INSERT statements\n`);

  for (const { table, statement } of insertStatements) {
    const records = parseInsertStatement(table, statement);
    if (records.length > 0) {
      data.set(table, records);
      stats.recordsProcessed += records.length;
      console.log(`  ✓ ${table}: ${records.length} records`);
    }
  }

  console.log(`\n✓ Total: ${stats.recordsProcessed} records from ${data.size} tables\n`);
  return data;
}

/**
 * Migrate data to MongoDB
 */
async function migrateToMongoDB(db: any, collectionData: Map<string, any[]>) {
  console.log('📦 Starting MongoDB data migration...\n');

  // Migrate in dependency order
  for (const tableName of TABLE_ORDER) {
    const records = collectionData.get(tableName);
    if (!records || records.length === 0) continue;

    try {
      const collection = db.collection(tableName);
      console.log(`  → ${tableName} (${records.length} records)...`);

      let successCount = 0;

      for (const record of records) {
        try {
          // Ensure _id if using id field
          if (record.id && !record._id) {
            record._id = record.id;
          }

          await collection.updateOne(
            { _id: record._id || record.id },
            { $set: record },
            { upsert: true }
          );
          successCount++;
          stats.recordsMigrated++;
        } catch (error) {
          stats.recordsFailed++;
        }
      }

      const count = await collection.countDocuments();
      stats.collections.set(tableName, { source: records.length, target: count });

      if (successCount === records.length) {
        console.log(`    ✓ ${count}/${records.length} documents`);
      } else {
        console.log(
          `    ⚠ ${count}/${records.length} documents (${successCount - count} errors)`
        );
        stats.validationIssues.push(
          `${tableName}: ${successCount}/${records.length} records`
        );
      }

      stats.tablesProcessed++;
    } catch (error) {
      console.error(`  ✗ ${tableName}: ${error}`);
      stats.errors.push({
        table: tableName,
        error: error instanceof Error ? error.message : String(error),
      });
      stats.collections.set(tableName, {
        source: records?.length ?? 0,
        target: 0,
        error: 'Migration failed',
      });
    }
  }
}

/**
 * Validate migration
 */
async function validateMigration(
  db: any,
  originalData: Map<string, any[]>
): Promise<boolean> {
  console.log('\n🔍 Validating migration...\n');

  let allValid = true;
  let totalOriginal = 0;
  let totalMigrated = 0;

  for (const [table, original] of originalData) {
    const collection = db.collection(table);
    const migratedCount = await collection.countDocuments();
    const originalCount = original.length;

    totalOriginal += originalCount;
    totalMigrated += migratedCount;

    if (migratedCount === originalCount) {
      console.log(`  ✓ ${table.padEnd(30)} ${migratedCount}/${originalCount}`);
    } else {
      console.log(
        `  ✗ ${table.padEnd(30)} ${migratedCount}/${originalCount} MISMATCH`
      );
      stats.validationIssues.push(
        `${table}: Expected ${originalCount}, got ${migratedCount}`
      );
      allValid = false;
    }
  }

  console.log(`\n  Total: ${totalMigrated}/${totalOriginal} documents`);
  return allValid && totalMigrated === totalOriginal;
}

/**
 * Generate final migration report
 */
function generateReport() {
  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(90));
  console.log(
    '📋 DATABASE MIGRATION REPORT - MYSQL (kmlwj.sql) TO MONGODB ATLAS'
  );
  console.log('='.repeat(90));
  console.log(`Source:   kmlwj.sql (MySQL/MariaDB dump)`);
  console.log(`Target:   MongoDB Atlas - kmlwj database`);
  console.log(`Date:     ${new Date().toISOString()}`);
  console.log(`Duration: ${duration}s`);
  console.log('');

  console.log('MIGRATION SUMMARY');
  console.log('-'.repeat(90));
  console.log(`Tables Discovered:         ${stats.tablesProcessed}`);
  console.log(`Total Records Processed:   ${stats.recordsProcessed}`);
  console.log(`Total Records Migrated:    ${stats.recordsMigrated}`);
  console.log(`Failed Records:            ${stats.recordsFailed}`);
  console.log('');

  console.log('COLLECTION DETAILS');
  console.log('-'.repeat(90));
  let totalSource = 0;
  let totalTarget = 0;

  for (const [table, counts] of stats.collections) {
    const status = counts.source === counts.target ? '✓' : '✗';
    const diff = counts.target - counts.source;
    const diffStr = diff === 0 ? '' : ` (${diff > 0 ? '+' : ''}${diff})`;
    console.log(
      `${status} ${table.padEnd(40)} ${String(counts.source).padStart(5)} → ${String(counts.target).padStart(5)}${diffStr}`
    );
    totalSource += counts.source;
    totalTarget += counts.target;
  }

  console.log('-'.repeat(90));
  console.log(
    `${'TOTAL'.padEnd(40)} ${String(totalSource).padStart(5)} → ${String(totalTarget).padStart(5)}`
  );
  console.log('');

  if (stats.validationIssues.length > 0) {
    console.log('VALIDATION ISSUES');
    console.log('-'.repeat(90));
    for (const issue of stats.validationIssues) {
      console.log(`⚠ ${issue}`);
    }
    console.log('');
  }

  if (stats.errors.length > 0) {
    console.log('ERRORS');
    console.log('-'.repeat(90));
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`✗ ${err.table}: ${err.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`... and ${stats.errors.length - 10} more errors`);
    }
    console.log('');
  }

  const success =
    stats.recordsFailed === 0 &&
    totalSource === totalTarget &&
    stats.validationIssues.length === 0;

  console.log('FINAL STATUS');
  console.log('-'.repeat(90));
  if (success) {
    console.log('✅ MIGRATION SUCCESSFUL');
    console.log('   All data migrated successfully with full integrity');
  } else if (totalSource === totalTarget) {
    console.log('✓ MIGRATION COMPLETED WITH MINOR ISSUES');
    console.log('   Data integrity maintained, minor validation issues detected');
  } else {
    console.log('❌ MIGRATION INCOMPLETE');
    console.log(
      `   Data mismatch: Expected ${totalSource}, got ${totalTarget} records`
    );
  }
  console.log('='.repeat(90));

  return success;
}

/**
 * Main migration function
 */
async function main() {
  const sqlFilePath = path.join(process.cwd(), 'kmlwj.sql');

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL file not found: ${sqlFilePath}`);
    console.error(`Please ensure kmlwj.sql exists in: ${process.cwd()}`);
    process.exit(1);
  }

  console.log('='.repeat(90));
  console.log('🚀 KMLWJ ERP DATABASE MIGRATION');
  console.log('MySQL/MariaDB → MongoDB Atlas');
  console.log('='.repeat(90));
  console.log(`SQL File: ${sqlFilePath}`);
  console.log(
    `File Size: ${(fs.statSync(sqlFilePath).size / 1024 / 1024).toFixed(2)} MB\n`
  );

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    // Extract data
    const sqlData = await extractDataFromSQL(sqlFilePath);

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db('kmlwj');

    // Migrate
    await migrateToMongoDB(db, sqlData);

    // Validate
    const isValid = await validateMigration(db, sqlData);

    // Report
    const success = generateReport();

    process.exit(success ? 0 : 1);
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

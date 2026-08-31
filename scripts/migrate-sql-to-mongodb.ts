/**
 * KMLWJ ERP — Database Restore Script
 * =====================================
 * Restores all data from kmlwj.sql (MySQL dump) and the JSON backup
 * into MongoDB Atlas, preserving all UUID _id values and relationships.
 *
 * Strategy:
 *   1. Parse kmlwj.sql → extract INSERT data per table
 *   2. Read backups/db-backup-*.json → secondary source
 *   3. Merge: union by _id, SQL wins on conflict (SQL is newer)
 *   4. Connect to MongoDB Atlas via native driver (bypasses Prisma ObjectId)
 *   5. Upsert all documents (idempotent — safe to re-run)
 *   6. Validate counts, references, financial totals
 *   7. Generate migration report
 *
 * Usage:
 *   npx tsx scripts/migrate-sql-to-mongodb.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// ─── Configuration ──────────────────────────────────────────────────────────

const SQL_FILE = path.resolve(__dirname, '../kmlwj.sql');
const BACKUP_DIR = path.resolve(__dirname, '../backups');
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = 'kmlwj';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

// ─── Report Tracking ────────────────────────────────────────────────────────

interface CollectionReport {
  collection: string;
  sqlRecords: number;
  jsonRecords: number;
  mergedRecords: number;
  insertedRecords: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
}

const report: {
  collections: CollectionReport[];
  orphanChecks: { check: string; broken: number; total: number; status: 'PASS' | 'FAIL' }[];
  financialCheck: { debitTotal: number; creditTotal: number; difference: number; status: 'PASS' | 'FAIL' };
  startedAt: string;
  completedAt?: string;
  totalSourceRecords: number;
  totalMigratedRecords: number;
  finalStatus: 'MIGRATION COMPLETE' | 'MIGRATION FAILED';
} = {
  collections: [],
  orphanChecks: [],
  financialCheck: { debitTotal: 0, creditTotal: 0, difference: 0, status: 'PASS' },
  startedAt: new Date().toISOString(),
  totalSourceRecords: 0,
  totalMigratedRecords: 0,
  finalStatus: 'MIGRATION COMPLETE',
};

// ─── SQL Parser ─────────────────────────────────────────────────────────────

/**
 * Parses a MySQL INSERT VALUES string like:
 *   ('val1', 'val2', NULL, 1, '{"key":"val"}')
 * into an array of raw string values.
 *
 * Handles: escaped quotes (''), nested quotes, NULL, JSON strings.
 */
function parseValueRow(row: string): string[] {
  const values: string[] = [];
  let i = 0;
  const len = row.length;

  while (i < len) {
    // skip leading whitespace
    while (i < len && (row[i] === ' ' || row[i] === '\t')) i++;
    if (i >= len) break;

    if (row[i] === '(') { i++; continue; }
    if (row[i] === ')') { i++; break; }
    if (row[i] === ',') { i++; continue; }

    if (row[i] === "'") {
      // quoted string — find closing quote, handling '' escapes
      i++; // skip opening quote
      let val = '';
      while (i < len) {
        if (row[i] === "'") {
          if (i + 1 < len && row[i + 1] === "'") {
            val += "'";
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else if (row[i] === '\\' && i + 1 < len) {
          const next = row[i + 1];
          if (next === 'n') { val += '\n'; i += 2; }
          else if (next === 'r') { val += '\r'; i += 2; }
          else if (next === 't') { val += '\t'; i += 2; }
          else if (next === '\\') { val += '\\'; i += 2; }
          else if (next === "'") { val += "'"; i += 2; }
          else if (next === '"') { val += '"'; i += 2; }
          else { val += row[i]; i++; }
        } else {
          val += row[i];
          i++;
        }
      }
      values.push(val);
    } else {
      // unquoted: NULL or a number
      let val = '';
      while (i < len && row[i] !== ',' && row[i] !== ')') {
        val += row[i];
        i++;
      }
      values.push(val.trim());
    }
  }

  return values;
}

/**
 * Splits a multi-row VALUES clause into individual row strings.
 * e.g. "('a','b'),\n('c','d')" → ["('a','b')", "('c','d')"]
 */
function splitValueRows(valuesClause: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let start = 0;
  let inStr = false;

  for (let i = 0; i < valuesClause.length; i++) {
    const ch = valuesClause[i];

    if (ch === "'" && !inStr) {
      inStr = true;
    } else if (ch === "'" && inStr) {
      if (i + 1 < valuesClause.length && valuesClause[i + 1] === "'") {
        i++; // escaped quote
      } else {
        inStr = false;
      }
    } else if (!inStr) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          rows.push(valuesClause.slice(start, i + 1).trim());
          start = i + 1;
        }
      }
    }
  }

  return rows.filter(r => r.startsWith('('));
}

interface TableData {
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Parse all INSERT INTO statements from the SQL file.
 * Returns a map: tableName → { columns, rows }
 */
function parseSqlFile(filePath: string): Map<string, TableData> {
  console.log(`\n📂 Parsing SQL file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = new Map<string, TableData>();

  // Match INSERT INTO `TableName` (`col1`, `col2`, ...) VALUES ...;
  const insertRegex = /INSERT INTO `(\w+)` \(([^)]+)\) VALUES\s*([\s\S]+?)(?:;|\n\n)/g;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(content)) !== null) {
    const tableName = match[1];
    const colsPart = match[2];
    const valuesPart = match[3].trim().replace(/;$/, '');

    // Parse column names
    const columns = colsPart
      .split(',')
      .map(c => c.trim().replace(/`/g, ''));

    // Parse value rows
    const rowStrings = splitValueRows(valuesPart);
    const rows: Record<string, string>[] = [];

    for (const rowStr of rowStrings) {
      const values = parseValueRow(rowStr);
      if (values.length !== columns.length) {
        // Length mismatch — try to continue
        console.warn(`  ⚠️  ${tableName}: column/value mismatch (${columns.length} cols, ${values.length} vals) — skipping row`);
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx];
      });
      rows.push(row);
    }

    // Merge with existing if multiple INSERT blocks for same table
    const existing = result.get(tableName);
    if (existing) {
      existing.rows.push(...rows);
    } else {
      result.set(tableName, { columns, rows });
    }
  }

  console.log(`  ✅ Parsed ${result.size} tables with INSERT data`);
  for (const [table, data] of result.entries()) {
    console.log(`     ${table}: ${data.rows.length} rows`);
  }

  return result;
}

// ─── JSON Backup Reader ──────────────────────────────────────────────────────

function loadJsonBackup(): Map<string, Record<string, any>[]> {
  const result = new Map<string, Record<string, any>[]>();

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse(); // most recent first

  if (files.length === 0) {
    console.log('  ⚠️  No JSON backup found in backups/');
    return result;
  }

  const backupFile = path.join(BACKUP_DIR, files[0]);
  console.log(`\n📂 Loading JSON backup: ${files[0]}`);

  const raw = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
  const tables = raw.tables as Record<string, any[]>;

  for (const [name, records] of Object.entries(tables)) {
    if (Array.isArray(records) && records.length > 0) {
      result.set(name, records);
      console.log(`     ${name}: ${records.length} records`);
    }
  }

  return result;
}

// ─── Type Converters ─────────────────────────────────────────────────────────

function toBoolean(val: string): boolean {
  if (val === '1' || val === 'true' || val === 'TRUE') return true;
  if (val === '0' || val === 'false' || val === 'FALSE') return false;
  return Boolean(val);
}

function toDate(val: string): Date | null {
  if (val === 'NULL' || val === '' || val === null) return null;
  // MySQL datetime: '2026-07-16 03:34:14' → ISO
  const d = new Date(val.replace(' ', 'T') + (val.includes('.') ? 'Z' : '.000Z'));
  return isNaN(d.getTime()) ? null : d;
}

function toFloat(val: string): number {
  if (val === 'NULL' || val === '') return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function toInt(val: string): number {
  if (val === 'NULL' || val === '') return 0;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function toNullableString(val: string): string | null {
  if (val === 'NULL') return null;
  return val;
}

function toNullableDate(val: string): Date | null {
  if (val === 'NULL' || val === '') return null;
  return toDate(val);
}

function toNullableFloat(val: string): number | null {
  if (val === 'NULL' || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toNullableInt(val: string): number | null {
  if (val === 'NULL' || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toJson(val: string): any {
  if (val === 'NULL' || val === '') return null;
  try {
    return JSON.parse(val);
  } catch {
    return val; // return raw if unparseable
  }
}

function toStringArray(val: string): string[] {
  if (val === 'NULL' || val === '') return ['Global'];
  // In SQL it's stored as 'Global' plain string
  // Could also be a JSON array like '["Global"]'
  if (val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  // Plain string → wrap in array
  return [val];
}

// ─── Per-Table Document Transformers ─────────────────────────────────────────

function transformAccount(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    glCode: row['glCode'],
    accountName: row['accountName'],
    accountLevel: row['accountLevel'],
    parentId: toNullableString(row['parentId']),
    accountTypeId: toNullableString(row['accountTypeId']),
    isLocked: toBoolean(row['isLocked']),
    isReserved: toBoolean(row['isReserved']),
    isSystemDefined: toBoolean(row['isSystemDefined']),
    description: toNullableString(row['description']),
    currency: row['currency'] || 'PKR',
    subsidiary: toStringArray(row['subsidiary']),
    initialBalance: toFloat(row['initialBalance']),
    currentBalance: toFloat(row['currentBalance']),
    detailType: row['detailType'] || 'Header',
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformAccountType(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    description: toNullableString(row['description']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformRole(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    description: toNullableString(row['description']),
    isPrivileged: toBoolean(row['isPrivileged']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformPermission(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    description: toNullableString(row['description']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformRolePermission(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    roleId: row['roleId'],
    permissionId: row['permissionId'],
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformUser(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    fullName: row['fullName'],
    email: row['email'],
    password: row['password'],
    isActive: toBoolean(row['isActive']),
    roleId: row['roleId'],
    resetPasswordToken: toNullableString(row['resetPasswordToken']),
    resetPasswordExpires: toNullableDate(row['resetPasswordExpires']),
    themePreference: toNullableString(row['themePreference']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformRefreshToken(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    token: row['token'],
    userId: row['userId'],
    expiresAt: toDate(row['expiresAt']) || new Date(),
    createdAt: toDate(row['createdAt']) || new Date(),
    revokedAt: toNullableDate(row['revokedAt']),
  };
}

function transformAuditLog(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    userId: toNullableString(row['userId']),
    action: row['action'],
    module: row['module'],
    oldValues: toJson(row['oldValues']),
    newValues: toJson(row['newValues']),
    ipAddress: toNullableString(row['ipAddress']),
    userAgent: toNullableString(row['userAgent']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

function transformJournalEntry(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    voucherNo: row['voucherNo'],
    postingDate: toDate(row['postingDate']) || new Date(),
    subsidiary: row['subsidiary'],
    reference: row['reference'],
    description: toNullableString(row['description']),
    postedBy: row['postedBy'],
    status: row['status'] || 'Draft',
    voucherType: row['voucherType'] || 'JV',
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformJournalEntryLine(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    journalEntryId: row['journalEntryId'],
    accountId: row['accountId'],
    description: toNullableString(row['description']),
    debit: toFloat(row['debit']),
    credit: toFloat(row['credit']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformRevenueHead(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    category: row['category'],
    hall: toNullableString(row['hall']),
    amount: toFloat(row['amount']),
    accountId: toNullableString(row['accountId']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

function transformExpenseHead(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    category: row['category'],
    accountId: toNullableString(row['accountId']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

function transformBeneficiary(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    fatherName: toNullableString(row['fatherName']),
    husbandName: toNullableString(row['husbandName']),
    cnic: toNullableString(row['cnic']),
    dob: toNullableDate(row['dob']),
    mobile: toNullableString(row['mobile']),
    email: toNullableString(row['email']),
    familySize: toNullableInt(row['familySize']),
    monthlyIncome: toNullableFloat(row['monthlyIncome']),
    monthlyExpenses: toNullableFloat(row['monthlyExpenses']),
    debtAmount: toNullableFloat(row['debtAmount']),
    housingStatus: toNullableString(row['housingStatus']),
    housingOther: toNullableString(row['housingOther']),
    address: toNullableString(row['address']),
    town: toNullableString(row['town']),
    area: toNullableString(row['area']),
    gham: toNullableString(row['gham']),
    husbandGham: toNullableString(row['husbandGham']),
    fatherGham: toNullableString(row['fatherGham']),
    education: toNullableString(row['education']),
    profession: toNullableString(row['profession']),
    firm: toNullableString(row['firm']),
    remarks: toNullableString(row['remarks']),
    photoUrl: toNullableString(row['photoUrl']),
    cnicFrontUrl: toNullableString(row['cnicFrontUrl']),
    cnicBackUrl: toNullableString(row['cnicBackUrl']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformDonation(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    beneficiaryId: toNullableString(row['beneficiaryId']),
    donorName: toNullableString(row['donorName']),
    donorMobile: toNullableString(row['donorMobile']),
    donationType: row['donationType'],
    customDonationType: toNullableString(row['customDonationType']),
    amount: toFloat(row['amount']),
    paymentMethod: row['paymentMethod'],
    bankAccountId: toNullableString(row['bankAccountId']),
    chequeNumber: toNullableString(row['chequeNumber']),
    donorBankName: toNullableString(row['donorBankName']),
    remarks: toNullableString(row['remarks']),
    status: row['status'] || 'PENDING',
    createdById: toNullableString(row['createdById']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformHallBooking(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    bookingDate: toDate(row['bookingDate']) || new Date(),
    receiptNo: toInt(row['receiptNo']),
    bookerName: row['bookerName'],
    fatherHusbandName: toNullableString(row['fatherHusbandName']),
    address: toNullableString(row['address']),
    mobile: toNullableString(row['mobile']),
    programDate: toDate(row['programDate']) || new Date(),
    programType: toNullableString(row['programType']),
    functionType: toNullableString(row['functionType']),
    timeFrom: toNullableString(row['timeFrom']),
    timeTo: toNullableString(row['timeTo']),
    timings: toNullableString(row['timings']),
    hallId: toNullableString(row['hallId']),
    isForJamaat: toBoolean(row['isForJamaat']),
    hallCharges: toFloat(row['hallCharges']),
    discount: toFloat(row['discount']),
    netAmount: toNullableFloat(row['netAmount']),
    receivedAmount: toNullableFloat(row['receivedAmount']),
    remainingAmount: toNullableFloat(row['remainingAmount']),
    refundAmount: toNullableFloat(row['refundAmount']),
    refundDate: toNullableDate(row['refundDate']),
    refundReason: toNullableString(row['refundReason']),
    paymentMethod: row['paymentMethod'],
    bankAccountId: toNullableString(row['bankAccountId']),
    chequeNumber: toNullableString(row['chequeNumber']),
    chequeBankName: toNullableString(row['chequeBankName']),
    status: row['status'] || 'Confirmed',
    remarks: toNullableString(row['remarks']),
    createdById: toNullableString(row['createdById']),
    journalEntryId: toNullableString(row['journalEntryId']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformRevenueCollection(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    category: row['category'],
    receiptNo: toInt(row['receiptNo']),
    title: row['title'],
    subTitle: toNullableString(row['subTitle']),
    mobile: toNullableString(row['mobile']),
    eventDate: toNullableDate(row['eventDate']),
    quantity: toNullableInt(row['quantity']),
    rate: toNullableFloat(row['rate']),
    destination: toNullableString(row['destination']),
    amount: toFloat(row['amount']),
    paymentMethod: row['paymentMethod'] || 'CASH',
    bankAccountId: toNullableString(row['bankAccountId']),
    chequeNumber: toNullableString(row['chequeNumber']),
    status: row['status'] || 'Confirmed',
    remarks: toNullableString(row['remarks']),
    createdById: toNullableString(row['createdById']),
    journalEntryId: toNullableString(row['journalEntryId']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformMember(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    memberNo: toNullableString(row['memberNo']),
    fullName: row['fullName'],
    fatherName: toNullableString(row['fatherName']),
    cnic: toNullableString(row['cnic']),
    dob: toNullableString(row['dob']),
    address: toNullableString(row['address']),
    mobile: toNullableString(row['mobile']),
    email: toNullableString(row['email']),
    city: toNullableString(row['city']),
    area: toNullableString(row['area']),
    ghamName: toNullableString(row['ghamName']),
    education: toNullableString(row['education']),
    profession: toNullableString(row['profession']),
    company: toNullableString(row['company']),
    doi: toNullableString(row['doi']),
    photoUrl: toNullableString(row['photoUrl']),
    cnicFrontUrl: toNullableString(row['cnicFrontUrl']),
    cnicBackUrl: toNullableString(row['cnicBackUrl']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformFamilyRelationship(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    memberId: row['memberId'],
    relatedMemberId: row['relatedMemberId'],
    relationshipType: row['relationshipType'],
    customLabel: toNullableString(row['customLabel']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformZakatCard(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    memberId: toNullableString(row['memberId']),
    beneficiaryId: toNullableString(row['beneficiaryId']),
    zakatAmount: toFloat(row['zakatAmount']),
    issueDate: toDate(row['issueDate']) || new Date(),
    cardNumber: row['cardNumber'],
    paymentMethod: row['paymentMethod'] || 'CASH',
    bankAccountId: toNullableString(row['bankAccountId']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdById: toNullableString(row['createdById']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformDonor(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    donorCode: row['donorCode'],
    fullName: row['fullName'],
    fatherName: toNullableString(row['fatherName']),
    mobile: toNullableString(row['mobile']),
    cnic: toNullableString(row['cnic']),
    email: toNullableString(row['email']),
    address: toNullableString(row['address']),
    city: toNullableString(row['city']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformDonationReceived(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    receiptNo: row['receiptNo'],
    receiptDate: toDate(row['receiptDate']) || new Date(),
    donorId: row['donorId'],
    donationType: row['donationType'],
    customDonationType: toNullableString(row['customDonationType']),
    amount: toFloat(row['amount']),
    paymentMethod: row['paymentMethod'],
    cashAccountId: toNullableString(row['cashAccountId']),
    bankAccountId: toNullableString(row['bankAccountId']),
    chequeNo: toNullableString(row['chequeNo']),
    chequeDate: toNullableDate(row['chequeDate']),
    referenceNo: toNullableString(row['referenceNo']),
    narration: toNullableString(row['narration']),
    journalEntryId: toNullableString(row['journalEntryId']),
    status: row['status'] || 'POSTED',
    createdById: row['createdById'],
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformIncomeCategory(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    description: toNullableString(row['description']),
    accountId: toNullableString(row['accountId']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformAddIncomeRecord(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    categoryId: row['categoryId'],
    subCategory: toNullableString(row['subCategory']),
    amount: toFloat(row['amount']),
    date: toDate(row['date']) || new Date(),
    paymentMethod: row['paymentMethod'] || 'CASH',
    bankAccountId: toNullableString(row['bankAccountId']),
    referenceNumber: toNullableString(row['referenceNumber']),
    remarks: toNullableString(row['remarks']),
    attachmentUrl: toNullableString(row['attachmentUrl']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdById: toNullableString(row['createdById']),
    status: row['status'] || 'PENDING_POST',
    postedAt: toNullableDate(row['postedAt']),
    postedById: toNullableString(row['postedById']),
    revertedAt: toNullableDate(row['revertedAt']),
    revertedById: toNullableString(row['revertedById']),
    revertReason: toNullableString(row['revertReason']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformSimpleIncome(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    date: toDate(row['date']) || new Date(),
    revenueHeadId: row['revenueHeadId'],
    description: toNullableString(row['description']),
    amount: toFloat(row['amount']),
    paymentMethod: row['paymentMethod'] || 'CASH',
    bankAccountId: toNullableString(row['bankAccountId']),
    reference: toNullableString(row['reference']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdById: toNullableString(row['createdById']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

function transformSimpleExpense(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    date: toDate(row['date']) || new Date(),
    expenseHeadId: row['expenseHeadId'],
    paidTo: toNullableString(row['paidTo']),
    description: toNullableString(row['description']),
    amount: toFloat(row['amount']),
    paymentMethod: row['paymentMethod'] || 'CASH',
    bankAccountId: toNullableString(row['bankAccountId']),
    reference: toNullableString(row['reference']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdById: toNullableString(row['createdById']),
    status: row['status'] || 'PENDING_POST',
    postedAt: toNullableDate(row['postedAt']),
    postedById: toNullableString(row['postedById']),
    revertedAt: toNullableDate(row['revertedAt']),
    revertedById: toNullableString(row['revertedById']),
    revertReason: toNullableString(row['revertReason']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

function transformCustomer(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    name: row['name'],
    email: toNullableString(row['email']),
    phone: toNullableString(row['phone']),
    address: toNullableString(row['address']),
    company: toNullableString(row['company']),
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformInvoice(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    invoiceNo: row['invoiceNo'],
    customerId: row['customerId'],
    issueDate: toDate(row['issueDate']) || new Date(),
    dueDate: toDate(row['dueDate']) || new Date(),
    status: row['status'] || 'DRAFT',
    subtotal: toFloat(row['subtotal']),
    discount: toFloat(row['discount']),
    tax: toFloat(row['tax']),
    total: toFloat(row['total']),
    paymentMethod: toNullableString(row['paymentMethod']),
    bankAccountId: toNullableString(row['bankAccountId']),
    chequeNumber: toNullableString(row['chequeNumber']),
    remarks: toNullableString(row['remarks']),
    createdById: toNullableString(row['createdById']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformInvoiceItem(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    invoiceId: row['invoiceId'],
    description: row['description'],
    quantity: toFloat(row['quantity']),
    unitPrice: toFloat(row['unitPrice']),
    amount: toFloat(row['amount']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformReservedCode(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    reserveStart: row['reserveStart'],
    reserveEnd: row['reserveEnd'],
    reserveReason: row['reserveReason'],
    isActive: toBoolean(row['isActive']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformFinancialYear(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    code: row['code'],
    name: row['name'],
    startDate: toDate(row['startDate']) || new Date(),
    endDate: toDate(row['endDate']) || new Date(),
    isClosed: toBoolean(row['isClosed']),
    closedAt: toNullableDate(row['closedAt']),
    closedById: toNullableString(row['closedById']),
    reopenedAt: toNullableDate(row['reopenedAt']),
    reopenedById: toNullableString(row['reopenedById']),
    closingNotes: toNullableString(row['closingNotes']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformOpeningBalanceBatch(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    openingDate: toDate(row['openingDate']) || new Date(),
    financialYear: row['financialYear'],
    sourceFinancialYear: toNullableString(row['sourceFinancialYear']),
    sourceClosingDate: toNullableDate(row['sourceClosingDate']),
    isAutoRolled: toBoolean(row['isAutoRolled']),
    adjustmentReason: toNullableString(row['adjustmentReason']),
    adjustedById: toNullableString(row['adjustedById']),
    adjustedAt: toNullableDate(row['adjustedAt']),
    status: row['status'] || 'Posted',
    journalEntryId: row['journalEntryId'],
    createdBy: row['createdBy'],
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformOpeningBalanceLine(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    batchId: row['batchId'],
    accountId: row['accountId'],
    glCode: toNullableString(row['glCode']),
    debitCredit: row['debitCredit'] || 'DEBIT',
    amount: toFloat(row['amount']),
    sourceClosingBalance: toNullableFloat(row['sourceClosingBalance']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformPettyCashConfig(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    accountId: row['accountId'],
    fundLimit: toFloat(row['fundLimit']),
    custodianName: row['custodianName'] || 'Authorized Custodian',
    status: row['status'] || 'ACTIVE',
    remarks: toNullableString(row['remarks']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformPettyCashTransaction(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    voucherNo: row['voucherNo'],
    transactionType: row['transactionType'],
    pettyCashAccountId: row['pettyCashAccountId'],
    sourceAccountId: toNullableString(row['sourceAccountId']),
    expenseAccountId: toNullableString(row['expenseAccountId']),
    expenseHeadId: toNullableString(row['expenseHeadId']),
    amount: toFloat(row['amount']),
    date: toDate(row['date']) || new Date(),
    paidTo: toNullableString(row['paidTo']),
    referenceNo: toNullableString(row['referenceNo']),
    narration: toNullableString(row['narration']),
    attachmentUrl: toNullableString(row['attachmentUrl']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdById: row['createdById'],
    postedAt: toNullableDate(row['postedAt']),
    postedById: toNullableString(row['postedById']),
    revertedAt: toNullableDate(row['revertedAt']),
    revertedById: toNullableString(row['revertedById']),
    revertReason: toNullableString(row['revertReason']),
    isDeleted: toBoolean(row['isDeleted']),
    deletedAt: toNullableDate(row['deletedAt']),
    deletedBy: toNullableString(row['deletedBy']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformPettyCashReconciliation(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    pettyCashAccountId: row['pettyCashAccountId'],
    reconciliationDate: toDate(row['reconciliationDate']) || new Date(),
    systemBalance: toFloat(row['systemBalance']),
    physicalCount: toFloat(row['physicalCount']),
    difference: toFloat(row['difference']),
    explanation: toNullableString(row['explanation']),
    status: row['status'] || 'PENDING_APPROVAL',
    reconciledById: row['reconciledById'],
    approvedById: toNullableString(row['approvedById']),
    approvedAt: toNullableDate(row['approvedAt']),
    journalEntryId: toNullableString(row['journalEntryId']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformAiRepairIssue(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    type: row['type'],
    severity: row['severity'],
    description: row['description'],
    entityRef: toNullableString(row['entityRef']),
    currentValue: toNullableFloat(row['currentValue']),
    expectedValue: toNullableFloat(row['expectedValue']),
    difference: toNullableFloat(row['difference']),
    affectedRecords: toJson(row['affectedRecords']),
    status: row['status'] || 'OPEN',
    detectedAt: toDate(row['detectedAt']) || new Date(),
    lastSeenAt: toDate(row['lastSeenAt']) || new Date(),
    resolvedAt: toNullableDate(row['resolvedAt']),
    aiRootCause: toNullableString(row['aiRootCause']),
    aiExplanation: toNullableString(row['aiExplanation']),
    aiConfidence: toNullableFloat(row['aiConfidence']),
    aiRiskLevel: toNullableString(row['aiRiskLevel']),
    aiProposedRepairType: toNullableString(row['aiProposedRepairType']),
    aiProposedChange: toJson(row['aiProposedChange']),
    aiModel: toNullableString(row['aiModel']),
    aiAnalyzedAt: toNullableDate(row['aiAnalyzedAt']),
    createdAt: toDate(row['createdAt']) || new Date(),
    updatedAt: toDate(row['updatedAt']) || new Date(),
  };
}

function transformAiRepairLog(row: Record<string, string>): Record<string, any> {
  return {
    _id: row['id'],
    issueId: toNullableString(row['issueId']),
    userId: toNullableString(row['userId']),
    action: row['action'],
    issueType: row['issueType'],
    repairType: row['repairType'],
    rootCause: toNullableString(row['rootCause']),
    aiRecommendation: toJson(row['aiRecommendation']),
    oldValue: toJson(row['oldValue']),
    newValue: toJson(row['newValue']),
    affectedRecords: toJson(row['affectedRecords']),
    riskLevel: row['riskLevel'],
    approvalStatus: row['approvalStatus'],
    approvedById: toNullableString(row['approvedById']),
    beforeCheckResult: toJson(row['beforeCheckResult']),
    afterCheckResult: toJson(row['afterCheckResult']),
    rollbackStatus: row['rollbackStatus'] || 'NOT_NEEDED',
    success: toBoolean(row['success']),
    errorMessage: toNullableString(row['errorMessage']),
    createdAt: toDate(row['createdAt']) || new Date(),
  };
}

// ─── JSON Backup Transformer (keeps MongoDB documents as-is) ─────────────────

/**
 * Convert a JSON backup record to a MongoDB-ready document.
 * The JSON backup already has the correct structure; we just ensure
 * _id is set and Date fields are proper Date objects.
 */
function normalizeJsonRecord(record: Record<string, any>): Record<string, any> {
  const doc: Record<string, any> = { ...record };

  // Ensure _id is set from id field
  if (!doc._id && doc.id) {
    doc._id = doc.id;
  }
  delete doc.id; // MongoDB uses _id

  // Convert ISO date strings to Date objects
  for (const [key, val] of Object.entries(doc)) {
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      doc[key] = new Date(val);
    }
  }

  return doc;
}

// ─── Data Merge: SQL + JSON ───────────────────────────────────────────────────

/**
 * Merge SQL-parsed rows and JSON backup records for a table.
 * - Deduplicates by _id
 * - SQL records win on conflict (newer data)
 */
function mergeRecords(
  sqlDocs: Record<string, any>[],
  jsonDocs: Record<string, any>[]
): Record<string, any>[] {
  const map = new Map<string, Record<string, any>>();

  // JSON backup first (lower priority)
  for (const doc of jsonDocs) {
    const id = doc._id || doc.id;
    if (id) map.set(String(id), normalizeJsonRecord(doc));
  }

  // SQL records override (higher priority — newer)
  for (const doc of sqlDocs) {
    const id = doc._id;
    if (id) map.set(String(id), doc);
  }

  return Array.from(map.values());
}

// ─── MongoDB Upsert ──────────────────────────────────────────────────────────

/**
 * Bulk upsert documents into a MongoDB collection.
 * Uses replaceOne + upsert:true for idempotency.
 */
async function upsertCollection(
  db: Db,
  collectionName: string,
  docs: Record<string, any>[]
): Promise<number> {
  if (docs.length === 0) return 0;

  const collection = db.collection(collectionName);
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const ops = batch.map(doc => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(ops, { ordered: false });
    inserted += result.upsertedCount + result.modifiedCount;
  }

  return inserted;
}

// ─── Migration Pipeline ───────────────────────────────────────────────────────

interface CollectionDef {
  table: string;        // SQL table name
  collection: string;   // MongoDB collection name (Prisma uses same name lowercase)
  transform: (row: Record<string, string>) => Record<string, any>;
}

// Ordered by dependency (parents before children)
const COLLECTION_DEFS: CollectionDef[] = [
  { table: 'AccountType',             collection: 'AccountType',             transform: transformAccountType },
  { table: 'Role',                    collection: 'Role',                    transform: transformRole },
  { table: 'Permission',              collection: 'Permission',              transform: transformPermission },
  { table: 'RolePermission',          collection: 'RolePermission',          transform: transformRolePermission },
  { table: 'User',                    collection: 'User',                    transform: transformUser },
  { table: 'RefreshToken',            collection: 'RefreshToken',            transform: transformRefreshToken },
  { table: 'Account',                 collection: 'Account',                 transform: transformAccount },
  { table: 'ReservedCode',            collection: 'ReservedCode',            transform: transformReservedCode },
  { table: 'RevenueHead',             collection: 'RevenueHead',             transform: transformRevenueHead },
  { table: 'ExpenseHead',             collection: 'ExpenseHead',             transform: transformExpenseHead },
  { table: 'IncomeCategory',          collection: 'IncomeCategory',          transform: transformIncomeCategory },
  { table: 'FinancialYear',           collection: 'FinancialYear',           transform: transformFinancialYear },
  { table: 'JournalEntry',            collection: 'JournalEntry',            transform: transformJournalEntry },
  { table: 'JournalEntryLine',        collection: 'JournalEntryLine',        transform: transformJournalEntryLine },
  { table: 'OpeningBalanceBatch',     collection: 'OpeningBalanceBatch',     transform: transformOpeningBalanceBatch },
  { table: 'OpeningBalanceLine',      collection: 'OpeningBalanceLine',      transform: transformOpeningBalanceLine },
  { table: 'HallBooking',             collection: 'HallBooking',             transform: transformHallBooking },
  { table: 'RevenueCollection',       collection: 'RevenueCollection',       transform: transformRevenueCollection },
  { table: 'AddIncomeRecord',         collection: 'AddIncomeRecord',         transform: transformAddIncomeRecord },
  { table: 'Beneficiary',             collection: 'Beneficiary',             transform: transformBeneficiary },
  { table: 'Member',                  collection: 'Member',                  transform: transformMember },
  { table: 'FamilyRelationship',      collection: 'FamilyRelationship',      transform: transformFamilyRelationship },
  { table: 'Donor',                   collection: 'Donor',                   transform: transformDonor },
  { table: 'DonationReceived',        collection: 'DonationReceived',        transform: transformDonationReceived },
  { table: 'Donation',               collection: 'Donation',                transform: transformDonation },
  { table: 'ZakatCard',              collection: 'ZakatCard',               transform: transformZakatCard },
  { table: 'Customer',               collection: 'Customer',                transform: transformCustomer },
  { table: 'Invoice',                collection: 'Invoice',                  transform: transformInvoice },
  { table: 'InvoiceItem',            collection: 'InvoiceItem',             transform: transformInvoiceItem },
  { table: 'SimpleIncome',           collection: 'SimpleIncome',            transform: transformSimpleIncome },
  { table: 'SimpleExpense',          collection: 'SimpleExpense',           transform: transformSimpleExpense },
  { table: 'PettyCashConfig',        collection: 'PettyCashConfig',         transform: transformPettyCashConfig },
  { table: 'PettyCashTransaction',   collection: 'PettyCashTransaction',    transform: transformPettyCashTransaction },
  { table: 'PettyCashReconciliation',collection: 'PettyCashReconciliation', transform: transformPettyCashReconciliation },
  { table: 'AiRepairIssue',          collection: 'AiRepairIssue',           transform: transformAiRepairIssue },
  { table: 'AiRepairLog',            collection: 'AiRepairLog',             transform: transformAiRepairLog },
  { table: 'AuditLog',               collection: 'AuditLog',                transform: transformAuditLog },
];

// ─── Validation ───────────────────────────────────────────────────────────────

async function runOrphanChecks(db: Db): Promise<void> {
  console.log('\n🔍 Running orphan reference checks...');

  const checks = [
    {
      check: 'User.roleId → Role._id',
      pipeline: async () => {
        const roleIds = await db.collection('Role').distinct('_id');
        const roleIdSet = new Set(roleIds.map(String));
        const users = await db.collection('User').find({ isDeleted: false }).toArray();
        const broken = users.filter(u => u.roleId && !roleIdSet.has(String(u.roleId)));
        return { total: users.length, broken: broken.length };
      }
    },
    {
      check: 'Account.parentId → Account._id',
      pipeline: async () => {
        const accountIds = await db.collection('Account').distinct('_id');
        const accountIdSet = new Set(accountIds.map(String));
        const accs = await db.collection('Account').find({ parentId: { $ne: null } }).toArray();
        const broken = accs.filter(a => a.parentId && !accountIdSet.has(String(a.parentId)));
        return { total: accs.length, broken: broken.length };
      }
    },
    {
      check: 'JournalEntryLine.journalEntryId → JournalEntry._id',
      pipeline: async () => {
        const jeIds = await db.collection('JournalEntry').distinct('_id');
        const jeIdSet = new Set(jeIds.map(String));
        const lines = await db.collection('JournalEntryLine').find({}).toArray();
        const broken = lines.filter(l => !jeIdSet.has(String(l.journalEntryId)));
        return { total: lines.length, broken: broken.length };
      }
    },
    {
      check: 'JournalEntryLine.accountId → Account._id',
      pipeline: async () => {
        const accountIds = await db.collection('Account').distinct('_id');
        const accountIdSet = new Set(accountIds.map(String));
        const lines = await db.collection('JournalEntryLine').find({}).toArray();
        const broken = lines.filter(l => !accountIdSet.has(String(l.accountId)));
        return { total: lines.length, broken: broken.length };
      }
    },
    {
      check: 'HallBooking.createdById → User._id',
      pipeline: async () => {
        const userIds = await db.collection('User').distinct('_id');
        const userIdSet = new Set(userIds.map(String));
        const bookings = await db.collection('HallBooking').find({ createdById: { $ne: null }, isDeleted: false }).toArray();
        const broken = bookings.filter(b => b.createdById && !userIdSet.has(String(b.createdById)));
        return { total: bookings.length, broken: broken.length };
      }
    },
    {
      check: 'AuditLog.userId → User._id (nullable)',
      pipeline: async () => {
        const userIds = await db.collection('User').distinct('_id');
        const userIdSet = new Set(userIds.map(String));
        const logs = await db.collection('AuditLog').find({ userId: { $ne: null } }).toArray();
        const broken = logs.filter(l => l.userId && !userIdSet.has(String(l.userId)));
        return { total: logs.length, broken: broken.length };
      }
    },
    {
      check: 'RolePermission.roleId → Role._id',
      pipeline: async () => {
        const roleIds = await db.collection('Role').distinct('_id');
        const roleIdSet = new Set(roleIds.map(String));
        const rps = await db.collection('RolePermission').find({}).toArray();
        const broken = rps.filter(rp => !roleIdSet.has(String(rp.roleId)));
        return { total: rps.length, broken: broken.length };
      }
    },
    {
      check: 'RolePermission.permissionId → Permission._id',
      pipeline: async () => {
        const permIds = await db.collection('Permission').distinct('_id');
        const permIdSet = new Set(permIds.map(String));
        const rps = await db.collection('RolePermission').find({}).toArray();
        const broken = rps.filter(rp => !permIdSet.has(String(rp.permissionId)));
        return { total: rps.length, broken: broken.length };
      }
    },
  ];

  for (const { check, pipeline } of checks) {
    try {
      const { total, broken } = await pipeline();
      const status = broken === 0 ? 'PASS' : 'FAIL';
      const icon = status === 'PASS' ? '  ✅' : '  ❌';
      console.log(`${icon} ${check}: ${total - broken}/${total} valid (${broken} broken) — ${status}`);
      report.orphanChecks.push({ check, broken, total, status });
    } catch (err) {
      console.log(`  ⚠️  ${check}: error — ${err}`);
      report.orphanChecks.push({ check, broken: -1, total: 0, status: 'FAIL' });
    }
  }
}

async function runFinancialCheck(db: Db): Promise<void> {
  console.log('\n💰 Running financial integrity check (debit = credit)...');

  try {
    const lines = await db.collection('JournalEntryLine').find({}).toArray();
    let debitTotal = 0;
    let creditTotal = 0;

    for (const line of lines) {
      debitTotal += typeof line.debit === 'number' ? line.debit : parseFloat(String(line.debit || 0));
      creditTotal += typeof line.credit === 'number' ? line.credit : parseFloat(String(line.credit || 0));
    }

    const difference = Math.abs(debitTotal - creditTotal);
    const status: 'PASS' | 'FAIL' = difference < 0.01 ? 'PASS' : 'FAIL';

    report.financialCheck = { debitTotal, creditTotal, difference, status };

    console.log(`  Total Debits:  PKR ${debitTotal.toFixed(2)}`);
    console.log(`  Total Credits: PKR ${creditTotal.toFixed(2)}`);
    console.log(`  Difference:    PKR ${difference.toFixed(2)}`);
    console.log(`  Status: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL (unbalanced ledger)'}`);
  } catch (err) {
    console.error('  ⚠️  Financial check error:', err);
    report.financialCheck.status = 'FAIL';
  }
}

// ─── Final Report ─────────────────────────────────────────────────────────────

function printAndSaveReport(): void {
  report.completedAt = new Date().toISOString();
  report.totalSourceRecords = report.collections.reduce((a, c) => a + c.mergedRecords, 0);
  report.totalMigratedRecords = report.collections.reduce((a, c) => a + c.insertedRecords, 0);

  const hasFailedCollection = report.collections.some(c => c.status === 'FAIL');
  const hasFailedOrphan = report.orphanChecks.some(c => c.status === 'FAIL');
  const hasFailedFinancial = report.financialCheck.status === 'FAIL';

  if (hasFailedCollection || hasFailedOrphan || hasFailedFinancial) {
    report.finalStatus = 'MIGRATION FAILED';
  }

  console.log('\n');
  console.log('═'.repeat(70));
  console.log('                  DATABASE MIGRATION REPORT');
  console.log('═'.repeat(70));
  console.log(`Source:           kmlwj.sql + db-backup JSON`);
  console.log(`Target:           MongoDB Atlas (${DB_NAME})`);
  console.log(`Started:          ${report.startedAt}`);
  console.log(`Completed:        ${report.completedAt}`);
  console.log('─'.repeat(70));
  console.log(`Tables discovered:    ${report.collections.length}`);
  console.log(`Total source records: ${report.totalSourceRecords}`);
  console.log(`Total migrated docs:  ${report.totalMigratedRecords}`);
  console.log('─'.repeat(70));
  console.log('  COLLECTION RESULTS:');
  for (const c of report.collections) {
    const icon = c.status === 'PASS' ? '✅' : c.status === 'SKIP' ? '⬜' : '❌';
    console.log(`  ${icon} ${c.collection.padEnd(28)} SQL:${c.sqlRecords.toString().padStart(4)}  JSON:${c.jsonRecords.toString().padStart(4)}  Merged:${c.mergedRecords.toString().padStart(4)}  Saved:${c.insertedRecords.toString().padStart(4)}  ${c.status}`);
  }
  console.log('─'.repeat(70));
  console.log('  ORPHAN CHECKS:');
  for (const c of report.orphanChecks) {
    const icon = c.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${c.check.padEnd(42)} Broken: ${c.broken}/${c.total}  ${c.status}`);
  }
  console.log('─'.repeat(70));
  console.log('  FINANCIAL CHECK:');
  console.log(`  Debit Total:  PKR ${report.financialCheck.debitTotal.toFixed(2)}`);
  console.log(`  Credit Total: PKR ${report.financialCheck.creditTotal.toFixed(2)}`);
  console.log(`  Difference:   PKR ${report.financialCheck.difference.toFixed(2)}`);
  console.log(`  Status: ${report.financialCheck.status}`);
  console.log('─'.repeat(70));
  console.log(`\n  🏁 FINAL STATUS: ${report.finalStatus}`);
  console.log('═'.repeat(70));

  // Save report
  const reportPath = path.join(BACKUP_DIR, `migration-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      KMLWJ ERP — MongoDB Database Restore Script                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Started at: ${new Date().toISOString()}`);

  // ── 1. Parse SQL file
  let sqlData: Map<string, TableData>;
  try {
    sqlData = parseSqlFile(SQL_FILE);
  } catch (err) {
    console.error('❌ Failed to parse SQL file:', err);
    process.exit(1);
  }

  // ── 2. Load JSON backup
  let jsonData: Map<string, Record<string, any>[]>;
  try {
    jsonData = loadJsonBackup();
  } catch (err) {
    console.warn('⚠️  Failed to load JSON backup (continuing with SQL only):', err);
    jsonData = new Map();
  }

  // ── 3. Connect to MongoDB
  console.log('\n🔌 Connecting to MongoDB Atlas...');
  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`  ✅ Connected to database: ${DB_NAME}`);

    // Ping test
    await db.command({ ping: 1 });
    console.log('  ✅ Ping successful');

    // ── 4. Migrate each collection
    console.log('\n📥 Starting collection migration...\n');

    for (const def of COLLECTION_DEFS) {
      const sqlTable = sqlData.get(def.table);
      const jsonTable = jsonData.get(def.table) || [];

      // Transform SQL rows
      const sqlDocs: Record<string, any>[] = [];
      if (sqlTable) {
        for (const row of sqlTable.rows) {
          try {
            const doc = def.transform(row);
            if (doc._id) sqlDocs.push(doc);
          } catch (err) {
            console.warn(`  ⚠️  ${def.table}: transform error on row ${row['id']}: ${err}`);
          }
        }
      }

      // Normalize JSON records
      const jsonDocs = jsonTable.map(r => ({ ...r }));

      // Merge
      const merged = mergeRecords(sqlDocs, jsonDocs);

      if (merged.length === 0) {
        console.log(`  ⬜ ${def.collection.padEnd(28)} — 0 records (empty table)`);
        report.collections.push({
          collection: def.collection,
          sqlRecords: sqlDocs.length,
          jsonRecords: jsonDocs.length,
          mergedRecords: 0,
          insertedRecords: 0,
          status: 'SKIP',
        });
        continue;
      }

      // Upsert
      try {
        const inserted = await upsertCollection(db, def.collection, merged);
        const mongoCount = await db.collection(def.collection).countDocuments();
        const status: 'PASS' | 'FAIL' = mongoCount >= merged.length ? 'PASS' : 'FAIL';
        const icon = status === 'PASS' ? '✅' : '❌';

        console.log(`  ${icon} ${def.collection.padEnd(28)} SQL:${sqlDocs.length.toString().padStart(4)}  JSON:${jsonDocs.length.toString().padStart(4)}  Merged:${merged.length.toString().padStart(4)}  Saved:${mongoCount.toString().padStart(4)}  ${status}`);

        report.collections.push({
          collection: def.collection,
          sqlRecords: sqlDocs.length,
          jsonRecords: jsonDocs.length,
          mergedRecords: merged.length,
          insertedRecords: mongoCount,
          status,
        });
      } catch (err) {
        console.error(`  ❌ ${def.collection}: upsert error — ${err}`);
        report.collections.push({
          collection: def.collection,
          sqlRecords: sqlDocs.length,
          jsonRecords: jsonDocs.length,
          mergedRecords: merged.length,
          insertedRecords: 0,
          status: 'FAIL',
          error: String(err),
        });
      }
    }

    // ── 5. Orphan checks
    await runOrphanChecks(db);

    // ── 6. Financial integrity
    await runFinancialCheck(db);

  } finally {
    await client.close();
    console.log('\n🔌 MongoDB connection closed.');
  }

  // ── 7. Print report
  printAndSaveReport();

  if (report.finalStatus === 'MIGRATION FAILED') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n💥 Fatal migration error:', err);
  process.exit(1);
});

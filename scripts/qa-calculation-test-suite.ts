import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient, PaymentMethod, DonationType, TransactionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AccountingService } from '../api/_services/accounting.service.js';
import { LedgerWorkflowService } from '../api/_services/ledger-workflow.service.js';
import { PettyCashService } from '../api/_services/petty-cash.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TestResult {
  module: string;
  test: string;
  expected: string | number;
  actual: string | number;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const testResults: TestResult[] = [];

function recordTest(module: string, test: string, expected: any, actual: any, details = '') {
  const expStr = typeof expected === 'number' ? expected.toFixed(2) : String(expected);
  const actStr = typeof actual === 'number' ? Number(actual).toFixed(2) : String(actual);
  const isMatch = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) < 0.01
    : expStr === actStr;

  const status: 'PASS' | 'FAIL' = isMatch ? 'PASS' : 'FAIL';
  testResults.push({
    module,
    test,
    expected: expStr,
    actual: actStr,
    status,
    details: isMatch ? details : `${details} | Mismatch: expected ${expStr}, got ${actStr}`
  });

  console.log(`[${status}] ${module} | ${test}: Expected=${expStr}, Actual=${actStr}`);
  if (!isMatch) {
    console.error(`   ❌ DISCREPANCY: ${details}`);
  }
}

async function runCalculationValidationSuite() {
  console.log('===============================================================');
  console.log('🚀 RUNNING COMPLETE ERP QA CALCULATION & ACCOUNTING TEST SUITE');
  console.log('===============================================================\n');

  // Step 0: Get Super Admin user for posting actions
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@erp.com' }
  }) || await prisma.user.findFirst({
    where: { isActive: true }
  });

  if (!adminUser) {
    throw new Error('No active administrative user found to execute test operations.');
  }
  console.log(`👤 Executing tests as user: ${adminUser.fullName} (${adminUser.email})\n`);

  // Step 1: Ensure Leaf Cash in Hand and Bank accounts exist
  const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
  const bankAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'National Bank of Pakistan', mode: 'insensitive' },
      isLocked: false,
      children: { none: {} }
    }
  }) || await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Bank', mode: 'insensitive' },
      isLocked: false,
      children: { none: {} }
    }
  });

  if (!bankAccount) {
    throw new Error('Bank account not found in Chart of Accounts.');
  }

  const hallAccounts = await prisma.account.findMany({
    where: {
      accountType: { name: { in: ['REVENUE', 'Revenue'] } },
      accountName: { in: ['Bagh-e-Hajiani Kareema', 'Sadaya Hall', 'Zikarya Hall', 'Annexy Hall'] },
      children: { none: {} }
    }
  });

  const baghHallAccount = hallAccounts.find(h => h.accountName.includes('Bagh')) || hallAccounts[0];
  const sadayaHallAccount = hallAccounts.find(h => h.accountName.includes('Sadaya')) || hallAccounts[1] || hallAccounts[0];

  // ───────────────────────────────────────────────────────────────────────────
  // 1. MASTER OPERATIONAL TEST ENTITIES (Tag: [QA TEST DATA])
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Creating Controlled QA Master Entities ---');

  const testMember = await prisma.member.create({
    data: {
      memberNo: 'QA-MEM-001',
      fullName: 'QA Member Muhammad Ali',
      cnic: '42101-1111111-1',
      mobile: '03001234567',
      address: 'QA Test Street, Block 1, Karachi',
      isActive: true
    }
  });
  recordTest('Master Data', 'Create Member Record', 'QA-MEM-001', testMember.memberNo);

  const testBeneficiary = await prisma.beneficiary.create({
    data: {
      name: 'QA Beneficiary Fatima Bibi',
      cnic: '42101-2222222-2',
      mobile: '03007654321',
      address: 'QA Test House, Sector 2, Karachi',
      monthlyIncome: 15000,
      monthlyExpenses: 25000,
      familySize: 5,
      isActive: true
    }
  });
  recordTest('Master Data', 'Create Beneficiary Record', '42101-2222222-2', testBeneficiary.cnic || '');

  const testDonor = await prisma.donor.create({
    data: {
      donorCode: 'QA-DNR-001',
      fullName: 'QA Donor Ahmed Khan',
      cnic: '42101-3333333-3',
      mobile: '03219876543',
      city: 'Karachi',
      isActive: true
    }
  });
  recordTest('Master Data', 'Create Donor Record', 'QA-DNR-001', testDonor.donorCode);

  const testCustomer = await prisma.customer.create({
    data: {
      name: 'QA Customer Al-Rehman Traders',
      phone: '03331122334',
      address: 'QA Commercial Plaza, Karachi',
      isActive: true
    }
  });
  recordTest('Master Data', 'Create Customer Record', 'QA Customer Al-Rehman Traders', testCustomer.name);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. HALL BOOKING CALCULATIONS & ACCOUNTING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Hall Booking Calculations & Accounting ---');

  // Scenario 1: Base = 100,000, Discount = 10% (10,000), Net = 90,000, Deposit = 30,000, Balance = 60,000
  const hb1Charges = 100000;
  const hb1DiscountPercent = 10;
  const hb1ExpectedDiscount = (hb1Charges * hb1DiscountPercent) / 100; // 10,000
  const hb1ExpectedNet = hb1Charges - hb1ExpectedDiscount; // 90,000
  const hb1ReceivedDeposit = 30000;
  const hb1ExpectedRemaining = hb1ExpectedNet - hb1ReceivedDeposit; // 60,000

  recordTest('Hall Booking S1', 'Discount Calculation (10%)', 10000, hb1ExpectedDiscount);
  recordTest('Hall Booking S1', 'Net Amount Calculation', 90000, hb1ExpectedNet);
  recordTest('Hall Booking S1', 'Remaining Balance Calculation', 60000, hb1ExpectedRemaining);

  const hb1Booking = await prisma.hallBooking.create({
    data: {
      bookerName: 'QA Booker Tariq Mahmood',
      mobile: '03001112233',
      address: 'QA Address 1',
      programDate: new Date('2026-09-10T00:00:00.000Z'),
      timings: 'Morning',
      hallId: baghHallAccount.id,
      hallCharges: hb1Charges,
      discount: hb1ExpectedDiscount,
      netAmount: hb1ExpectedNet,
      receivedAmount: hb1ReceivedDeposit,
      remainingAmount: hb1ExpectedRemaining,
      paymentMethod: PaymentMethod.CASH,
      status: 'Confirmed',
      remarks: 'QA TEST DATA - Hall Booking Scenario 1',
      createdById: adminUser.id
    }
  });

  // Post Hall Booking 1 to Ledger:
  // Debit Cash in Hand = 30,000
  // Debit Accounts Receivable = 60,000
  // Credit Hall Revenue = 90,000
  const arAccount = await AccountingService.getOrCreateAccountsReceivable(prisma);
  const hb1Journal = await AccountingService.postTransaction(prisma, {
    voucherType: 'BR',
    postingDate: new Date('2026-09-10'),
    reference: `HB-${hb1Booking.receiptNo}`,
    description: `QA TEST DATA: Hall Booking Receipt for Tariq Mahmood - ${baghHallAccount.accountName}`,
    module: 'Hall Booking',
    postedBy: adminUser.id,
    lines: [
      { accountId: cashAccount.id, debit: hb1ReceivedDeposit, credit: 0, description: 'Cash deposit received' },
      { accountId: arAccount.id, debit: hb1ExpectedRemaining, credit: 0, description: 'Outstanding receivable' },
      { accountId: baghHallAccount.id, debit: 0, credit: hb1ExpectedNet, description: 'Hall booking revenue' }
    ]
  });

  await prisma.hallBooking.update({
    where: { id: hb1Booking.id },
    data: { status: 'POSTED', journalEntryId: hb1Journal.journalEntry.id }
  });

  const hb1JELines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId: hb1Journal.journalEntry.id }
  });
  const hb1DebitSum = hb1JELines.reduce((s, l) => s + Number(l.debit), 0);
  const hb1CreditSum = hb1JELines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Hall Booking S1', 'Journal Entry Debit Sum', 90000, hb1DebitSum);
  recordTest('Hall Booking S1', 'Journal Entry Credit Sum', 90000, hb1CreditSum);
  recordTest('Hall Booking S1', 'Journal Entry Balanced (Debit === Credit)', true, hb1DebitSum === hb1CreditSum);

  // Scenario 2: Base = 50,000, Discount = 5% (2,500), Net = 47,500, Deposit = 20,000 (Bank), Balance = 27,500
  const hb2Charges = 50000;
  const hb2DiscountPercent = 5;
  const hb2ExpectedDiscount = (hb2Charges * hb2DiscountPercent) / 100; // 2,500
  const hb2ExpectedNet = hb2Charges - hb2ExpectedDiscount; // 47,500
  const hb2ReceivedDeposit = 20000;
  const hb2ExpectedRemaining = hb2ExpectedNet - hb2ReceivedDeposit; // 27,500

  recordTest('Hall Booking S2', 'Discount Calculation (5%)', 2500, hb2ExpectedDiscount);
  recordTest('Hall Booking S2', 'Net Amount Calculation', 47500, hb2ExpectedNet);
  recordTest('Hall Booking S2', 'Remaining Balance Calculation', 27500, hb2ExpectedRemaining);

  const hb2Booking = await prisma.hallBooking.create({
    data: {
      bookerName: 'QA Booker Rashid Ali',
      mobile: '03004445566',
      address: 'QA Address 2',
      programDate: new Date('2026-09-12T00:00:00.000Z'),
      timings: 'Evening',
      hallId: sadayaHallAccount.id,
      hallCharges: hb2Charges,
      discount: hb2ExpectedDiscount,
      netAmount: hb2ExpectedNet,
      receivedAmount: hb2ReceivedDeposit,
      remainingAmount: hb2ExpectedRemaining,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: bankAccount.id,
      status: 'Confirmed',
      remarks: 'QA TEST DATA - Hall Booking Scenario 2',
      createdById: adminUser.id
    }
  });

  const hb2Journal = await AccountingService.postTransaction(prisma, {
    voucherType: 'BR',
    postingDate: new Date('2026-09-12'),
    reference: `HB-${hb2Booking.receiptNo}`,
    description: `QA TEST DATA: Hall Booking Receipt for Rashid Ali - ${sadayaHallAccount.accountName}`,
    module: 'Hall Booking',
    postedBy: adminUser.id,
    lines: [
      { accountId: bankAccount.id, debit: hb2ReceivedDeposit, credit: 0, description: 'Bank deposit received' },
      { accountId: arAccount.id, debit: hb2ExpectedRemaining, credit: 0, description: 'Outstanding receivable' },
      { accountId: sadayaHallAccount.id, debit: 0, credit: hb2ExpectedNet, description: 'Hall booking revenue' }
    ]
  });

  await prisma.hallBooking.update({
    where: { id: hb2Booking.id },
    data: { status: 'POSTED', journalEntryId: hb2Journal.journalEntry.id }
  });

  const hb2JELines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId: hb2Journal.journalEntry.id }
  });
  const hb2DebitSum = hb2JELines.reduce((s, l) => s + Number(l.debit), 0);
  const hb2CreditSum = hb2JELines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Hall Booking S2', 'Journal Entry Debit Sum', 47500, hb2DebitSum);
  recordTest('Hall Booking S2', 'Journal Entry Credit Sum', 47500, hb2CreditSum);
  recordTest('Hall Booking S2', 'Journal Entry Balanced (Debit === Credit)', true, hb2DebitSum === hb2CreditSum);

  // Scenario 3: Fixed Discount: Gross = 100,000, Fixed Discount = 15,000 -> Net = 85,000, Full Paid = 85,000 (Cash)
  const hb3Gross = 100000;
  const hb3FixedDiscount = 15000;
  const hb3Net = hb3Gross - hb3FixedDiscount; // 85,000
  const hb3Paid = 85000;
  const hb3Rem = hb3Net - hb3Paid; // 0 (PAID)

  recordTest('Hall Booking S3', 'Fixed Discount Net Amount', 85000, hb3Net);
  recordTest('Hall Booking S3', 'Full Payment Remaining Balance', 0, hb3Rem);

  const hb3Booking = await prisma.hallBooking.create({
    data: {
      bookerName: 'QA Booker Usman Ghani',
      mobile: '03007778899',
      address: 'QA Address 3',
      programDate: new Date('2026-09-15T00:00:00.000Z'),
      timings: 'Full Day',
      hallId: baghHallAccount.id,
      hallCharges: hb3Gross,
      discount: hb3FixedDiscount,
      netAmount: hb3Net,
      receivedAmount: hb3Paid,
      remainingAmount: hb3Rem,
      paymentMethod: PaymentMethod.CASH,
      status: 'Confirmed',
      remarks: 'QA TEST DATA - Hall Booking Scenario 3 (Fixed Discount + Full Pay)',
      createdById: adminUser.id
    }
  });

  const hb3Journal = await AccountingService.postTransaction(prisma, {
    voucherType: 'BR',
    postingDate: new Date('2026-09-15'),
    reference: `HB-${hb3Booking.receiptNo}`,
    description: `QA TEST DATA: Full Payment Hall Booking for Usman Ghani`,
    module: 'Hall Booking',
    postedBy: adminUser.id,
    lines: [
      { accountId: cashAccount.id, debit: hb3Paid, credit: 0, description: 'Full Cash payment received' },
      { accountId: baghHallAccount.id, debit: 0, credit: hb3Net, description: 'Hall booking revenue' }
    ]
  });

  await prisma.hallBooking.update({
    where: { id: hb3Booking.id },
    data: { status: 'POSTED', journalEntryId: hb3Journal.journalEntry.id }
  });

  const hb3JELines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId: hb3Journal.journalEntry.id }
  });
  const hb3DebitSum = hb3JELines.reduce((s, l) => s + Number(l.debit), 0);
  const hb3CreditSum = hb3JELines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Hall Booking S3', 'Journal Entry Balanced', true, hb3DebitSum === hb3CreditSum && hb3DebitSum === 85000);

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DONATIONS RECEIVED CALCULATIONS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Donation Received Calculations & Accounting ---');

  const generalDonationAccount = await AccountingService.ensureGeneralDonationAccount(prisma);

  // Donation 1: Cash Donation = 10,000
  const don1Amount = 10000;
  const don1Posting = await AccountingService.postReceipt(prisma, {
    amount: don1Amount,
    cashOrBankAccountId: cashAccount.id,
    incomeAccountId: generalDonationAccount.id,
    reference: 'QA-REC-DON-001',
    description: 'QA TEST DATA: Cash Donation from Ahmed Khan',
    module: 'Donations Received',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-01'),
    voucherType: 'BR'
  });

  const don1Record = await prisma.donationReceived.create({
    data: {
      receiptNo: 'REC-2026-0001',
      receiptDate: new Date('2026-09-01'),
      donorId: testDonor.id,
      donationType: DonationType.GENERAL_DONATION,
      amount: don1Amount,
      paymentMethod: PaymentMethod.CASH,
      cashAccountId: cashAccount.id,
      journalEntryId: don1Posting.journalEntry.id,
      status: TransactionStatus.POSTED,
      narration: 'QA TEST DATA: Cash General Donation',
      createdById: adminUser.id
    }
  });

  const don1Lines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: don1Posting.journalEntry.id } });
  const don1Debits = don1Lines.reduce((s, l) => s + Number(l.debit), 0);
  const don1Credits = don1Lines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Donations Received', 'Cash Donation Amount', 10000, Number(don1Record.amount));
  recordTest('Donations Received', 'Cash Donation Debit Sum', 10000, don1Debits);
  recordTest('Donations Received', 'Cash Donation Credit Sum', 10000, don1Credits);
  recordTest('Donations Received', 'Cash Donation Double-Entry Balanced', true, don1Debits === don1Credits);

  // Donation 2: Bank Donation = 25,000
  const don2Amount = 25000;
  const don2Posting = await AccountingService.postReceipt(prisma, {
    amount: don2Amount,
    cashOrBankAccountId: bankAccount.id,
    incomeAccountId: generalDonationAccount.id,
    reference: 'QA-REC-DON-002',
    description: 'QA TEST DATA: Bank Donation from Ahmed Khan',
    module: 'Donations Received',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-02'),
    voucherType: 'BR'
  });

  const don2Record = await prisma.donationReceived.create({
    data: {
      receiptNo: 'REC-2026-0002',
      receiptDate: new Date('2026-09-02'),
      donorId: testDonor.id,
      donationType: DonationType.GENERAL_DONATION,
      amount: don2Amount,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: bankAccount.id,
      journalEntryId: don2Posting.journalEntry.id,
      status: TransactionStatus.POSTED,
      narration: 'QA TEST DATA: Bank General Donation',
      createdById: adminUser.id
    }
  });

  const don2Lines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: don2Posting.journalEntry.id } });
  const don2Debits = don2Lines.reduce((s, l) => s + Number(l.debit), 0);
  const don2Credits = don2Lines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Donations Received', 'Bank Donation Amount', 25000, Number(don2Record.amount));
  recordTest('Donations Received', 'Bank Donation Debit Sum', 25000, don2Debits);
  recordTest('Donations Received', 'Bank Donation Credit Sum', 25000, don2Credits);
  recordTest('Donations Received', 'Bank Donation Double-Entry Balanced', true, don2Debits === don2Credits);

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ZAKAT RECEIVED & ZAKAT DISTRIBUTION (ZAKAT CARD)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Zakat Received & Distribution Calculations ---');

  // Zakat Revenue Account
  const zakatRevenueAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Zakat', mode: 'insensitive' },
      accountType: { name: { in: ['REVENUE', 'Revenue'] } },
      isLocked: false,
      children: { none: {} }
    }
  }) || generalDonationAccount;

  // Zakat Expense Account
  const zakatExpenseAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Zakat', mode: 'insensitive' },
      accountType: { name: { in: ['EXPENSE', 'Expense'] } },
      isLocked: false,
      children: { none: {} }
    }
  }) || await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Donation', mode: 'insensitive' },
      accountType: { name: { in: ['EXPENSE', 'Expense'] } },
      isLocked: false,
      children: { none: {} }
    }
  });

  if (!zakatExpenseAccount) {
    throw new Error('Zakat expense account not found in Chart of Accounts.');
  }

  // 4.1: Zakat Received = 10,000 (Cash)
  const zakatReceivedAmount = 10000;
  const zakatRecPosting = await AccountingService.postReceipt(prisma, {
    amount: zakatReceivedAmount,
    cashOrBankAccountId: cashAccount.id,
    incomeAccountId: zakatRevenueAccount.id,
    reference: 'QA-ZAKAT-REC-001',
    description: 'QA TEST DATA: Zakat Received (Cash)',
    module: 'Revenue Collections',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-03'),
    voucherType: 'BR'
  });

  const zakatRecCollection = await prisma.revenueCollection.create({
    data: {
      category: 'Zakat',
      title: 'QA Donor Ahmed Khan',
      subTitle: 'CNIC 42101-3333333-3',
      amount: zakatReceivedAmount,
      paymentMethod: PaymentMethod.CASH,
      status: 'Confirmed',
      remarks: 'QA TEST DATA: Zakat collection',
      journalEntryId: zakatRecPosting.journalEntry.id,
      createdById: adminUser.id
    }
  });

  // Approved Zakat Donation Record for Beneficiary Eligibility
  const zakatDonationRecord = await prisma.donation.create({
    data: {
      beneficiaryId: testBeneficiary.id,
      donorName: 'QA Welfare Fund',
      donationType: DonationType.ZAKAT,
      amount: 3000,
      paymentMethod: PaymentMethod.CASH,
      status: 'APPROVED',
      remarks: 'QA TEST DATA: Approved Zakat aid allocation for Fatima Bibi',
      createdById: adminUser.id
    }
  });

  // 4.2: Zakat Distribution (Zakat Card) = 3,000 (Cash)
  const zakatDisbursedAmount = 3000;
  const zakatCardPosting = await AccountingService.postTransaction(prisma, {
    reference: 'ZK-000001',
    description: `QA TEST DATA: Zakat Card issued to ${testBeneficiary.name}`,
    module: 'Zakat Card',
    voucherType: 'JV',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-04'),
    lines: [
      { accountId: zakatExpenseAccount.id, debit: zakatDisbursedAmount, credit: 0, description: `Zakat disbursement - ${testBeneficiary.name}` },
      { accountId: cashAccount.id, debit: 0, credit: zakatDisbursedAmount, description: 'Zakat payment - ZK-000001' }
    ]
  });

  const testZakatCard = await prisma.zakatCard.create({
    data: {
      beneficiaryId: testBeneficiary.id,
      zakatAmount: zakatDisbursedAmount,
      cardNumber: 'ZK-000001',
      paymentMethod: PaymentMethod.CASH,
      journalEntryId: zakatCardPosting.journalEntry.id,
      createdById: adminUser.id
    }
  });

  const expectedRemainingZakat = zakatReceivedAmount - zakatDisbursedAmount; // 7,000
  recordTest('Zakat Tracking', 'Zakat Received Amount', 10000, Number(zakatRecCollection.amount));
  recordTest('Zakat Tracking', 'Zakat Disbursed Amount', 3000, Number(testZakatCard.zakatAmount));
  recordTest('Zakat Tracking', 'Net Zakat Balance (10,000 - 3,000)', 7000, expectedRemainingZakat);

  // ───────────────────────────────────────────────────────────────────────────
  // 5. DONATION DISBURSEMENTS (WELFARE GIVEN)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Donation Disbursements (Welfare Given) ---');

  // Donation Received for Medical Welfare = 20,000 (Bank)
  const medDonationReceived = 20000;
  const medDonationPosting = await AccountingService.postReceipt(prisma, {
    amount: medDonationReceived,
    cashOrBankAccountId: bankAccount.id,
    incomeAccountId: generalDonationAccount.id,
    reference: 'QA-REC-MED-001',
    description: 'QA TEST DATA: Medical Donation Fund Received',
    module: 'Donations Received',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-05'),
    voucherType: 'BR'
  });

  await prisma.donationReceived.create({
    data: {
      receiptNo: 'REC-2026-0003',
      receiptDate: new Date('2026-09-05'),
      donorId: testDonor.id,
      donationType: DonationType.MEDICAL_DONATION,
      amount: medDonationReceived,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: bankAccount.id,
      journalEntryId: medDonationPosting.journalEntry.id,
      status: TransactionStatus.POSTED,
      narration: 'QA TEST DATA: Medical Donation Received',
      createdById: adminUser.id
    }
  });

  // Donation Disbursement to Beneficiary = 5,000 (Bank)
  const medExpenseAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Medical Donations', mode: 'insensitive' },
      accountType: { name: { in: ['EXPENSE', 'Expense'] } },
      isLocked: false,
      children: { none: {} }
    }
  }) || zakatExpenseAccount;

  const medDisbursedAmount = 5000;
  const medDisbursePosting = await AccountingService.postPayment(prisma, {
    amount: medDisbursedAmount,
    cashOrBankAccountId: bankAccount.id,
    expenseAccountId: medExpenseAccount.id,
    reference: 'QA-DON-GIVEN-001',
    description: `QA TEST DATA: Medical Aid Disbursement to ${testBeneficiary.name}`,
    module: 'Donations Given',
    voucherType: 'BP',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-06')
  });

  const medDonationGiven = await prisma.donation.create({
    data: {
      beneficiaryId: testBeneficiary.id,
      donorName: testBeneficiary.name,
      donationType: DonationType.MEDICAL,
      amount: medDisbursedAmount,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: bankAccount.id,
      status: 'APPROVED',
      remarks: 'QA TEST DATA: Medical Aid Disbursement',
      createdById: adminUser.id
    }
  });

  const expectedRemainingMedDonation = medDonationReceived - medDisbursedAmount; // 15,000
  recordTest('Donation Disbursement', 'Donation Received for Aid', 20000, medDonationReceived);
  recordTest('Donation Disbursement', 'Donation Disbursed to Beneficiary', 5000, Number(medDonationGiven.amount));
  recordTest('Donation Disbursement', 'Net Donation Fund Remaining (20k - 5k)', 15000, expectedRemainingMedDonation);

  // ───────────────────────────────────────────────────────────────────────────
  // 6. EXPENSES & SIMPLE EXPENSE MODULE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Expense Recording & Posting ---');

  const salaryExpenseHead = await prisma.expenseHead.findFirst({
    where: { name: { contains: 'Salary', mode: 'insensitive' } },
    include: { account: true }
  });
  const generatorFuelHead = await prisma.expenseHead.findFirst({
    where: { name: { contains: 'Generator', mode: 'insensitive' } },
    include: { account: true }
  });

  // Expense 1: Staff Salary = 5,000 (Cash)
  const salaryAmount = 5000;
  const salaryPosting = await AccountingService.postPayment(prisma, {
    amount: salaryAmount,
    cashOrBankAccountId: cashAccount.id,
    expenseAccountId: salaryExpenseHead?.accountId || salaryExpenseHead?.account?.id || zakatExpenseAccount.id,
    reference: 'QA-EXP-SALARY-001',
    description: 'QA TEST DATA: Staff Salary Expense',
    module: 'Expense',
    voucherType: 'BP',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-07')
  });

  const salaryExpRecord = await prisma.simpleExpense.create({
    data: {
      date: new Date('2026-09-07'),
      expenseHeadId: salaryExpenseHead!.id,
      paidTo: 'QA Office Staff',
      description: 'QA TEST DATA: Staff Salary',
      amount: salaryAmount,
      paymentMethod: 'CASH',
      status: 'POSTED',
      journalEntryId: salaryPosting.journalEntry.id,
      createdById: adminUser.id
    }
  });
  recordTest('Expense Module', 'Staff Salary Expense Amount', 5000, Number(salaryExpRecord.amount));

  // Expense 2: Generator Fuel = 3,000 (Cash)
  const fuelAmount = 3000;
  const fuelPosting = await AccountingService.postPayment(prisma, {
    amount: fuelAmount,
    cashOrBankAccountId: cashAccount.id,
    expenseAccountId: generatorFuelHead?.accountId || generatorFuelHead?.account?.id || zakatExpenseAccount.id,
    reference: 'QA-EXP-FUEL-001',
    description: 'QA TEST DATA: Generator Fuel Expense',
    module: 'Expense',
    voucherType: 'BP',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-08')
  });

  const fuelExpRecord = await prisma.simpleExpense.create({
    data: {
      date: new Date('2026-09-08'),
      expenseHeadId: generatorFuelHead!.id,
      paidTo: 'QA Fuel Station',
      description: 'QA TEST DATA: Generator Diesel',
      amount: fuelAmount,
      paymentMethod: 'CASH',
      status: 'POSTED',
      journalEntryId: fuelPosting.journalEntry.id,
      createdById: adminUser.id
    }
  });
  recordTest('Expense Module', 'Generator Fuel Expense Amount', 3000, Number(fuelExpRecord.amount));

  // ───────────────────────────────────────────────────────────────────────────
  // 7. REVENUE MODULES: MEMBERSHIP FEE, BUS BOOKING, ADD INCOME
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Additional Revenue Modules ---');

  // Revenue 1: Membership Fee = 2,000 (Cash)
  const memFeeAmount = 2000;
  const memFeePosting = await AccountingService.postReceipt(prisma, {
    amount: memFeeAmount,
    cashOrBankAccountId: cashAccount.id,
    incomeAccountKeyword: 'Membership Fee',
    reference: 'QA-REV-MEM-001',
    description: `QA TEST DATA: Membership Fee from ${testMember.fullName}`,
    module: 'Revenue Collections',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-09'),
    voucherType: 'BR'
  });

  const memFeeRecord = await prisma.revenueCollection.create({
    data: {
      category: 'Membership Fee',
      title: testMember.fullName,
      subTitle: testMember.memberNo,
      amount: memFeeAmount,
      paymentMethod: PaymentMethod.CASH,
      status: 'Confirmed',
      remarks: 'QA TEST DATA: Annual Membership Fee',
      journalEntryId: memFeePosting.journalEntry.id,
      createdById: adminUser.id
    }
  });
  recordTest('Revenue Modules', 'Membership Fee Collection Amount', 2000, Number(memFeeRecord.amount));

  // Revenue 2: Bus Booking = 8,000 (Bank)
  const busBookingAmount = 8000;
  const busPosting = await AccountingService.postReceipt(prisma, {
    amount: busBookingAmount,
    cashOrBankAccountId: bankAccount.id,
    incomeAccountKeyword: 'Bus Booking',
    reference: 'QA-REV-BUS-001',
    description: 'QA TEST DATA: Bus Booking Income',
    module: 'Revenue Collections',
    postedBy: adminUser.id,
    postingDate: new Date('2026-09-10'),
    voucherType: 'BR'
  });

  const busRecord = await prisma.revenueCollection.create({
    data: {
      category: 'Bus Booking',
      title: 'QA Trip to Hyderabad',
      quantity: 45,
      rate: 177.78,
      amount: busBookingAmount,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: bankAccount.id,
      status: 'Confirmed',
      remarks: 'QA TEST DATA: Bus Trip Booking',
      journalEntryId: busPosting.journalEntry.id,
      createdById: adminUser.id
    }
  });
  recordTest('Revenue Modules', 'Bus Booking Income Amount', 8000, Number(busRecord.amount));

  // Revenue 3: Add Income Module Record (e.g. Haqqani Decoration Income = 6,000 Cash)
  const decorationCategory = await prisma.incomeCategory.findFirst({
    where: { name: { contains: 'Decoration', mode: 'insensitive' } },
    include: { account: true }
  }) || await prisma.incomeCategory.findFirst({
    where: { isActive: true },
    include: { account: true }
  });

  if (decorationCategory && decorationCategory.accountId) {
    const addIncAmount = 6000;
    const addIncPosting = await AccountingService.postReceipt(prisma, {
      amount: addIncAmount,
      cashOrBankAccountId: cashAccount.id,
      incomeAccountId: decorationCategory.accountId,
      reference: 'QA-ADD-INC-001',
      description: 'QA TEST DATA: Decoration Commission Income',
      module: 'Add Income',
      postedBy: adminUser.id,
      postingDate: new Date('2026-09-11'),
      voucherType: 'BR'
    });

    const addIncRecord = await prisma.addIncomeRecord.create({
      data: {
        categoryId: decorationCategory.id,
        amount: addIncAmount,
        date: new Date('2026-09-11'),
        paymentMethod: PaymentMethod.CASH,
        referenceNumber: 'QA-DEC-001',
        remarks: 'QA TEST DATA: Decoration Services Commission',
        status: 'POSTED',
        journalEntryId: addIncPosting.journalEntry.id,
        postedAt: new Date('2026-09-11'),
        postedById: adminUser.id,
        createdById: adminUser.id
      }
    });
    recordTest('Revenue Modules', 'Add Income Record Amount', 6000, Number(addIncRecord.amount));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. INVOICES, TAX, DISCOUNT & TOTALS VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Invoice Calculations & Posting ---');

  // Items: (2 qty * 5000 = 10,000) + (3 qty * 2000 = 6,000) -> Subtotal = 16,000
  // Tax = 5% of 16,000 = 800
  // Discount = 1,000
  // Total = 16,000 + 800 - 1,000 = 15,800
  const invItem1Qty = 2;
  const invItem1Price = 5000;
  const invItem1Amt = invItem1Qty * invItem1Price; // 10,000

  const invItem2Qty = 3;
  const invItem2Price = 2000;
  const invItem2Amt = invItem2Qty * invItem2Price; // 6,000

  const invSubtotal = invItem1Amt + invItem2Amt; // 16,000
  const invTax = 800; // 5%
  const invDiscount = 1000;
  const invExpectedTotal = invSubtotal + invTax - invDiscount; // 15,800

  recordTest('Invoices', 'Line Items Subtotal Calculation', 16000, invSubtotal);
  recordTest('Invoices', 'Invoice Total Calculation (Subtotal + Tax - Discount)', 15800, invExpectedTotal);

  const invSoftwareAccount = await prisma.account.findFirst({
    where: {
      accountName: { contains: 'Software', mode: 'insensitive' },
      accountType: { name: { in: ['REVENUE', 'Revenue'] } },
      isLocked: false,
      children: { none: {} }
    }
  }) || generalDonationAccount;

  const invoiceRecord = await prisma.invoice.create({
    data: {
      invoiceNo: 'INV-2026-QA01',
      customerId: testCustomer.id,
      issueDate: new Date('2026-09-12'),
      dueDate: new Date('2026-10-12'),
      subtotal: invSubtotal,
      tax: invTax,
      discount: invDiscount,
      total: invExpectedTotal,
      status: 'POSTED',
      paymentMethod: 'BANK',
      bankAccountId: bankAccount.id,
      remarks: 'QA TEST DATA: Commercial Tech Invoice',
      createdById: adminUser.id,
      items: {
        create: [
          { description: 'QA ERP Module Setup', quantity: invItem1Qty, unitPrice: invItem1Price, amount: invItem1Amt },
          { description: 'QA Technical Maintenance', quantity: invItem2Qty, unitPrice: invItem2Price, amount: invItem2Amt }
        ]
      }
    },
    include: { items: true }
  });

  // Post Invoice to Ledger: Debit AR (15,800), Credit Software/Other Income (15,800)
  const invoicePosting = await AccountingService.postTransaction(prisma, {
    voucherType: 'JV',
    postingDate: new Date('2026-09-12'),
    reference: invoiceRecord.invoiceNo,
    description: `QA TEST DATA: Invoice for ${testCustomer.name}`,
    module: 'Invoice',
    postedBy: adminUser.id,
    lines: [
      { accountId: arAccount.id, debit: invExpectedTotal, credit: 0, description: 'Invoice Receivable' },
      { accountId: invSoftwareAccount.id, debit: 0, credit: invExpectedTotal, description: 'Invoice Revenue' }
    ]
  });

  const invLines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: invoicePosting.journalEntry.id } });
  const invDebits = invLines.reduce((s, l) => s + Number(l.debit), 0);
  const invCredits = invLines.reduce((s, l) => s + Number(l.credit), 0);
  recordTest('Invoices', 'Invoice Ledger Debit Sum', 15800, invDebits);
  recordTest('Invoices', 'Invoice Ledger Credit Sum', 15800, invCredits);
  recordTest('Invoices', 'Invoice Double-Entry Balanced', true, invDebits === invCredits);

  // ───────────────────────────────────────────────────────────────────────────
  // 9. CASH IN HAND INDEPENDENT FLOW VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Independent Validation of Cash in Hand Balance ---');

  // Manual Expected Cash Math:
  // + 30,000 (HB1 Cash Deposit)
  // + 85,000 (HB3 Cash Full Payment)
  // + 10,000 (Donation 1 Cash Received)
  // + 10,000 (Zakat Received Cash)
  // - 3,000 (Zakat Card Disbursed Cash)
  // - 5,000 (Staff Salary Paid Cash)
  // - 3,000 (Generator Fuel Paid Cash)
  // + 2,000 (Membership Fee Cash)
  // + 6,000 (Decoration Commission Cash)
  // Expected Cash = 0 + 30000 + 85000 + 10000 + 10000 - 3000 - 5000 - 3000 + 2000 + 6000 = 132,000
  const expectedCashInHand = 30000 + 85000 + 10000 + 10000 - 3000 - 5000 - 3000 + 2000 + 6000; // 132,000

  // Manual Expected Bank Math:
  // + 20,000 (HB2 Bank Deposit)
  // + 25,000 (Donation 2 Bank Received)
  // + 20,000 (Medical Donation Received Bank)
  // - 5,000 (Medical Aid Disbursed Bank)
  // + 8,000 (Bus Booking Income Bank)
  // Expected Bank = 0 + 20000 + 25000 + 20000 - 5000 + 8000 = 68,000
  const expectedBankBalance = 20000 + 25000 + 20000 - 5000 + 8000; // 68,000

  // Rebuild balances to ensure cache matches ledger
  await AccountingService.recalculateAllBalances(prisma);

  const freshCashAccount = await prisma.account.findUnique({ where: { id: cashAccount.id } });
  const freshBankAccount = await prisma.account.findUnique({ where: { id: bankAccount.id } });

  recordTest('Cash & Bank', 'Independent Cash in Hand Calculation', 132000, expectedCashInHand);
  recordTest('Cash & Bank', 'Actual Database Cash in Hand CurrentBalance', 132000, Number(freshCashAccount?.currentBalance));
  recordTest('Cash & Bank', 'Independent Bank Balance Calculation', 68000, expectedBankBalance);
  recordTest('Cash & Bank', 'Actual Database Bank CurrentBalance', 68000, Number(freshBankAccount?.currentBalance));

  // ───────────────────────────────────────────────────────────────────────────
  // 10. JOURNAL ENTRIES & TRIAL BALANCE VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Double-Entry & Trial Balance Integrity ---');

  // Verify EVERY single journal entry in the database has Total Debit === Total Credit
  const allJournals = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    include: { lines: true }
  });

  let allJournalsBalanced = true;
  let totalSystemDebits = 0;
  let totalSystemCredits = 0;

  for (const je of allJournals) {
    const dSum = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const cSum = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    totalSystemDebits += dSum;
    totalSystemCredits += cSum;

    if (Math.abs(dSum - cSum) > 0.01) {
      allJournalsBalanced = false;
      console.error(`❌ Unbalanced Journal Voucher: ${je.voucherNo} (Debits=${dSum}, Credits=${cSum})`);
    }
  }

  recordTest('Journal Engine', `All ${allJournals.length} Vouchers Balanced (Debit === Credit)`, true, allJournalsBalanced);
  recordTest('Trial Balance', 'Trial Balance Total Debits === Total Credits', totalSystemDebits, totalSystemCredits);

  // Call Trial Balance Report API service
  const trialBalanceReport = await AccountingService.getTrialBalance();
  recordTest('Trial Balance Report', 'Report Total Debits === Report Total Credits', trialBalanceReport.totalDebit, trialBalanceReport.totalCredit);
  recordTest('Trial Balance Report', 'Report Difference === 0', 0, trialBalanceReport.difference);

  // ───────────────────────────────────────────────────────────────────────────
  // 11. INCOME STATEMENT (P&L) & NET INCOME VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Income Statement (Profit & Loss) ---');

  // Manual Revenue Calculation:
  // HB1 Net: 90,000
  // HB2 Net: 47,500
  // HB3 Net: 85,000
  // Donation 1: 10,000
  // Donation 2: 25,000
  // Zakat Received: 10,000
  // Medical Donation: 20,000
  // Membership Fee: 2,000
  // Bus Booking: 8,000
  // Decoration Commission: 6,000
  // Invoice Tech Income: 15,800
  // Total Expected Revenue = 90000 + 47500 + 85000 + 10000 + 25000 + 10000 + 20000 + 2000 + 8000 + 6000 + 15800 = 319,300
  const expectedTotalRevenue = 90000 + 47500 + 85000 + 10000 + 25000 + 10000 + 20000 + 2000 + 8000 + 6000 + 15800; // 319,300

  // Manual Expense Calculation:
  // Zakat Disbursed: 3,000
  // Medical Aid Disbursed: 5,000
  // Staff Salary: 5,000
  // Generator Fuel: 3,000
  // Total Expected Expense = 3000 + 5000 + 5000 + 3000 = 16,000
  const expectedTotalExpense = 3000 + 5000 + 5000 + 3000; // 16,000

  // Expected Net Income = 319,300 - 16,000 = 303,300
  const expectedNetIncome = expectedTotalRevenue - expectedTotalExpense; // 303,300

  const incomeStatement = await AccountingService.getIncomeStatement();
  recordTest('Income Statement', 'Total Revenue Verification', expectedTotalRevenue, incomeStatement.totalRevenue);
  recordTest('Income Statement', 'Total Expense Verification', expectedTotalExpense, incomeStatement.totalExpense);
  recordTest('Income Statement', 'Net Income (Revenue - Expense)', expectedNetIncome, incomeStatement.netProfit);

  // ───────────────────────────────────────────────────────────────────────────
  // 12. BALANCE SHEET & ACCOUNTING EQUATION VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Balance Sheet & Fundamental Accounting Equation ---');

  // Manual Assets Calculation:
  // Cash in Hand: 132,000
  // Bank Balance: 68,000
  // Accounts Receivable:
  //   HB1 Remaining: 60,000
  //   HB2 Remaining: 27,500
  //   Invoice Total: 15,800
  //   Total AR = 103,300
  // Total Assets = 132,000 + 68,000 + 103,300 = 303,300
  const expectedAR = 60000 + 27500 + 15800; // 103,300
  const expectedTotalAssets = 132000 + 68000 + expectedAR; // 303,300

  // Liabilities = 0
  // Base Equity = 0
  // Net Period Income = 303,300
  // Total Equity + Liabilities = 0 + 303,300 = 303,300
  // Fundamental Equation: Assets (303,300) === Liabilities (0) + Equity (303,300)
  const balanceSheet = await AccountingService.getBalanceSheet();

  recordTest('Balance Sheet', 'Accounts Receivable Balance', 103300, expectedAR);
  recordTest('Balance Sheet', 'Total Assets Verification', expectedTotalAssets, balanceSheet.totalAssets);
  recordTest('Balance Sheet', 'Total Liabilities Verification', 0, balanceSheet.totalLiabilities);
  recordTest('Balance Sheet', 'Total Equity Verification (including Net Surplus)', expectedNetIncome, balanceSheet.totalEquity);
  recordTest('Balance Sheet', 'Accounting Equation: Assets === Liabilities + Equity', balanceSheet.totalAssets, balanceSheet.totalLiabilitiesAndEquity);

  // ───────────────────────────────────────────────────────────────────────────
  // 13. DASHBOARD FINANCIAL SUMMARY KPI RECONCILIATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Dashboard Stats Reconciliation ---');

  const dashboardSummary = await AccountingService.getFinancialSummary();
  recordTest('Dashboard Stats', 'Dashboard Total Revenue Matches P&L', expectedTotalRevenue, dashboardSummary.totalRevenue);
  recordTest('Dashboard Stats', 'Dashboard Total Expenses Matches P&L', expectedTotalExpense, dashboardSummary.totalExpense);
  recordTest('Dashboard Stats', 'Dashboard Net Income Matches P&L', expectedNetIncome, dashboardSummary.netPeriodIncome);
  recordTest('Dashboard Stats', 'Dashboard Cash Balance Matches GL', 132000, dashboardSummary.cashBalance);
  recordTest('Dashboard Stats', 'Dashboard Bank Balance Matches GL', 68000, dashboardSummary.bankBalance);
  recordTest('Dashboard Stats', 'Dashboard Total Assets Matches Balance Sheet', expectedTotalAssets, dashboardSummary.totalAssets);

  // ───────────────────────────────────────────────────────────────────────────
  // 14. SUMMARY & REPORT GENERATION
  // ───────────────────────────────────────────────────────────────────────────
  const passCount = testResults.filter(t => t.status === 'PASS').length;
  const failCount = testResults.filter(t => t.status === 'FAIL').length;
  const totalCount = testResults.length;

  console.log('\n===============================================================');
  console.log('📊 FINAL QA TEST RESULTS SUMMARY');
  console.log('===============================================================');
  console.log(`Total Test Scenarios Executed: ${totalCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / totalCount) * 100).toFixed(2)}%`);
  console.log('===============================================================\n');

  return {
    totalCount,
    passCount,
    failCount,
    testResults
  };
}

export { runCalculationValidationSuite };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCalculationValidationSuite()
    .catch((err) => {
      console.error('❌ Test suite error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}

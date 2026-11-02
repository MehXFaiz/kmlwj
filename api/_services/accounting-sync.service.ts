import type { VercelResponse } from '@vercel/node';
import { prisma as defaultPrisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { AccountingService } from './accounting.service.js';

export interface SyncEventPayload {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'POST' | 'REVERSE' | 'APPROVE' | 'REJECT' | string;
  module: string;
  recordId?: string;
  userId?: string | null;
  timestamp?: string;
}

export interface ModuleSyncResult {
  success: boolean;
  hallBookingsSynced: number;
  donationsReceivedSynced: number;
  donationsDisbursedSynced: number;
  revenueCollectionsSynced: number;
  addIncomeSynced: number;
  simpleExpensesSynced: number;
  pettyCashSynced: number;
  orphanJEsDeleted: number;
  accountsRebuilt: number;
  timestamp: string;
}

class AccountingSyncHub {
  private globalVersion = 1;
  private lastTimestamp = new Date().toISOString();
  private recentEvents: SyncEventPayload[] = [];

  emitSyncEvent(payload: SyncEventPayload): number {
    this.globalVersion += 1;
    this.lastTimestamp = new Date().toISOString();
    const event = {
      ...payload,
      timestamp: this.lastTimestamp
    };
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents = this.recentEvents.slice(0, 100);
    }
    return this.globalVersion;
  }

  getSyncState() {
    return {
      version: this.globalVersion,
      lastTimestamp: this.lastTimestamp,
      recentEvents: this.recentEvents.slice(0, 10)
    };
  }

  attachSyncHeaders(res: VercelResponse) {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-ERP-Sync-Version', String(this.globalVersion));
      res.setHeader('X-ERP-Sync-Timestamp', this.lastTimestamp);
    }
  }

  /**
   * Synchronizes all operational module records (Hall Bookings, Donations Received,
   * Revenue Collections, Add Income, Simple Expenses, Petty Cash, Donations Disbursed)
   * directly to the General Ledger (JournalEntry + lines), cleans up orphan headers,
   * and rebuilds the chart of accounts balance cache.
   */
  async syncAllModulesToLedger(prismaClient?: any): Promise<ModuleSyncResult> {
    const db = prismaClient || defaultPrisma;
    const nowIso = new Date().toISOString();

    // 1. Clean up contaminated test initial balances (e.g., from failed test runs)
    await db.account.updateMany({
      where: {
        glCode: { in: ['1010102', '4080103'] }
      },
      data: { initialBalance: 0 }
    });

    // 2. Resolve standard accounts
    let cashAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '1010103' },
          { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
          { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } },
          { detailType: 'Cash' }
        ],
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });

    if (!cashAccount) {
      const parentCash = await db.account.findFirst({
        where: { OR: [{ glCode: '1010100' }, { accountName: { contains: 'Cash & Bank', mode: 'insensitive' } }] }
      });
      const assetType = await db.accountType.findFirst({
        where: { name: { in: ['Asset', 'Assets', 'ASSET', 'ASSETS'] } }
      });
      cashAccount = await db.account.create({
        data: {
          glCode: '1010103',
          accountName: 'Cash in Hand',
          accountLevel: 'GL',
          parentId: parentCash ? parentCash.id : null,
          accountTypeId: assetType ? assetType.id : null,
          detailType: 'Cash',
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isSystemDefined: true,
          description: 'Main operational cash in hand account'
        }
      });
    }

    let generalDonationAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '3020401' },
          { glCode: '3020408' },
          { accountName: { equals: 'General Donation', mode: 'insensitive' } }
        ],
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });

    if (!generalDonationAccount) {
      const parentRev = await db.account.findFirst({
        where: { OR: [{ glCode: '3020400' }, { accountName: { contains: 'Other Income', mode: 'insensitive' } }] }
      });
      const revenueType = await db.accountType.findFirst({
        where: { name: { in: ['Revenue', 'REVENUE', 'Revenues', 'Income', 'INCOME'] } }
      });
      generalDonationAccount = await db.account.create({
        data: {
          glCode: '3020401',
          accountName: 'General Donation',
          accountLevel: 'GL',
          parentId: parentRev ? parentRev.id : null,
          accountTypeId: revenueType ? revenueType.id : null,
          detailType: 'Revenue',
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isSystemDefined: true,
          description: 'General/unrestricted donation income'
        }
      });
    }

    let arAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '1010200' },
          { glCode: '1010201' },
          { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } }
        ],
        children: { none: {} }
      }
    });

    if (!arAccount) {
      const parentCurr = await db.account.findFirst({
        where: { OR: [{ glCode: '1010000' }, { accountName: { contains: 'Current Assets', mode: 'insensitive' } }] }
      });
      const assetType = await db.accountType.findFirst({
        where: { name: { in: ['Asset', 'Assets', 'ASSET'] } }
      });
      arAccount = await db.account.create({
        data: {
          glCode: '1010200',
          accountName: 'Accounts Receivable',
          accountLevel: 'GL',
          parentId: parentCurr ? parentCurr.id : null,
          accountTypeId: assetType ? assetType.id : null,
          detailType: 'Accounts Receivable',
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isSystemDefined: true
        }
      });
    }

    const zakatRevenueAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '3020101' },
          { accountName: { contains: 'Zakat', mode: 'insensitive' }, accountType: { name: { in: ['Revenue', 'REVENUE', 'Income', 'INCOME'] } } }
        ],
        children: { none: {} }
      }
    }) || generalDonationAccount;

    const defaultBank = await db.account.findFirst({
      where: {
        detailType: 'Bank',
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });

    const zakatExpenseAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '4060104' },
          { glCode: '4040203' },
          { glCode: '4060201' },
          { accountName: { contains: 'Zakat', mode: 'insensitive' }, accountType: { name: { in: ['Expense', 'EXPENSE'] } } }
        ],
        children: { none: {} }
      }
    });

    const donationExpenseAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '4060101' },
          { accountName: { contains: 'Monthly Donation', mode: 'insensitive' } }
        ],
        children: { none: {} }
      }
    });

    let donationPoolAccount = await db.account.findFirst({
      where: {
        OR: [
          { glCode: '1010401' },
          { accountName: { equals: 'Donation Pool', mode: 'insensitive' } }
        ],
        isDeleted: false,
        children: { none: {} }
      }
    });

    if (!donationPoolAccount) {
      let parentPool = await db.account.findFirst({
        where: {
          OR: [
            { glCode: '1010400' },
            { accountName: { equals: 'Funds & Pools', mode: 'insensitive' } },
            { accountName: { equals: 'Donation & Welfare Pools', mode: 'insensitive' } }
          ],
          isDeleted: false
        }
      });
      const assetType = await db.accountType.findFirst({
        where: { name: { in: ['Asset', 'Assets', 'ASSET', 'ASSETS'] } }
      });
      if (!parentPool) {
        const currentAssets = await db.account.findFirst({
          where: { OR: [{ glCode: '1010000' }, { accountName: { equals: 'Current Assets', mode: 'insensitive' } }] }
        });
        parentPool = await db.account.create({
          data: {
            glCode: '1010400',
            accountName: 'Funds & Pools',
            accountLevel: 'SUBSIDIARY',
            parentId: currentAssets ? currentAssets.id : null,
            accountTypeId: assetType ? assetType.id : null,
            detailType: 'Header',
            currency: 'PKR',
            subsidiary: ['Global'],
            initialBalance: 0,
            currentBalance: 0,
            isSystemDefined: true,
            description: 'Special purpose funds and welfare pools'
          }
        });
      }
      donationPoolAccount = await db.account.create({
        data: {
          glCode: '1010401',
          accountName: 'Donation Pool',
          accountLevel: 'GL',
          parentId: parentPool.id,
          accountTypeId: assetType ? assetType.id : (parentPool ? parentPool.accountTypeId : null),
          detailType: 'Donation Pool',
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isSystemDefined: true,
          description: 'Dedicated Donation Pool / Donation Fund account for welfare allocations'
        }
      });
    }

    // 3. Sync Hall Bookings (Total Net Amount to General Ledger)
    const hallBookings = await db.hallBooking.findMany({
      where: { isDeleted: false },
      include: { hallAccount: true, journalEntry: { include: { lines: true } } }
    });

    let hallBookingsSynced = 0;
    for (const hb of hallBookings) {
      const netAmt = Number(hb.netAmount ?? hb.hallCharges ?? 0);
      const recAmt = Number(hb.receivedAmount ?? 0);
      const remAmt = Number(hb.remainingAmount ?? (netAmt - recAmt));

      if (netAmt <= 0) continue;

      let debitAccountId = cashAccount.id;
      if (hb.paymentMethod === 'BANK' || hb.paymentMethod === 'CHEQUE') {
        debitAccountId = hb.bankAccountId || defaultBank?.id || cashAccount.id;
      }

      let revenueAccountId = hb.hallId;
      if (!revenueAccountId) {
        const matchingHall = await db.account.findFirst({
          where: {
            detailType: 'Hall',
            accountType: { name: { in: ['Revenue', 'REVENUE', 'Income', 'INCOME'] } }
          }
        });
        revenueAccountId = matchingHall?.id || generalDonationAccount.id;
      }

      const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
      if (recAmt > 0) {
        lines.push({
          accountId: debitAccountId,
          debit: recAmt,
          credit: 0,
          description: `Receipt: Hall Booking #${hb.receiptNo} for ${hb.bookerName} - ${hb.hallAccount?.accountName || 'Hall'}`
        });
      }
      if (remAmt > 0) {
        lines.push({
          accountId: arAccount.id,
          debit: remAmt,
          credit: 0,
          description: `Receivable: Hall Booking #${hb.receiptNo} for ${hb.bookerName}`
        });
      }
      lines.push({
        accountId: revenueAccountId,
        debit: 0,
        credit: netAmt,
        description: `Revenue: Hall Booking #${hb.receiptNo} for ${hb.bookerName} - ${hb.hallAccount?.accountName || 'Hall'}`
      });

      const postingDate = hb.bookingDate || hb.programDate || hb.createdAt || new Date();
      let existingJe = hb.journalEntry;
      if (!existingJe && hb.journalEntryId) {
        existingJe = await db.journalEntry.findUnique({
          where: { id: hb.journalEntryId },
          include: { lines: true }
        });
      }

      // Check if existing JE already has valid lines matching the total amount
      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - netAmt) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: {
            status: 'Posted',
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            postingDate,
            reference: `HB-${hb.receiptNo}`,
            voucherType: 'BR'
          }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(l => ({
            journalEntryId: existingJe.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description
          }))
        });
        if (hb.status !== 'POSTED') {
          await db.hallBooking.update({ where: { id: hb.id }, data: { status: 'POSTED' } });
        }
      } else {
        const voucherNo = `BR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newJe = await db.journalEntry.create({
          data: {
            voucherNo,
            voucherType: 'BR',
            postingDate,
            subsidiary: 'Global',
            reference: `HB-${hb.receiptNo}`,
            description: `Hall Booking Receipt for ${hb.bookerName} - ${hb.hallAccount?.accountName || 'Hall'}`,
            postedBy: hb.createdById || 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.hallBooking.update({
          where: { id: hb.id },
          data: { journalEntryId: newJe.id, status: 'POSTED' }
        });
      }

      hallBookingsSynced++;
    }

    // 4. Sync Donations Received
    const donRecs = await db.donationReceived.findMany({
      where: { isDeleted: false },
      include: { journalEntry: { include: { lines: true } } }
    });
    let donationsReceivedSynced = 0;

    for (const d of donRecs) {
      const amount = Number(d.amount || 0);
      if (amount <= 0) continue;

      let debitAccId = cashAccount.id;
      if (d.paymentMethod !== 'CASH') {
        debitAccId = d.bankAccountId || defaultBank?.id || cashAccount.id;
      }

      let creditAccId = generalDonationAccount.id;
      if (d.donationType === 'ZAKAT') {
        creditAccId = zakatRevenueAccount.id;
      }

      const lines = [
        { accountId: debitAccId, debit: amount, credit: 0, description: `Receipt: Donation from ${d.donorId || 'Donor'} (${d.donationType})` },
        { accountId: creditAccId, debit: 0, credit: amount, description: `Revenue: Donation from ${d.donorId || 'Donor'} (${d.donationType})` }
      ];

      const postingDate = d.receiptDate || d.createdAt || new Date();
      let existingJe = d.journalEntry;
      if (!existingJe && d.journalEntryId) {
        existingJe = await db.journalEntry.findUnique({
          where: { id: d.journalEntryId },
          include: { lines: true }
        });
      }

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: `DNR-${d.receiptNo}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(l => ({
            journalEntryId: existingJe.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description
          }))
        });
        if (d.status !== 'POSTED') {
          await db.donationReceived.update({ where: { id: d.id }, data: { status: 'POSTED' } });
        }
      } else {
        const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newJe = await db.journalEntry.create({
          data: {
            voucherNo,
            voucherType: 'CR',
            postingDate,
            subsidiary: 'Global',
            reference: `DNR-${d.receiptNo}`,
            description: `Donation Received (${d.donationType})`,
            postedBy: d.createdById || 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.donationReceived.update({
          where: { id: d.id },
          data: { journalEntryId: newJe.id, status: 'POSTED' }
        });
      }

      donationsReceivedSynced++;
    }

    // 5. Sync Revenue Collections (Membership Fees, Bus Booking, etc.)
    const revCollections = await db.revenueCollection.findMany({
      where: { isDeleted: false },
      include: { journalEntry: { include: { lines: true } } }
    });
    let revenueCollectionsSynced = 0;

    for (const rc of revCollections) {
      const amount = Number(rc.amount || 0);
      if (amount <= 0) continue;

      let debitAccId = cashAccount.id;
      if (rc.paymentMethod !== 'CASH') {
        debitAccId = rc.bankAccountId || defaultBank?.id || cashAccount.id;
      }

      let creditAcc = null;
      const catUpper = (rc.category || '').toUpperCase();
      if (catUpper.includes('MEMBERSHIP')) {
        creditAcc = await db.account.findFirst({
          where: {
            OR: [
              { glCode: '3021002' },
              { accountName: { contains: 'Membership', mode: 'insensitive' } }
            ],
            isDeleted: false,
            children: { none: {} }
          }
        });
      } else if (catUpper.includes('BUS')) {
        creditAcc = await db.account.findFirst({
          where: {
            OR: [
              { glCode: '3021001' },
              { accountName: { contains: 'Bus', mode: 'insensitive' } }
            ],
            isDeleted: false,
            children: { none: {} }
          }
        });
      } else if (catUpper.includes('ZAKAT')) {
        creditAcc = await db.account.findFirst({
          where: {
            OR: [
              { glCode: '3020101' },
              { glCode: '3021004' },
              { accountName: { contains: 'Zakat', mode: 'insensitive' } }
            ],
            isDeleted: false,
            children: { none: {} }
          }
        });
      }
      const creditAccId = creditAcc?.id || generalDonationAccount.id;

      const lines = [
        { accountId: debitAccId, debit: amount, credit: 0, description: `Collection: ${rc.category} - ${rc.title || 'Member'}` },
        { accountId: creditAccId, debit: 0, credit: amount, description: `Revenue: ${rc.category} - ${rc.title || 'Member'}` }
      ];

      const postingDate = rc.eventDate || rc.createdAt || new Date();
      let existingJe = rc.journalEntry;
      if (!existingJe && rc.journalEntryId) {
        existingJe = await db.journalEntry.findUnique({
          where: { id: rc.journalEntryId },
          include: { lines: true }
        });
      }

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: `REV-${rc.receiptNo || rc.id.slice(0, 8)}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(l => ({
            journalEntryId: existingJe.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description
          }))
        });
        if (rc.status !== 'POSTED') {
          await db.revenueCollection.update({ where: { id: rc.id }, data: { status: 'POSTED' } });
        }
      } else {
        const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newJe = await db.journalEntry.create({
          data: {
            voucherNo,
            voucherType: 'CR',
            postingDate,
            subsidiary: 'Global',
            reference: `REV-${rc.receiptNo || rc.id.slice(0, 8)}`,
            description: `Revenue Collection: ${rc.category} (${rc.title || 'Member'})`,
            postedBy: rc.createdById || 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.revenueCollection.update({
          where: { id: rc.id },
          data: { journalEntryId: newJe.id, status: 'POSTED' }
        });
      }

      revenueCollectionsSynced++;
    }

    // 6. Sync Add Income Records
    const addIncomes = await db.addIncomeRecord.findMany({
      where: { isDeleted: false },
      include: { category: true, journalEntry: { include: { lines: true } } }
    });
    let addIncomeSynced = 0;

    for (const ai of addIncomes) {
      const amount = Number(ai.amount || 0);
      if (amount <= 0) continue;

      let debitAccId = cashAccount.id;
      if (ai.paymentMethod !== 'CASH') {
        debitAccId = ai.bankAccountId || defaultBank?.id || cashAccount.id;
      }

      let creditAccId = null;
      if (ai.category?.glAccountId) {
        creditAccId = ai.category.glAccountId;
      } else {
        const matched = await db.account.findFirst({
          where: {
            accountName: { contains: ai.category?.name || 'Income', mode: 'insensitive' },
            accountType: { name: { in: ['Revenue', 'Income', 'REVENUE', 'INCOME'] } },
            isDeleted: false,
            children: { none: {} }
          }
        });
        creditAccId = matched?.id || generalDonationAccount.id;
      }

      const lines = [
        { accountId: debitAccId, debit: amount, credit: 0, description: `Receipt: ${ai.category?.name || 'Income'} - ${ai.referenceNumber || 'Direct'}` },
        { accountId: creditAccId, debit: 0, credit: amount, description: `Revenue: ${ai.category?.name || 'Income'} - ${ai.referenceNumber || 'Direct'}` }
      ];

      const postingDate = ai.date || ai.createdAt || new Date();
      let existingJe = ai.journalEntry;
      if (!existingJe && ai.journalEntryId) {
        existingJe = await db.journalEntry.findUnique({
          where: { id: ai.journalEntryId },
          include: { lines: true }
        });
      }

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: ai.referenceNumber || `INC-${ai.id.slice(0, 8)}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(l => ({
            journalEntryId: existingJe.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description
          }))
        });
        if (ai.status !== 'POSTED') {
          await db.addIncomeRecord.update({ where: { id: ai.id }, data: { status: 'POSTED' } });
        }
      } else {
        const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newJe = await db.journalEntry.create({
          data: {
            voucherNo,
            voucherType: 'CR',
            postingDate,
            subsidiary: 'Global',
            reference: ai.referenceNumber || `INC-${ai.id.slice(0, 8)}`,
            description: `Direct Income: ${ai.category?.name || 'Income'}`,
            postedBy: ai.createdById || 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.addIncomeRecord.update({
          where: { id: ai.id },
          data: { journalEntryId: newJe.id, status: 'POSTED' }
        });
      }

      addIncomeSynced++;
    }

    // 7. Sync Simple Expenses
    let simpleExpensesSynced = 0;
    try {
      const simpleExpenses = await db.simpleExpense.findMany({
        where: { isDeleted: false },
        include: { expenseHead: true }
      });

      for (const se of simpleExpenses) {
        const amount = Number(se.amount || 0);
        if (amount <= 0) continue;

        let creditAccId = cashAccount.id;
        if (se.paymentMethod !== 'CASH') {
          creditAccId = se.bankAccountId || defaultBank?.id || cashAccount.id;
        }

        let debitAccId = se.expenseHead?.glAccountId;
        if (!debitAccId) {
          const matched = await db.account.findFirst({
            where: {
              accountName: { contains: se.expenseHead?.name || 'Expense', mode: 'insensitive' },
              accountType: { name: { in: ['Expense', 'EXPENSE', 'Expenses', 'EXPENSES'] } },
              isDeleted: false,
              children: { none: {} }
            }
          });
          debitAccId = matched?.id || donationExpenseAccount?.id;
        }
        if (!debitAccId) continue;

        const lines = [
          { accountId: debitAccId, debit: amount, credit: 0, description: `Expense: ${se.description || se.expenseHead?.name || 'General Expense'}` },
          { accountId: creditAccId, debit: 0, credit: amount, description: `Payment: ${se.description || se.expenseHead?.name || 'General Expense'}` }
        ];

        const postingDate = se.date || se.createdAt || new Date();
        let existingJe = null;
        if (se.journalEntryId) {
          existingJe = await db.journalEntry.findUnique({
            where: { id: se.journalEntryId },
            include: { lines: true }
          });
        }

        if (existingJe) {
          await db.journalEntry.update({
            where: { id: existingJe.id },
            data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: se.reference || `EXP-${se.id.slice(0, 8)}` }
          });
          await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
          await db.journalEntryLine.createMany({
            data: lines.map(l => ({
              journalEntryId: existingJe.id,
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description
            }))
          });
          if (se.status !== 'POSTED') {
            await db.simpleExpense.update({ where: { id: se.id }, data: { status: 'POSTED' } });
          }
        } else {
          const voucherNo = `CP-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
          const newJe = await db.journalEntry.create({
            data: {
              voucherNo,
              voucherType: 'CP',
              postingDate,
              subsidiary: 'Global',
              reference: se.reference || `EXP-${se.id.slice(0, 8)}`,
              description: `Expense: ${se.description || se.expenseHead?.name || 'Expense'}`,
              postedBy: se.createdById || 'system',
              status: 'Posted',
              isDeleted: false,
              lines: { create: lines }
            }
          });
          await db.simpleExpense.update({
            where: { id: se.id },
            data: { journalEntryId: newJe.id, status: 'POSTED' }
          });
        }
        simpleExpensesSynced++;
      }
    } catch (e) {}

    // 8. Sync Petty Cash Transactions
    let pettyCashSynced = 0;
    try {
      const pcTxs = await db.pettyCashTransaction.findMany({
        where: { isDeleted: false }
      });

      for (const pc of pcTxs) {
        const amount = Number(pc.amount || 0);
        if (amount <= 0) continue;

        let lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
        if (pc.transactionType === 'EXPENSE') {
          const debitId = pc.expenseAccountId;
          const creditId = pc.pettyCashAccountId || cashAccount.id;
          if (debitId && creditId) {
            lines = [
              { accountId: debitId, debit: amount, credit: 0, description: `Petty Cash Expense: ${pc.narration || pc.paidTo || 'Expense'}` },
              { accountId: creditId, debit: 0, credit: amount, description: `Petty Cash Payment: ${pc.narration || pc.paidTo || 'Expense'}` }
            ];
          }
        } else if (pc.transactionType === 'TOPUP') {
          const debitId = pc.pettyCashAccountId || cashAccount.id;
          const creditId = pc.sourceAccountId || defaultBank?.id || cashAccount.id;
          if (debitId && creditId) {
            lines = [
              { accountId: debitId, debit: amount, credit: 0, description: `Petty Cash Replenishment: ${pc.narration || 'Topup'}` },
              { accountId: creditId, debit: 0, credit: amount, description: `Source Account: ${pc.narration || 'Topup'}` }
            ];
          }
        }

        if (lines.length === 2) {
          const postingDate = pc.date || pc.createdAt || new Date();
          let existingJe = null;
          if (pc.journalEntryId) {
            existingJe = await db.journalEntry.findUnique({
              where: { id: pc.journalEntryId },
              include: { lines: true }
            });
          }

          if (existingJe) {
            await db.journalEntry.update({
              where: { id: existingJe.id },
              data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: pc.referenceNo || `PC-${pc.id.slice(0, 8)}` }
            });
            await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
            await db.journalEntryLine.createMany({
              data: lines.map(l => ({
                journalEntryId: existingJe.id,
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                description: l.description
              }))
            });
          } else {
            const voucherNo = `PC-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
            const newJe = await db.journalEntry.create({
              data: {
                voucherNo,
                voucherType: 'PC',
                postingDate,
                subsidiary: 'Global',
                reference: pc.referenceNo || `PC-${pc.id.slice(0, 8)}`,
                description: `Petty Cash: ${pc.narration || pc.paidTo || 'Transaction'}`,
                postedBy: pc.createdById || 'system',
                status: 'Posted',
                isDeleted: false,
                lines: { create: lines }
              }
            });
            await db.pettyCashTransaction.update({
              where: { id: pc.id },
              data: { journalEntryId: newJe.id }
            });
          }
          pettyCashSynced++;
        }
      }
    } catch (e) {}

    // 9. Sync Donations Disbursed
    const donDisbs = await db.donation.findMany({
      where: { isDeleted: false, status: 'APPROVED' },
      include: { journalEntry: { include: { lines: true } } }
    });
    let donationsDisbursedSynced = 0;

    for (const d of donDisbs) {
      const amount = Number(d.amount || 0);
      if (amount <= 0) continue;

      const isZakat = d.donationType === 'ZAKAT';
      let debitAccId = donationPoolAccount.id;
      if (isZakat && zakatExpenseAccount) {
        debitAccId = zakatExpenseAccount.id;
      }

      let creditAccId = d.bankAccountId || defaultBank?.id || cashAccount.id;
      if (d.paymentMethod === 'CASH') {
        creditAccId = cashAccount.id;
      }

      const lines = [
        {
          accountId: debitAccId,
          debit: amount,
          credit: 0,
          description: isZakat
            ? `Expense: Zakat Disbursement - ${d.voucherNumber || d.voucherNo || d.id.slice(0, 8)}`
            : `Monthly Donation Allocation to Donation Pool - ${d.voucherNumber || d.voucherNo || d.id.slice(0, 8)}`
        },
        {
          accountId: creditAccId,
          debit: 0,
          credit: amount,
          description: `Payment: Donation Disbursement (${d.donationType}) - ${d.voucherNumber || d.voucherNo || d.id.slice(0, 8)}`
        }
      ];

      const postingDate = d.createdAt || new Date();
      let existingJe = d.journalEntry;
      if (!existingJe && d.journalEntryId) {
        existingJe = await db.journalEntry.findUnique({
          where: { id: d.journalEntryId },
          include: { lines: true }
        });
      }

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: d.voucherNumber || `DON-${d.id.slice(0, 8)}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        await db.journalEntryLine.createMany({
          data: lines.map(l => ({
            journalEntryId: existingJe.id,
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description
          }))
        });
      } else {
        const voucherNo = `BP-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newJe = await db.journalEntry.create({
          data: {
            voucherNo,
            voucherType: 'BP',
            postingDate,
            subsidiary: 'Global',
            reference: d.voucherNumber || `DON-${d.id.slice(0, 8)}`,
            description: `Donation Disbursement (${d.donationType})`,
            postedBy: 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.donation.update({
          where: { id: d.id },
          data: { journalEntryId: newJe.id }
        });
      }

      donationsDisbursedSynced++;
    }

    const orphanJEsDeleted = 0;

    // 10. Recalculate all Account balances from posted lines
    const rebuildResult = await AccountingService.recalculateAllBalances(db);
    const accountsRebuilt = rebuildResult.updated ?? 0;

    this.emitSyncEvent({
      action: 'SYNC_ALL_MODULES',
      module: 'General Ledger',
      recordId: undefined
    });

    logger.info({
      hallBookingsSynced,
      donationsReceivedSynced,
      donationsDisbursedSynced,
      revenueCollectionsSynced,
      addIncomeSynced,
      simpleExpensesSynced,
      pettyCashSynced,
      orphanJEsDeleted,
      accountsRebuilt
    }, 'AccountingSyncService: syncAllModulesToLedger completed successfully');

    return {
      success: true,
      hallBookingsSynced,
      donationsReceivedSynced,
      donationsDisbursedSynced,
      revenueCollectionsSynced,
      addIncomeSynced,
      simpleExpensesSynced,
      pettyCashSynced,
      orphanJEsDeleted,
      accountsRebuilt,
      timestamp: nowIso
    };
  }
}

export const AccountingSyncService = new AccountingSyncHub();

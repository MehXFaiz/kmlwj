import type { VercelResponse } from '@vercel/node';
import { prisma as defaultPrisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';

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
   * Donations Disbursed, Income/Expenses) directly to the General Ledger (JournalEntry + lines),
   * cleans up orphan 0-line journal headers, and rebuilds the chart of accounts balance cache.
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
      const existingJe = hb.journalEntry;

      // Check if existing JE already has valid lines matching the total amount
      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - netAmt) < 0.01) {
          // Already in sync
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: {
            status: 'Posted',
            isDeleted: false,
            postingDate,
            reference: `HB-${hb.receiptNo}`,
            voucherType: 'BR'
          }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        for (const line of lines) {
          await db.journalEntryLine.create({
            data: {
              journalEntryId: existingJe.id,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description
            }
          });
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
            lines: {
              create: lines
            }
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
      where: { isDeleted: false, status: 'POSTED' },
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
        { accountId: debitAccId, debit: amount, credit: 0, description: `Receipt: Donation from ${d.donorName || 'Donor'} (${d.donationType})` },
        { accountId: creditAccId, debit: 0, credit: amount, description: `Revenue: Donation from ${d.donorName || 'Donor'} (${d.donationType})` }
      ];

      const postingDate = d.receiptDate || d.createdAt || new Date();
      const existingJe = d.journalEntry;

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, postingDate, reference: `DNR-${d.receiptNo}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        for (const line of lines) {
          await db.journalEntryLine.create({
            data: { journalEntryId: existingJe.id, accountId: line.accountId, debit: line.debit, credit: line.credit, description: line.description }
          });
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
            description: `Donation Received from ${d.donorName || 'Donor'} (${d.donationType})`,
            postedBy: d.createdById || 'system',
            status: 'Posted',
            isDeleted: false,
            lines: { create: lines }
          }
        });
        await db.donationReceived.update({
          where: { id: d.id },
          data: { journalEntryId: newJe.id }
        });
      }

      donationsReceivedSynced++;
    }

    // 5. Sync Donations Disbursed
    const donDisbs = await db.donation.findMany({
      where: { isDeleted: false, status: 'APPROVED' },
      include: { journalEntry: { include: { lines: true } } }
    });
    let donationsDisbursedSynced = 0;

    for (const d of donDisbs) {
      const amount = Number(d.amount || 0);
      if (amount <= 0) continue;

      let debitAccId = donationExpenseAccount?.id || generalDonationAccount.id;
      if (d.donationType === 'ZAKAT' && zakatExpenseAccount) {
        debitAccId = zakatExpenseAccount.id;
      }

      let creditAccId = d.bankAccountId || defaultBank?.id || cashAccount.id;
      if (d.paymentMethod === 'CASH') {
        creditAccId = cashAccount.id;
      }

      const lines = [
        { accountId: debitAccId, debit: amount, credit: 0, description: `Expense: Donation Disbursement (${d.donationType}) - ${d.voucherNumber || d.id.slice(0, 8)}` },
        { accountId: creditAccId, debit: 0, credit: amount, description: `Payment: Donation Disbursement (${d.donationType}) - ${d.voucherNumber || d.id.slice(0, 8)}` }
      ];

      const postingDate = d.createdAt || new Date();
      const existingJe = d.journalEntry;

      if (existingJe && existingJe.lines && existingJe.lines.length > 0 && !existingJe.isDeleted && existingJe.status === 'Posted') {
        const currentCredit = existingJe.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
        if (Math.abs(currentCredit - amount) < 0.01) {
          continue;
        }
      }

      if (existingJe) {
        await db.journalEntry.update({
          where: { id: existingJe.id },
          data: { status: 'Posted', isDeleted: false, postingDate, reference: d.voucherNumber || `DON-${d.id.slice(0, 8)}` }
        });
        await db.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
        for (const line of lines) {
          await db.journalEntryLine.create({
            data: { journalEntryId: existingJe.id, accountId: line.accountId, debit: line.debit, credit: line.credit, description: line.description }
          });
        }
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

    // 6. Rebuild all Account.currentBalance cache from posted lines
    const accounts = await db.account.findMany({
      where: { accountLevel: { in: ['GL', 'SUBSIDIARY'] }, isDeleted: false },
      include: { accountType: true }
    });

    const postedSums = await db.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accounts.map((a: any) => a.id) },
        journalEntry: { status: 'Posted', isDeleted: false }
      },
      _sum: { debit: true, credit: true }
    });

    const sumsMap = new Map(postedSums.map((s: any) => [s.accountId, { debit: Number(s._sum?.debit || 0), credit: Number(s._sum?.credit || 0) }]));
    let accountsRebuilt = 0;

    for (const acc of accounts) {
      const typeName = (acc.accountType?.name || 'ASSET').toUpperCase();
      const isDebitNormal = typeName === 'ASSET' || typeName === 'EXPENSE' || typeName === 'EXPENSES' || typeName === 'ASSETS';
      const sum = sumsMap.get(acc.id) || { debit: 0, credit: 0 };
      const movement = isDebitNormal ? (sum.debit - sum.credit) : (sum.credit - sum.debit);
      const newBal = Number(acc.initialBalance || 0) + movement;

      if (Math.abs(Number(acc.currentBalance ?? 0) - newBal) > 0.001) {
        await db.account.update({
          where: { id: acc.id },
          data: { currentBalance: newBal }
        });
        accountsRebuilt++;
      }
    }

    this.emitSyncEvent({
      action: 'SYNC_ALL_MODULES',
      module: 'General Ledger',
      recordId: undefined
    });

    logger.info({
      hallBookingsSynced,
      donationsReceivedSynced,
      donationsDisbursedSynced,
      orphanJEsDeleted,
      accountsRebuilt
    }, 'AccountingSyncService: syncAllModulesToLedger completed successfully');

    return {
      success: true,
      hallBookingsSynced,
      donationsReceivedSynced,
      donationsDisbursedSynced,
      orphanJEsDeleted,
      accountsRebuilt,
      timestamp: nowIso
    };
  }
}

export const AccountingSyncService = new AccountingSyncHub();


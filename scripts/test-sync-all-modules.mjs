import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('Starting full synchronization check...');

  // Standard Accounts
  let cashAccount = await prisma.account.findFirst({
    where: {
      OR: [
        { glCode: '1010103' },
        { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
        { detailType: 'Cash' }
      ],
      isLocked: false,
      children: { none: {} }
    },
    orderBy: { glCode: 'asc' }
  });

  let defaultBank = await prisma.account.findFirst({
    where: {
      detailType: 'Bank',
      isLocked: false,
      children: { none: {} }
    },
    orderBy: { glCode: 'asc' }
  });

  let generalDonationAccount = await prisma.account.findFirst({
    where: {
      OR: [
        { glCode: '3020401' },
        { glCode: '3020408' },
        { accountName: { equals: 'General Donation', mode: 'insensitive' } }
      ]
    }
  });

  let arAccount = await prisma.account.findFirst({
    where: {
      OR: [
        { glCode: '1010200' },
        { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } }
      ],
      children: { none: {} }
    }
  });

  console.log('Resolved Accounts:');
  console.log('- Cash:', cashAccount?.accountName, cashAccount?.glCode);
  console.log('- Bank:', defaultBank?.accountName, defaultBank?.glCode);
  console.log('- General Donation:', generalDonationAccount?.accountName, generalDonationAccount?.glCode);
  console.log('- AR:', arAccount?.accountName, arAccount?.glCode);

  // 1. Hall Bookings
  const hallBookings = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: { hallAccount: true, journalEntry: { include: { lines: true } } }
  });
  console.log(`Found ${hallBookings.length} active HallBookings.`);

  let hbSynced = 0;
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
      const matchingHall = await prisma.account.findFirst({
        where: {
          detailType: 'Hall',
          accountType: { name: { in: ['Revenue', 'REVENUE', 'Income', 'INCOME'] } }
        }
      });
      revenueAccountId = matchingHall?.id || generalDonationAccount.id;
    }

    const lines = [];
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
      existingJe = await prisma.journalEntry.findUnique({
        where: { id: hb.journalEntryId },
        include: { lines: true }
      });
    }

    if (existingJe) {
      await prisma.journalEntry.update({
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
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
      await prisma.journalEntryLine.createMany({
        data: lines.map(l => ({
          journalEntryId: existingJe.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description
        }))
      });
      if (hb.status !== 'POSTED') {
        await prisma.hallBooking.update({
          where: { id: hb.id },
          data: { status: 'POSTED' }
        });
      }
    } else {
      const voucherNo = `BR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newJe = await prisma.journalEntry.create({
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
      await prisma.hallBooking.update({
        where: { id: hb.id },
        data: { journalEntryId: newJe.id, status: 'POSTED' }
      });
    }
    hbSynced++;
  }
  console.log(`Synced ${hbSynced} Hall Bookings.`);

  // 2. Donations Received
  const donRecs = await prisma.donationReceived.findMany({
    where: { isDeleted: false },
    include: { journalEntry: { include: { lines: true } } }
  });
  console.log(`Found ${donRecs.length} active DonationsReceived.`);

  let donSynced = 0;
  for (const d of donRecs) {
    const amount = Number(d.amount || 0);
    if (amount <= 0) continue;

    let debitAccId = cashAccount.id;
    if (d.paymentMethod !== 'CASH') {
      debitAccId = d.bankAccountId || defaultBank?.id || cashAccount.id;
    }

    let creditAccId = generalDonationAccount.id;
    if (d.donationType === 'ZAKAT') {
      const zakatRev = await prisma.account.findFirst({
        where: {
          OR: [
            { glCode: '3020101' },
            { accountName: { contains: 'Zakat', mode: 'insensitive' }, accountType: { name: { in: ['Revenue', 'REVENUE', 'Income', 'INCOME'] } } }
          ],
          children: { none: {} }
        }
      });
      if (zakatRev) creditAccId = zakatRev.id;
    }

    const lines = [
      { accountId: debitAccId, debit: amount, credit: 0, description: `Receipt: Donation from ${d.donorId || 'Donor'} (${d.donationType})` },
      { accountId: creditAccId, debit: 0, credit: amount, description: `Revenue: Donation from ${d.donorId || 'Donor'} (${d.donationType})` }
    ];

    const postingDate = d.receiptDate || d.createdAt || new Date();
    let existingJe = d.journalEntry;
    if (!existingJe && d.journalEntryId) {
      existingJe = await prisma.journalEntry.findUnique({
        where: { id: d.journalEntryId },
        include: { lines: true }
      });
    }

    if (existingJe) {
      await prisma.journalEntry.update({
        where: { id: existingJe.id },
        data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: `DNR-${d.receiptNo}` }
      });
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
      await prisma.journalEntryLine.createMany({
        data: lines.map(l => ({
          journalEntryId: existingJe.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description
        }))
      });
      if (d.status !== 'POSTED') {
        await prisma.donationReceived.update({ where: { id: d.id }, data: { status: 'POSTED' } });
      }
    } else {
      const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newJe = await prisma.journalEntry.create({
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
      await prisma.donationReceived.update({
        where: { id: d.id },
        data: { journalEntryId: newJe.id, status: 'POSTED' }
      });
    }
    donSynced++;
  }
  console.log(`Synced ${donSynced} Donations Received.`);

  // 3. Revenue Collections (Specialized Revenue / Membership Fees)
  const revCollections = await prisma.revenueCollection.findMany({
    where: { isDeleted: false },
    include: { journalEntry: { include: { lines: true } } }
  });
  console.log(`Found ${revCollections.length} active RevenueCollections.`);

  let rcSynced = 0;
  for (const rc of revCollections) {
    const amount = Number(rc.amount || 0);
    if (amount <= 0) continue;

    let debitAccId = cashAccount.id;
    if (rc.paymentMethod !== 'CASH') {
      debitAccId = rc.bankAccountId || defaultBank?.id || cashAccount.id;
    }

    // Resolve revenue account based on category
    let creditAcc = null;
    const catUpper = (rc.category || '').toUpperCase();
    if (catUpper.includes('MEMBERSHIP')) {
      creditAcc = await prisma.account.findFirst({
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
      creditAcc = await prisma.account.findFirst({
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
      creditAcc = await prisma.account.findFirst({
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
      existingJe = await prisma.journalEntry.findUnique({
        where: { id: rc.journalEntryId },
        include: { lines: true }
      });
    }

    if (existingJe) {
      await prisma.journalEntry.update({
        where: { id: existingJe.id },
        data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: `REV-${rc.receiptNo || rc.id.slice(0, 8)}` }
      });
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
      await prisma.journalEntryLine.createMany({
        data: lines.map(l => ({
          journalEntryId: existingJe.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description
        }))
      });
      if (rc.status !== 'POSTED') {
        await prisma.revenueCollection.update({ where: { id: rc.id }, data: { status: 'POSTED' } });
      }
    } else {
      const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newJe = await prisma.journalEntry.create({
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
      await prisma.revenueCollection.update({
        where: { id: rc.id },
        data: { journalEntryId: newJe.id, status: 'POSTED' }
      });
    }
    rcSynced++;
  }
  console.log(`Synced ${rcSynced} Revenue Collections.`);

  // 4. Add Income Records
  const addIncomes = await prisma.addIncomeRecord.findMany({
    where: { isDeleted: false },
    include: { category: true, journalEntry: { include: { lines: true } } }
  });
  console.log(`Found ${addIncomes.length} active AddIncomeRecords.`);

  let aiSynced = 0;
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
      const matched = await prisma.account.findFirst({
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
      existingJe = await prisma.journalEntry.findUnique({
        where: { id: ai.journalEntryId },
        include: { lines: true }
      });
    }

    if (existingJe) {
      await prisma.journalEntry.update({
        where: { id: existingJe.id },
        data: { status: 'Posted', isDeleted: false, deletedAt: null, deletedBy: null, postingDate, reference: ai.referenceNumber || `INC-${ai.id.slice(0, 8)}` }
      });
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: existingJe.id } });
      await prisma.journalEntryLine.createMany({
        data: lines.map(l => ({
          journalEntryId: existingJe.id,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description
        }))
      });
      if (ai.status !== 'POSTED') {
        await prisma.addIncomeRecord.update({ where: { id: ai.id }, data: { status: 'POSTED' } });
      }
    } else {
      const voucherNo = `CR-${postingDate.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newJe = await prisma.journalEntry.create({
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
      await prisma.addIncomeRecord.update({
        where: { id: ai.id },
        data: { journalEntryId: newJe.id, status: 'POSTED' }
      });
    }
    aiSynced++;
  }
  console.log(`Synced ${aiSynced} Add Income Records.`);

  // Recalculate all account balances
  console.log('Recalculating all account balances...');
  const { AccountingService } = await import('../api/_services/accounting.service.js');
  await AccountingService.recalculateAllBalances();

  // Test summary
  const summary = await AccountingService.getFinancialSummary();
  console.log('=== SYNCHRONIZED FINANCIAL SUMMARY ===');
  console.log('Total Revenue:', summary.totalRevenue);
  console.log('Total Expense:', summary.totalExpense);
  console.log('Net Period Income:', summary.netPeriodIncome);
  console.log('Total Assets:', summary.totalAssets);
  console.log('Total Liabilities:', summary.totalLiabilities);
  console.log('Total Equity:', summary.totalEquity);
  console.log('Is Equation Balanced:', summary.isEquationBalanced);
  console.log('Cash Balance:', summary.cashBalance);
  console.log('Bank Balance:', summary.bankBalance);

  await prisma.$disconnect();
}
run().catch(console.error);

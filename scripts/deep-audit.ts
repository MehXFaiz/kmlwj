import { prisma } from '../api/_prisma.js';

async function deepAudit() {
  console.log('=== DEEP AUDIT DETAILS ===\n');

  // 1. Financial Years
  const fys = await prisma.financialYear.findMany();
  console.log('--- Financial Years ---');
  for (const fy of fys) {
    console.log(`FY Code: ${fy.code}, Name: ${fy.name}, Start: ${fy.startDate.toISOString()}, End: ${fy.endDate.toISOString()}, Closed: ${fy.isClosed}`);
  }

  // 2. Hall Bookings detail
  const hbs = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: {
      hallAccount: { include: { accountType: true } },
      journalEntry: {
        include: {
          lines: {
            include: { account: { include: { accountType: true } } }
          }
        }
      }
    }
  });

  console.log(`\n--- Hall Bookings (${hbs.length} total) ---`);
  let netSum = 0;
  let recSum = 0;
  let remSum = 0;
  let chargeSum = 0;
  let discSum = 0;

  for (const hb of hbs) {
    netSum += hb.netAmount || 0;
    recSum += hb.receivedAmount || 0;
    remSum += hb.remainingAmount || 0;
    chargeSum += hb.hallCharges || 0;
    discSum += hb.discount || 0;

    const je = hb.journalEntry;
    const linesCount = je?.lines?.length || 0;
    const lineDebits = je?.lines?.reduce((s, l) => s + l.debit, 0) || 0;
    const lineCredits = je?.lines?.reduce((s, l) => s + l.credit, 0) || 0;

    console.log(`Booking #${hb.receiptNo}: Booker: "${hb.bookerName}", Status: ${hb.status}, ProgDate: ${hb.programDate.toISOString().slice(0, 10)}, BookDate: ${hb.bookingDate?.toISOString().slice(0, 10)}, Charges: ${hb.hallCharges}, Disc: ${hb.discount}, Net: ${hb.netAmount}, Rec: ${hb.receivedAmount}, Rem: ${hb.remainingAmount}, JE: ${hb.journalEntryId ? `${je?.voucherNo} (${je?.status}) [${linesCount} lines, Dr: ${lineDebits}, Cr: ${lineCredits}]` : 'NONE'}`);
  }

  console.log(`\nTotals: Charges=${chargeSum}, Discount=${discSum}, Net=${netSum}, Received=${recSum}, Remaining=${remSum}`);

  // 3. Inspect all Journal Entries in the system
  const allJEs = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    include: {
      lines: {
        include: { account: { include: { accountType: true } } }
      }
    }
  });

  console.log(`\n--- ALL JOURNAL ENTRIES (${allJEs.length} total) ---`);
  let emptyJEs = 0;
  for (const je of allJEs) {
    const linesCount = je.lines.length;
    if (linesCount === 0) {
      emptyJEs++;
      console.log(`EMPTY JE: ${je.voucherNo} | Status: ${je.status} | Date: ${je.postingDate.toISOString().slice(0, 10)} | Ref: ${je.reference} | Desc: ${je.description}`);
    } else {
      console.log(`JE: ${je.voucherNo} | ${je.voucherType} | Status: ${je.status} | Date: ${je.postingDate.toISOString().slice(0, 10)} | Ref: ${je.reference} | Lines: ${linesCount}`);
      for (const line of je.lines) {
        console.log(`   -> Line: [${line.account?.glCode}] ${line.account?.accountName} (${line.account?.accountType?.name}) | Dr: ${line.debit} | Cr: ${line.credit} | Desc: ${line.description}`);
      }
    }
  }
  console.log(`Empty JEs count: ${emptyJEs} / ${allJEs.length}`);
}

deepAudit().catch(console.error).finally(() => prisma.$disconnect());

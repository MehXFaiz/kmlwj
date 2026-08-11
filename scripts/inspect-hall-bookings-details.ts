import { prisma } from '../api/_prisma.js';

async function main() {
  console.log('=== HALL BOOKINGS IN DATABASE ===');
  const hbs = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: {
      hallAccount: { include: { accountType: true } },
      bankAccount: { include: { accountType: true } },
    }
  });

  for (const hb of hbs) {
    console.log(`Booking ID: ${hb.id}`);
    console.log(`  Booking No: ${hb.bookingNo} | Customer: ${hb.customerName} | Hall: ${hb.hallName} | Event Date: ${hb.eventDate?.toISOString()}`);
    console.log(`  Created Date: ${hb.createdAt?.toISOString()} | Status: ${hb.status}`);
    console.log(`  Net Amount: ${hb.netAmount} | Total Amount: ${hb.totalAmount} | Advance: ${hb.advanceAmount}`);
    console.log(`  Hall GL: ${hb.hallAccount?.glCode} (${hb.hallAccount?.accountName})`);
    
    // Find journal entries matching reference or description
    const jes = await prisma.journalEntry.findMany({
      where: {
        isDeleted: false,
        OR: [
          { reference: { contains: hb.id } },
          { reference: { contains: hb.bookingNo || 'HB' } },
          { description: { contains: hb.customerName || 'Hall' } }
        ]
      },
      include: {
        lines: { include: { account: { include: { accountType: true } } } }
      }
    });
    console.log(`  Associated Journal Entries (${jes.length}):`);
    for (const je of jes) {
      console.log(`    JE ID: ${je.id} | Voucher: ${je.voucherNo} | Date: ${je.postingDate.toISOString()} | Status: ${je.status}`);
      for (const l of je.lines) {
        console.log(`      Line: ${l.account?.glCode} ${l.account?.accountName} (${l.account?.accountType?.name}) | Dr: ${l.debit} | Cr: ${l.credit}`);
      }
    }
  }

  console.log('\n=== ALL POSTED JOURNAL ENTRIES WITH HALL IN DESCRIPTION/REFERENCE ===');
  const allHbJes = await prisma.journalEntry.findMany({
    where: {
      isDeleted: false,
      status: 'Posted',
      OR: [
        { reference: { contains: 'HB', mode: 'insensitive' } },
        { description: { contains: 'Hall', mode: 'insensitive' } }
      ]
    },
    include: {
      lines: { include: { account: { include: { accountType: true } } } }
    }
  });
  for (const je of allHbJes) {
    console.log(`JE ID: ${je.id} | Voucher: ${je.voucherNo} | Date: ${je.postingDate.toISOString().slice(0, 10)} | Ref: ${je.reference} | Desc: ${je.description}`);
    for (const l of je.lines) {
      console.log(`  Account: ${l.account?.glCode} ${l.account?.accountName} (${l.account?.accountType?.name}) | Dr: ${l.debit} | Cr: ${l.credit}`);
    }
  }
}

main().finally(() => prisma.$disconnect());

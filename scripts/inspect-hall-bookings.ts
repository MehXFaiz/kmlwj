import { prisma } from '../api/_prisma.js';

async function inspectHallBookings() {
  const hbs = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: { hallAccount: true, bankAccount: true }
  });

  console.log(`Found ${hbs.length} hall bookings:`);
  for (const hb of hbs) {
    console.log(`ID: ${hb.id} | #${hb.receiptNo} | Booker: ${hb.bookerName} | HallId: ${hb.hallId} | HallAcc: ${hb.hallAccount?.accountName} (${hb.hallAccount?.glCode}) | Method: ${hb.paymentMethod} | BankId: ${hb.bankAccountId} | Net: ${hb.netAmount} | Rec: ${hb.receivedAmount} | Status: ${hb.status} | BookDate: ${hb.bookingDate?.toISOString()} | ProgDate: ${hb.programDate?.toISOString()}`);
  }
}

inspectHallBookings().catch(console.error).finally(() => prisma.$disconnect());

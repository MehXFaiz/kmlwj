import { prisma } from '../api/_prisma.js';

const MEMBER_NO_PREFIX = 'KML-';

async function nextMemberNo(): Promise<string> {
  const existing = await prisma.member.findMany({
    where: { memberNo: { startsWith: MEMBER_NO_PREFIX } },
    select: { memberNo: true },
  });
  const maxNum = existing.reduce((max, m) => {
    const n = parseInt(m.memberNo!.slice(MEMBER_NO_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${MEMBER_NO_PREFIX}${String(maxNum + 1).padStart(4, '0')}`;
}

async function main() {
  console.log('=== MIGRATING EXISTING MEMBERSHIP FEE COLLECTIONS TO MEMBERS ===');

  const feeCollections = await prisma.revenueCollection.findMany({
    where: { category: 'Membership Fee' },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${feeCollections.length} membership fee records to inspect.`);

  let linkedCount = 0;
  let createdCount = 0;

  for (const fee of feeCollections) {
    let member = null;

    // 1. Try matching by memberId if already set
    if (fee.memberId) {
      member = await prisma.member.findUnique({ where: { id: fee.memberId } });
    }

    // 2. Try matching by subTitle (memberNo or CNIC)
    if (!member && fee.subTitle) {
      member = await prisma.member.findFirst({
        where: {
          OR: [
            { memberNo: fee.subTitle.trim() },
            { cnic: fee.subTitle.trim().replace(/-/g, '') }
          ],
          isDeleted: false
        }
      });
    }

    // 3. Try matching by exact mobile
    if (!member && fee.mobile) {
      member = await prisma.member.findFirst({
        where: { mobile: fee.mobile.trim(), isDeleted: false }
      });
    }

    // 4. Try matching by normalized title/fullName
    if (!member && fee.title) {
      const cleanTitle = fee.title.split('S/O')[0].split('s/o')[0].trim();
      member = await prisma.member.findFirst({
        where: {
          fullName: { equals: cleanTitle, mode: 'insensitive' },
          isDeleted: false
        }
      });
    }

    if (member) {
      // Link to existing member
      await prisma.revenueCollection.update({
        where: { id: fee.id },
        data: { memberId: member.id, subTitle: member.memberNo || member.cnic || fee.subTitle }
      });
      console.log(`Linked receipt #${fee.receiptNo} ("${fee.title}") -> Existing Member ${member.memberNo} (${member.fullName})`);
      linkedCount++;
    } else {
      // Extract metadata from title and remarks
      let fullName = fee.title.trim();
      let fatherName: string | null = null;
      let ghamName: string | null = null;

      if (fee.title.toUpperCase().includes('S/O')) {
        const parts = fee.title.split(/s\/o/i);
        fullName = parts[0].trim();
        fatherName = parts[1].replace(/late/i, '').trim();
      }

      if (fee.remarks) {
        const fMatch = fee.remarks.match(/Father:\s*([^|\n]+)/i);
        if (fMatch && !fatherName) fatherName = fMatch[1].trim();

        const gMatch = fee.remarks.match(/Gham:\s*([^|\n]+)/i);
        if (gMatch) ghamName = gMatch[1].trim();
      }

      const assignedNo = await nextMemberNo();
      const eventDateStr = fee.eventDate ? fee.eventDate.toISOString().split('T')[0] : '2026-07-01';
      const eventYear = fee.eventDate ? fee.eventDate.getFullYear() : 2026;
      const expiryDateStr = `${eventYear + 1}-06-30`;

      const newMember = await prisma.member.create({
        data: {
          memberNo: assignedNo,
          fullName,
          fatherName: fatherName || null,
          mobile: fee.mobile || null,
          address: fee.destination || null,
          area: fee.destination || null,
          city: 'Karachi',
          ghamName: ghamName || null,
          membershipType: 'Regular',
          feeAmount: fee.rate || fee.amount || 300,
          startDate: eventDateStr,
          expiryDate: expiryDateStr,
          doi: eventDateStr,
          isActive: true,
          isDeleted: false,
        }
      });

      await prisma.revenueCollection.update({
        where: { id: fee.id },
        data: { memberId: newMember.id, subTitle: newMember.memberNo }
      });

      console.log(`Created Member ${newMember.memberNo} ("${newMember.fullName}") and linked receipt #${fee.receiptNo}`);
      createdCount++;
    }
  }

  console.log(`\nMigration completed: ${linkedCount} linked to existing, ${createdCount} created as new linked members.`);
}

main().finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const masterData = [
  { name: 'Bagh-e-Hajiani Garden', category: 'Hall Bookings' },
  { name: 'Sadaya Hall', category: 'Hall Bookings' },
  { name: 'Zikarya Hall', category: 'Hall Bookings' },
  { name: 'Annexy Hall', category: 'Hall Bookings' },
  { name: 'Membership Fee', category: 'Other Income' },
  { name: 'Bus Booking', category: 'Other Income' },
  { name: 'Zakat', category: 'Other Income' },
  { name: 'Fitra', category: 'Other Income' },
  { name: 'Qurbani', category: 'Other Income' },
  { name: 'Marriage Donation', category: 'Other Income' },
  { name: 'Decoration Commission', category: 'Other Income' },
];

async function main() {
  console.log('Seeding master data for RevenueHeads...');
  for (const item of masterData) {
    // Upsert or simply create if not exists
    const existing = await prisma.revenueHead.findFirst({
      where: { name: item.name, category: item.category },
    });
    
    if (!existing) {
      await prisma.revenueHead.create({
        data: {
          name: item.name,
          category: item.category,
          isActive: true,
        },
      });
      console.log(`Created: ${item.name} (${item.category})`);
    } else {
      console.log(`Skipped (already exists): ${item.name}`);
    }
  }
  console.log('Done seeding master data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from '../api/_prisma.js';

async function main() {
  console.log('Fixing Member_cnic_key to be sparse unique...');

  try {
    await prisma.$runCommandRaw({
      dropIndexes: 'Member',
      index: 'Member_cnic_key'
    });
    console.log('Dropped old non-sparse Member_cnic_key');
  } catch (err: any) {
    console.log('Drop index note:', err.message);
  }

  await prisma.$runCommandRaw({
    createIndexes: 'Member',
    indexes: [
      {
        key: { cnic: 1 },
        name: 'Member_cnic_key',
        unique: true,
        sparse: true
      }
    ]
  });
  console.log('Created sparse unique index Member_cnic_key successfully!');
}

main().finally(() => prisma.$disconnect());

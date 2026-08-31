import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import { prisma } from '../api/_prisma.js';

async function test() {
  try {
    const batch = await prisma.openingBalanceBatch.findUnique({
      where: { financialYear: 'FY 2026-2027' },
      include: {
        lines: {
          include: {
            account: true
          }
        }
      }
    });
    console.log('Opening balance batch loaded successfully!');
    console.log(JSON.stringify(batch, null, 2));
  } catch (err) {
    console.error('Error loading opening balance batch:');
    console.error(err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();

import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import { prisma } from '../api/_prisma.js';

async function test() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' },
    });
    console.log('User found:', user);
  } catch (err) {
    console.error('Caught error as expected:');
    console.error(err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();

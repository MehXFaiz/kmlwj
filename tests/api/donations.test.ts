import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../api/index';
import { prisma } from '../../api/_prisma';
import { AccountingService } from '../../api/_services/accounting.service';

describe('Donations Monthly Restriction API', () => {
  let token: string;
  let beneficiaryId: string;
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  beforeAll(async () => {
    // Generate auth token for testing
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'super admin', 'administrator'], mode: 'insensitive' } } }
    });
    const subId = adminUser ? adminUser.id : 'admin-user-id';
    const email = adminUser ? adminUser.email : 'admin@erp.com';
    token = jwt.sign({ sub: subId, email, role: 'admin' }, secret);

    // Create a temporary beneficiary for testing
    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: 'Test Beneficiary ' + Math.random().toString(36).substring(7),
        cnic: '42101-' + Math.floor(1000000 + Math.random() * 9000000) + '-1',
        mobile: '0300' + Math.floor(1000000 + Math.random() * 9000000),
        isActive: true,
      }
    });
    // Ensure Cash account has sufficient balance for test disbursements
    const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
    await prisma.account.update({
      where: { id: cashAccount.id },
      data: { initialBalance: 1000000, currentBalance: 1000000 }
    });

    beneficiaryId = beneficiary.id;
  }, 30000);

  afterAll(async () => {
    if (beneficiaryId) {
      // Find journal entries related to the donations and delete them to avoid foreign key violations or database clutter
      const testDonations = await prisma.donation.findMany({
        where: { beneficiaryId }
      });
      for (const d of testDonations) {
        const ref = `DON-${d.id.substring(0, 8)}`;
        const je = await prisma.journalEntry.findFirst({ where: { reference: ref } });
        if (je) {
          try {
            await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } });
            await prisma.journalEntry.delete({ where: { id: je.id } });
          } catch (e) {
            // Ignore
          }
        }
      }

      await prisma.donation.deleteMany({
        where: { beneficiaryId }
      });
      await prisma.beneficiary.delete({
        where: { id: beneficiaryId }
      });

      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      await prisma.account.update({
        where: { id: cashAccount.id },
        data: { initialBalance: 0, currentBalance: 0 }
      });
    }
  }, 30000);

  it('should successfully log the first donation for a beneficiary in the calendar month', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        beneficiaryId,
        donorName: 'Test Beneficiary',
        donorMobile: '03001234567',
        donationType: 'MONTHLY',
        amount: '15000',
        paymentMethod: 'CASH',
        remarks: 'First donation'
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('APPROVED');
  }, 30000);

  it('should allow logging a second approved donation for the same beneficiary in the same calendar month', async () => {
    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        beneficiaryId,
        donorName: 'Test Beneficiary',
        donorMobile: '03001234567',
        donationType: 'MONTHLY',
        amount: '20000',
        paymentMethod: 'CASH',
        remarks: 'Second donation'
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('APPROVED');
  }, 30000);
});

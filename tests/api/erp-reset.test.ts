import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../api/index';
import { ErpResetService } from '../../api/_services/erp-reset.service';

describe('ERP Data Reset API Security & Authorization', () => {
  it('should reject unauthenticated preview requests with 401', async () => {
    const response = await request(app).get('/api/v1/admin/erp-reset/preview');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toMatch(/token required|Authentication required/i);
  });

  it('should reject unauthenticated reset execution requests with 401', async () => {
    const response = await request(app)
      .post('/api/v1/admin/erp-reset')
      .send({ confirmationText: 'RESET ERP', resetMode: 'TRANSACTIONS_ONLY' });
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should validate isResetFeatureAllowed when environment flags are set', () => {
    const originalEnv = process.env.ALLOW_ERP_RESET;
    try {
      process.env.ALLOW_ERP_RESET = 'false';
      expect(ErpResetService.isResetFeatureAllowed()).toBe(false);

      delete process.env.ALLOW_ERP_RESET;
      expect(ErpResetService.isResetFeatureAllowed()).toBe(true);
    } finally {
      process.env.ALLOW_ERP_RESET = originalEnv;
    }
  });

  it('should enforce exact confirmation text "RESET ERP"', async () => {
    await expect(
      ErpResetService.executeReset({
        userId: 'dummy-id',
        resetMode: 'TRANSACTIONS_ONLY',
        confirmationText: 'WRONG_CONFIRMATION',
      })
    ).rejects.toThrow(/RESET ERP/);
  });
});

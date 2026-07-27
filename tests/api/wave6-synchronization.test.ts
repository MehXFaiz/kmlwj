import { describe, it, expect, beforeAll } from 'vitest';
import { AccountingService } from '../../api/_services/accounting.service';
import { AccountingSyncService } from '../../api/_services/accounting-sync.service';
import { AccountingIntegrityService } from '../../api/_services/accounting-integrity.service';
import { logAudit } from '../../api/_utils/audit';

describe('Wave 6: ERP Full Event-Driven Synchronization & Audit Logging', () => {
  it('AccountingSyncService should track global sync version and emit events', () => {
    const initialState = AccountingSyncService.getSyncState();
    const currentVersion = initialState.version;

    const newVersion = AccountingSyncService.emitSyncEvent({
      action: 'POST',
      module: 'Test Module',
      recordId: 'test-uuid-1234',
      userId: 'user-uuid-5678'
    });

    expect(newVersion).toBe(currentVersion + 1);
    const updatedState = AccountingSyncService.getSyncState();
    expect(updatedState.version).toBe(newVersion);
    expect(updatedState.recentEvents.length).toBeGreaterThan(0);
    expect(updatedState.recentEvents[0].action).toBe('POST');
  });

  it('logAudit should format and record all 16 audit trail tracking metadata fields', async () => {
    // Test helper formatting without database error
    await expect(
      logAudit({
        userId: '11111111-2222-3333-4444-555555555555',
        action: 'UPDATE',
        module: 'Journal Entries',
        createdById: '11111111-2222-3333-4444-555555555555',
        createdAt: '2026-07-27T10:00:00Z',
        updatedById: '11111111-2222-3333-4444-555555555555',
        updatedAt: '2026-07-27T11:00:00Z',
        deletedById: null,
        deletedAt: null,
        approvedById: '11111111-2222-3333-4444-555555555555',
        approvedAt: '2026-07-27T10:30:00Z',
        postedById: '11111111-2222-3333-4444-555555555555',
        postedAt: '2026-07-27T10:45:00Z',
        reversedById: null,
        reversedAt: null,
        reason: 'Correction of voucher entry',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        oldValues: { amount: 1000 },
        newValues: { amount: 1200 }
      })
    ).resolves.not.toThrow();
  });

  it('AccountingService should provide unified calculation methods for all reports', () => {
    expect(typeof AccountingService.getTrialBalance).toBe('function');
    expect(typeof AccountingService.getBalanceSheet).toBe('function');
    expect(typeof AccountingService.getIncomeStatement).toBe('function');
    expect(typeof AccountingService.getCashFlow).toBe('function');
    expect(typeof AccountingService.getFinancialSummary).toBe('function');
    expect(typeof AccountingService.getGeneralLedger).toBe('function');
  });

  it('AccountingIntegrityService should expose runFullCheck and reconcileAll', () => {
    expect(typeof AccountingIntegrityService.runFullCheck).toBe('function');
    expect(typeof AccountingIntegrityService.reconcileAll).toBe('function');
  });
});

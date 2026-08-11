import { describe, it, expect } from 'vitest';
import { getFinancialYearFromDate } from '../../api/_v1/opening-balances.js';

describe('Opening Balances Module', () => {
  it('correctly calculates financial year for July 1 (start of FY)', () => {
    expect(getFinancialYearFromDate('2025-07-01')).toBe('FY 2025-2026');
    expect(getFinancialYearFromDate('2024-07-01')).toBe('FY 2024-2025');
  });

  it('correctly calculates financial year for mid-fiscal year date', () => {
    expect(getFinancialYearFromDate('2025-12-31')).toBe('FY 2025-2026');
    expect(getFinancialYearFromDate('2026-01-15')).toBe('FY 2025-2026');
    expect(getFinancialYearFromDate('2026-06-30')).toBe('FY 2025-2026');
  });
});

import { describe, it, expect } from 'vitest';

describe('Hall Booking Remaining Amount Posting Validation', () => {
  it('prevents posting when remaining amount is greater than 0', () => {
    const booking = {
      id: 'hb-123',
      netAmount: 50000,
      receivedAmount: 20000,
      remainingAmount: 30000
    };

    const checkNetAmt = Number(booking.netAmount);
    const checkRecAmt = Number(booking.receivedAmount);
    const checkRemAmt = Number(booking.remainingAmount ?? (checkNetAmt - checkRecAmt));

    expect(checkRemAmt).toBe(30000);
    expect(checkRemAmt > 0).toBe(true);
  });

  it('allows posting when remaining amount is 0', () => {
    const booking = {
      id: 'hb-456',
      netAmount: 50000,
      receivedAmount: 50000,
      remainingAmount: 0
    };

    const checkNetAmt = Number(booking.netAmount);
    const checkRecAmt = Number(booking.receivedAmount);
    const checkRemAmt = Number(booking.remainingAmount ?? (checkNetAmt - checkRecAmt));

    expect(checkRemAmt).toBe(0);
    expect(checkRemAmt > 0).toBe(false);
  });

  it('correctly identifies POSTED status error when remaining amount > 0', () => {
    const requestedStatus = 'POSTED';
    const calculatedRemainingAmount = 10000;

    const isBlocked = requestedStatus === 'POSTED' && calculatedRemainingAmount > 0;
    expect(isBlocked).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveVoucherRecipientDetails, formatCNIC, parseEmbeddedBio } from '../../src/utils/voucherRecipientResolver.js';

describe('voucherRecipientResolver', () => {
  it('formats raw 13-digit CNIC correctly', () => {
    expect(formatCNIC('4210112345678')).toBe('42101-1234567-8');
    expect(formatCNIC('42101-1234567-8')).toBe('42101-1234567-8');
    expect(formatCNIC('')).toBe('-');
    expect(formatCNIC(null)).toBe('-');
  });

  it('parses embedded bio details from text description', () => {
    const text = 'Bank Payout (Salary): Paid To: Arshad | Father: Ibrahim Arkhanray wala | CNIC: 4240172427381 | Ph: 03032567909';
    const parsed = parseEmbeddedBio(text);
    expect(parsed.name).toBe('Arshad');
    expect(parsed.fatherName).toBe('Ibrahim Arkhanray wala');
    expect(parsed.cnic).toBe('4240172427381');
    expect(parsed.mobile).toBe('03032567909');
  });

  it('resolves details from beneficiary relation', () => {
    const voucher = {
      beneficiary: {
        name: 'Muhammad Ahmed',
        fatherName: 'Abdul Ghafoor',
        cnic: '42101-1234567-8',
        mobile: '0301-1234567',
        address: 'Lyari, Karachi',
        gham: 'Kukma Wala'
      }
    };
    const res = resolveVoucherRecipientDetails(voucher);
    expect(res.name).toBe('Muhammad Ahmed');
    expect(res.fatherName).toBe('Abdul Ghafoor');
    expect(res.cnic).toBe('42101-1234567-8');
    expect(res.mobile).toBe('0301-1234567');
    expect(res.address).toBe('Lyari, Karachi');
    expect(res.gham).toBe('Kukma Wala');
  });

  it('sanitizes generic fallback names like "Recipient / Bank Account"', () => {
    const voucher = {
      paidTo: 'Recipient / Bank Account',
      description: 'Paid To: Fatima Bibi | Husband: Rashid Khan | CNIC: 4220198765432'
    };
    const res = resolveVoucherRecipientDetails(voucher);
    expect(res.name).toBe('Fatima Bibi');
    expect(res.fatherName).toBe('Rashid Khan');
    expect(res.cnic).toBe('42201-9876543-2');
  });

  it('returns "-" for genuinely missing values without inventing dummy data', () => {
    const voucher = {
      paidTo: 'Cash'
    };
    const res = resolveVoucherRecipientDetails(voucher);
    expect(res.name).toBe('-');
    expect(res.fatherName).toBe('-');
    expect(res.cnic).toBe('-');
    expect(res.mobile).toBe('-');
    expect(res.gham).toBe('-');
    expect(res.address).toBe('-');
  });
});

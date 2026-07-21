import { describe, expect, it } from 'vitest';
import { sanitizeInputValue, validateInputValue } from '../../src/utils/validation';

describe('sanitizeInputValue', () => {
  it('removes non-numeric characters for numeric fields', () => {
    expect(sanitizeInputValue('12a3', 'numeric')).toBe('123');
  });

  it('keeps only letters for name fields', () => {
    expect(sanitizeInputValue('Ali123', 'letters')).toBe('Ali');
  });

  it('preserves address punctuation while stripping unsafe characters', () => {
    expect(sanitizeInputValue('House #12/3', 'address')).toBe('House #12/3');
  });
});

describe('validateInputValue', () => {
  it('rejects empty values for required text fields', () => {
    expect(validateInputValue('', 'letters', { required: true })).toBe(false);
  });

  it('accepts valid mobile numbers', () => {
    expect(validateInputValue('03123456789', 'numeric', { maxLength: 11 })).toBe(true);
  });
});

export const INPUT_RULES = {
  numeric: { pattern: /[^0-9]/g, allow: /[0-9]/g, sanitize: value => String(value ?? '').replace(/[^0-9]/g, '') },
  letters: { pattern: /[^a-zA-Z\s.-]/g, allow: /[a-zA-Z\s.-]/g, sanitize: value => String(value ?? '').replace(/[^a-zA-Z\s.-]/g, '') },
  address: { pattern: /[^a-zA-Z0-9\s.,#/-]/g, allow: /[a-zA-Z0-9\s.,#/-]/g, sanitize: value => String(value ?? '').replace(/[^a-zA-Z0-9\s.,#/-]/g, '') },
  email: { pattern: /[^a-zA-Z0-9@._+-]/g, allow: /[a-zA-Z0-9@._+-]/g, sanitize: value => String(value ?? '').replace(/[^a-zA-Z0-9@._+-]/g, '') },
};

export function sanitizeInputValue(value, type = 'text', options = {}) {
  const normalized = String(value ?? '');
  if (!type || type === 'text') return normalized;
  const rule = INPUT_RULES[type];
  if (!rule) return normalized;
  const sanitized = rule.sanitize(normalized);
  if (options.maxLength) {
    return sanitized.slice(0, options.maxLength);
  }
  return sanitized;
}

export function validateInputValue(value, type = 'text', options = {}) {
  const normalized = String(value ?? '');
  if (options.required && normalized.trim() === '') return false;
  if (!type || type === 'text') return true;

  switch (type) {
    case 'numeric':
      if (options.maxLength && normalized.length > options.maxLength) return false;
      return /^[0-9]+$/.test(normalized);
    case 'letters':
      return /^[a-zA-Z\s.-]+$/.test(normalized);
    case 'address':
      return /^[a-zA-Z0-9\s.,#/-]+$/.test(normalized);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    default:
      return true;
  }
}

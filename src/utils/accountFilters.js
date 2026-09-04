/**
 * Centralized account classification utilities for UI dropdowns and filters.
 * Ensures consistent filtering of GL leaf accounts for Cash and Bank selectors,
 * strictly excluding header accounts, non-asset accounts (e.g. Bank Charges), and test accounts.
 */

export function isGenuineBankAccount(account) {
  if (!account) return false;
  if (account.isLocked || account.isDeleted) return false;

  // Must be Asset type
  const typeName = (account.type || account.accountType?.name || account.accountTypeName || '').toUpperCase();
  if (typeName && typeName !== 'ASSET') return false;

  // Must be GL leaf level (not a parent / subsidiary header)
  const level = (account.level || account.accountLevel || '').toUpperCase();
  if (level && level !== 'GL') return false;
  if ((account.detailType || '').toLowerCase() === 'header') return false;

  const code = String(account.code || account.glCode || '').trim();
  const name = (account.name || account.accountName || '').toLowerCase();
  const detail = (account.detailType || '').toLowerCase();

  // Exclude test accounts and expense heads like Bank Charges
  if (code.includes('TEST') || code === '1010199' || code === '1010202') return false;
  if (name.includes('test')) return false;
  if (name.includes('charge') || name.includes('fee') || name.includes('expense')) return false;

  // Recognized Bank Accounts
  if (code === '1010101' || code === '1010102') return true;
  if (detail === 'bank') return true;

  if (
    name.includes('bank') || name.includes('nbp') || name.includes('mcb') ||
    name.includes('hbl') || name.includes('ubl') || name.includes('habib') ||
    name.includes('allied') || name.includes('faysal') || name.includes('alfalah') ||
    name.includes('meezan') || name.includes('soneri') || name.includes('askari') ||
    name.includes('js bank') || name.includes('bop') || name.includes('dubai islamic')
  ) {
    return true;
  }

  return false;
}

export function isGenuineCashAccount(account) {
  if (!account) return false;
  if (account.isLocked || account.isDeleted) return false;

  const typeName = (account.type || account.accountType?.name || account.accountTypeName || '').toUpperCase();
  if (typeName && typeName !== 'ASSET') return false;

  const level = (account.level || account.accountLevel || '').toUpperCase();
  if (level && level !== 'GL') return false;
  if ((account.detailType || '').toLowerCase() === 'header') return false;

  const code = String(account.code || account.glCode || '').trim();
  const name = (account.name || account.accountName || '').toLowerCase();
  const detail = (account.detailType || '').toLowerCase();

  if (code.includes('TEST') || name.includes('test')) return false;
  if (name.includes('bank')) return false;

  if (code === '1010103' || code === '1010104') return true;
  if (detail === 'cash' || detail === 'pettycash') return true;

  if (name.includes('cash in hand') || name.includes('petty cash') || name.includes('cash')) {
    return true;
  }

  return false;
}

/**
 * Central Route-to-Permission Mapping
 *
 * Each route is mapped to its required canonical module and action.
 * Routes not listed here or mapped to null (e.g. Dashboard, Profile) are open to all authenticated users.
 */

export const ROUTE_PERMISSIONS = {
  // Chart of Accounts & Balances
  '/coa': { module: 'coa', action: 'view' },
  '/opening-balances': { module: 'openingBalances', action: 'view' },

  // Revenue & Heads
  '/revenue-heads': { module: 'revenue', action: 'view' },
  '/income-category-mapping': { module: 'revenue', action: 'view' },
  '/income': { module: 'revenue', action: 'view' },
  '/add-income': { module: 'revenue', action: 'view' },
  '/add-income/records': { module: 'revenue', action: 'view' },
  '/add-income/new': { module: 'revenue', action: 'create' },
  '/add-income/edit/:id': { module: 'revenue', action: 'update' },

  // Expenses & Cash
  '/expense-heads': { module: 'expenses', action: 'view' },
  '/expenses': { module: 'expenses', action: 'view' },
  '/petty-cash': { module: 'expenses', action: 'view' },
  '/bank-vouchers': { module: 'expenses', action: 'view' },
  '/bank-vouchers/new': { module: 'expenses', action: 'create' },
  '/bank-vouchers/expense/new': { module: 'expenses', action: 'create' },
  '/bank-vouchers/transfer/new': { module: 'expenses', action: 'create' },
  '/bank-vouchers/revenue/new': { module: 'revenue', action: 'create' },

  // Reports & Auditing
  '/reports': { module: 'reports', action: 'view' },
  '/trial-balance-sheet': { module: 'reports', action: 'view' },
  '/financial-year-closing': { module: 'reports', action: 'view' },
  '/donation-reports': { module: 'reports', action: 'view' },
  '/audit': { module: 'audit', action: 'view' },
  '/accounting-health': { module: 'audit', action: 'view' },

  // Ledger & Journals
  '/ledger': { module: 'generalLedger', action: 'view' },
  '/journals': { module: 'journalEntries', action: 'view' },

  // Hall Bookings
  '/hall-bookings': { module: 'hallBookings', action: 'view' },
  '/hall-bookings/new': { module: 'hallBookings', action: 'create' },
  '/hall-bookings/edit/:id': { module: 'hallBookings', action: 'update' },

  // Beneficiaries
  '/beneficiaries': { module: 'beneficiaries', action: 'view' },
  '/beneficiaries/new': { module: 'beneficiaries', action: 'create' },
  '/beneficiaries/edit/:id': { module: 'beneficiaries', action: 'update' },

  // Donations Given
  '/donations': { module: 'donations', action: 'view' },
  '/donations/new': { module: 'donations', action: 'create' },
  '/donations/edit/:id': { module: 'donations', action: 'update' },

  // Donors
  '/donors': { module: 'donors', action: 'view' },
  '/donors/new': { module: 'donors', action: 'create' },
  '/donors/edit/:id': { module: 'donors', action: 'update' },

  // Revenue Collections (Donations Received, Membership Fees, Bus Bookings, Fitra)
  '/donations-received': { module: 'revenueCollections', action: 'view' },
  '/monthly-donations': { module: 'revenueCollections', action: 'view' },
  '/general-donations': { module: 'revenueCollections', action: 'view' },
  '/donations-received/new': { module: 'revenueCollections', action: 'create' },
  '/donations-received/edit/:id': { module: 'revenueCollections', action: 'update' },

  '/membership-fees': { module: 'revenueCollections', action: 'view' },
  '/membership-fees/new': { module: 'revenueCollections', action: 'create' },
  '/membership-fees/edit/:id': { module: 'revenueCollections', action: 'update' },

  '/bus-bookings': { module: 'revenueCollections', action: 'view' },
  '/bus-bookings/new': { module: 'revenueCollections', action: 'create' },
  '/bus-bookings/edit/:id': { module: 'revenueCollections', action: 'update' },

  '/fitra': { module: 'revenueCollections', action: 'view' },
  '/fitra/new': { module: 'revenueCollections', action: 'create' },
  '/fitra/edit/:id': { module: 'revenueCollections', action: 'update' },

  // Zakat & Zakat Cards
  '/zakat': { module: 'zakat', action: 'view' },
  '/zakat/new': { module: 'zakat', action: 'create' },
  '/zakat/edit/:id': { module: 'zakat', action: 'update' },
  '/zakat-cards': { module: 'zakatCards', action: 'view' },
  '/monthly-donation-cards': { module: 'zakatCards', action: 'view' },

  // Customers & Invoices
  '/customers': { module: 'customers', action: 'view' },
  '/customers/new': { module: 'customers', action: 'create' },
  '/customers/edit/:id': { module: 'customers', action: 'update' },
  '/invoices': { module: 'invoices', action: 'view' },
  '/invoices/new': { module: 'invoices', action: 'create' },
  '/invoices/edit/:id': { module: 'invoices', action: 'update' },
  '/invoices/:id': { module: 'invoices', action: 'view' },

  // Members & Membership Cards
  '/members': { module: 'members', action: 'view' },
  '/members/new': { module: 'members', action: 'create' },
  '/members/edit/:id': { module: 'members', action: 'update' },
  '/members/:id': { module: 'members', action: 'view' },
  '/membership-cards': { module: 'membership', action: 'view' },

  // System Administration
  '/users-roles': { module: 'roles', action: 'view' },
  '/reserved': { module: 'settings', action: 'view' },
  '/settings': { module: 'settings', action: 'view' },
};

/**
 * Helper to get permission requirement for a pathname
 * @param {string} pathname
 * @returns {{ module: string, action: string } | null}
 */
export function getRoutePermission(pathname) {
  if (!pathname) return null;
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];

  // Try matching parameterized routes e.g. /invoices/:id, /members/:id
  for (const [routePattern, perm] of Object.entries(ROUTE_PERMISSIONS)) {
    if (routePattern.includes(':')) {
      const regex = new RegExp('^' + routePattern.replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$');
      if (regex.test(pathname)) {
        return perm;
      }
    }
  }

  return null;
}

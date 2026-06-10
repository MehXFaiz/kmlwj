import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultJournals = [
  {
    id: 'JE-0001',
    date: '2026-05-01',
    subsidiary: 'Acme US',
    reference: 'Founder Equity Contribution',
    postedBy: 'system',
    status: 'Posted',
    lines: [
      { accountCode: '1110', description: 'Initial cash investment', debit: 50000, credit: 0 },
      { accountCode: '3100', description: 'Founder shares issuance', debit: 0, credit: 50000 },
    ],
  },
  {
    id: 'JE-0002',
    date: '2026-05-05',
    subsidiary: 'Acme Europe',
    reference: 'Office Equipment Purchase',
    postedBy: 'admin@acme.com',
    status: 'Posted',
    lines: [
      { accountCode: '1210', description: 'Laptops and monitors purchase', debit: 12000, credit: 0 },
      { accountCode: '2110', description: 'Vendor liability - TechDistributors', debit: 0, credit: 12000 },
    ],
  },
  {
    id: 'JE-0003',
    date: '2026-05-10',
    subsidiary: 'Acme US',
    reference: 'SaaS Software Sales Invoice',
    postedBy: 'billing@acme.com',
    status: 'Posted',
    lines: [
      { accountCode: '1120', description: 'Customer Invoice INV-2026-001', debit: 8500, credit: 0 },
      { accountCode: '4100', description: 'Product sales revenue', debit: 0, credit: 8500 },
    ],
  },
  {
    id: 'JE-0004',
    date: '2026-05-15',
    subsidiary: 'Acme US',
    reference: 'Office Rent Payment',
    postedBy: 'admin@acme.com',
    status: 'Posted',
    lines: [
      { accountCode: '6200', description: 'May 2026 rent payment', debit: 3500, credit: 0 },
      { accountCode: '1110', description: 'Cash disbursement - Rent', debit: 0, credit: 3500 },
    ],
  },
  {
    id: 'JE-0005',
    date: '2026-05-20',
    subsidiary: 'Acme Europe',
    reference: 'Payroll Accrual',
    postedBy: 'system',
    status: 'Posted',
    lines: [
      { accountCode: '6100', description: 'Accrued wages for May 1-15', debit: 9800, credit: 0 },
      { accountCode: '2120', description: 'Payroll accrual liability', debit: 0, credit: 9800 },
    ],
  },
];

const defaultAuditLogs = [
  { id: '1', timestamp: '2026-05-01T08:00:00Z', action: 'System Init', details: 'Chart of Accounts initialized with standard ERP templates.', user: 'System' },
  { id: '2', timestamp: '2026-05-01T09:15:00Z', action: 'Post Journal', details: 'Posted Journal Entry JE-0001: Founder Equity Contribution.', user: 'System' },
  { id: '3', timestamp: '2026-05-05T10:30:00Z', action: 'Post Journal', details: 'Posted Journal Entry JE-0002: Office Equipment Purchase.', user: 'admin@acme.com' },
  { id: '4', timestamp: '2026-05-10T11:45:00Z', action: 'Post Journal', details: 'Posted Journal Entry JE-0003: SaaS Software Sales Invoice.', user: 'billing@acme.com' },
  { id: '5', timestamp: '2026-05-15T14:20:00Z', action: 'Post Journal', details: 'Posted Journal Entry JE-0004: Office Rent Payment.', user: 'admin@acme.com' },
  { id: '6', timestamp: '2026-05-20T16:00:00Z', action: 'Post Journal', details: 'Posted Journal Entry JE-0005: Payroll Accrual.', user: 'System' },
];

export const useJournalStore = create(
  persist(
    (set, get) => ({
      journals: defaultJournals,
      auditLogs: defaultAuditLogs,

      addJournalEntry: (entry) => {
        const nextId = `JE-${String(get().journals.length + 1).padStart(4, '0')}`;
        const newJournal = {
          id: nextId,
          date: entry.date || new Date().toISOString().split('T')[0],
          subsidiary: entry.subsidiary || 'Global',
          reference: entry.reference || 'Manual Journal Entry',
          postedBy: entry.postedBy || 'admin@acme.com',
          status: 'Posted',
          lines: entry.lines.map(line => ({
            accountCode: line.accountCode,
            description: line.description || '',
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
          })),
        };

        set((state) => ({
          journals: [newJournal, ...state.journals],
          auditLogs: [
            {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              action: 'Post Journal',
              details: `Posted Journal Entry ${nextId}: ${newJournal.reference}. Total Amount: $${newJournal.lines.reduce((sum, l) => sum + l.debit, 0).toLocaleString()}`,
              user: newJournal.postedBy,
            },
            ...state.auditLogs,
          ],
        }));
      },

      logActivity: (action, details, user = 'admin@acme.com') => {
        set((state) => ({
          auditLogs: [
            {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              action,
              details,
              user,
            },
            ...state.auditLogs,
          ],
        }));
      },

      resetJournals: () => {
        set({ journals: defaultJournals, auditLogs: defaultAuditLogs });
      },
    }),
    {
      name: 'journal-storage',
    }
  )
);

// Helper function to calculate the balance for a single account including its descendants
// Normal account balance calculation rules:
// - Asset: initialBalance + Debits - Credits
// - Expense: initialBalance + Debits - Credits
// - Liability: initialBalance + Credits - Debits
// - Equity: initialBalance + Credits - Debits
// - Revenue: initialBalance + Credits - Debits
export const calculateAccountBalances = (accounts, journals, subsidiary = 'Global') => {
  // 1. Calculate posting-level balances directly from journal lines + initialBalances
  const baseBalances = {};

  accounts.forEach((acc) => {
    baseBalances[acc.code] = {
      code: acc.code,
      initial: 0,
      debits: 0,
      credits: 0,
    };
    
    // Filter initial balance by subsidiary check
    // If the account has this subsidiary OR subsidiary is 'Global'
    const appliesToSubsidiary = subsidiary === 'Global' || acc.subsidiary.includes(subsidiary);
    
    if (appliesToSubsidiary) {
      // In a real consolidation, initial balances might be split, here we use the initial balance scaled or fully
      // For demo, if Global we show it, if specific subsidiary we filter.
      // Let's assume accounts with 'Global' apply to all, or are split.
      // Let's say if subsidiary matches, we count the initial balance.
      baseBalances[acc.code].initial = acc.initialBalance || 0;
    }
  });

  // Aggregate journal lines
  journals.forEach((je) => {
    // Check if subsidiary matches
    if (subsidiary !== 'Global' && je.subsidiary !== subsidiary) {
      return;
    }

    je.lines.forEach((line) => {
      if (baseBalances[line.accountCode]) {
        baseBalances[line.accountCode].debits += line.debit;
        baseBalances[line.accountCode].credits += line.credit;
      }
    });
  });

  // Calculate local balance for each account code
  const localBalances = {};
  accounts.forEach((acc) => {
    const stats = baseBalances[acc.code] || { initial: 0, debits: 0, credits: 0 };
    const { initial, debits, credits } = stats;

    let balance = 0;
    const type = acc.type;

    if (type === 'Asset' || type === 'Expense') {
      balance = initial + debits - credits;
    } else if (type === 'Liability' || type === 'Equity' || type === 'Revenue') {
      balance = initial + credits - debits;
    }

    localBalances[acc.code] = balance;
  });

  // 2. Rollup hierarchy: Parent account balance = sum of self and all descendants
  const rollupBalances = {};

  // Build tree index mapping parent to children
  const childrenMap = {};
  accounts.forEach((acc) => {
    if (acc.parentCode) {
      if (!childrenMap[acc.parentCode]) childrenMap[acc.parentCode] = [];
      childrenMap[acc.parentCode].push(acc.code);
    }
  });

  // DFS function to compute recursive rollup balances
  const getRollupBalance = (code) => {
    if (rollupBalances[code] !== undefined) return rollupBalances[code];

    const currentLocal = localBalances[code] || 0;
    const children = childrenMap[code] || [];

    let total = currentLocal;
    children.forEach((childCode) => {
      total += getRollupBalance(childCode);
    });

    rollupBalances[code] = total;
    return total;
  };

  accounts.forEach((acc) => {
    getRollupBalance(acc.code);
  });

  return { localBalances, rollupBalances, baseBalances };
};

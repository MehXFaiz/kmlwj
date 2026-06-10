import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default Chart of Accounts (COA) data
const defaultAccounts = [
  // ASSETS (1000 - 1999)
  { id: '1', code: '1000', name: 'Assets', type: 'Asset', detailType: 'Header', parentCode: null, currency: 'USD', status: 'Active', description: 'Total Assets Header', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '2', code: '1100', name: 'Current Assets', type: 'Asset', detailType: 'Header', parentCode: '1000', currency: 'USD', status: 'Active', description: 'Short-term liquid assets', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '3', code: '1110', name: 'Cash and Cash Equivalents', type: 'Asset', detailType: 'Cash', parentCode: '1100', currency: 'USD', status: 'Active', description: 'Operating checking and savings accounts', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 125000 },
  { id: '4', code: '1111', name: 'Petty Cash', type: 'Asset', detailType: 'Cash', parentCode: '1110', currency: 'USD', status: 'Active', description: 'Cash on hand for minor office expenses', subsidiary: ['Global', 'Acme US'], initialBalance: 500 },
  { id: '5', code: '1120', name: 'Accounts Receivable', type: 'Asset', detailType: 'Receivable', parentCode: '1100', currency: 'USD', status: 'Active', description: 'Amounts owed by customers for credit sales', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 45000 },
  { id: '6', code: '1130', name: 'Inventory - Raw Materials', type: 'Asset', detailType: 'Inventory', parentCode: '1100', currency: 'USD', status: 'Active', description: 'Unprocessed materials for production', subsidiary: ['Global', 'Acme US', 'Acme APAC'], initialBalance: 85000 },
  { id: '7', code: '1131', name: 'Inventory - Finished Goods', type: 'Asset', detailType: 'Inventory', parentCode: '1100', currency: 'USD', status: 'Active', description: 'Products ready for sale to customers', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 140000 },
  { id: '8', code: '1140', name: 'Prepaid Expenses', type: 'Asset', detailType: 'Prepayments', parentCode: '1100', currency: 'USD', status: 'Active', description: 'Prepaid rent, insurance, or services', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 12000 },
  { id: '9', code: '1200', name: 'Non-Current Assets', type: 'Asset', detailType: 'Header', parentCode: '1000', currency: 'USD', status: 'Active', description: 'Long-term assets (> 1 year)', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '10', code: '1210', name: 'Property, Plant, & Equipment', type: 'Asset', detailType: 'Fixed Asset', parentCode: '1200', currency: 'USD', status: 'Active', description: 'Land, buildings, and factory equipment', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 450000 },
  { id: '11', code: '1220', name: 'Accumulated Depreciation', type: 'Asset', detailType: 'Accumulated Depreciation', parentCode: '1200', currency: 'USD', status: 'Active', description: 'Contra asset account for asset depreciation', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: -90000 },

  // LIABILITIES (2000 - 2999)
  { id: '12', code: '2000', name: 'Liabilities', type: 'Liability', detailType: 'Header', parentCode: null, currency: 'USD', status: 'Active', description: 'Total Liabilities Header', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '13', code: '2100', name: 'Current Liabilities', type: 'Liability', detailType: 'Header', parentCode: '2000', currency: 'USD', status: 'Active', description: 'Short-term obligations due within 1 year', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '14', code: '2110', name: 'Accounts Payable', type: 'Liability', detailType: 'Payable', parentCode: '2100', currency: 'USD', status: 'Active', description: 'Amounts owed to vendors for purchases on credit', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 32000 },
  { id: '15', code: '2120', name: 'Accrued Payroll', type: 'Liability', detailType: 'Payable', parentCode: '2100', currency: 'USD', status: 'Active', description: 'Salaries and wages earned but not yet paid', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 18000 },
  { id: '16', code: '2130', name: 'Credit Card (Corporate)', type: 'Liability', detailType: 'Credit Card', parentCode: '2100', currency: 'USD', status: 'Active', description: 'Corporate credit card liability', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 4200 },
  { id: '17', code: '2200', name: 'Non-Current Liabilities', type: 'Liability', detailType: 'Header', parentCode: '2000', currency: 'USD', status: 'Active', description: 'Long-term obligations (> 1 year)', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '18', code: '2210', name: 'Long-term Debt (Bank Loan)', type: 'Liability', detailType: 'Long Term Loan', parentCode: '2200', currency: 'USD', status: 'Active', description: 'Long-term secured bank financing', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 150000 },

  // EQUITY (3000 - 3999)
  { id: '19', code: '3000', name: 'Equity', type: 'Equity', detailType: 'Header', parentCode: null, currency: 'USD', status: 'Active', description: 'Total Equity Header', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '20', code: '3100', name: 'Common Stock', type: 'Equity', detailType: 'Equity', parentCode: '3000', currency: 'USD', status: 'Active', description: 'Initial shareholder investments', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 200000 },
  { id: '21', code: '3200', name: 'Retained Earnings', type: 'Equity', detailType: 'Equity', parentCode: '3000', currency: 'USD', status: 'Active', description: 'Accumulated profits retained in the company', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 250000 },
  { id: '22', code: '3300', name: 'Shareholder Distributions', type: 'Equity', detailType: 'Equity', parentCode: '3000', currency: 'USD', status: 'Active', description: 'Dividends or distributions to shareholders', subsidiary: ['Global', 'Acme US'], initialBalance: -15000 },

  // REVENUE (4000 - 4999)
  { id: '23', code: '4000', name: 'Revenue', type: 'Revenue', detailType: 'Header', parentCode: null, currency: 'USD', status: 'Active', description: 'Operating and non-operating revenue', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '24', code: '4100', name: 'Product Sales', type: 'Revenue', detailType: 'Revenue', parentCode: '4000', currency: 'USD', status: 'Active', description: 'Revenue from direct product sales', subsidiary: ['Global', 'Acme US', 'Acme APAC'], initialBalance: 320000 },
  { id: '25', code: '4200', name: 'Service Revenue', type: 'Revenue', detailType: 'Revenue', parentCode: '4000', currency: 'USD', status: 'Active', description: 'Revenue from professional consulting services', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 95000 },
  { id: '26', code: '4300', name: 'Interest Income', type: 'Revenue', detailType: 'Other Revenue', parentCode: '4000', currency: 'USD', status: 'Active', description: 'Interest earned on cash accounts', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 1200 },

  // EXPENSES (5000 - 7999)
  { id: '27', code: '5000', name: 'Expenses', type: 'Expense', detailType: 'Header', parentCode: null, currency: 'USD', status: 'Active', description: 'Operating and administrative expenses', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '28', code: '5100', name: 'Cost of Goods Sold (COGS)', type: 'Expense', detailType: 'COGS', parentCode: '5000', currency: 'USD', status: 'Active', description: 'Direct costs of production / inventory sold', subsidiary: ['Global', 'Acme US', 'Acme APAC'], initialBalance: 165000 },
  { id: '29', code: '6000', name: 'Operating Expenses', type: 'Expense', detailType: 'Header', parentCode: '5000', currency: 'USD', status: 'Active', description: 'Selling, general and admin expenses (SG&A)', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 0 },
  { id: '30', code: '6100', name: 'Salaries and Wages', type: 'Expense', detailType: 'Expense', parentCode: '6000', currency: 'USD', status: 'Active', description: 'Employee wages, payroll taxes, benefits', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 82000 },
  { id: '31', code: '6200', name: 'Rent Expense', type: 'Expense', detailType: 'Expense', parentCode: '6000', currency: 'USD', status: 'Active', description: 'Office and warehouse rental payments', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 18000 },
  { id: '32', code: '6300', name: 'Utilities Expense', type: 'Expense', detailType: 'Expense', parentCode: '6000', currency: 'USD', status: 'Active', description: 'Electricity, water, gas, internet', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 3400 },
  { id: '33', code: '6400', name: 'Marketing & Advertising', type: 'Expense', detailType: 'Expense', parentCode: '6000', currency: 'USD', status: 'Active', description: 'Paid ads, campaigns, promotional events', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 14500 },
  { id: '34', code: '6500', name: 'Office Supplies & Software', type: 'Expense', detailType: 'Expense', parentCode: '6000', currency: 'USD', status: 'Active', description: 'SaaS subscriptions, computer equipment, supplies', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 6100 },
  { id: '35', code: '7100', name: 'Interest Expense', type: 'Expense', detailType: 'Expense', parentCode: '5000', currency: 'USD', status: 'Active', description: 'Interest paid on bank loans', subsidiary: ['Global', 'Acme US', 'Acme Europe'], initialBalance: 2400 },
  { id: '36', code: '7200', name: 'Income Tax Expense', type: 'Expense', detailType: 'Expense', parentCode: '5000', currency: 'USD', status: 'Active', description: 'Corporate income tax accruals', subsidiary: ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'], initialBalance: 11000 },
];

export const useCoaStore = create(
  persist(
    (set) => ({
      accounts: defaultAccounts,
      selectedSubsidiary: 'Global',
      fiscalYear: '2026',

      setSelectedSubsidiary: (subsidiary) => set({ selectedSubsidiary: subsidiary }),
      setFiscalYear: (fiscalYear) => set({ fiscalYear }),

      addAccount: (account) => {
        const newAccount = {
          id: Date.now().toString(),
          status: 'Active',
          initialBalance: 0,
          subsidiary: account.subsidiary || ['Global'],
          parentCode: account.parentCode === 'none' ? null : account.parentCode,
          ...account,
        };
        set((state) => ({
          accounts: [...state.accounts, newAccount].sort((a, b) => a.code.localeCompare(b.code)),
        }));
        // Return the added account
        return newAccount;
      },

      updateAccount: (id, updatedFields) => {
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id
              ? {
                  ...acc,
                  ...updatedFields,
                  parentCode: updatedFields.parentCode === 'none' ? null : updatedFields.parentCode,
                }
              : acc
          ).sort((a, b) => a.code.localeCompare(b.code)),
        }));
      },

      toggleAccountStatus: (id) => {
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id
              ? { ...acc, status: acc.status === 'Active' ? 'Inactive' : 'Active' }
              : acc
          ),
        }));
      },

      deleteAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
        }));
      },

      importAccounts: (importedList) => {
        set((state) => {
          // Merge imported accounts: if code exists, update, otherwise insert
          let currentList = [...state.accounts];
          importedList.forEach((imp) => {
            const index = currentList.findIndex((x) => x.code === imp.code);
            const formatted = {
              id: imp.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
              status: imp.status || 'Active',
              initialBalance: Number(imp.initialBalance) || 0,
              parentCode: imp.parentCode || null,
              subsidiary: Array.isArray(imp.subsidiary) ? imp.subsidiary : [imp.subsidiary || 'Global'],
              ...imp,
            };
            if (index > -1) {
              currentList[index] = { ...currentList[index], ...formatted };
            } else {
              currentList.push(formatted);
            }
          });
          return { accounts: currentList.sort((a, b) => a.code.localeCompare(b.code)) };
        });
      },

      resetAccounts: () => {
        set({ accounts: defaultAccounts });
      },
    }),
    {
      name: 'coa-storage', // name of item in local storage
    }
  )
);

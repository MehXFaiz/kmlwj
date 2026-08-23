import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Download, Printer, Plus, Edit2, CheckCircle2, AlertTriangle, Grid, List, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { VoucherLogo } from '../components/common/VoucherLogo';
import { useCoaStore } from '../store/coaStore';
import { AccountFormDrawer } from '../components/coa/AccountFormDrawer';
import { reportsService } from '../services/apiServices';
import { useJournalStore } from '../store/journalStore';
import { useDashboardStore } from '../store/dashboardStore';

// Cash in Hand / each Bank (dynamic count) / Advance & Loan / Receivable /
// Other Assets — one tile per category, fully driven by whatever the backend
// returns. No account name or count is hardcoded here.
/**
 * The Jammat financial year runs 01-July → 30-June, so FY N spans
 * 01-07-(N−1) .. 30-06-N. Derived arithmetically — no date is hardcoded.
 *
 * NOTE: this is deliberately NOT coaStore's getCurrentFiscalYear(), which
 * returns the CALENDAR year and which the Dashboard and Reports views use to
 * build 01-01 → 31-12 ranges. Those two definitions disagree; this statement has
 * always been captioned "01-07 → 30-06", so it follows the July–June convention.
 */
export const fiscalYearRange = (fy) => ({
  startDate: `${Number(fy) - 1}-07-01`,
  endDate: `${Number(fy)}-06-30`,
});

/**
 * The Jammat fiscal year (N) whose 01-07-(N−1) .. 30-06-N window contains
 * `today`. Computed arithmetically from the current date — never hardcoded —
 * so the report's default period always covers "now".
 *
 * ROOT CAUSE FIX: this file previously hardcoded `DEFAULT_FISCAL_YEAR = 2026`.
 * That was correct only while "today" fell inside 01-07-2025..30-06-2026. Once
 * the calendar crossed 30-06-2026, every freshly posted Income/Expense
 * transaction (dated in the new FY) fell outside that frozen default window,
 * so the Trial Balance Matrix opened on a stale period and rendered its
 * Income/Expense rows as empty — even though AccountingService.getTrialBalance
 * correctly includes them once the date filter is widened to cover the
 * transaction's actual posting date. Deriving the default from `new Date()`
 * (same 01-07→30-06 convention the file already documents) keeps the default
 * view current on every page load, indefinitely, with no yearly manual edit.
 */
export const getCurrentJammatFiscalYear = (today = new Date()) => {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  return month >= 7 ? year + 1 : year;
};

/** Financial year the report opens on — the one containing today. */
const DEFAULT_FISCAL_YEAR = getCurrentJammatFiscalYear();

const BalanceCategoryGrid = ({ categories, formatMoney }) => {
  const tiles = [
    { key: 'cash', label: 'Cash in Hand', value: categories.cashInHand.total },
    ...categories.banks.accounts.map((b) => ({ key: `bank-${b.glCode}`, label: b.name, value: b.balance })),
    { key: 'advance', label: 'Advance & Loan', value: categories.advanceAndLoan.total },
    { key: 'receivable', label: 'Receivable', value: categories.receivable.total },
    { key: 'other', label: 'Other Assets', value: categories.otherAssets.total },
  ];

  return (
    <div className="flex flex-wrap gap-3 print:break-inside-avoid">
      {tiles.map((tile) => (
<<<<<<< HEAD
        <div key={tile.key} className="flex-1 min-w-[150px] rounded-xl bg-slate-950/60 print:bg-transparent border border-slate-800 print:border-slate-300 px-3.5 py-2.5">
=======
        <div key={tile.key} className="flex-1 min-w-[150px] rounded-xl bg-slate-950/60 border border-slate-800 px-3.5 py-2.5 print:bg-white print:border-slate-300 print:break-inside-avoid">
>>>>>>> b8503e0a68ebac4b8a43011b67e111878bc7d9a5
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate" title={tile.label}>{tile.label}</p>
          <p className="text-sm font-mono font-bold text-slate-200 mt-0.5">{formatMoney(tile.value)}</p>
        </div>
      ))}
    </div>
  );
};

export const TrialBalanceSheet = () => {
  const { treeAccounts, fetchAccountsTree } = useCoaStore();
  const { tbReport, loading: isLoadingTb, fetchTbReport, version } = useDashboardStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('sheet'); // 'sheet' (Official Jammat 4-Column Statement), 'matrix' (Dual-Column), 'ledger' (Standard)
  
  // Date filter states.
  //
  // These default to a full FINANCIAL YEAR rather than being empty. An empty
  // range means "all time", and an all-time report has no period *before* it to
  // open from — every opening balance collapses to the account's initialBalance
  // (0 for every account here), which is why the opening rows rendered as "—".
  // The backend only computes a real opening position when it is given a
  // startDate to look back from (getTrialBalance's `priorAggregates`).
  //
  // The financial year runs 01-07 → 30-06, so FY N = 01-07-(N−1) .. 30-06-N.
  // Changing either input re-scopes the whole report, so any FY (or any custom
  // range) works dynamically — nothing about the period is hardcoded beyond the
  // initial default below.
  const [fromDate, setFromDate] = useState(() => fiscalYearRange(DEFAULT_FISCAL_YEAR).startDate);
  const [toDate, setToDate] = useState(() => fiscalYearRange(DEFAULT_FISCAL_YEAR).endDate);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    fetchAccountsTree();
  }, [fetchAccountsTree]);

  useEffect(() => {
    const params = {};
    if (fromDate) params.startDate = fromDate;
    if (toDate) params.endDate = toDate;
    fetchTbReport(params);
  }, [fromDate, toDate, fetchTbReport, version]);

  const formatMoney = (val) => {
    if (val === undefined || val === null || isNaN(val)) return 'Rs 0';
    if (val === 0) return '—';
    return `Rs ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatBalance = (debit, credit) => {
    const net = (debit || 0) - (credit || 0);
    if (Math.abs(net) < 0.005) return '—';
    if (net > 0) {
      return `Rs ${net.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Dr`;
    }
    return `Rs ${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Cr`;
  };

  // Build a lookup map from trial balance report entries
  const tbLookupMap = useMemo(() => {
    const map = new Map();
    if (tbReport && tbReport.entries) {
      tbReport.entries.forEach(entry => {
        map.set(entry.glCode, entry);
      });
    }
    return map;
  }, [tbReport]);

  // Flatten the tree data for the matrix view & sync with live balances
  const flattenedData = useMemo(() => {
    const result = [];
    const traverse = (node, depth = 0, parentCategoryName = '') => {
      const level = node.level || 'SUBSIDIARY';
      const isHeader = node.detailType === 'Header';
      
      let mainCategoryName = '';
      let glName = '';
      
      if (level === 'MAIN' || level === 'PARENT') {
        mainCategoryName = node.name;
      } else if (level === 'SUBSIDIARY') {
        if (isHeader || (node.children && node.children.length > 0)) {
          mainCategoryName = parentCategoryName ? `${parentCategoryName} > ${node.name}` : node.name;
        } else {
          mainCategoryName = parentCategoryName;
          glName = node.name;
        }
      } else if (level === 'GL') {
        mainCategoryName = parentCategoryName;
        glName = node.name;
      }

      const tbEntry = tbLookupMap.get(node.code);
      const debit = tbEntry ? (tbEntry.debit || 0) : (node.debit || 0);
      const credit = tbEntry ? (tbEntry.credit || 0) : (node.credit || 0);
      const netBalance = debit - credit;

      result.push({
        id: node.id,
        code: node.code,
        nature: node.type || 'UNKNOWN',
        mainCategory: mainCategoryName || node.name,
        glName: glName || node.name,
        debit: debit,
        credit: credit,
        netBalance: netBalance,
        remarks: level,
        type: level.toLowerCase(),
        rawAccount: node
      });
      
      if (node.children && node.children.length > 0) {
        const sortedChildren = [...node.children].sort((a, b) => a.code.localeCompare(b.code));
        const nextParentCategory = mainCategoryName || parentCategoryName || node.name;
        sortedChildren.forEach(child => traverse(child, depth + 1, nextParentCategory));
      }
    };
    
    const sortedAccounts = [...treeAccounts].sort((a, b) => a.code.localeCompare(b.code));
    sortedAccounts.forEach(root => traverse(root));
    return result;
  }, [treeAccounts, tbLookupMap]);

  // Compute dynamic date-wise filtered accounts
  const computedAccounts = useMemo(() => {
    return flattenedData;
  }, [flattenedData]);

  // Dynamic mapper: LEFT = Expense accounts only, RIGHT = Revenue accounts only.
  //
  // SINGLE SOURCE OF TRUTH: every value below is derived exclusively from
  // `tbReport.entries` — the Trial Balance API rows, which come from
  // AccountingService.getTrialBalance → getPostedAggregates (posted journal
  // entry lines). We deliberately do NOT read the account tree's rolled-up
  // node.debit/node.credit here: the tree sums each posting up through every
  // parent, so including both leaf ('gl') and header ('subsidiary') nodes
  // counted every expense twice (leaf + its parent) — that was the 40k→80k
  // Dashboard/Matrix mismatch. tbReport has exactly one row per posting
  // account, so each posted transaction now contributes exactly once and the
  // Matrix totals equal the Dashboard, Income Statement, Balance Sheet and
  // Cash Flow totals.
  const matrixData = useMemo(() => {
    const entries = (tbReport && Array.isArray(tbReport.entries)) ? tbReport.entries : [];

    const typeOf = (e) => (e.accountType || '').toUpperCase();
    const expenseEntries = entries.filter(e => typeOf(e) === 'EXPENSE');
    const revenueEntries = entries.filter(e => typeOf(e) === 'REVENUE' || typeOf(e) === 'INCOME');

    // Debit-normal balance for expenses/assets; credit-normal for revenue.
    const debitBal  = (e) => Math.max(0, (e.debit || 0) - (e.credit || 0));
    const creditBal = (e) => Math.max(0, (e.credit || 0) - (e.debit || 0));

    // Strict PARTITION of entries into named rows (first matching definition
    // wins) plus a single residual row. Because every entry lands in exactly
    // one row, the rows always sum back to the single-source total — no double
    // counting and no hardcoded/overlapping subtotals.
    const partition = (items, rowDefs, amtFn, residualLabel) => {
      const totals = new Array(rowDefs.length).fill(0);
      let residual = 0;
      for (const e of items) {
        const idx = rowDefs.findIndex(def =>
          (def.codes && def.codes.includes(e.glCode)) ||
          (def.regex && def.regex.test(e.accountName || ''))
        );
        const amt = amtFn(e);
        if (idx >= 0) totals[idx] += amt;
        else residual += amt;
      }
      const rows = rowDefs.map((def, i) => ({ desc: def.desc, val: totals[i] }));
      rows.push({ desc: residualLabel, val: residual });
      return rows.map((row, idx) => ({ ...row, sNo: String(idx + 1).padStart(2, '0') }));
    };

    // ── LEFT COLUMN: EXPENSE rows ────────────────────────────────────────────
    // Built dynamically from the Chart of Accounts: one row per EXPENSE account
    // that carries a posted balance, labelled with that account's own name and
    // ordered by GL code. There is deliberately NO name/code pattern table here
    // — the previous version matched entries against a hardcoded list of
    // descriptions and swept everything unmatched into a "Miscellaneous
    // Expenses" residual, so an expense posted to e.g. Salary or Hall Expense
    // showed up under Miscellaneous. Now "Miscellaneous Expenses" is just the
    // account of that name, and only its own postings land there.
    const groupByAccount = (items, amtFn) => {
      const byAccount = new Map();
      for (const e of items) {
        const key = e.id || e.glCode || e.accountName;
        const existing = byAccount.get(key);
        if (existing) {
          existing.val += amtFn(e);
        } else {
          byAccount.set(key, {
            desc: e.accountName || e.glCode || 'Unnamed Account',
            glCode: e.glCode || '',
            val: amtFn(e)
          });
        }
      }
      return [...byAccount.values()]
        .sort((a, b) => String(a.glCode).localeCompare(String(b.glCode)) || a.desc.localeCompare(b.desc))
        .map((row, idx) => ({ ...row, sNo: String(idx + 1).padStart(2, '0') }));
    };

    const expenses = groupByAccount(expenseEntries, debitBal);
    const totalActualExpense = expenseEntries.reduce((s, e) => s + debitBal(e), 0);

    // ── RIGHT COLUMN: REVENUE rows ───────────────────────────────────────────
    // Built dynamically from the Chart of Accounts: one row per REVENUE account
    // that carries a posted balance, labelled with that account's own name and
    // ordered by GL code.
    const incomes = groupByAccount(revenueEntries, creditBal);
    const totalActualRevenue = revenueEntries.reduce((s, e) => s + creditBal(e), 0);

    return { expenses, incomes, totalActualExpense, totalActualRevenue };
  }, [tbReport]);

  // ── OPENING / CLOSING BALANCES (proper accounting-standard presentation) ──
  // Cash in Hand, every Bank individually, Advance & Loan, Receivable, and a
  // residual Other Assets bucket. Read directly from the backend's
  // openingBalances/closingBalances — computed in AccountingService.getTrialBalance
  // from initialBalance + posted JournalEntryLine rows only. No client-side
  // name-matching, no cached values: this IS the single source of truth.
  const emptyCat = { total: 0, accounts: [] };
  const balanceSheetCategories = useMemo(() => {
    const opening = tbReport?.openingBalances || {};
    const closing = tbReport?.closingBalances || {};
    return {
      opening: {
        cashInHand: opening.cashInHand || emptyCat,
        banks: opening.banks || emptyCat,
        advanceAndLoan: opening.advanceAndLoan || emptyCat,
        receivable: opening.receivable || emptyCat,
        otherAssets: opening.otherAssets || emptyCat,
      },
      closing: {
        cashInHand: closing.cashInHand || emptyCat,
        banks: closing.banks || emptyCat,
        advanceAndLoan: closing.advanceAndLoan || emptyCat,
        receivable: closing.receivable || emptyCat,
        otherAssets: closing.otherAssets || emptyCat,
      },
    };
  }, [tbReport]);

  const filteredData = useMemo(() => {
    return computedAccounts.filter(item => 
      item.code.includes(searchQuery) || 
      item.nature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.mainCategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.glName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [computedAccounts, searchQuery]);

  // Compute summary totals across MAIN accounts or from trial balance report
  const summaryTotals = useMemo(() => {
    if (tbReport && tbReport.summary) {
      return {
        totalDebit: tbReport.summary.totalDebit || 0,
        totalCredit: tbReport.summary.totalCredit || 0,
        isBalanced: tbReport.summary.isBalanced ?? true
      };
    }
    const mainRows = computedAccounts.filter(r => r.type === 'main');
    const totalDebit = mainRows.reduce((sum, r) => sum + (r.debit || 0), 0);
    const totalCredit = mainRows.reduce((sum, r) => sum + (r.credit || 0), 0);
    return {
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }, [tbReport, computedAccounts]);

  // Compute matrix surplus or deficit. Totals come straight from the
  // single-source figures (identical to the sum of the partitioned rows, but
  // taken directly so the footer can never drift from the source).
  const matrixTotals = useMemo(() => {
    const totalExp = matrixData.totalActualExpense || 0;
    const totalInc = matrixData.totalActualRevenue || 0;
    const netSurplus = totalInc - totalExp; // positive = surplus, negative = deficit
    const cashInHand = balanceSheetCategories.closing.cashInHand.total || 0;
    const bankBalance = balanceSheetCategories.closing.banks.total || 0;
    // Requirement 9: Closing Cash in Trial Balance = Cash in Hand + Bank Balance.
    const closingCash = cashInHand + bankBalance;
    return {
      totalExpenses: totalExp,
      totalIncomes: totalInc,
      cashInHand,
      bankBalance,
      closingCash,
      surplus: netSurplus,
      isDeficit: netSurplus < 0,
      finalExpensesTotal: totalExp + Math.max(0, netSurplus),
      finalIncomesTotal: totalInc
    };
  }, [matrixData]);

  const getRowStyle = (type) => {
    switch (type) {
      case 'main':
        return 'bg-brand-400/10 hover:bg-brand-400/15 border-y border-brand-400/30 font-bold text-brand-300';
      case 'parent':
        return 'bg-slate-800/40 hover:bg-slate-800/60 border-y border-slate-700/40 font-semibold text-slate-200';
      case 'subsidiary':
        return 'bg-transparent hover:bg-slate-900/50 border-b border-slate-800/50 text-slate-300';
      case 'gl':
        return 'bg-slate-900/20 hover:bg-slate-900/40 border-b border-slate-800/30 text-slate-200';
      default:
        return 'border-b border-slate-800/50 text-slate-300';
    }
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setIsDrawerOpen(true);
  };

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setIsDrawerOpen(true);
  };

  const handleCreateSubAccount = (parent) => {
    if (parent) {
      setEditingAccount({
        parentCode: parent.code,
        type: parent.type,
        currency: parent.currency,
        subsidiary: parent.subsidiary,
      });
      setIsDrawerOpen(true);
    }
  };

  // Dynamic 4-Column Official Jammat Trial Balance Sheet Data (Matching Physical Paper Document Format)
  const officialJammatSheetData = useMemo(() => {
    if (!tbReport) {
      return { rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true, startStr: '01-07-2025', endStr: '30-06-2026' };
    }

    const opening = tbReport.openingBalances || {};
    const closing = tbReport.closingBalances || {};
    const entries = Array.isArray(tbReport.entries) ? tbReport.entries : [];

    // DD-MM-YYYY, matching the printed Jammat statement ("01-07-2025").
    // The YYYY-MM-DD input is split textually rather than parsed through Date:
    // `new Date('2025-07-01')` is UTC midnight, so reading it back with local
    // getters shifts the label to the previous day in any timezone west of UTC.
    const formatShortDate = (dStr, fallback) => {
      if (!dStr) return fallback;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dStr);
      if (!m) return fallback;
      return `${m[3]}-${m[2]}-${m[1]}`;
    };

    const startStr = formatShortDate(fromDate, '01-07-2025');
    const endStr = formatShortDate(toDate, '30-06-2026');

    const rows = [];
    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const collectCategoryAccounts = (catsObj, includeZero = false) => {
      const list = [];
      const keys = ['banks', 'cashInHand', 'advanceAndLoan', 'receivable', 'otherAssets'];
      keys.forEach(k => {
        if (catsObj[k] && Array.isArray(catsObj[k].accounts)) {
          catsObj[k].accounts.forEach(acc => {
            if (includeZero || (acc.balance && Math.abs(acc.balance) > 0.001)) {
              list.push({ ...acc, categoryKey: k });
            }
          });
        }
      });
      return list;
    };

    const formatOpDesc = (acc) => {
      const name = acc.name || '';
      if (name.toLowerCase().includes('opening balance') || name.toLowerCase().includes('receivable bal')) {
        return `${name} ${startStr}`;
      }
      if (name.toLowerCase().endsWith('bal') || name.toLowerCase().endsWith('balance')) {
        return `${name} ${startStr}`;
      }
      return `${name} Opening Balance ${startStr}`;
    };

    const formatClDesc = (acc) => {
      const name = acc.name || '';
      if (name.toLowerCase().includes('closing balance')) {
        return `${name} ${endStr}`;
      }
      return `${name} Closing Balance ${endStr}`;
    };

    // 1. OPENING BALANCES (Dynamic DEBIT/CREDIT placement)
    //
    // Each `acc.balance` is the account's real position as of the FY start,
    // computed server-side from posted JournalEntryLine rows only
    // (AccountingService.getTrialBalance → priorAggregates → naturalBalance).
    // Nothing here derives an opening figure from the closing balance.
    //
    // PLACEMENT: this statement is a Receipts & Payments account, and its
    // balancing identity is
    //     Opening + Revenue = Expense + Closing
    // With Revenue in CREDIT and Expense in DEBIT (sections 2 and 3 below), that
    // identity only closes when Opening contributes to the CREDIT side and
    // Closing to the DEBIT side, each as a SIGNED amount — a negative balance
    // simply crosses to the opposite column. Moving positive opening balances
    // into DEBIT would leave the sheet out by 2 × (net opening balance).
    const openingAccounts = collectCategoryAccounts(opening, true);
    openingAccounts.forEach(acc => {
      const bal = acc.balance || 0;
      let deb = 0;
      let crd = 0;

      if (Math.abs(bal) > 0.001) {
        if (bal > 0) {
          crd = bal;
          totalCreditSum += crd;
        } else {
          deb = Math.abs(bal);
          totalDebitSum += deb;
        }
      }

      rows.push({
        id: `opening-${acc.glCode}`,
        section: 'OPENING',
        sectionLabel: 'Opening Balances',
        description: formatOpDesc(acc),
        note: '',
        debit: deb,
        credit: crd,
        // An account that genuinely opened the year at nil must read as an
        // explicit zero, not as the "—" placeholder used for "not applicable".
        showZero: Math.abs(bal) <= 0.001,
        // A debit-normal asset sitting on a credit balance is an accounting
        // anomaly (you cannot hold negative cash). Surfaced, never silently
        // normalised — see openingAnomalies below.
        isCreditBalanceAsset: bal < -0.001,
        glCode: acc.glCode,
        accountName: acc.name,
        balance: bal
      });
    });

    // 2. REVENUE / INCOME ITEMS (Credit Column)
    const typeOf = (e) => (e.accountType || '').toUpperCase();
    const revenueEntries = entries.filter(e => typeOf(e) === 'REVENUE' || typeOf(e) === 'INCOME');

    const hallEntries = revenueEntries.filter(e => 
      (e.accountName || '').toLowerCase().includes('hall') || 
      (e.accountName || '').toLowerCase().includes('garden')
    );
    const hallSubtotal = hallEntries.reduce((sum, e) => sum + Math.max(0, (e.credit || 0) - (e.debit || 0)), 0);
    let hallSubtotalDisplayed = false;

    revenueEntries.forEach(e => {
      const creditVal = Math.max(0, (e.credit || 0) - (e.debit || 0));
      if (creditVal > 0.001) {
        totalCreditSum += creditVal;
        const isHall = (e.accountName || '').toLowerCase().includes('hall') || (e.accountName || '').toLowerCase().includes('garden');
        let noteText = '';
        if (isHall && !hallSubtotalDisplayed && hallEntries.length > 1) {
          noteText = hallSubtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          hallSubtotalDisplayed = true;
        }

        rows.push({
          id: `rev-${e.id || e.glCode}`,
          section: 'REVENUE',
          sectionLabel: 'Revenue & Income',
          description: e.accountName,
          note: noteText,
          debit: 0,
          credit: creditVal
        });
      }
    });

    // 3. EXPENSE / EXPENDITURE ITEMS (Debit Column)
    const expenseEntries = entries.filter(e => typeOf(e) === 'EXPENSE');

    expenseEntries.forEach(e => {
      const debitVal = Math.max(0, (e.debit || 0) - (e.credit || 0));
      if (debitVal > 0.001) {
        totalDebitSum += debitVal;
        let noteText = '';
        if ((e.accountName || '').toLowerCase().includes('sadaya academy') || (e.accountName || '').toLowerCase().includes('check')) {
          noteText = 'Check (GL)';
        }

        rows.push({
          id: `exp-${e.id || e.glCode}`,
          section: 'EXPENSE',
          sectionLabel: 'Expenditures & Operations',
          description: e.accountName,
          note: noteText,
          debit: debitVal,
          credit: 0
        });
      }
    });

    // 4. CLOSING BALANCES (Dynamic DEBIT/CREDIT placement)
    const closingAccounts = collectCategoryAccounts(closing, true);
    closingAccounts.forEach(acc => {
      const bal = acc.balance || 0;
      let deb = 0;
      let crd = 0;

      if (Math.abs(bal) > 0.001) {
        if (bal > 0) {
          deb = bal;
          totalDebitSum += deb;
        } else {
          crd = Math.abs(bal);
          totalCreditSum += crd;
        }
      }

      const isZakat = (acc.name || '').toLowerCase().includes('zakat');
      rows.push({
        id: `closing-${acc.glCode}`,
        section: 'CLOSING',
        sectionLabel: 'Closing Balances',
        description: formatClDesc(acc),
        note: isZakat ? '(Include Zakat)' : '',
        debit: deb,
        credit: crd
      });
    });

    const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01;

    // Debit-normal assets that opened the year on a CREDIT balance. Reported as
    // a visible accounting warning rather than being silently sign-flipped or
    // zeroed — the figures below are exactly what the posted ledger says.
    const openingAnomalies = rows
      .filter(r => r.section === 'OPENING' && r.isCreditBalanceAsset)
      .map(r => ({ glCode: r.glCode, accountName: r.accountName, balance: r.balance }));

    return {
      rows,
      totalDebit: totalDebitSum,
      totalCredit: totalCreditSum,
      isBalanced,
      openingAnomalies,
      startStr,
      endStr
    };
  }, [tbReport, fromDate, toDate]);

  const filteredJammatSheetRows = useMemo(() => {
    if (!searchQuery) return officialJammatSheetData.rows;
    const query = searchQuery.toLowerCase();
    return officialJammatSheetData.rows.filter(r =>
      r.description.toLowerCase().includes(query) ||
      r.note.toLowerCase().includes(query)
    );
  }, [officialJammatSheetData.rows, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  // SQA fix: neutralize CSV formula injection — a description/category name
  // starting with =, +, -, or @ would otherwise be interpreted as a formula
  // by Excel/Sheets when this export is opened.
  const csvCell = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    if (viewMode === 'sheet') {
      const headers = ['DESCRIPTION', 'NOTE', 'DEBIT (PKR)', 'CREDIT (PKR)'];
      const csvRows = [
        '"KUTCHI MUSLIM LOHAR WADA JAMMAT REGD.(1319)"',
        '"TRIAL BALANCE"',
        `"As On ${officialJammatSheetData.startStr} TO ${officialJammatSheetData.endStr}"`,
        '',
        headers.join(',')
      ];

      officialJammatSheetData.rows.forEach(r => {
        csvRows.push([
          csvCell(r.description),
          csvCell(r.note),
          r.debit ? r.debit.toFixed(2) : '',
          r.credit ? r.credit.toFixed(2) : ''
        ].join(','));
      });

      csvRows.push(['"TOTAL"', '', officialJammatSheetData.totalDebit.toFixed(2), officialJammatSheetData.totalCredit.toFixed(2)].join(','));

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `official_jammat_trial_balance_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === 'matrix') {
      const headers = ['S.No', 'Expenses / Payments Description', 'Expense Amount (PKR)', '', 'S.No', 'Receipts / Income Description', 'Income Amount (PKR)'];
      const csvRows = [headers.join(',')];
      
      const maxRows = Math.max(matrixData.expenses.length, matrixData.incomes.length);
      for (let i = 0; i < maxRows; i++) {
        const exp = matrixData.expenses[i] || { sNo: '', desc: '', val: 0 };
        const inc = matrixData.incomes[i] || { sNo: '', desc: '', val: 0 };
        csvRows.push([
          exp.sNo,
          csvCell(exp.desc),
          exp.val ? exp.val.toFixed(2) : '0.00',
          '',
          inc.sNo,
          csvCell(inc.desc),
          inc.val ? inc.val.toFixed(2) : '0.00'
        ].join(','));
      }
      
      // Add bottom summary rows
      csvRows.push(['', '', '', '', '', '', '']);
      csvRows.push(['"Total Income (Credit)"', matrixTotals.totalIncomes.toFixed(2), '', '', '', '', ''].join(','));
      csvRows.push(['"Total Expense (Debit)"', matrixTotals.totalExpenses.toFixed(2), '', '', '', '', ''].join(','));
      csvRows.push(['"Cash in Hand"', matrixTotals.cashInHand.toFixed(2), '', '', '', '', ''].join(','));
      csvRows.push(['"Total Bank Balance"', matrixTotals.bankBalance.toFixed(2), '', '', '', '', ''].join(','));
      csvRows.push([
        '"Closing Surplus (Income - Expense)"',
        matrixTotals.surplus.toFixed(2),
        '',
        '',
        '',
        '',
        ''
      ].join(','));
      csvRows.push([
        '',
        '"Grand Totals"',
        matrixTotals.finalExpensesTotal.toFixed(2),
        '',
        '',
        '"Grand Totals"',
        matrixTotals.finalIncomesTotal.toFixed(2)
      ].join(','));

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `trial_balance_matrix_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = ['GL Code', 'Nature', 'Main Category Name', 'GL Name', 'Debit (PKR)', 'Credit (PKR)', 'Net Balance', 'Remarks'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        [
          row.code,
          row.nature,
          csvCell(row.mainCategory || ''),
          csvCell(row.glName || ''),
          (row.debit || 0).toFixed(2),
          (row.credit || 0).toFixed(2),
          `"${formatBalance(row.debit, row.credit)}"`,
          row.remarks
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trial_balance_hierarchical_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Header Logo & Title */}
      <div className="hidden print:flex flex-col items-center justify-center space-y-2 border-b-2 border-black pb-4 mb-6">
        <VoucherLogo className="w-16 h-16" />
        <h1 className="text-xl font-bold uppercase tracking-wider text-black font-serif">Kutchi Muslim Loharwada Welfare Jamat</h1>
        <h2 className="text-sm font-bold tracking-widest text-black uppercase">TRIAL BALANCE</h2>
        <p className="text-xs font-semibold text-gray-800 font-mono">
          As On {officialJammatSheetData.startStr} TO {officialJammatSheetData.endStr}
        </p>
      </div>

      {/* Header Title & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Trial Balance Sheet</h2>
          <p className="text-xs text-slate-400">Official dynamic financial statement matching the Jammat Trial Balance paper format.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Switcher Toggle */}
          <div className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('sheet')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${viewMode === 'sheet' ? 'bg-amber-500 text-slate-950 shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Official Jammat Statement (Paper Replica)"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Jammat Statement</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${viewMode === 'matrix' ? 'bg-brand-400 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Matrix View (Side-by-Side)"
            >
              <Grid className="h-3.5 w-3.5 shrink-0" />
              <span>Dual Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${viewMode === 'ledger' ? 'bg-brand-400 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Standard Hierarchical Table View"
            >
              <List className="h-3.5 w-3.5 shrink-0" />
              <span>Standard Ledger</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 cursor-pointer">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 cursor-pointer">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateAccount} className="gap-2 cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>New Account</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Date Search Filter Panel */}
      <Card className="bg-slate-900/40 border-slate-800 print:hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[130px] sm:flex-none">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-44 bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[130px] sm:flex-none">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full sm:w-44 bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer self-end"
              >
                Clear Dates
              </button>
            )}
          </div>
          
          {/* Search bar inside toolbar */}
          <div className="relative w-full sm:max-w-xs shrink-0 self-end">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Trial Balance descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2.5 pl-9 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Credit Side</p>
            <p className="text-lg font-mono font-bold text-amber-400 mt-1">
              {formatMoney(viewMode === 'sheet' ? officialJammatSheetData.totalCredit : viewMode === 'matrix' ? matrixTotals.totalIncomes : summaryTotals.totalCredit)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Debit Side</p>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
              {formatMoney(viewMode === 'sheet' ? officialJammatSheetData.totalDebit : viewMode === 'matrix' ? matrixTotals.totalExpenses : summaryTotals.totalDebit)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Surplus / Net Movement</p>
            <p className="text-lg font-mono font-bold text-slate-200 mt-1">
              {formatMoney(matrixTotals.surplus)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balancing Status</p>
            <div className="flex items-center gap-2 mt-1.5">
              {(viewMode === 'sheet' ? officialJammatSheetData.isBalanced : summaryTotals.isBalanced) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> BALANCED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> UNBALANCED
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting warning — a debit-normal asset that opened the period on a
          CREDIT balance. Rendered ONLY when the posted ledger actually contains
          one, so the statement is visually unchanged in the normal case. The
          numbers are never adjusted to hide it. */}
      {viewMode === 'sheet' && officialJammatSheetData.openingAnomalies?.length > 0 && (
        <Card className="bg-slate-900/60 border-amber-800/60 print:hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Opening Balance Warning</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  These asset accounts opened {officialJammatSheetData.startStr} on a <strong>credit</strong> balance,
                  which a debit-normal asset should not hold. The figures below are exactly what the posted ledger
                  contains and have not been adjusted — the underlying entries need review.
                </p>
                <ul className="mt-2 space-y-0.5">
                  {officialJammatSheetData.openingAnomalies.map(a => (
                    <li key={a.glCode} className="text-[11px] font-mono text-slate-300">
                      {a.glCode} · {a.accountName}: {formatMoney(a.balance)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODE 1: OFFICIAL JAMMAT TRIAL BALANCE SHEET (EXACT PAPER REPLICA, DYNAMIC DATA) */}
      {viewMode === 'sheet' && (
        <Card className="overflow-hidden border border-slate-800 bg-slate-900/80 print:border-slate-900 print:bg-white print:shadow-none">

          {/* Document Header Banner */}
          <div className="bg-slate-950 p-6 border-b border-slate-800 text-center space-y-1.5 print:bg-white print:border-b-2 print:border-black print:p-4">
            <h1 className="text-lg sm:text-2xl font-black uppercase tracking-wider text-amber-400 print:text-black font-serif">
              KUTCHI MUSLIM LOHAR WADA JAMMAT REGD.(1319)
            </h1>
            <h2 className="text-sm sm:text-base font-extrabold tracking-widest text-slate-200 print:text-black uppercase">
              TRIAL BALANCE
            </h2>
            <p className="text-xs font-mono font-bold text-slate-400 print:text-gray-800">
              As On <span className="text-amber-400 print:text-black font-semibold">{officialJammatSheetData.startStr}</span> TO <span className="text-amber-400 print:text-black font-semibold">{officialJammatSheetData.endStr}</span>
            </p>
          </div>

          {/* 4-Column Table */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse min-w-[700px] print:min-w-full print:border print:border-black">
              <thead>
                <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800 uppercase tracking-wider print:bg-gray-200 print:text-black print:border-b-2 print:border-black">
                  <th className="py-3 px-4 border-r border-slate-800/60 print:border-r print:border-black">DESCRIPTION</th>
                  <th className="py-3 px-4 w-36 text-center border-r border-slate-800/60 print:border-r print:border-black">NOTE</th>
                  <th className="py-3 px-4 w-44 text-right border-r border-slate-800/60 print:border-r print:border-black">DEBIT</th>
                  <th className="py-3 px-4 w-44 text-right">CREDIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200 print:divide-gray-300 print:text-black">
                {filteredJammatSheetRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-800/40 transition-colors print:hover:bg-transparent">
                    
                    {/* Description */}
                    <td className="py-2.5 px-4 font-medium print:text-black print:py-1.5 border-r border-slate-800/40 print:border-r print:border-gray-300">
                      <span className={row.section === 'OPENING' || row.section === 'CLOSING' ? 'font-bold text-amber-300/90 print:text-black' : ''}>
                        {row.description}
                      </span>
                    </td>

                    {/* Note Column */}
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400 print:text-black print:py-1.5 border-r border-slate-800/40 print:border-r print:border-gray-300 font-semibold">
                      {row.note ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-amber-400 print:bg-transparent print:text-black print:p-0">
                          {row.note}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Debit Column — an opening/closing row that is genuinely
                        nil shows an explicit 0.00 rather than the "—"
                        placeholder, so a real zero is distinguishable from
                        "no value". */}
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400 print:text-black print:py-1.5 border-r border-slate-800/40 print:border-r print:border-gray-300">
                      {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : (row.credit > 0 ? '' : (row.showZero ? '0.00' : '—'))}
                    </td>

                    {/* Credit Column */}
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-400 print:text-black print:py-1.5">
                      {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : (row.debit > 0 ? '' : '—')}
                    </td>

                  </tr>
                ))}

                {filteredJammatSheetRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 italic">
                      No matching statement accounts found for the selected filter.
                    </td>
                  </tr>
                )}

                {/* Footer Total Row */}
                <tr className="bg-slate-950 font-black text-slate-100 border-t-2 border-amber-500/50 print:bg-gray-100 print:text-black print:border-t-2 print:border-black">
                  <td className="py-3.5 px-4 text-left font-black uppercase tracking-widest text-amber-400 print:text-black border-r border-slate-800 print:border-r print:border-black">
                    TOTAL
                  </td>
                  <td className="py-3.5 px-4 text-center border-r border-slate-800 print:border-r print:border-black"></td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-400 print:text-black border-r border-slate-800 print:border-r print:border-black">
                    {officialJammatSheetData.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-blue-400 print:text-black">
                    {officialJammatSheetData.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </Card>
      )}

      {/* OPENING BALANCES — proper accounting-standard presentation, shown
          regardless of view mode. Every figure is read straight from
          tbReport.openingBalances (AccountingService.getTrialBalance),
          computed from initialBalance + posted ledger lines only. */}
<<<<<<< HEAD
      <Card className="bg-slate-900/60 print:bg-transparent border-slate-800 print:border-slate-300 print:shadow-none">
        <CardContent className="p-4 space-y-3 print:p-0">
          <div className="flex items-center justify-between print:mb-2">
            <h3 className="text-xs font-bold text-slate-300 print:text-black uppercase tracking-widest">Opening Balances</h3>
            <span className="text-[11px] text-slate-500 print:text-black font-mono">As of {fromDate || 'Inception'}</span>
=======
      <Card className="bg-slate-900/60 border-slate-800 print:bg-white print:border-slate-300 print:break-inside-avoid">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Opening Balances</h3>
            <span className="text-[11px] text-slate-500 font-mono">As of {fromDate || 'Inception'}</span>
>>>>>>> b8503e0a68ebac4b8a43011b67e111878bc7d9a5
          </div>
          <BalanceCategoryGrid categories={balanceSheetCategories.opening} formatMoney={formatMoney} />
        </CardContent>
      </Card>

      {/* MATRIX VIEW MODE */}
      {viewMode === 'matrix' && (
        <Card className="overflow-hidden border border-slate-800 print:border-slate-300 print:bg-white print:shadow-none">
          <div className="bg-slate-900/40 p-4 border-b border-slate-800 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-400"></span>
              <span>Values map dynamically to the database. Selected Date filter: <strong>{fromDate || 'Inception'}</strong> to <strong>{toDate || 'Present'}</strong>.</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 print:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x print:divide-y-0 print:divide-x divide-slate-800 print:divide-slate-300">
            
            {/* Left Side: Payments / Expenses */}
            <div className="overflow-x-auto print:overflow-visible">
              <div className="bg-slate-900/80 print:bg-slate-100 px-4 py-3 border-b border-slate-800 print:border-slate-300 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200 print:text-slate-900 uppercase tracking-wider">Payments / Expenditures</h3>
                <span className="hidden md:inline text-xs text-slate-500 font-mono print:hidden">Left Column (Debit Outcomes)</span>
              </div>
              <table className="w-full text-left text-xs border-collapse min-w-[450px]">
                <thead>
                  <tr className="bg-slate-950 print:bg-slate-55 text-slate-400 print:text-slate-700 font-bold border-b border-slate-800 print:border-slate-300">
                    <th className="py-2.5 px-4 w-12 text-center border-r border-slate-900 print:border-slate-200">No.</th>
                    <th className="py-2.5 px-4">Expenses Description</th>
                    <th className="py-2.5 px-4 w-32 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 print:divide-slate-200">
                  {matrixData.expenses.map((row) => (
                    <tr key={row.sNo} className="hover:bg-slate-900/30 transition-colors print:text-slate-800">
                      <td className="py-2.5 px-4 font-mono text-slate-500 print:text-slate-700 text-center border-r border-slate-900 print:border-slate-200">{row.sNo}</td>
                      <td className="py-2.5 px-4 text-slate-300 print:text-slate-900 font-medium">{row.desc}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-200 print:text-slate-900 font-semibold">
                        {formatMoney(row.val)}
                      </td>
                    </tr>
                  ))}
                  {/* Closing Cash Surplus / Deficit line to balance */}
                  {!matrixTotals.isDeficit && (
                    <tr className="bg-brand-400/5 print:bg-slate-50 font-semibold text-brand-300 print:text-slate-800">
                      <td className="py-2.5 px-4 font-mono text-center border-r border-slate-900 print:border-slate-200">{String(matrixData.expenses.length + 1).padStart(2, '0')}</td>
                      <td className="py-2.5 px-4">Closing Cash & Bank Balance (Surplus)</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold print:text-slate-900">
                        {formatMoney(matrixTotals.surplus)}
                      </td>
                    </tr>
                  )}
                  {matrixTotals.isDeficit && (
                    <tr className="bg-red-950/10 print:bg-red-50 font-semibold text-red-400 print:text-slate-800">
                      <td className="py-2.5 px-4 font-mono text-center border-r border-slate-900 print:border-slate-200">{String(matrixData.expenses.length + 1).padStart(2, '0')}</td>
                      <td className="py-2.5 px-4">Deficit (Expenses exceed Income)</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold print:text-slate-900">—</td>
                    </tr>
                  )}
                  {/* Total row */}
                  <tr className="bg-slate-900/90 print:bg-slate-100 font-bold text-slate-200 print:text-slate-900 border-t border-slate-700 print:border-slate-300">
                    <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider">Total Payments (Balanced)</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-brand-400 print:text-slate-900">
                      {formatMoney(matrixTotals.finalExpensesTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Side: Receipts / Income */}
            <div className="overflow-x-auto print:overflow-visible">
              <div className="bg-slate-900/80 print:bg-slate-100 px-4 py-3 border-b border-slate-800 print:border-slate-300 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200 print:text-slate-900 uppercase tracking-wider">Receipts / Income</h3>
                <span className="hidden md:inline text-xs text-slate-500 font-mono print:hidden">Right Column (Credit Inflows)</span>
              </div>
              <table className="w-full text-left text-xs border-collapse min-w-[450px]">
                <thead>
                  <tr className="bg-slate-950 print:bg-slate-55 text-slate-400 print:text-slate-700 font-bold border-b border-slate-800 print:border-slate-300">
                    <th className="py-2.5 px-4 w-12 text-center border-r border-slate-900 print:border-slate-200">No.</th>
                    <th className="py-2.5 px-4">Income Description</th>
                    <th className="py-2.5 px-4 w-32 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 print:divide-slate-200">
                  {matrixData.incomes.map((row) => (
                    <tr key={row.sNo} className="hover:bg-slate-900/30 transition-colors print:text-slate-800">
                      <td className="py-2.5 px-4 font-mono text-slate-500 print:text-slate-700 text-center border-r border-slate-900 print:border-slate-200">{row.sNo}</td>
                      <td className="py-2.5 px-4 text-slate-300 print:text-slate-900 font-medium">{row.desc}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-200 print:text-slate-900 font-semibold">
                        {formatMoney(row.val)}
                      </td>
                    </tr>
                  ))}
                  {/* Padding empty rows to align height with the left side side-by-side */}
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-10 opacity-30 print:opacity-0 select-none">
                      <td className="py-2.5 px-4 text-center border-r border-slate-900 print:border-slate-200">—</td>
                      <td className="py-2.5 px-4 text-slate-600 print:text-transparent font-mono">N/A</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-650 print:text-transparent">—</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-slate-900/90 print:bg-slate-100 font-bold text-slate-200 print:text-slate-900 border-t border-slate-700 print:border-slate-300">
                    <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider">Total Receipts</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-brand-400 print:text-slate-900">
                      {formatMoney(matrixTotals.finalIncomesTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* ── BOTTOM SUMMARY: required 6-row section ────────────────────────── */}
          <div className="border-t-2 border-slate-700 print:border-slate-400 bg-slate-950/60 print:bg-slate-50">
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-400 uppercase tracking-wider font-semibold w-1/2">Total Income (Credit)</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-brand-400 print:text-slate-900 w-1/2">
                    {formatMoney(matrixTotals.totalIncomes)}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-400 uppercase tracking-wider font-semibold">Total Expense (Debit)</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-brand-400 print:text-slate-900">
                    {formatMoney(matrixTotals.totalExpenses)}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-400 uppercase tracking-wider font-semibold">Cash in Hand</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400 print:text-slate-900">
                    {formatMoney(matrixTotals.cashInHand)}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-400 uppercase tracking-wider font-semibold">Total Bank Balance</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400 print:text-slate-900">
                    {formatMoney(matrixTotals.bankBalance)}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-300 uppercase tracking-wider font-bold">Closing Cash (Cash in Hand + Bank)</td>
                  <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-300 print:text-slate-900">
                    {formatMoney(matrixTotals.closingCash)}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 print:border-slate-300">
                  <td className="py-2.5 px-4 text-slate-400 uppercase tracking-wider font-semibold">
                    Closing Surplus {matrixTotals.isDeficit ? '(Deficit)' : '(Income − Expense)'}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-mono font-bold print:text-slate-900 ${matrixTotals.isDeficit ? 'text-red-400' : 'text-brand-400'}`}>
                    {formatMoney(matrixTotals.surplus)}
                  </td>
                </tr>
                <tr className="bg-slate-900 print:bg-slate-100">
                  <td className="py-3 px-4 text-slate-200 uppercase tracking-widest font-black text-xs">Grand Total (Income Side)</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-brand-400 print:text-slate-900 text-sm">
                    {formatMoney(matrixTotals.finalIncomesTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* STANDARD LEDGER VIEW MODE */}
      {viewMode === 'ledger' && (
        <Card>
          <CardContent className="p-0">
            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-900/80 border-b-2 border-slate-700 text-slate-300 font-bold tracking-wider text-xs uppercase">
                    <th className="py-3 px-4 w-28">GL Code</th>
                    <th className="py-3 px-4 w-28">Nature</th>
                    <th className="py-3 px-4 w-48">Main Category Name <span className="text-slate-500 text-[10px] ml-1">(Locked)</span></th>
                    <th className="py-3 px-4 min-w-[180px]">GL Name <span className="text-slate-500 text-[10px] ml-1">(Open)</span></th>
                    <th className="py-3 px-4 w-36 text-right">Debit (PKR)</th>
                    <th className="py-3 px-4 w-36 text-right">Credit (PKR)</th>
                    <th className="py-3 px-4 w-36 text-right">Net Balance</th>
                    <th className="py-3 px-4 w-28 text-center">Remarks</th>
                    <th className="py-3 px-4 w-24 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? (
                    <>
                      {filteredData.map((row) => (
                        <tr 
                          key={row.code} 
                          className={`group transition-colors duration-150 ${getRowStyle(row.type)}`}
                        >
                          <td className="py-2.5 px-4 font-mono">{row.code}</td>
                          <td className="py-2.5 px-4 uppercase text-xs">{row.nature}</td>
                          <td className={`py-2.5 px-4 text-xs ${row.type === 'subsidiary' && row.mainCategory ? 'font-semibold text-brand-300' : ''}`}>
                            {row.mainCategory}
                          </td>
                          <td className="py-2.5 px-4 text-xs">{row.glName}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-brand-400">
                            {row.debit > 0 ? formatMoney(row.debit) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-brand-400">
                            {row.credit > 0 ? formatMoney(row.credit) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-200 font-semibold">
                            {formatBalance(row.debit, row.credit)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`
                              inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                              ${row.type === 'main' ? 'bg-brand-400/20 text-brand-300 border border-brand-400/30' : ''}
                              ${row.type === 'parent' ? 'bg-slate-800 text-slate-300' : ''}
                              ${row.type === 'subsidiary' ? 'bg-slate-900 text-slate-400' : ''}
                              ${row.type === 'gl' ? 'bg-slate-950 text-slate-200 border border-slate-800' : ''}
                            `}>
                              {row.remarks}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity print:hidden">
                            <div className="inline-flex gap-1.5 justify-end w-full">
                              {row.type !== 'gl' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 cursor-pointer"
                                  onClick={() => handleCreateSubAccount(row.rawAccount)}
                                  title="Add child account"
                                >
                                  <Plus className="h-3.5 w-3.5 text-brand-400" />
                                </Button>
                              ) : <div className="h-7 w-7"></div>}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                  className="h-7 w-7 p-0 cursor-pointer"
                                onClick={() => handleEditAccount(row.rawAccount)}
                                title="Edit Account Details"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-brand-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Grand Total Footer Row */}
                      <tr className="bg-slate-900 font-bold border-t-2 border-slate-700 text-xs uppercase tracking-wider text-slate-200">
                        <td colSpan={4} className="py-4 px-4 text-right">Matrix Grand Totals</td>
                        <td className={`py-4 px-4 text-right font-mono ${summaryTotals.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                          {formatMoney(summaryTotals.totalDebit)}
                        </td>
                        <td className={`py-4 px-4 text-right font-mono ${summaryTotals.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                          {formatMoney(summaryTotals.totalCredit)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-400">
                          {summaryTotals.isBalanced ? 'Balanced' : 'Unbalanced'}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No matching accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLOSING BALANCES — mirrors Opening Balances above, shown regardless
          of view mode, read straight from tbReport.closingBalances. */}
<<<<<<< HEAD
      <Card className="bg-slate-900/60 print:bg-transparent border-slate-800 print:border-slate-300 print:shadow-none print:mt-6">
        <CardContent className="p-4 space-y-3 print:p-0">
          <div className="flex items-center justify-between print:mb-2">
            <h3 className="text-xs font-bold text-slate-300 print:text-black uppercase tracking-widest">Closing Balances</h3>
            <span className="text-[11px] text-slate-500 print:text-black font-mono">As of {toDate || 'Today'}</span>
=======
      <Card className="bg-slate-900/60 border-slate-800 print:bg-white print:border-slate-300 print:break-inside-avoid">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Closing Balances</h3>
            <span className="text-[11px] text-slate-500 font-mono">As of {toDate || 'Today'}</span>
>>>>>>> b8503e0a68ebac4b8a43011b67e111878bc7d9a5
          </div>
          <BalanceCategoryGrid categories={balanceSheetCategories.closing} formatMoney={formatMoney} />
        </CardContent>
      </Card>

      {/* Detail drawer Form modal */}
      <AccountFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingAccount(null);
        }}
        editingAccount={editingAccount}
      />
    </div>
  );
};

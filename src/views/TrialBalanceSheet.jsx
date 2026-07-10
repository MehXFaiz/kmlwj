import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Download, Printer, Plus, Edit2, CheckCircle2, AlertTriangle, Grid, List } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useCoaStore } from '../store/coaStore';
import { AccountFormDrawer } from '../components/coa/AccountFormDrawer';
import { reportsService } from '../services/apiServices';
import { useJournalStore } from '../store/journalStore';

export const TrialBalanceSheet = () => {
  const { treeAccounts, fetchAccountsTree } = useCoaStore();
  const { journals, fetchJournals } = useJournalStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [tbReport, setTbReport] = useState(null);
  const [isLoadingTb, setIsLoadingTb] = useState(false);
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' (Urdu paper replica) or 'ledger' (Standard hierarchical grid)
  
  // Date filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    fetchAccountsTree();
    fetchJournals('Global', 1, 1000); // Fetch journals for local calculation
    const loadTbData = async () => {
      setIsLoadingTb(true);
      try {
        const data = await reportsService.getTrialBalance();
        setTbReport(data);
      } catch (e) {
        console.error('Failed to load trial balance report:', e);
      } finally {
        setIsLoadingTb(false);
      }
    };
    loadTbData();
  }, [fetchAccountsTree, fetchJournals]);

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
    if (!fromDate && !toDate) {
      return flattenedData;
    }

    const baseBalances = {};
    flattenedData.forEach(acc => {
      baseBalances[acc.code] = {
        code: acc.code,
        initial: acc.rawAccount?.initialBalance || 0,
        debitsBefore: 0,
        creditsBefore: 0,
        debitsPeriod: 0,
        creditsPeriod: 0,
      };
    });

    // Aggregate journal entries
    journals.forEach(je => {
      if (je.status !== 'Posted') return;
      je.lines.forEach(line => {
        const stats = baseBalances[line.accountCode];
        if (stats) {
          const dateStr = je.postingDate; // YYYY-MM-DD
          const isBefore = fromDate && dateStr < fromDate;
          const isInPeriod = (!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate);

          if (isBefore) {
            stats.debitsBefore += line.debit;
            stats.creditsBefore += line.credit;
          } else if (isInPeriod) {
            stats.debitsPeriod += line.debit;
            stats.creditsPeriod += line.credit;
          }
        }
      });
    });

    // Compute closing/net balances
    return flattenedData.map(acc => {
      const stats = baseBalances[acc.code] || { initial: 0, debitsBefore: 0, creditsBefore: 0, debitsPeriod: 0, creditsPeriod: 0 };
      const type = acc.nature;

      // 1. Calculate opening balance for the period
      let openingBal = 0;
      if (type === 'Asset' || type === 'Expense') {
        openingBal = stats.initial + stats.debitsBefore - stats.creditsBefore;
      } else {
        openingBal = stats.initial + stats.creditsBefore - stats.debitsBefore;
      }

      // 2. Calculate closing balance for the period
      let closingBal = 0;
      if (type === 'Asset' || type === 'Expense') {
        closingBal = openingBal + stats.debitsPeriod - stats.creditsPeriod;
      } else {
        closingBal = openingBal + stats.creditsPeriod - stats.debitsPeriod;
      }

      // 3. Convert to debit/credit columns
      let debit = 0;
      let credit = 0;
      if (type === 'Asset' || type === 'Expense') {
        if (closingBal > 0) debit = closingBal;
        else if (closingBal < 0) credit = Math.abs(closingBal);
      } else {
        if (closingBal > 0) credit = closingBal;
        else if (closingBal < 0) debit = Math.abs(closingBal);
      }

      return {
        ...acc,
        debit,
        credit,
        netBalance: debit - credit
      };
    });
  }, [flattenedData, journals, fromDate, toDate]);

  // Dynamic mapper that maps active ledger accounts to the specific Urdu statement matrix rows (in English)
  const matrixData = useMemo(() => {
    const getBalanceByCodes = (codes, nameRegex = null) => {
      let debitSum = 0;
      let creditSum = 0;
      
      computedAccounts.forEach(acc => {
        if (acc.type === 'gl' || acc.type === 'subsidiary') {
          const matchesCode = codes.includes(acc.code);
          const matchesName = nameRegex && nameRegex.test(acc.glName || acc.mainCategory || '');
          if (matchesCode || matchesName) {
            debitSum += acc.debit || 0;
            creditSum += acc.credit || 0;
          }
        }
      });
      return { debit: debitSum, credit: creditSum };
    };

    // Helper to get Net Debit (Debit - Credit) for expense items
    const getExpenseBal = (codes, nameRegex = null) => {
      const bal = getBalanceByCodes(codes, nameRegex);
      return Math.max(0, bal.debit - bal.credit);
    };

    // Helper to get Net Credit (Credit - Debit) for revenue/liability items
    const getRevenueBal = (codes, nameRegex = null) => {
      const bal = getBalanceByCodes(codes, nameRegex);
      return Math.max(0, bal.credit - bal.debit);
    };

    // Helper to get Asset balance (Debits - Credits)
    const getAssetBal = (codes, nameRegex = null) => {
      const bal = getBalanceByCodes(codes, nameRegex);
      return Math.max(0, bal.debit - bal.credit);
    };

    // Left Column: 26 Expenses (Payments)
    const expenses = [
      { sNo: '01', desc: 'Bank Charges', val: getExpenseBal(['4080103']) },
      { sNo: '02', desc: 'Bus Diesel', val: getExpenseBal(['4030101']) },
      { sNo: '03', desc: 'Bus Maintenance', val: getExpenseBal(['4050101'], /bus.*repair|bus.*maintenance/i) },
      { sNo: '04', desc: 'Bus Renovation', val: getExpenseBal([], /bus.*renovation/i) },
      { sNo: '05', desc: 'Annexy Canopy', val: getExpenseBal([], /annexy.*canopy|canopy.*annexy/i) },
      { sNo: '06', desc: 'Garden Canopy', val: getExpenseBal([], /garden.*canopy|canopy.*garden/i) },
      { sNo: '07', desc: 'Cleaning Staff Labor', val: getExpenseBal([], /cleaning.*labor|clean.*staff/i) },
      { sNo: '08', desc: 'Office Equipment', val: getExpenseBal([], /office.*equipment|office.*asset/i) },
      { sNo: '09', desc: 'Cleaning Equipment', val: getExpenseBal([], /cleaning.*equipment/i) },
      { sNo: '10', desc: 'Generator Diesel', val: getExpenseBal(['4080104'], /generator.*fuel|generator.*diesel/i) },
      { sNo: '11', desc: 'Diyanat Committee Expenses', val: getExpenseBal([], /diyanat.*committee/i) },
      { sNo: '12', desc: 'Staff Refreshments', val: getExpenseBal(['4080101'], /entertainment|refreshment/i) },
      { sNo: '13', desc: 'Generator Repair', val: getExpenseBal(['4050102'], /generator.*repair/i) },
      { sNo: '14', desc: 'Cricket Tournament Expenses', val: getExpenseBal([], /cricket|tournament/i) },
      { sNo: '15', desc: 'Donation Expenses', val: getExpenseBal(['4060101'], /monthly.*donation/i) },
      { sNo: '16', desc: 'Electric Equipment', val: getExpenseBal([], /electric.*equipment/i) },
      { sNo: '17', desc: 'Office Fitting', val: getExpenseBal([], /office.*fitting/i) },
      { sNo: '18', desc: 'Gardening Expenses', val: getExpenseBal([], /garden.*expense|gardening/i) },
      { sNo: '19', desc: 'Jamaat Khana Renovation', val: getExpenseBal([], /jamaat.*khana.*renovation|jamaat.*khana.*repair/i) },
      { sNo: '20', desc: 'Court / Legal Fees Payment', val: getExpenseBal(['4070101'], /legal.*fee|court/i) },
      { sNo: '21', desc: 'General Body Expenses', val: getExpenseBal(['4080105'], /general.*body|meeting/i) },
      { sNo: '22', desc: 'K-Electric Bill', val: getExpenseBal([], /k-electric|electricity/i) },
      { sNo: '23', desc: 'Medical Center Construction', val: getExpenseBal([], /medical.*center.*construction/i) },
      { sNo: '24', desc: 'Medical Donation', val: getExpenseBal(['4060103'], /medical.*donation/i) },
      { sNo: '25', desc: 'Shadi Biyah Donation', val: getExpenseBal(['4060102'], /marriage.*donation/i) },
      { sNo: '26', desc: 'Miscellaneous Expenses', val: 0 }, 
    ];

    // Right Column: 20 Incomes (Receipts)
    const incomes = [
      { sNo: '01', desc: 'General Account HBL (Opening)', val: getAssetBal(['1010102']) },
      { sNo: '02', desc: 'Cash in Hand (Opening)', val: getAssetBal(['1010101']) },
      { sNo: '03', desc: 'Opening Advance Salary', val: getAssetBal([], /advance.*salary/i) },
      { sNo: '04', desc: 'Bus Booking', val: getRevenueBal(['3020401'], /bus.*booking/i) },
      { sNo: '05', desc: 'Decoration Income', val: getRevenueBal(['3020403'], /decoration.*commission|decoration.*income/i) },
      { sNo: '06', desc: 'Fitra Income', val: getRevenueBal(['3020201'], /fitra/i) },
      { sNo: '07', desc: 'Donation Income', val: getRevenueBal(['3020000'], /general.*donation|donations/i) },
      { sNo: '08', desc: 'Sadaya Academy Receipt (Balance)', val: getAssetBal([], /sadaya.*academy/i) },
      { sNo: '09', desc: 'Loan for Salary Staff', val: getRevenueBal([], /salary.*loan/i) },
      { sNo: '10', desc: 'Sadar Jamaat Payable', val: getRevenueBal(['2010100'], /sadar.*payable/i) },
      { sNo: '11', desc: 'Membership Fees', val: getRevenueBal(['3020402'], /membership.*fee/i) },
      { sNo: '12', desc: 'Light Decoration Income', val: getRevenueBal([], /light.*decoration/i) },
      { sNo: '13', desc: 'Donation Income (Shadi Biyah)', val: getRevenueBal(['3020404'], /marriage.*donation.*received/i) },
      { sNo: '14', desc: 'Hall Booking Income', val: getRevenueBal(['3010101', '3010102', '3010103', '3010104']) },
      { sNo: '15', desc: 'Scrap Sale (Raddi)', val: getRevenueBal([], /scrap.*raddi|raddi/i) },
      { sNo: '16', desc: 'Scrap Sale (Scrap)', val: getRevenueBal([], /scrap.*sale|scrap.*sold/i) },
      { sNo: '17', desc: 'Zakat Income Ramzan 2021', val: getRevenueBal([], /zakat.*2021/i) },
      { sNo: '18', desc: 'Zakat Income Ramzan 2022', val: getRevenueBal([], /zakat.*2022/i) },
      { sNo: '19', desc: 'Zakat Income Ramzan 2023', val: getRevenueBal(['3020101'], /zakat/i) },
      { sNo: '20', desc: 'Profit HBL General', val: getRevenueBal([], /profit.*hbl|interest.*hbl/i) },
    ];

    // Compute residual balances from all ledger accounts and distribute to match main total
    const totalActualExpense = computedAccounts
      .filter(acc => acc.type === 'gl' && acc.nature.toUpperCase() === 'EXPENSE')
      .reduce((sum, acc) => sum + Math.max(0, acc.debit - acc.credit), 0);
    const mappedExpTotal = expenses.reduce((sum, item) => sum + item.val, 0);
    expenses[25].val = Math.max(0, totalActualExpense - mappedExpTotal);

    const totalActualIncome = computedAccounts
      .filter(acc => acc.type === 'gl' && acc.nature.toUpperCase() === 'REVENUE')
      .reduce((sum, acc) => sum + Math.max(0, acc.credit - acc.debit), 0);
    
    const mappedIncTotal = incomes.slice(3).reduce((sum, item) => sum + item.val, 0);
    const incomeDiff = totalActualIncome - mappedIncTotal;
    if (incomeDiff > 0) {
      incomes[6].val += incomeDiff;
    }

    return { expenses, incomes };
  }, [computedAccounts]);

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
    if (!fromDate && !toDate && tbReport && tbReport.summary) {
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
  }, [tbReport, computedAccounts, fromDate, toDate]);

  // Compute matrix balanced surplus
  const matrixTotals = useMemo(() => {
    const totalExp = matrixData.expenses.reduce((sum, e) => sum + e.val, 0);
    const totalInc = matrixData.incomes.reduce((sum, i) => sum + i.val, 0);
    
    // surplus represents the closing Cash & Bank surplus balance
    const surplus = Math.max(0, totalInc - totalExp);
    const finalExpTotal = totalExp + surplus;
    
    return {
      totalExpenses: totalExp,
      totalIncomes: totalInc,
      surplus: surplus,
      finalExpensesTotal: finalExpTotal,
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (viewMode === 'matrix') {
      const headers = ['S.No', 'Expenses / Payments Description', 'Expense Amount (PKR)', '', 'S.No', 'Receipts / Income Description', 'Income Amount (PKR)'];
      const csvRows = [headers.join(',')];
      
      const maxRows = Math.max(matrixData.expenses.length, matrixData.incomes.length);
      for (let i = 0; i < maxRows; i++) {
        const exp = matrixData.expenses[i] || { sNo: '', desc: '', val: 0 };
        const inc = matrixData.incomes[i] || { sNo: '', desc: '', val: 0 };
        csvRows.push([
          exp.sNo,
          `"${exp.desc}"`,
          exp.val ? exp.val.toFixed(2) : '0.00',
          '',
          inc.sNo,
          `"${inc.desc}"`,
          inc.val ? inc.val.toFixed(2) : '0.00'
        ].join(','));
      }
      
      // Add cash surplus & totals
      csvRows.push(['', '', '', '', '', '', '']);
      csvRows.push([
        '27',
        '"Closing Cash & Bank Surplus"',
        matrixTotals.surplus.toFixed(2),
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
          `"${(row.mainCategory || '').replace(/"/g, '""')}"`,
          `"${(row.glName || '').replace(/"/g, '""')}"`,
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
      <div className="hidden print:block text-center space-y-2 border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100">Katchi Muslim Lohar Wadha Welfare Jamaat</h1>
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Financial Statement / Trial Balance Matrix</p>
        <p className="text-xs text-slate-500 font-mono">
          Statement Date: {fromDate || 'Inception'} to {toDate || 'Live'} Live Synced Database Ledger Balance
        </p>
      </div>

      {/* Header Title & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Trial Balance Matrix</h2>
          <p className="text-xs text-slate-400">Live synced financial ledger matrix formatted exactly like the Urdu paper statement.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Switcher Toggle */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${viewMode === 'matrix' ? 'bg-brand-400 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Matrix View (Urdu Paper Layout)"
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Dual-Column Matrix</span>
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${viewMode === 'ledger' ? 'bg-brand-400 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              title="Standard Hierarchical Table View"
            >
              <List className="h-3.5 w-3.5" />
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
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-400/30 w-44"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-400/30 w-44"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors cursor-pointer self-end"
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
              placeholder="Search Matrix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl text-xs py-2.5 pl-9 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Receipts / Income</p>
            <p className="text-lg font-mono font-bold text-brand-400 mt-1">{formatMoney(viewMode === 'matrix' ? matrixTotals.totalIncomes : summaryTotals.totalCredit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Payments / Expenses</p>
            <p className="text-lg font-mono font-bold text-brand-400 mt-1">{formatMoney(viewMode === 'matrix' ? matrixTotals.totalExpenses : summaryTotals.totalDebit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Surplus / Closing Cash</p>
            <p className="text-lg font-mono font-bold text-slate-200 mt-1">
              {viewMode === 'matrix' 
                ? formatMoney(matrixTotals.surplus) 
                : formatMoney(Math.abs(summaryTotals.totalDebit - summaryTotals.totalCredit))}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balancing Status</p>
            <div className="flex items-center gap-2 mt-1.5">
              {summaryTotals.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-bg/15 text-slate-200 border border-brand-400/40">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" /> BALANCED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error-bg/15 text-slate-200 border border-brand-400/40">
                  <AlertTriangle className="h-3.5 w-3.5 text-brand-400" /> UNBALANCED
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                <span className="text-xs text-slate-500 font-mono print:hidden">Left Column (Debit Outcomes)</span>
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
                  {/* Closing Cash Surplus line to balance */}
                  <tr className="bg-brand-400/5 print:bg-slate-50 font-semibold text-brand-300 print:text-slate-800">
                    <td className="py-2.5 px-4 font-mono text-center border-r border-slate-900 print:border-slate-200">27</td>
                    <td className="py-2.5 px-4">Closing Cash & Bank Balance (Surplus)</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold print:text-slate-900">
                      {formatMoney(matrixTotals.surplus)}
                    </td>
                  </tr>
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
                <span className="text-xs text-slate-500 font-mono print:hidden">Right Column (Credit Inflows)</span>
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

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Download, Printer, Plus, Edit2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useCoaStore } from '../store/coaStore';
import { AccountFormDrawer } from '../components/coa/AccountFormDrawer';
import { reportsService } from '../services/apiServices';

export const TrialBalanceSheet = () => {
  const { treeAccounts, fetchAccountsTree } = useCoaStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [tbReport, setTbReport] = useState(null);
  const [isLoadingTb, setIsLoadingTb] = useState(false);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    fetchAccountsTree();
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
  }, [fetchAccountsTree]);

  const formatMoney = (val) => {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '—';
    return `Rs ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatBalance = (debit, credit) => {
    const net = (debit || 0) - (credit || 0);
    if (Math.abs(net) < 0.005) return '—';
    if (net > 0) {
      return `Rs ${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dr`;
    }
    return `Rs ${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
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
        glName: glName,
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

  const filteredData = useMemo(() => {
    return flattenedData.filter(item => 
      item.code.includes(searchQuery) || 
      item.nature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.mainCategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.glName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [flattenedData, searchQuery]);

  // Compute summary totals across MAIN accounts or from trial balance report
  const summaryTotals = useMemo(() => {
    if (tbReport && tbReport.summary) {
      return {
        totalDebit: tbReport.summary.totalDebit || 0,
        totalCredit: tbReport.summary.totalCredit || 0,
        isBalanced: tbReport.summary.isBalanced ?? true
      };
    }
    const mainRows = flattenedData.filter(r => r.type === 'main');
    const totalDebit = mainRows.reduce((sum, r) => sum + (r.debit || 0), 0);
    const totalCredit = mainRows.reduce((sum, r) => sum + (r.credit || 0), 0);
    return {
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
  }, [tbReport, flattenedData]);

  // Helper function to get row styling based on level
  const getRowStyle = (type) => {
    switch (type) {
      case 'main':
        return 'bg-amber-500/20 hover:bg-amber-500/30 border-y border-amber-500/50 font-bold text-amber-200';
      case 'parent':
        return 'bg-emerald-500/20 hover:bg-emerald-500/30 border-y border-emerald-500/40 font-semibold text-emerald-200';
      case 'subsidiary':
        return 'bg-transparent hover:bg-slate-800/50 border-b border-slate-800/50 text-slate-300';
      case 'gl':
        return 'bg-slate-900/40 hover:bg-slate-800/60 border-b border-slate-800/60 text-slate-200';
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
    link.setAttribute('download', `trial_balance_matrix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Trial Balance Matrix</h2>
          <p className="text-xs text-slate-400">Hierarchical ledger matrix synced with real-time trial balance financial data.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 cursor-pointer">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 cursor-pointer">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreateAccount} className="gap-2 cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </Button>
        </div>
      </div>

      {/* KPI Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Debit</p>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">{formatMoney(summaryTotals.totalDebit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Credit</p>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">{formatMoney(summaryTotals.totalCredit)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balancing Check</p>
            <div className="flex items-center gap-2 mt-1">
              {summaryTotals.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5" /> BALANCED (PKR 0.00)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                  <AlertTriangle className="h-3.5 w-3.5" /> OUT OF BALANCE
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Matrix Entries</p>
            <p className="text-lg font-mono font-bold text-slate-200 mt-1">{filteredData.length} accounts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search GL Code, Nature, or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg text-sm py-2 pl-9 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-500/40 border border-amber-500/50"></div>
                <span className="text-slate-400">Main</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/40 border border-emerald-500/50"></div>
                <span className="text-slate-400">Parent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></div>
                <span className="text-slate-400">Subsidiary / GL</span>
              </div>
            </div>
          </div>

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
                  <th className="py-3 px-4 w-24 text-right">Actions</th>
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
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-emerald-400">
                          {row.debit > 0 ? formatMoney(row.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-emerald-400">
                          {row.credit > 0 ? formatMoney(row.credit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-200 font-semibold">
                          {formatBalance(row.debit, row.credit)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`
                            inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                            ${row.type === 'main' ? 'bg-amber-500/20 text-amber-300' : ''}
                            ${row.type === 'parent' ? 'bg-emerald-500/20 text-emerald-300' : ''}
                            ${row.type === 'subsidiary' ? 'bg-slate-800 text-slate-400' : ''}
                            ${row.type === 'gl' ? 'bg-slate-900 text-slate-300 border border-slate-700' : ''}
                          `}>
                            {row.remarks}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
                              <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-amber-400" />
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

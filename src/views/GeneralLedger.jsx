import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useJournalStore } from '../store/journalStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Badge, AccountTypeBadge } from '../components/ui/Badge';
import { BookOpen, Calendar, ArrowRightLeft } from 'lucide-react';

export const GeneralLedger = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountQuery = searchParams.get('account');

  const { accounts, selectedSubsidiary } = useCoaStore();
  const { journals } = useJournalStore();

  // Filter posting accounts (no headers)
  const postingAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.detailType !== 'Header' && acc.status === 'Active');
  }, [accounts]);

  // Selected Account Code state
  const [selectedCode, setSelectedCode] = useState('');

  // Handle initialization and URL query changes
  useEffect(() => {
    if (accountQuery) {
      setSelectedCode(accountQuery);
    } else if (postingAccounts.length > 0 && !selectedCode) {
      setSelectedCode(postingAccounts[0].code);
    }
  }, [accountQuery, postingAccounts]);

  const activeAccount = useMemo(() => {
    return accounts.find((acc) => acc.code === selectedCode);
  }, [accounts, selectedCode]);

  // Fetch transaction lines for the selected account filtered by subsidiary
  const ledgerEntries = useMemo(() => {
    if (!selectedCode) return [];

    const list = [];
    
    journals.forEach((je) => {
      // Filter by subsidiary
      if (selectedSubsidiary !== 'Global' && je.subsidiary !== selectedSubsidiary) {
        return;
      }

      je.lines.forEach((line) => {
        if (line.accountCode === selectedCode) {
          list.push({
            jeId: je.id,
            date: je.date,
            reference: je.reference,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
          });
        }
      });
    });

    // Sort by date (ascending) for proper ledger running balance computation
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [journals, selectedCode, selectedSubsidiary]);

  // Compute starting balance and running balances list
  const runningLedger = useMemo(() => {
    if (!activeAccount) return { startingBalance: 0, endingBalance: 0, rows: [] };

    // Get initial balance for this subsidiary
    // In our simplified mock, initial balance applies if the account contains the subsidiary
    const appliesToSubsidiary = selectedSubsidiary === 'Global' || activeAccount.subsidiary.includes(selectedSubsidiary);
    const startingBalance = appliesToSubsidiary ? activeAccount.initialBalance : 0;
    
    let currentBalance = startingBalance;
    const isDebitNormal = activeAccount.type === 'Asset' || activeAccount.type === 'Expense';

    const rows = ledgerEntries.map((entry) => {
      if (isDebitNormal) {
        currentBalance = currentBalance + entry.debit - entry.credit;
      } else {
        currentBalance = currentBalance + entry.credit - entry.debit;
      }

      return {
        ...entry,
        runningBalance: currentBalance,
      };
    });

    return {
      startingBalance,
      endingBalance: currentBalance,
      rows,
    };
  }, [activeAccount, ledgerEntries, selectedSubsidiary]);

  const handleAccountChange = (e) => {
    const code = e.target.value;
    setSelectedCode(code);
    setSearchParams({ account: code });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">General Ledger Register</h2>
        <p className="text-xs text-slate-400">Audit trail transaction registers and historical debit/credit account balances.</p>
      </div>

      {/* Account Filter Panel */}
      <Card>
        <CardContent className="p-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:max-w-md">
            <BookOpen className="h-5 w-5 text-slate-500 flex-shrink-0" />
            <Select
              label="Select General Ledger Account"
              value={selectedCode}
              onChange={handleAccountChange}
            >
              {postingAccounts.map((acc) => (
                <option key={acc.code} value={acc.code}>
                  {acc.code} - {acc.name} ({acc.type})
                </option>
              ))}
            </Select>
          </div>

          {activeAccount && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Account Normal:</span>
              <AccountTypeBadge type={activeAccount.type} />
            </div>
          )}
        </CardContent>
      </Card>

      {activeAccount ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Panel: Account Details Summary */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="glow-indigo">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-brand-400">{activeAccount.code}</span>
                    <CardTitle className="mt-1">{activeAccount.name}</CardTitle>
                  </div>
                  <Badge variant="default">{activeAccount.currency}</Badge>
                </div>
                <CardDescription className="mt-2 leading-relaxed">
                  {activeAccount.description || 'No description provided for this GL account.'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4 border-t border-slate-800">
                {/* Starting Balance */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-semibold">Starting Balance</span>
                  <span className="font-mono font-bold text-slate-200">
                    ${runningLedger.startingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* Total Debits in period */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-semibold">Total Debits (DR)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ${runningLedger.rows.reduce((s, r) => s + r.debit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Total Credits in period */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-semibold">Total Credits (CR)</span>
                  <span className="font-mono text-red-400 font-bold">
                    ${runningLedger.rows.reduce((s, r) => s + r.credit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Net balance rollup */}
                <div className="flex justify-between items-center border-t border-slate-800 pt-3 text-sm">
                  <span className="text-slate-200 uppercase font-bold text-[11px] tracking-wider">Ending Balance</span>
                  <span className={`font-mono font-bold ${runningLedger.endingBalance < 0 ? 'text-red-400' : 'text-brand-300'}`}>
                    ${runningLedger.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5 text-brand-400" />
                <span>Consolidation details</span>
              </h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                This account operates globally and consolidates financials under:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {activeAccount.subsidiary.map(sub => (
                  <Badge key={sub} variant="brand" className="text-[9px]">{sub}</Badge>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Panel: Transaction Journal Lines Ledger */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle>Ledger Postings</CardTitle>
                  <CardDescription>All posted journals reflecting debits/credits on this account.</CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold uppercase font-mono">FY 2026</span>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                      <th className="py-2.5 px-3 w-28">Date</th>
                      <th className="py-2.5 px-3 w-24">Doc Ref</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 w-28 text-right">Debit (DR)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Credit (CR)</th>
                      <th className="py-2.5 px-3 w-32 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-800/40">
                    {/* Initial Starting Balance Row */}
                    <tr className="bg-slate-900/10 italic text-slate-400">
                      <td className="py-3 px-3">---</td>
                      <td className="py-3 px-3">---</td>
                      <td className="py-3 px-3 font-semibold uppercase tracking-wider text-[10px]">Starting Balance</td>
                      <td className="py-3 px-3 text-right">---</td>
                      <td className="py-3 px-3 text-right">---</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        ${runningLedger.startingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {runningLedger.rows.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500 italic">
                          No journal entries posted to this account in the current fiscal period.
                        </td>
                      </tr>
                    ) : (
                      runningLedger.rows.map((row, index) => (
                        <tr key={`${row.jeId}-${index}`} className="hover:bg-slate-900/20 transition-colors">
                          <td className="py-3 px-3 text-slate-300 font-medium">{row.date}</td>
                          <td className="py-3 px-3 text-brand-400 font-mono font-bold">{row.jeId}</td>
                          <td className="py-3 px-3 text-slate-300">{row.description}</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-400">
                            {row.debit > 0 ? `$${row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-red-400">
                            {row.credit > 0 ? `$${row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                            ${row.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

        </div>
      ) : (
        <Card className="p-8 text-center text-slate-500">
          No accounts available to inspect. Add accounts in the Chart of Accounts first.
        </Card>
      )}
    </div>
  );
};

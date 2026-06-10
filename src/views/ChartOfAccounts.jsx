import { useState, useMemo } from 'react';
import { useCoaStore } from '../store/coaStore';
import { useJournalStore, calculateAccountBalances } from '../store/journalStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { CoaTreeView } from '../components/coa/CoaTreeView';
import { CoaTableView } from '../components/coa/CoaTableView';
import { CoaExportImport } from '../components/coa/CoaExportImport';
import { AccountFormDrawer } from '../components/coa/AccountFormDrawer';
import { Plus, Search, Layers, Grid } from 'lucide-react';

export const ChartOfAccounts = () => {
  const { accounts, selectedSubsidiary, toggleAccountStatus } = useCoaStore();
  const { journals } = useJournalStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [viewMode, setViewMode] = useState('tree'); // tree or table
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Calculate live balances
  const { rollupBalances } = useMemo(() => {
    return calculateAccountBalances(accounts, journals, selectedSubsidiary);
  }, [accounts, journals, selectedSubsidiary]);

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setIsDrawerOpen(true);
  };

  const handleCreateAccount = () => {
    setEditingAccount(null);
    setIsDrawerOpen(true);
  };

  // Callback to create a sub-account pre-filled with parent details
  const handleCreateSubAccount = (parentCode) => {
    const parent = accounts.find(a => a.code === parentCode);
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

  return (
    <div className="space-y-6">
      {/* Header Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Chart of Accounts</h2>
          <p className="text-xs text-slate-400">Establish and organize general ledger index accounts, summary nodes, and hierarchies.</p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* CSV Tools */}
          <CoaExportImport />
          
          {/* Create Button */}
          <Button variant="primary" size="sm" onClick={handleCreateAccount} className="gap-1.5 cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <Card>
        <CardContent className="p-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search code or account name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg text-sm py-2 pl-10 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
              />
            </div>

            {/* Type filter */}
            <div className="w-full md:w-48">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 text-sm py-2 px-3 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>

          {/* View Toggler (Tree vs Table) */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950/60 border border-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('tree')}
              className={`
                px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5
                ${viewMode === 'tree'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Hierarchical Tree</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`
                px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5
                ${viewMode === 'table'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Grid Table</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Main Ledger Accounts List */}
      <Card>
        <CardContent className="p-0">
          {viewMode === 'tree' ? (
            <CoaTreeView
              accounts={accounts}
              balances={rollupBalances}
              onEditAccount={handleEditAccount}
              onToggleStatus={toggleAccountStatus}
              onCreateSubAccount={handleCreateSubAccount}
              searchQuery={searchQuery}
              typeFilter={typeFilter}
              selectedSubsidiary={selectedSubsidiary}
            />
          ) : (
            <CoaTableView
              accounts={accounts}
              balances={rollupBalances}
              onEditAccount={handleEditAccount}
              onToggleStatus={toggleAccountStatus}
              searchQuery={searchQuery}
              typeFilter={typeFilter}
              selectedSubsidiary={selectedSubsidiary}
            />
          )}
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

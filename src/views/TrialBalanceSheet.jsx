import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Download, Printer, Plus, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useCoaStore } from '../store/coaStore';
import { AccountFormDrawer } from '../components/coa/AccountFormDrawer';

export const TrialBalanceSheet = () => {
  const { treeAccounts, fetchAccountsTree } = useCoaStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    fetchAccountsTree();
  }, [fetchAccountsTree]);

  // Flatten the tree data for the matrix view
  const flattenedData = useMemo(() => {
    const result = [];
    const traverse = (node, depth = 0) => {
      // Determine columns based on the image format
      const level = node.level || 'SUBSIDIARY';
      const isHeader = node.detailType === 'Header';
      
      let mainCategoryName = '';
      let glName = '';
      
      if (level === 'MAIN' || level === 'PARENT') {
        mainCategoryName = node.name;
      } else if (level === 'SUBSIDIARY') {
        if (isHeader) {
          mainCategoryName = node.name;
        } else {
          glName = node.name;
        }
      }

      result.push({
        id: node.id,
        code: node.code,
        nature: node.type || 'UNKNOWN',
        mainCategory: mainCategoryName,
        glName: glName,
        remarks: level,
        type: level.toLowerCase(),
        rawAccount: node
      });
      
      if (node.children && node.children.length > 0) {
        // Sort children by code
        const sortedChildren = [...node.children].sort((a, b) => a.code.localeCompare(b.code));
        sortedChildren.forEach(child => traverse(child, depth + 1));
      }
    };
    
    // Sort treeAccounts by code
    const sortedAccounts = [...treeAccounts].sort((a, b) => a.code.localeCompare(b.code));
    sortedAccounts.forEach(root => traverse(root));
    return result;
  }, [treeAccounts]);

  const filteredData = flattenedData.filter(item => 
    item.code.includes(searchQuery) || 
    item.nature.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.mainCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.glName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function to get row styling based on level
  const getRowStyle = (type) => {
    switch (type) {
      case 'main':
        return 'bg-amber-500/20 hover:bg-amber-500/30 border-y border-amber-500/50 font-bold text-amber-200';
      case 'parent':
        return 'bg-emerald-500/20 hover:bg-emerald-500/30 border-y border-emerald-500/40 font-semibold text-emerald-200';
      case 'subsidiary':
        return 'bg-transparent hover:bg-slate-800/50 border-b border-slate-800/50 text-slate-300';
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

  return (
    <div className="space-y-6">
      {/* Header Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Trial Balance Matrix</h2>
          <p className="text-xs text-slate-400">Hierarchical view of Main, Parent, and Subsidiary Accounts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreateAccount} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </Button>
        </div>
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
                <span className="text-slate-400">Subsidiary</span>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b-2 border-slate-700 text-slate-300 font-bold tracking-wider text-xs uppercase">
                  <th className="py-3 px-4 w-32">GL Code</th>
                  <th className="py-3 px-4 w-48">Nature</th>
                  <th className="py-3 px-4 w-64">Main Category Name <span className="text-slate-500 text-[10px] ml-1">(Locked)</span></th>
                  <th className="py-3 px-4 min-w-[200px]">GL Name <span className="text-slate-500 text-[10px] ml-1">(Open)</span></th>
                  <th className="py-3 px-4 w-32 text-center">Remarks</th>
                  <th className="py-3 px-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row) => (
                    <tr 
                      key={row.code} 
                      className={`group transition-colors duration-150 ${getRowStyle(row.type)}`}
                    >
                      <td className="py-2.5 px-4 font-mono">{row.code}</td>
                      <td className="py-2.5 px-4 uppercase">{row.nature}</td>
                      <td className={`py-2.5 px-4 ${row.type === 'subsidiary' && row.mainCategory ? 'font-semibold text-brand-300' : ''}`}>
                        {row.mainCategory}
                      </td>
                      <td className="py-2.5 px-4">{row.glName}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`
                          inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${row.type === 'main' ? 'bg-amber-500/20 text-amber-300' : ''}
                          ${row.type === 'parent' ? 'bg-emerald-500/20 text-emerald-300' : ''}
                          ${row.type === 'subsidiary' ? 'bg-slate-800 text-slate-400' : ''}
                        `}>
                          {row.remarks}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <div className="inline-flex gap-1.5 justify-end w-full">
                          {row.type !== 'subsidiary' || row.rawAccount.detailType === 'Header' ? (
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
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

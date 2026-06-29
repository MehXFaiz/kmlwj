import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit2, ToggleLeft, ToggleRight, BookOpen, AlertCircle, Plus, Lock, Trash2 } from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { showToast } from '../ui/Toast';

export const CoaTreeView = ({
  accounts,
  balances,
  reservedCodes = [],
  onEditAccount,
  onToggleStatus,
  onCreateSubAccount,
  searchQuery,
  typeFilter,
  selectedSubsidiary,
  showReserved = false,
}) => {
  const navigate = useNavigate();
  const { deleteAccount } = useCoaStore();
  
  // Track collapsed node codes
  const [collapsedCodes, setCollapsedCodes] = useState(new Set());
  // Fix 17 — Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(null); // holds account to delete

  const toggleCollapse = (code) => {
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Fix 17 — Handle delete with reserved check
  const handleDeleteConfirmed = useCallback(async () => {
    if (!confirmDelete) return;
    // Fix 7 — Block reserved accounts
    if (confirmDelete.isReserved || reservedCodes.some(r => r.isActive && confirmDelete.code >= r.reserveStart && confirmDelete.code <= r.reserveEnd)) {
      showToast('This is a reserved code and cannot be deleted.', 'error');
      setConfirmDelete(null);
      return;
    }
    try {
      await deleteAccount(confirmDelete.id);
      showToast(`✅ Account ${confirmDelete.code} deleted successfully`, 'success');
    } catch (e) {
      showToast(e.message || 'Failed to delete account', 'error');
    }
    setConfirmDelete(null);
  }, [confirmDelete, deleteAccount, reservedCodes]);

  // Fix 12 — Normalize search (handle leading zeros)
  const normalizeSearch = (val) => val?.replace(/^0+/, '') || '';
  const normalizedQuery = normalizeSearch(searchQuery);

  // Helper to traverse and flatten the nested tree for rendering
  const treeRows = useMemo(() => {
    const result = [];

    // Traverse recursively (DFS)
    const traverse = (node, depth = 0, isLastChild = false, parentPath = []) => {
      // Filter by subsidiary at the node level
      if (selectedSubsidiary !== 'Global' && !node.subsidiary.includes(selectedSubsidiary) && !node.subsidiary.includes('Global')) {
        return; // Skip if it doesn't match subsidiary
      }

      const isReservedNode = node.isReserved || reservedCodes.some(r => r.isActive && node.code >= r.reserveStart && node.code <= r.reserveEnd);
      if (!showReserved && isReservedNode) {
        return; // Skip if reserved and showReserved is false
      }

      const children = node.children || [];
      const hasChildren = children.length > 0;
      
      const nodeRow = {
        account: node,
        depth,
        hasChildren,
        isLastChild,
        parentPath,
      };

      result.push(nodeRow);

      // If search is active, we auto-expand everything. Otherwise, respect collapse state.
      const isCollapsed = collapsedCodes.has(node.code) && !searchQuery;

      if (!isCollapsed && hasChildren) {
        // Sort children by code
        const sortedChildren = [...children].sort((a, b) => a.code.localeCompare(b.code));
        sortedChildren.forEach((child, index) => {
          traverse(child, depth + 1, index === sortedChildren.length - 1, [...parentPath, node.code]);
        });
      }
    };

    // accounts is already an array of root nodes from the API
    const rootAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
    rootAccounts.forEach((root, index) => {
      traverse(root, 0, index === rootAccounts.length - 1, []);
    });

    // Filter rows based on search and type filters
    if (searchQuery || typeFilter !== 'All') {
      const matches = new Set();
      
      // Pass 1: Mark nodes that directly match
      result.forEach((row) => {
        const matchesSearch = searchQuery
          ? row.account.code.includes(searchQuery) || normalizeSearch(row.account.code).includes(normalizedQuery) || row.account.name.toLowerCase().includes(searchQuery.toLowerCase())
          : true;
        const matchesType = typeFilter !== 'All' ? row.account.type === typeFilter : true;

        if (matchesSearch && matchesType) {
          matches.add(row.account.code);
          // Also mark all its ancestors so they are visible
          row.parentPath.forEach((ancestorCode) => matches.add(ancestorCode));
        }
      });

      // Pass 2: Filter results array to keep matched nodes and their ancestors
      return result.filter((row) => matches.has(row.account.code));
    }

    return result;
  }, [accounts, collapsedCodes, searchQuery, normalizedQuery, typeFilter, selectedSubsidiary]);

  return (
    <div className="w-full overflow-x-auto">
      {/* Fix 17 — Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Confirm Deletion</h3>
            <p className="text-sm text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-200">{confirmDelete.name}</span>{' '}
              (<span className="font-mono text-brand-400">{confirmDelete.code}</span>)?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-red-600 hover:bg-red-500 text-white" onClick={handleDeleteConfirmed}>Delete</Button>
            </div>
          </div>
        </div>
      )}
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/20">
            <th className="py-3 px-4 w-40">Account Code</th>
            <th className="py-3 px-4">Account Name</th>
            <th className="py-3 px-4 w-32">Type</th>
            <th className="py-3 px-4 w-36">Subtype</th>
            <th className="py-3 px-4 w-28">Currency</th>
            <th className="py-3 px-4 w-40 text-right">Balance</th>
            <th className="py-3 px-4 w-24 text-center">Status</th>
            <th className="py-3 px-4 w-44 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-slate-800/50">
          {treeRows.length === 0 ? (
            <tr>
              <td colSpan="8" className="py-10 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-6 w-6 text-slate-600" />
                  <span>No accounts found matching your search.</span>
                </div>
              </td>
            </tr>
          ) : (
            treeRows.map((row) => {
              const { account, depth, hasChildren } = row;
              const balance = balances[account.code] ?? 0;
              const isCollapsed = collapsedCodes.has(account.code) && !searchQuery;
              const isSystemLevel = account.level === 'MAIN' || account.level === 'PARENT' || account.level === 'SUBSIDIARY';
              const isReservedNode = account.isReserved || reservedCodes.some(r => r.isActive && account.code >= r.reserveStart && account.code <= r.reserveEnd);

              // Fix 14 — Row background by level
              const levelBg = account.level === 'MAIN'
                ? 'bg-slate-900/60 font-bold'
                : account.level === 'PARENT'
                ? 'bg-slate-900/30 font-semibold'
                : account.level === 'SUBSIDIARY'
                ? 'bg-slate-900/15'
                : '';

              return (
                <tr 
                  key={account.code} 
                  className={`
                    hover:bg-slate-900/35 transition-colors group
                    ${levelBg}
                    ${account.status === 'Inactive' ? 'opacity-55' : ''}
                  `}
                >
                  {/* Account Code */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                    <div className="flex items-center gap-1.5">
                      {account.code}
                      {isReservedNode && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">RESERVED</span>
                      )}
                      {(account.isReserved || reservedCodes.some(r => r.isActive && account.code >= r.reserveStart && account.code <= r.reserveEnd)) && (
                        <Lock className="h-3 w-3 text-amber-500" title="This account code is system-reserved" />
                      )}
                    </div>
                  </td>

                  {/* Account Name (with hierarchical indentation) */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 16}px` }}>
                      {/* Tree Join lines indicator */}
                      {depth > 0 && (
                        <div className="flex items-center mr-2">
                          <span className="text-slate-700 font-normal">└─</span>
                        </div>
                      )}
                      
                      {/* Collapse/Expand Toggle */}
                      {hasChildren ? (
                        <button
                          onClick={() => toggleCollapse(account.code)}
                          className="mr-2 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-6.5"></span> // spacer
                      )}
                      
                      <span className={`${account.level === 'MAIN' ? 'text-slate-100 font-bold' : account.level === 'PARENT' ? 'text-slate-200 font-semibold' : 'text-slate-300'} flex items-center gap-1.5`}>
                        {/* Fix 5/14 — Lock icon for Levels 1, 2, 3 */}
                        {(account.level === 'MAIN' || account.level === 'PARENT' || account.level === 'SUBSIDIARY') && (
                          <span title={`Level ${account.level === 'MAIN' ? '1' : account.level === 'PARENT' ? '2' : '3'} — system account`} className="text-slate-500 select-none">🔒</span>
                        )}
                        {isReservedNode ? (
                          <div className="flex flex-col select-none">
                            <span className="text-slate-400 font-semibold italic text-xs">Reserved for Future Use</span>
                            <span className="text-[10px] text-slate-500 font-semibold tracking-wide">(Not Available for Posting)</span>
                          </div>
                        ) : (
                          <span>{account.name}</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Account Type */}
                  <td className="py-3.5 px-4">
                    <AccountTypeBadge type={account.type} />
                  </td>

                  {/* Account Subtype */}
                  <td className="py-3.5 px-4 text-slate-400 font-medium">
                    {account.detailType}
                  </td>

                  {/* Currency */}
                  <td className="py-3.5 px-4 font-semibold text-slate-500">
                    {account.currency}
                  </td>

                  {/* Balance */}
                  <td className={`py-3.5 px-4 text-right font-mono font-semibold ${balance < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                    Rs {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3.5 px-4 text-center">
                    {account.level === 'MAIN' ? (
                      <span className="inline-flex items-center justify-center gap-1 text-slate-500 cursor-default" title="MAIN accounts are permanent and cannot be deactivated">
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Locked</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onToggleStatus(account.id)}
                        className="cursor-pointer"
                        title={account.status === 'Active' ? 'Deactivate account' : 'Activate account'}
                      >
                        {account.status === 'Active' ? (
                          <ToggleRight className="h-5 w-5 text-emerald-400 hover:text-emerald-300" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    )}
                  </td>

                  {/* Inline Actions */}
                  <td className="py-3.5 px-4 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <div className="inline-flex gap-1.5">
                      {/* Create sub-account */}
                      {account.detailType === 'Header' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 cursor-pointer"
                          onClick={() => onCreateSubAccount(account.code)}
                          title="Add sub-account under this header"
                        >
                          <Plus className="h-3.5 w-3.5 text-brand-400" />
                        </Button>
                      )}
                      
                      {/* View General Ledger */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer"
                        onClick={() => navigate(`/ledger?account=${account.code}`)}
                        title="View Ledger Transactions"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-slate-400 hover:text-brand-300" />
                      </Button>

                      {/* Edit — Fix 5: warn for system levels */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${isSystemLevel ? 'text-slate-600 cursor-pointer hover:text-amber-400' : 'cursor-pointer text-slate-400 hover:text-amber-400'}`}
                        onClick={() => {
                          if (account.level === 'MAIN') return;
                          if (account.level === 'PARENT' || account.level === 'SUBSIDIARY') {
                            if (!window.confirm(`⚠️ Warning: This is a system-level account (${account.level}). Are you sure you want to edit it?`)) return;
                          }
                          onEditAccount(account);
                        }}
                        title={account.level === 'MAIN' ? 'MAIN accounts cannot be edited' : 'Edit Account'}
                        disabled={account.level === 'MAIN'}
                      >
                        {account.level === 'MAIN' ? <Lock className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                      </Button>

                      {/* Delete — Fix 7: blocked for reserved; Fix 17: confirmation */}
                      {account.level !== 'MAIN' && account.level !== 'PARENT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${isReservedNode ? 'opacity-35 cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-400 hover:text-red-400'}`}
                          onClick={() => {
                            if (isReservedNode) {
                              showToast('This is a reserved code and cannot be deleted.', 'error');
                              return;
                            }
                            setConfirmDelete(account);
                          }}
                          title={isReservedNode ? 'Reserved accounts cannot be deleted' : 'Delete Account'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

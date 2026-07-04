import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit2, ToggleLeft, ToggleRight, BookOpen, AlertCircle, Plus, Lock, Trash2 } from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { showToast } from '../ui/Toast';

// Recursively collect all codes at a given level to build initial collapse state
function collectCodesByLevel(nodes, targetLevels) {
  const codes = new Set();
  const traverse = (nodeList) => {
    for (const node of nodeList) {
      if (targetLevels.includes(node.level)) codes.add(node.code);
      if (node.children?.length) traverse(node.children);
    }
  };
  traverse(nodes);
  return codes;
}

export const CoaTreeView = ({
  accounts,
  balances,
  reservedCodes = [],
  onEditAccount,
  onToggleStatus,
  onCreateSubAccount,
  searchQuery,
  typeFilter,
  levelFilter,
  natureFilter,
  reservedFilter,
  selectedSubsidiary,
}) => {
  const navigate = useNavigate();
  const { deleteAccount } = useCoaStore();
  
  // All non-GL nodes start collapsed — user must expand level by level
  const [collapsedCodes, setCollapsedCodes] = useState(() => {
    return collectCodesByLevel(accounts, ['MAIN', 'PARENT', 'SUBSIDIARY']);
  });
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Re-initialize collapse state whenever the account tree changes (e.g. after seed/fetch)
  useEffect(() => {
    setCollapsedCodes(prev => {
      // Only add newly loaded nodes — preserve any user expansions that are still valid
      const newCodes = collectCodesByLevel(accounts, ['MAIN', 'PARENT', 'SUBSIDIARY']);
      // Start fully collapsed on first load (when prev is empty)
      if (prev.size === 0) return newCodes;
      return prev;
    });
  }, [accounts]);

  const toggleCollapse = useCallback((code) => {
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

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

    // Filter rows based on search and filters
    if (searchQuery || typeFilter !== 'All' || levelFilter !== 'All' || natureFilter !== 'All' || reservedFilter !== 'All') {
      const matches = new Set();
      
      // Pass 1: Mark nodes that directly match ALL active filters
      result.forEach((row) => {
        const isReservedNode = row.account.isReserved || reservedCodes.some(r => r.isActive && row.account.code >= r.reserveStart && row.account.code <= r.reserveEnd);

        const matchesSearch = searchQuery
          ? row.account.code.includes(searchQuery) || normalizeSearch(row.account.code).includes(normalizedQuery) || row.account.name.toLowerCase().includes(searchQuery.toLowerCase())
          : true;
        const matchesType = typeFilter !== 'All' ? row.account.type === typeFilter : true;
        const matchesLevel = levelFilter !== 'All' ? row.account.level === levelFilter : true;
        const matchesNature = natureFilter !== 'All' ? row.account.detailType === natureFilter : true;
        const matchesReserved = reservedFilter !== 'All' ? (reservedFilter === 'Yes' ? isReservedNode : !isReservedNode) : true;

        if (matchesSearch && matchesType && matchesLevel && matchesNature && matchesReserved) {
          matches.add(row.account.code);
          // Also mark all its ancestors so they are visible
          row.parentPath.forEach((ancestorCode) => matches.add(ancestorCode));
        }
      });

      // Pass 2: Filter results array to keep matched nodes and their ancestors
      return result.filter((row) => matches.has(row.account.code));
    }

    return result;
  }, [accounts, collapsedCodes, searchQuery, normalizedQuery, typeFilter, levelFilter, natureFilter, reservedFilter, selectedSubsidiary, reservedCodes]);

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
              const isGLLevel = account.level === 'GL';
              const isReservedNode = account.isReserved || reservedCodes.some(r => r.isActive && account.code >= r.reserveStart && account.code <= r.reserveEnd);

              // Fix 14 — Row background by level (4 levels)
              const levelBg = account.level === 'MAIN'
                ? 'bg-slate-900/70'
                : account.level === 'PARENT'
                ? 'bg-slate-900/40'
                : account.level === 'SUBSIDIARY'
                ? 'bg-slate-900/20'
                : ''; // GL = default white/clean

              return (
                <tr 
                  key={account.code} 
                  className={`
                    hover:bg-slate-800/40 transition-colors duration-100 group border-b border-slate-800/30
                    ${levelBg}
                    ${account.status === 'Inactive' ? 'opacity-50' : ''}
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
                  <td className="py-3 px-4">
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>

                      {/* Tree connector line */}
                      {depth > 0 && (
                        <span className="text-slate-700 text-sm mr-1.5 select-none font-mono">{isCollapsed !== undefined && hasChildren ? '├─' : '└─'}</span>
                      )}

                      {/* Expand / Collapse toggle — only for nodes with children */}
                      {hasChildren ? (
                        <button
                          onClick={() => toggleCollapse(account.code)}
                          className={`
                            mr-2 p-1 rounded transition-colors cursor-pointer
                            ${account.level === 'MAIN' ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : ''}
                            ${account.level === 'PARENT' ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : ''}
                            ${account.level === 'SUBSIDIARY' ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-300' : ''}
                            ${account.level === 'GL' ? 'hover:bg-slate-800 text-slate-500' : ''}
                          `}
                          title={isCollapsed ? `Expand ${account.name}` : `Collapse ${account.name}`}
                          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                          {isCollapsed
                            ? <ChevronRight className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                        </button>
                      ) : (
                        <span className="w-7 inline-block" /> // spacer for leaf nodes
                      )}

                      {/* Account name with level-aware styling */}
                      <span className={`flex items-center gap-1.5 ${
                        account.level === 'MAIN'       ? 'text-slate-100 font-bold text-[13px] tracking-wide' :
                        account.level === 'PARENT'     ? 'text-slate-200 font-semibold text-[12.5px]' :
                        account.level === 'SUBSIDIARY' ? 'text-slate-300 font-medium text-[12px]' :
                                                         'text-slate-400 text-[12px]'
                      }`}>

                        {/* 🔒 Lock icon for Levels 1, 2, 3 */}
                        {account.level === 'MAIN' && (
                          <Lock className="h-3 w-3 text-slate-600 flex-shrink-0" title="Level 1 — Root account (permanent, cannot be edited or deleted)" />
                        )}
                        {account.level === 'PARENT' && (
                          <Lock className="h-3 w-3 text-slate-600 flex-shrink-0" title="Level 2 — Parent category (admin only)" />
                        )}
                        {account.level === 'SUBSIDIARY' && (
                          <Lock className="h-3 w-3 text-slate-600 flex-shrink-0" title="Level 3 — Subsidiary header (admin only)" />
                        )}

                        {/* ✏️ Editable marker for Level 4 GL */}
                        {account.level === 'GL' && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500/10 flex-shrink-0" title="Level 4 — GL Account (user editable)">
                            <Edit2 className="h-2.5 w-2.5 text-emerald-400" />
                          </span>
                        )}

                        {/* Account name or Reserved placeholder */}
                        {isReservedNode ? (
                          <div className="flex flex-col select-none">
                            <span className="text-slate-500 italic text-[11px]">Reserved for Future Use</span>
                            <span className="text-[10px] text-slate-600">(Not Available for Posting)</span>
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
                  <td className="py-3 px-4 text-center">
                    {account.level !== 'GL' ? (
                      // L1/L2/L3 — always show locked status, no toggle
                      <span className="inline-flex items-center justify-center gap-1 text-slate-600 cursor-default" title={`Level ${account.level === 'MAIN' ? '1' : account.level === 'PARENT' ? '2' : '3'} accounts cannot be deactivated`}>
                        <Lock className="h-3 w-3" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Locked</span>
                      </span>
                    ) : (
                      // GL level — toggleable
                      <button
                        onClick={() => onToggleStatus(account.id)}
                        className="cursor-pointer"
                        title={account.status === 'Active' ? 'Deactivate GL account' : 'Activate GL account'}
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
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">

                      {/* View General Ledger — available for all levels */}
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 cursor-pointer"
                        onClick={() => navigate(`/ledger?account=${account.code}`)}
                        title="View Ledger Transactions"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-slate-500 hover:text-brand-300" />
                      </Button>

                      {/* ——— LEVEL 4 GL ONLY: Edit + Delete ——— */}
                      {isGLLevel && (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 cursor-pointer text-slate-400 hover:text-amber-400"
                            onClick={() => onEditAccount(account)}
                            title="Edit GL Account"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            className={`h-7 w-7 p-0 ${isReservedNode ? 'opacity-30 cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-400 hover:text-red-400'}`}
                            onClick={() => {
                              if (isReservedNode) {
                                showToast('Reserved codes cannot be deleted.', 'error');
                              } else {
                                setConfirmDelete(account);
                              }
                            }}
                            title={isReservedNode ? "Reserved accounts cannot be deleted" : "Delete GL Account"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                      {/* ——— LEVEL 2 / 3: Add sub-account (SUBSIDIARY level only adds GL) ——— */}
                      {account.level === 'SUBSIDIARY' && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 cursor-pointer text-slate-500 hover:text-brand-400"
                          onClick={() => onCreateSubAccount(account.code)}
                          title={`Add GL account under ${account.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* ——— LEVELS 1/2/3: No edit or delete — just lock indicator ——— */}
                      {!isGLLevel && (
                        <span
                          className="h-7 w-7 inline-flex items-center justify-center text-slate-700"
                          title={`Level ${account.level === 'MAIN' ? '1' : account.level === 'PARENT' ? '2' : '3'} accounts are system-defined and cannot be edited or deleted`}
                        >
                          <Lock className="h-3 w-3" />
                        </span>
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


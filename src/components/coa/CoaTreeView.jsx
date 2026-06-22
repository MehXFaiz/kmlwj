import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit2, ToggleLeft, ToggleRight, BookOpen, AlertCircle, Plus, Lock } from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
  
  // Track collapsed node codes
  const [collapsedCodes, setCollapsedCodes] = useState(new Set());

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
          ? row.account.code.includes(searchQuery) || row.account.name.toLowerCase().includes(searchQuery.toLowerCase())
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
  }, [accounts, collapsedCodes, searchQuery, typeFilter, selectedSubsidiary]);

  return (
    <div className="w-full overflow-x-auto">
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
              <td colSpan="8" className="py-8 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-6 w-6 text-slate-600" />
                  <span>No accounts match the selected filters.</span>
                </div>
              </td>
            </tr>
          ) : (
            treeRows.map((row) => {
              const { account, depth, hasChildren } = row;
              const balance = balances[account.code] ?? 0;
              const isCollapsed = collapsedCodes.has(account.code) && !searchQuery;

              return (
                <tr 
                  key={account.code} 
                  className={`
                    hover:bg-slate-900/35 transition-colors group
                    ${account.detailType === 'Header' ? 'font-bold bg-slate-900/10' : ''}
                    ${account.status === 'Inactive' ? 'opacity-55' : ''}
                  `}
                >
                  {/* Account Code */}
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                    <div className="flex items-center gap-1.5">
                      {account.code}
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
                      
                      <span className={`${account.detailType === 'Header' ? 'text-slate-100' : 'text-slate-300'} flex items-center gap-1.5`}>
                        {account.level === 'MAIN' && <span title="This root category is permanent and locked" className="text-slate-400 select-none">🔒</span>}
                        {account.isReserved || reservedCodes.some(r => r.isActive && account.code >= r.reserveStart && account.code <= r.reserveEnd) ? (
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

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${account.level === 'MAIN' ? 'opacity-35 cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-400 hover:text-amber-400'}`}
                        onClick={account.level === 'MAIN' ? undefined : () => onEditAccount(account)}
                        disabled={account.level === 'MAIN'}
                        title={account.level === 'MAIN' ? "MAIN accounts are permanent and cannot be edited" : "Edit Account Details"}
                      >
                        {account.level === 'MAIN' ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Edit2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
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

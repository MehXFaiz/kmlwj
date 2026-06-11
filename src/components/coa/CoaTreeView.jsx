import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit2, ToggleLeft, ToggleRight, BookOpen, AlertCircle, Plus } from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const CoaTreeView = ({
  accounts,
  balances,
  onEditAccount,
  onToggleStatus,
  onCreateSubAccount,
  searchQuery,
  typeFilter,
  selectedSubsidiary,
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

  // Helper to build hierarchy
  const treeRows = useMemo(() => {
    // Filter accounts by subsidiary first
    const subsidiaryFiltered = accounts.filter((acc) => {
      if (selectedSubsidiary === 'Global') return true;
      return acc.subsidiary.includes(selectedSubsidiary) || acc.subsidiary.includes('Global');
    });

    // Create maps
    const accountsMap = {};
    const rootAccounts = [];
    const childrenMap = {};

    subsidiaryFiltered.forEach((acc) => {
      accountsMap[acc.code] = acc;
      if (!acc.parentCode) {
        rootAccounts.push(acc);
      } else {
        if (!childrenMap[acc.parentCode]) {
          childrenMap[acc.parentCode] = [];
        }
        childrenMap[acc.parentCode].push(acc);
      }
    });

    // Sort roots by code
    rootAccounts.sort((a, b) => a.code.localeCompare(b.code));

    // Sort children lists by code
    Object.keys(childrenMap).forEach((pCode) => {
      childrenMap[pCode].sort((a, b) => a.code.localeCompare(b.code));
    });

    const result = [];

    // Traverse recursively (DFS)
    const traverse = (node, depth = 0, isLastChild = false, parentPath = []) => {
      const children = childrenMap[node.code] || [];
      const hasChildren = children.length > 0;
      
      const nodeRow = {
        account: node,
        depth,
        hasChildren,
        isLastChild,
        parentPath,
      };

      // We always add if no filters, but if filters exist, we might skip.
      // However, to keep tree structure, if a child matches search, we must show parents too!
      // So let's build the full list, and then we filter.
      // Wait, let's filter after DFS or during DFS.
      // A simple approach is: include everything in the DFS list, then filter out rows that don't match.
      // BUT if we filter out a parent, we break the visual tree.
      // Instead, if search is active, we expand all matching nodes and show matching nodes + their parents.
      
      result.push(nodeRow);

      // If search is active, we auto-expand everything. Otherwise, respect collapse state.
      const isCollapsed = collapsedCodes.has(node.code) && !searchQuery;

      if (!isCollapsed && hasChildren) {
        children.forEach((child, index) => {
          traverse(child, depth + 1, index === children.length - 1, [...parentPath, node.code]);
        });
      }
    };

    rootAccounts.forEach((root, index) => {
      traverse(root, 0, index === rootAccounts.length - 1, []);
    });

    // Filter rows based on filters
    // If a node matches the criteria, OR has a descendant that matches.
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

      // Pass 2: Filter results array
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
                    {account.code}
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
                      
                      <span className={`${account.detailType === 'Header' ? 'text-slate-100' : 'text-slate-300'}`}>
                        {account.name}
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
                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3.5 px-4 text-center">
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
                  </td>

                  {/* Inline Actions */}
                  <td className="py-3.5 px-4 text-right md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                        className="h-8 w-8 p-0 cursor-pointer"
                        onClick={() => onEditAccount(account)}
                        title="Edit Account Details"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-amber-400" />
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

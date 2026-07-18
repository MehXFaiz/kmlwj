import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  BookOpen, 
  Edit2, 
  ToggleLeft, 
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Trash2
} from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { showToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmationModal';

export const CoaTableView = ({
  accounts,
  balances,
  reservedCodes = [],
  onEditAccount,
  onToggleStatus,
  meta,
  page,
  setPage,
  limit,
  setLimit,
  sortBy,
  setSortBy,
  order,
  setOrder,
  searchQuery,
  typeFilter,
  levelFilter,
  natureFilter,
  reservedFilter,
  selectedSubsidiary,
}) => {
  const navigate = useNavigate();
  const { deleteAccount } = useCoaStore();
  const confirm = useConfirm();

  // Filter subsidiary locally if it's not supported by API yet
  // However, API pagination is global. For now, we will just pass accounts directly
  // if subsidiary is purely a client-side concept for this view, we filter it here.
  // Assuming API returned correct page, filtering locally might break page size visually, 
  // but let's keep subsidiary filter since it's an array field in DB and we didn't add it to API.
  const tableData = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesSubsidiary = 
        selectedSubsidiary === 'Global' || 
        acc.subsidiary.includes(selectedSubsidiary) || 
        acc.subsidiary.includes('Global');
      if (!matchesSubsidiary) return false;

      return true;
    });
  }, [accounts, selectedSubsidiary]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: () => (
          <button
            onClick={() => {
              if (sortBy === 'glCode') {
                setOrder(order === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('glCode');
                setOrder('asc');
              }
            }}
            className="flex items-center gap-1 hover:text-slate-200 cursor-pointer"
          >
            Code
            {sortBy === 'glCode' ? (
              order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const account = row.original;
          const isReservedNode = account.isReserved || reservedCodes.some(r => r.isActive && account.code >= r.reserveStart && account.code <= r.reserveEnd);
          return (
            <div className="flex items-center gap-1.5 font-mono font-medium text-slate-300">
              {account.code}
              {isReservedNode && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">RESERVED</span>
              )}
              {isReservedNode && (
                <Lock className="h-3 w-3 text-amber-500" title="This account code is system-reserved" />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'name',
        header: () => (
          <button
            onClick={() => {
              if (sortBy === 'accountName') {
                setOrder(order === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy('accountName');
                setOrder('asc');
              }
            }}
            className="flex items-center gap-1 hover:text-slate-200 cursor-pointer"
          >
            Name
            {sortBy === 'accountName' ? (
              order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const acc = row.original;
          const isReservedNode = acc.isReserved || reservedCodes.some(r => r.isActive && acc.code >= r.reserveStart && acc.code <= r.reserveEnd);
          return (
            <span className={`${acc.detailType === 'Header' ? 'font-bold text-slate-100' : 'text-slate-300'} flex items-center gap-1.5`}>
              {acc.level === 'MAIN' && <span title="This root category is permanent and locked" className="text-slate-400 select-none">🔒</span>}
              {isReservedNode ? (
                <div className="flex flex-col select-none">
                  <span className="text-slate-400 font-semibold italic text-xs">Reserved for Future Use</span>
                  <span className="text-[10px] text-slate-500 font-semibold tracking-wide">(Not Available for Posting)</span>
                </div>
              ) : (
                <span>{acc.name}</span>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <AccountTypeBadge type={row.getValue('type')} />
        ),
      },
      {
        accessorKey: 'detailType',
        header: 'Subtype',
        cell: ({ row }) => (
          <span className="text-slate-400 font-medium">{row.getValue('detailType')}</span>
        ),
      },
      {
        accessorKey: 'currency',
        header: 'Currency',
        cell: ({ row }) => (
          <span className="font-semibold text-slate-500">{row.getValue('currency')}</span>
        ),
      },
      {
        id: 'balance',
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
          const acc = row.original;
          const balance = balances[acc.code] ?? 0;
          return (
            <div className={`text-right font-mono font-semibold ${balance < 0 ? 'text-red-400' : 'text-slate-200'}`}>
              Rs {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const acc = row.original;
          return (
            <div className="text-center">
              {acc.level === 'MAIN' ? (
                <span className="inline-flex items-center justify-center gap-1 text-slate-500 cursor-default" title="MAIN accounts are permanent and cannot be deactivated">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Locked</span>
                </span>
              ) : (
                <button
                  onClick={() => onToggleStatus(acc.id)}
                  className="cursor-pointer"
                  title={acc.status === 'Active' ? 'Deactivate account' : 'Activate account'}
                >
                  {acc.status === 'Active' ? (
                    <ToggleRight className="h-5 w-5 text-emerald-400 hover:text-emerald-300" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-slate-600 hover:text-slate-400" />
                  )}
                </button>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const acc = row.original;
          const isReservedNode = acc.isReserved || reservedCodes.some(r => r.isActive && acc.code >= r.reserveStart && acc.code <= r.reserveEnd);
          const isGLLevel = acc.level === 'GL';
          return (
            <div className="flex justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => navigate(`/ledger?account=${acc.code}`)} title="View General Ledger">
                <BookOpen className="h-3.5 w-3.5 text-slate-400 hover:text-brand-300" />
              </Button>

              {/* Edit — Free for GL; confirmation for L2/L3; blocked for L1 */}
              <Button
                variant="ghost" size="sm"
                className={`h-8 w-8 p-0 ${
                  acc.level === 'MAIN'
                    ? 'opacity-25 cursor-not-allowed text-slate-600'
                    : isGLLevel
                    ? 'cursor-pointer text-slate-400 hover:text-amber-400'
                    : 'text-slate-600 cursor-pointer hover:text-amber-400'
                }`}
                onClick={async () => {
                  if (acc.level === 'MAIN') return;
                  if (acc.level === 'PARENT' || acc.level === 'SUBSIDIARY') {
                    const proceed = await confirm({
                      title: 'Edit System Account',
                      description: `Are you sure you want to edit "${acc.name}"? This is a system-level account (Level ${acc.level === 'PARENT' ? '2' : '3'}).`,
                      type: 'warning',
                      confirmLabel: 'Yes, Edit',
                      cancelLabel: 'Cancel'
                    });
                    if (!proceed) return;
                  }
                  onEditAccount(acc);
                }}
                disabled={acc.level === 'MAIN'}
                title={acc.level === 'MAIN' ? 'Level 1 accounts cannot be edited' : isGLLevel ? 'Edit GL Account' : `Edit ${acc.level} (system-level)`}
              >
                {acc.level === 'MAIN' ? <Lock className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
              </Button>

              {/* Delete — Only for GL accounts */}
              {isGLLevel && (
                <Button
                  variant="ghost" size="sm"
                  className={`h-8 w-8 p-0 ${isReservedNode ? 'opacity-35 cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-400 hover:text-red-400'}`}
                  onClick={async () => {
                    if (isReservedNode) { showToast('Reserved codes cannot be deleted.', 'error'); return; }
                    await confirm({
                      title: 'Delete GL Account',
                      description: `Are you sure you want to delete ${acc.name} (${acc.code})?`,
                      details: {
                        'Account Name': acc.name,
                        'GL Code': acc.code,
                        'Warning': 'This action will permanently delete this account from the Chart of Accounts and cannot be undone.'
                      },
                      type: 'error',
                      confirmLabel: 'Delete',
                      loadingLabel: 'Deleting...',
                      action: async () => {
                        await deleteAccount(acc.id);
                        showToast(`✅ Account ${acc.code} deleted`, 'success');
                      }
                    });
                  }}
                  title={isReservedNode ? 'Reserved accounts cannot be deleted' : 'Delete GL Account'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [balances, onEditAccount, onToggleStatus, navigate, sortBy, order, setSortBy, setOrder]
  );

  const totalPages = meta ? Math.ceil(meta.total / limit) : 1;

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Table grid */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr 
                key={headerGroup.id} 
                className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/20"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="text-sm divide-y divide-slate-800/50">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-500">
                  No accounts found matching filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id} 
                  className={`
                    hover:bg-slate-900/35 transition-colors group
                    ${row.original.detailType === 'Header' ? 'font-bold bg-slate-900/10' : ''}
                    ${row.original.status === 'Inactive' ? 'opacity-55' : ''}
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3.5 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 pt-4 px-2">
          {/* Info */}
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">
              {(page - 1) * limit + 1}
            </span> to <span className="font-semibold text-slate-200">
              {Math.min(page * limit, meta?.total || 0)}
            </span> of <span className="font-semibold text-slate-200">{meta?.total || 0}</span> accounts
          </div>

          {/* Limit selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded text-xs py-1 px-2 text-slate-200"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400 px-2 font-medium">
              Page <span className="text-slate-200">{page}</span> of <span className="text-slate-200">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

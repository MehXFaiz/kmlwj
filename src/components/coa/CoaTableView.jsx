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
  ChevronsRight
} from 'lucide-react';
import { AccountTypeBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const CoaTableView = ({
  accounts,
  balances,
  onEditAccount,
  onToggleStatus,
  searchQuery,
  typeFilter,
  selectedSubsidiary,
}) => {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState([{ id: 'code', desc: false }]);

  // Filter accounts in memory based on filters
  const tableData = useMemo(() => {
    return accounts.filter((acc) => {
      // Subsidiary filter
      const matchesSubsidiary = 
        selectedSubsidiary === 'Global' || 
        acc.subsidiary.includes(selectedSubsidiary) || 
        acc.subsidiary.includes('Global');
      
      if (!matchesSubsidiary) return false;

      // Type filter
      if (typeFilter !== 'All' && acc.type !== typeFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = acc.code.includes(query);
        const matchesName = acc.name.toLowerCase().includes(query);
        const matchesSubtype = acc.detailType.toLowerCase().includes(query);
        if (!matchesCode && !matchesName && !matchesSubtype) return false;
      }

      return true;
    });
  }, [accounts, typeFilter, searchQuery, selectedSubsidiary]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-slate-200 cursor-pointer"
          >
            Code
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium text-slate-300">
            {row.getValue('code')}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-slate-200 cursor-pointer"
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-slate-500" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const acc = row.original;
          return (
            <span className={acc.detailType === 'Header' ? 'font-bold text-slate-100' : 'text-slate-300'}>
              {acc.name}
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
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const acc = row.original;
          return (
            <div className="flex justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => navigate(`/ledger?account=${acc.code}`)}
                title="View General Ledger"
              >
                <BookOpen className="h-3.5 w-3.5 text-slate-400 hover:text-brand-300" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                onClick={() => onEditAccount(acc)}
                title="Edit Account"
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-amber-400" />
              </Button>
            </div>
          );
        },
      },
    ],
    [balances, onEditAccount, onToggleStatus, navigate]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
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
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-4 px-2">
          {/* Info */}
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </span> to <span className="font-semibold text-slate-200">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                tableData.length
              )}
            </span> of <span className="font-semibold text-slate-200">{tableData.length}</span> accounts
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400 px-2 font-medium">
              Page <span className="text-slate-200">{table.getState().pagination.pageIndex + 1}</span> of <span className="text-slate-200">{table.getPageCount()}</span>
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
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

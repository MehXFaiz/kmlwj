import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAddIncomeStore } from '../store/addIncomeStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import {
  TrendingUp,
  Plus,
  Search,
  Download,
  DollarSign,
  Building,
  Layers,
  Edit2,
  Trash2,
  FileText,
  Paperclip,
  CheckCircle2,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Tag
} from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import * as XLSX from 'xlsx';

import { ledgerService } from '../services/apiServices';

export const AddIncomeRecords = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdminOrSuperAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

  const {
    categories,
    records,
    pagination,
    loading,
    fetchCategories,
    fetchRecords,
    deleteRecord
  } = useAddIncomeStore();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [postingRecord, setPostingRecord] = useState(null);
  const [revertingRecord, setRevertingRecord] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const loadRecordsData = useCallback(() => {
    fetchRecords({
      search,
      categoryId: selectedCategoryFilter,
      paymentMethod: selectedMethodFilter,
      startDate,
      endDate,
      page: currentPage,
      limit: pageSize
    });
  }, [fetchRecords, search, selectedCategoryFilter, selectedMethodFilter, startDate, endDate, currentPage, pageSize]);

  useEffect(() => {
    loadRecordsData();
  }, [loadRecordsData]);

  // Handle Ledger Post
  const handlePostToLedger = async () => {
    if (!postingRecord) return;
    if (!isAdminOrSuperAdmin) {
      showToast('Forbidden: Only Admin and Super Admin can Post to Ledger', 'error');
      return;
    }
    try {
      setActionLoading(true);
      await ledgerService.postToLedger('Add Income', postingRecord.id);
      showToast('Transaction posted successfully to the General Ledger', 'success');
      setPostingRecord(null);
      loadRecordsData();
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to post transaction', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Posting Revert
  const handleRevertPosting = async () => {
    if (!revertingRecord) return;
    if (!isAdminOrSuperAdmin) {
      showToast('Forbidden: Only Admin and Super Admin can Revert Posting', 'error');
      return;
    }
    try {
      setActionLoading(true);
      await ledgerService.revertPosting('Add Income', revertingRecord.id, revertReason);
      showToast('Transaction posting reverted successfully from General Ledger', 'success');
      setRevertingRecord(null);
      setRevertReason('');
      loadRecordsData();
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to revert posting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Record Delete
  const handleDeleteRecord = async () => {
    if (!deletingRecordId) return;
    try {
      await deleteRecord(deletingRecordId);
      showToast('Income record deleted successfully', 'success');
      setDeletingRecordId(null);
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to delete record', 'error');
    }
  };

  // Export to Excel
  const handleExport = () => {
    if (records.length === 0) {
      showToast('No records available to export', 'info');
      return;
    }

    const exportData = records.map((r, idx) => ({
      'S.No': idx + 1,
      'Date': r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
      'Category': r.category?.name ? (r.subCategory ? `${r.category.name} - ${r.subCategory}` : r.category.name) : 'N/A',
      'Amount (PKR)': Number(r.amount) || 0,
      'Payment Method': r.paymentMethod || 'CASH',
      'Bank Account': r.bankAccount?.accountName || 'Cash in Hand',
      'Reference No': r.referenceNumber || '',
      'Voucher No': r.journalEntry?.voucherNo || '',
      'Created By': r.createdBy?.fullName || r.createdBy?.email || 'System',
      'Remarks': r.remarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Add Income');
    XLSX.writeFile(workbook, `Income_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported income records to Excel', 'success');
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalAmount = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyAmount = records
      .filter(r => new Date(r.date) >= startOfMonth)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return {
      totalAmount,
      totalCount: pagination.total || records.length,
      categoriesCount: categories.length,
      monthlyAmount
    };
  }, [records, pagination.total, categories.length]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-brand-950/60 border border-brand-900/40 text-brand-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mb-0.5">
                <span>Money In</span>
                <span>/</span>
                <span className="text-slate-300">Income Directory</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Income Records Directory
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                View, filter, and audit posted income entries and corresponding journal entries
              </p>
            </div>
          </div>
        </div>

        <div className={pageActionsClass}>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4 text-slate-400" />
            Export Excel
          </button>

          <Link
            to="/add-income"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isAdminOrSuperAdmin
                ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-950/40'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {!isAdminOrSuperAdmin ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Add Income Entry
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtered Income Total</p>
              <h3 className="text-xl font-extrabold text-brand-300 mt-1">
                PKR {summaryMetrics.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brand-950/70 border border-brand-900/40 flex items-center justify-center text-brand-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Sum of selected/filtered entries</p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Income Entries</p>
              <h3 className="text-xl font-extrabold text-slate-100 mt-1">
                {summaryMetrics.totalCount.toLocaleString()}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-950/70 border border-blue-900/40 flex items-center justify-center text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Posted in database</p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">This Month's Inflow</p>
              <h3 className="text-xl font-extrabold text-emerald-400 mt-1">
                PKR {summaryMetrics.monthlyAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-950/70 border border-emerald-900/40 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Current calendar month</p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Categories</p>
              <h3 className="text-xl font-extrabold text-purple-400 mt-1">
                {summaryMetrics.categoriesCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-950/70 border border-purple-900/40 flex items-center justify-center text-purple-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Configured categories</p>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="bg-slate-900/90 border-slate-800/80 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search reference, remarks, category, bank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedMethodFilter}
              onChange={(e) => setSelectedMethodFilter(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="CHEQUE">Cheque</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50"
              title="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50"
              title="End Date"
            />
            {(search || selectedCategoryFilter !== 'all' || selectedMethodFilter !== 'all' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategoryFilter('all');
                  setSelectedMethodFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-colors shrink-0"
                title="Reset Filters"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Table View */}
      <Card className="bg-slate-900/90 border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Bank Account</th>
                <th className="py-3 px-4">Ref # / Journal</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-center">Attachment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading income records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <TrendingUp className="h-10 w-10 mx-auto text-slate-700 mb-2" />
                    <p className="font-semibold text-slate-400">No income records found</p>
                    <p className="text-[11px] text-slate-600 mt-1">Try adjusting filters or click "Add Income Entry"</p>
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const methodBadge = {
                    CASH: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50',
                    BANK: 'bg-blue-950/80 text-blue-400 border-blue-800/50',
                    CHEQUE: 'bg-purple-950/80 text-purple-400 border-purple-800/50',
                    ONLINE: 'bg-amber-950/80 text-amber-400 border-amber-800/50'
                  }[rec.paymentMethod] || 'bg-slate-800 text-slate-300 border-slate-700';

                  const isPosted = rec.status === 'POSTED';
                  const isReverted = rec.status === 'REVERTED';
                  const isPending = !isPosted && !isReverted;

                  const statusBadge = isPosted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase bg-emerald-950/80 text-emerald-400 border-emerald-800/60">
                      🟢 Posted
                    </span>
                  ) : isReverted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase bg-red-950/80 text-red-400 border-red-800/60">
                      🔴 Reverted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase bg-amber-950/80 text-amber-400 border-amber-800/60">
                      🟡 Pending Post
                    </span>
                  );

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {rec.date ? new Date(rec.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {rec.category?.name ? (rec.subCategory ? `${rec.category.name} - ${rec.subCategory}` : rec.category.name) : 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-brand-300 whitespace-nowrap">
                        PKR {Number(rec.amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {statusBadge}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${methodBadge}`}>
                          {rec.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {rec.paymentMethod === 'BANK' || rec.bankAccount ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span>{rec.bankAccount?.accountName || 'Bank Account'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Cash in Hand</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="space-y-0.5">
                          <p className="font-mono text-[11px] font-bold">{rec.referenceNumber || '—'}</p>
                          {rec.journalEntry?.voucherNo && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/40 px-1.5 py-0.2 rounded">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {rec.journalEntry.voucherNo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        {rec.remarks || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rec.attachmentUrl ? (
                          <a
                            href={rec.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200 bg-brand-950/50 border border-brand-900/40 px-2 py-1 rounded text-[10px] font-medium"
                          >
                            <Paperclip className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => setPostingRecord(rec)}
                              disabled={!isAdminOrSuperAdmin}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                                isAdminOrSuperAdmin
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              Post to Ledger
                            </button>
                          )}

                          {isPosted && (
                            <button
                              onClick={() => setRevertingRecord(rec)}
                              disabled={!isAdminOrSuperAdmin}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                                isAdminOrSuperAdmin
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              Revert Posting
                            </button>
                          )}

                          {isReverted && (
                            <button
                              onClick={() => setPostingRecord(rec)}
                              disabled={!isAdminOrSuperAdmin}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${
                                isAdminOrSuperAdmin
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              Post Again
                            </button>
                          )}

                          {isPending && (
                            <Link
                              to={`/add-income/edit/${rec.id}`}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isAdminOrSuperAdmin
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-brand-400 border-slate-700 cursor-pointer'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 pointer-events-none'
                              }`}
                              title={isAdminOrSuperAdmin ? 'Edit Record' : 'Admin only'}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Link>
                          )}

                          {(isPending || isReverted) && (
                            <button
                              onClick={() => setDeletingRecordId(rec.id)}
                              disabled={!isAdminOrSuperAdmin}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isAdminOrSuperAdmin
                                  ? 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border-red-900/40 cursor-pointer'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                              }`}
                              title={isAdminOrSuperAdmin ? 'Delete Record' : 'Admin only'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="bg-slate-950/60 border-t border-slate-800/80 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <span className="font-bold text-slate-200">{pagination.page}</span> of{' '}
              <span className="font-bold text-slate-200">{pagination.totalPages}</span> ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Post to Ledger confirmation modal */}
      {postingRecord && (
        <Modal
          isOpen={!!postingRecord}
          onClose={() => setPostingRecord(null)}
          title="Post to General Ledger"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300">
              Are you sure you want to post this transaction to the General Ledger?
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
              <p className="text-slate-400">Category: <span className="text-slate-200">{postingRecord.category?.name}</span></p>
              <p className="text-slate-400">Amount: <span className="text-emerald-400 font-bold">PKR {Number(postingRecord.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span></p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPostingRecord(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePostToLedger}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2"
              >
                {actionLoading && <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirm Post to Ledger
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revert Posting confirmation modal */}
      {revertingRecord && (
        <Modal
          isOpen={!!revertingRecord}
          onClose={() => setRevertingRecord(null)}
          title="Revert Ledger Posting"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300">
              This will reverse all accounting effects for this transaction in the General Ledger. Continue?
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Reason for Revert (Optional)</label>
              <input
                type="text"
                placeholder="Enter reason for reverting posting..."
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRevertingRecord(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRevertPosting}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2"
              >
                {actionLoading && <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirm Revert Posting
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {deletingRecordId && (
        <Modal
          isOpen={!!deletingRecordId}
          onClose={() => setDeletingRecordId(null)}
          title="Confirm Deletion"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300">
              Are you sure you want to delete this income record?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingRecordId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

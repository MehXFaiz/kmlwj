import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAddIncomeStore } from '../store/addIncomeStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  CreditCard,
  Building,
  Layers,
  Edit2,
  Trash2,
  FileText,
  Paperclip,
  CheckCircle2,
  X,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Lock,
  Tag
} from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import * as XLSX from 'xlsx';

export const AddIncome = () => {
  const user = useAuthStore((state) => state.user);
  const isAdminOrSuperAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

  const {
    categories,
    records,
    pagination,
    loading,
    categoriesLoading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord
  } = useAddIncomeStore();

  const { flatAccounts, fetchAccountsList } = useCoaStore();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  // Record Form State
  const [recordForm, setRecordForm] = useState({
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    bankAccountId: '',
    referenceNumber: '',
    remarks: '',
    attachmentUrl: ''
  });
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  // Category Form State
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    accountId: '',
    isActive: true
  });
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Initial load
  useEffect(() => {
    fetchCategories();
    fetchAccountsList();
  }, [fetchCategories, fetchAccountsList]);

  // Load records on filter change
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

  // Filter Bank Accounts from CoA
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc =>
      (acc.type === 'Asset' || acc.accountType?.name === 'Asset') &&
      !acc.isLocked &&
      ((acc.detailType || '').toLowerCase().includes('bank') ||
       (acc.name || '').toLowerCase().includes('bank') ||
       (acc.name || '').toLowerCase().includes('cash'))
    );
  }, [flatAccounts]);

  // Revenue accounts for Category mapping
  const revenueAccounts = useMemo(() => {
    return flatAccounts.filter(acc =>
      (acc.type === 'Revenue' || acc.accountType?.name === 'Revenue') &&
      !acc.isLocked
    );
  }, [flatAccounts]);

  // Open Record Modal (Add / Edit)
  const handleOpenRecordModal = (record = null) => {
    if (!isAdminOrSuperAdmin) {
      showToast('Only Admin and Super Admin can create or edit income entries', 'warning');
      return;
    }

    if (record) {
      setEditingRecord(record);
      setRecordForm({
        categoryId: record.categoryId || record.category?.id || '',
        amount: record.amount ? String(record.amount) : '',
        date: record.date ? new Date(record.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMethod: record.paymentMethod || 'CASH',
        bankAccountId: record.bankAccountId || '',
        referenceNumber: record.referenceNumber || '',
        remarks: record.remarks || '',
        attachmentUrl: record.attachmentUrl || ''
      });
    } else {
      setEditingRecord(null);
      setRecordForm({
        categoryId: categories.length > 0 ? categories[0].id : '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
        referenceNumber: '',
        remarks: '',
        attachmentUrl: ''
      });
    }
    setIsRecordModalOpen(true);
  };

  // Submit Income Record Form
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!recordForm.categoryId) {
      showToast('Please select an Income Category', 'warning');
      return;
    }
    const numAmount = parseFloat(recordForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid positive amount', 'warning');
      return;
    }
    if (recordForm.paymentMethod === 'BANK' && !recordForm.bankAccountId) {
      showToast('Bank Account is required when Payment Method is Bank', 'warning');
      return;
    }

    setRecordSubmitting(true);
    try {
      if (editingRecord) {
        await updateRecord(editingRecord.id, recordForm);
        showToast('Income record updated successfully!', 'success');
      } else {
        await createRecord(recordForm);
        showToast('Income record created successfully! Journal Entry posted.', 'success');
      }
      setIsRecordModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to save income record', 'error');
    } finally {
      setRecordSubmitting(false);
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

  // Open Category Modal
  const handleOpenCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', accountId: '', isActive: true });
    setIsCategoryModalOpen(true);
  };

  // Edit Category
  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      description: cat.description || '',
      accountId: cat.accountId || '',
      isActive: cat.isActive !== undefined ? cat.isActive : true
    });
  };

  // Save Category
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showToast('Category Name is required', 'warning');
      return;
    }

    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryForm);
        showToast('Income category updated successfully', 'success');
      } else {
        await createCategory(categoryForm);
        showToast('Income category created successfully', 'success');
      }
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', accountId: '', isActive: true });
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to save category', 'error');
    } finally {
      setCategorySubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catId) => {
    try {
      await deleteCategory(catId);
      showToast('Income category deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to delete category', 'error');
    }
  };

  // Export to Excel / CSV
  const handleExport = () => {
    if (records.length === 0) {
      showToast('No records available to export', 'info');
      return;
    }

    const exportData = records.map((r, idx) => ({
      'S.No': idx + 1,
      'Date': r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
      'Category': r.category?.name || 'N/A',
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
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-900/40 text-amber-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Add Income
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-400 border border-amber-900/40">
                  Money In
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Record and manage extra income entries with automatic double-entry journal postings
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

          <button
            onClick={handleOpenCategoryModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Tag className="h-4 w-4 text-amber-400" />
            Income Categories ({categories.length})
          </button>

          <button
            onClick={() => handleOpenRecordModal()}
            disabled={!isAdminOrSuperAdmin}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isAdminOrSuperAdmin
                ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-900/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
            title={!isAdminOrSuperAdmin ? 'Only Admin and Super Admin can add income' : ''}
          >
            {!isAdminOrSuperAdmin ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Add Income Entry
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtered Income Total</p>
              <h3 className="text-xl font-extrabold text-amber-400 mt-1">
                PKR {summaryMetrics.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-950/70 border border-amber-900/40 flex items-center justify-center text-amber-400">
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

      {/* Filters & Search Toolbar */}
      <Card className="bg-slate-900/90 border-slate-800/80 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search reference, remarks, category, bank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedMethodFilter}
              onChange={(e) => setSelectedMethodFilter(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="CHEQUE">Cheque</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          {/* Date Range & Reset */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
              title="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
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
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading income records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
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

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {rec.date ? new Date(rec.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {rec.category?.name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-amber-400 whitespace-nowrap">
                        PKR {Number(rec.amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
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
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 bg-amber-950/50 border border-amber-900/40 px-2 py-1 rounded text-[10px] font-medium"
                          >
                            <Paperclip className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenRecordModal(rec)}
                            disabled={!isAdminOrSuperAdmin}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isAdminOrSuperAdmin
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border-slate-700 cursor-pointer'
                                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                            title={isAdminOrSuperAdmin ? 'Edit Record' : 'Admin only'}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* Modal 1: Add / Edit Income Record */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title={editingRecord ? 'Edit Income Entry' : 'Add Income Entry'}
        >
          <form onSubmit={handleRecordSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Income Category <span className="text-red-400">*</span>
              </label>
              <select
                value={recordForm.categoryId}
                onChange={(e) => setRecordForm({ ...recordForm, categoryId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                required
              >
                <option value="" disabled>Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Amount (PKR) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Payment Method <span className="text-red-400">*</span>
                </label>
                <select
                  value={recordForm.paymentMethod}
                  onChange={(e) => setRecordForm({ ...recordForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Bank Account {recordForm.paymentMethod === 'BANK' && <span className="text-red-400">*</span>}
                </label>
                <select
                  value={recordForm.bankAccountId}
                  onChange={(e) => setRecordForm({ ...recordForm, bankAccountId: e.target.value })}
                  disabled={recordForm.paymentMethod !== 'BANK' && recordForm.paymentMethod !== 'ONLINE'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  required={recordForm.paymentMethod === 'BANK'}
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.glCode} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. Receipt # / Cheque # / Ref #"
                value={recordForm.referenceNumber}
                onChange={(e) => setRecordForm({ ...recordForm, referenceNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Remarks / Description
              </label>
              <textarea
                rows={2}
                placeholder="Additional notes..."
                value={recordForm.remarks}
                onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Attachment URL (Optional)
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={recordForm.attachmentUrl}
                onChange={(e) => setRecordForm({ ...recordForm, attachmentUrl: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordSubmitting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {recordSubmitting ? 'Saving...' : editingRecord ? 'Update Record' : 'Post Income Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 2: Income Categories Management */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Manage Income Categories"
        >
          <div className="space-y-6 pt-2">
            {/* Category Form */}
            {isAdminOrSuperAdmin && (
              <form onSubmit={handleCategorySubmit} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {editingCategory ? 'Edit Category' : 'Create New Income Category'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Name *</label>
                    <input
                      type="text"
                      placeholder="Category Name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mapped Revenue Account (CoA)</label>
                    <select
                      value={categoryForm.accountId}
                      onChange={(e) => setCategoryForm({ ...categoryForm, accountId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Auto-map Revenue Account</option>
                      {revenueAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.glCode} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Short description..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryForm.isActive}
                      onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    Active Category
                  </label>

                  <div className="flex items-center gap-2">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', accountId: '', isActive: true }); }}
                        className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={categorySubmitting}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      {categorySubmitting ? 'Saving...' : editingCategory ? 'Update' : 'Add Category'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Categories List Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Configured Income Categories ({categories.length})
              </h4>
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-200">{cat.name}</span>
                        {!cat.isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-900/40">
                            Inactive
                          </span>
                        )}
                      </div>
                      {cat.description && <p className="text-[10px] text-slate-500 mt-0.5">{cat.description}</p>}
                      {cat.account && (
                        <p className="text-[10px] font-mono text-emerald-400 mt-0.5">
                          Linked: {cat.account.glCode} - {cat.account.accountName}
                        </p>
                      )}
                    </div>
                    {isAdminOrSuperAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEditCategory(cat)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Delete Record */}
      {deletingRecordId && (
        <Modal
          isOpen={!!deletingRecordId}
          onClose={() => setDeletingRecordId(null)}
          title="Confirm Deletion"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300">
              Are you sure you want to delete this income record?
              The corresponding journal entry will also be soft deleted and account balances updated.
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

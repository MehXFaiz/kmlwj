import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Heart,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wallet,
  Building,
  CreditCard,
  User,
  Phone,
  FileText,
  Clock,
  ArrowUpDown,
  X,
  Send,
  Eye
} from 'lucide-react';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useDonorStore } from '../store/donorStore';
import { useAuthStore } from '../store/authStore';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { resolveVoucherRecipientDetails } from '../utils/voucherRecipientResolver';
import { showToast } from '../utils/toast';

const DONATION_TYPES = [
  { value: 'ALL', label: 'All Donation Types' },
  { value: 'GENERAL_DONATION', label: 'General Donation' },
  { value: 'MONTHLY', label: 'Monthly Donation' },
  { value: 'MARRIAGE', label: 'Marriage Donation' },
  { value: 'MEDICAL', label: 'Medical Donation' },
  { value: 'EDUCATION', label: 'Education Donation' },
  { value: 'CUSTOM', label: 'Other / Custom Donation' },
];

const PAYMENT_METHODS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const STATUSES = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const DonationsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    donations,
    stats,
    loading,
    error,
    fetchDonations,
    updateDonationStatus,
    deleteDonation
  } = useDonationReceivedStore();

  const { donors, fetchDonors } = useDonorStore();
  const user = useAuthStore((state) => state.user);
  const isPrivileged = useAuthStore((state) => state.isPrivileged);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  // RBAC checks
  const canCreate = isPrivileged || hasPermission('revenueCollections', 'create') || hasPermission('donations', 'create') || hasPermission('CREATE_DONATION_RECEIVED');
  const canEditOrDelete = isPrivileged || user?.role === 'Super Admin' || user?.role?.name === 'Super Admin' || user?.role === 'Admin' || user?.role?.name === 'Admin';

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDonor, setSelectedDonor] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');

  // Modals state
  const [selectedDonationForSlip, setSelectedDonationForSlip] = useState(null);
  const [deleteModalItem, setDeleteModalItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial Data Load
  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  const loadData = useCallback(() => {
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (selectedDonor !== 'ALL') params.donorId = selectedDonor;
    if (selectedType !== 'ALL') params.donationType = selectedType;
    if (selectedMethod !== 'ALL') params.paymentMethod = selectedMethod;
    if (selectedStatus !== 'ALL') params.status = selectedStatus;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    fetchDonations(params);
  }, [fetchDonations, searchTerm, selectedDonor, selectedType, selectedMethod, selectedStatus, startDate, endDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle Date Presets
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'THIS_YEAR') {
      const start = `${now.getFullYear()}-01-01`;
      const end = `${now.getFullYear()}-12-31`;
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedDonor('ALL');
    setSelectedType('ALL');
    setSelectedMethod('ALL');
    setSelectedStatus('ALL');
    setStartDate('');
    setEndDate('');
    setDatePreset('ALL');
  };

  const hasActiveFilters = searchTerm || selectedDonor !== 'ALL' || selectedType !== 'ALL' || selectedMethod !== 'ALL' || selectedStatus !== 'ALL' || startDate || endDate;

  // GL Post Action
  const handlePostToLedger = async (donation) => {
    try {
      await updateDonationStatus(donation.id, 'POSTED');
      showToast(`Donation ${donation.receiptNo} posted to General Ledger successfully.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to post donation to ledger', 'error');
    }
  };

  // Delete Action
  const confirmDelete = async () => {
    if (!deleteModalItem) return;
    setIsDeleting(true);
    try {
      await deleteDonation(deleteModalItem.id);
      showToast('Donation record deleted and accounting entries reversed successfully.', 'success');
      setDeleteModalItem(null);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete donation record', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format Type Label
  const formatDonationType = (type, customType) => {
    if (type === 'CUSTOM') return customType || 'Custom';
    const found = DONATION_TYPES.find(t => t.value === type);
    return found ? found.label.replace(' Donation', '') : type;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-0.5 rounded-full">
              <Heart className="w-3 h-3" />
              Charitable Inflows
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Donations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record donation receipts, dynamic donor contributions & automated General Ledger postings
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {canCreate && (
            <button
              onClick={() => navigate('/donations/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Donation</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Total Donations */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Donations</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(stats?.totalAmount || 0).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats?.totalReceipts || 0}</span> receipts recorded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80" />
        </div>

        {/* Monthly Donations */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Monthly Donations (Inflow)</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(stats?.currentMonthAmount || 0).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Collected this month
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 opacity-80" />
        </div>

        {/* Cash vs Bank Breakdown */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cash in Hand</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(stats?.cashAmount || 0).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Cash receipts deposited
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 opacity-80" />
        </div>

        {/* Bank & Cheque Collection */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Bank & Cheques</span>
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {((stats?.bankAmount || 0) + (stats?.chequeAmount || 0)).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Bank: Rs {(stats?.bankAmount || 0).toLocaleString()} &middot; Cheque: Rs {(stats?.chequeAmount || 0).toLocaleString()}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400 opacity-80" />
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by receipt #, donor, phone, cheque #..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Donor Filter */}
          <div>
            <select
              value={selectedDonor}
              onChange={(e) => setSelectedDonor(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Donors</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.donorCode || d.mobile || 'Donor'})
                </option>
              ))}
            </select>
          </div>

          {/* Donation Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {DONATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row Filters: Date Range & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Period:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePreset(p.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          {/* Status Filter & Reset */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Donations Table / List ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
        {loading && donations.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading donation records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Unable to load donations</p>
            <p className="text-xs text-rose-500 mt-1">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : donations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-500 mx-auto mb-3">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No donation records found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search query or filters to find what you are looking for.'
                : 'Get started by recording your first donation receipt.'}
            </p>
            {canCreate && !hasActiveFilters && (
              <button
                onClick={() => navigate('/donations/new')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Record First Donation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Donor Details</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {donations.map((d) => {
                  const isPosted = d.status === 'POSTED';
                  const isCash = d.paymentMethod === 'CASH';
                  const isBank = d.paymentMethod === 'BANK' || d.paymentMethod === 'ONLINE';
                  const isCheque = d.paymentMethod === 'CHEQUE';

                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Receipt No */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {d.receiptNo || `REC-${d.id.slice(0, 6).toUpperCase()}`}
                        </span>
                        {d.referenceNo && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Ref: {d.referenceNo}
                          </div>
                        )}
                      </td>

                      {/* Donor Details */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {d.donor?.fullName || 'Walk-in Donor'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {d.donor?.donorCode && (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                              {d.donor.donorCode}
                            </span>
                          )}
                          {d.donor?.mobile && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {d.donor.mobile}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Donation Type */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {formatDonationType(d.donationType, d.customDonationType)}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4">
                        <div className="font-bold font-mono text-slate-900 dark:text-slate-50 text-sm">
                          Rs {Number(d.amount || 0).toLocaleString()}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {isCash && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Wallet className="w-3 h-3" /> Cash in Hand
                            </span>
                          )}
                          {isBank && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                <Building className="w-3 h-3" /> Bank Account
                              </span>
                              {d.bankAccount && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                  {d.bankAccount.accountName}
                                </div>
                              )}
                            </div>
                          )}
                          {isCheque && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                                <CreditCard className="w-3 h-3" /> Cheque
                              </span>
                              {d.chequeNo && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  #{d.chequeNo}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {d.receiptDate ? new Date(d.receiptDate).toLocaleDateString() : '-'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPosted
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : d.status === 'CANCELLED'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {isPosted && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {d.status || 'POSTED'}
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>{d.createdBy?.fullName || 'System User'}</div>
                        <div className="text-[9px] text-slate-400">
                          {d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print Receipt Slip */}
                          <button
                            onClick={() => setSelectedDonationForSlip(d)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                            title="Print Donation Receipt Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Post Draft to GL */}
                          {!isPosted && (canCreate || canEditOrDelete) && (
                            <button
                              onClick={() => handlePostToLedger(d)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                              title="Post to General Ledger"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit (Admin/Super Admin only) */}
                          {canEditOrDelete && (
                            <button
                              onClick={() => navigate(`/donations/edit/${d.id}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                              title="Edit Donation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete (Admin/Super Admin only) */}
                          {canEditOrDelete && (
                            <button
                              onClick={() => setDeleteModalItem(d)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Delete Donation Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Print Voucher Slip Modal ── */}
      {selectedDonationForSlip && (
        <DonationSlipWrapper
          donation={selectedDonationForSlip}
          onClose={() => setSelectedDonationForSlip(null)}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Donation Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Receipt #{deleteModalItem.receiptNo || deleteModalItem.id}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div><span className="font-semibold text-slate-400">Donor:</span> {deleteModalItem.donor?.fullName || 'Walk-in'}</div>
              <div><span className="font-semibold text-slate-400">Amount:</span> Rs {Number(deleteModalItem.amount || 0).toLocaleString()}</div>
              <div><span className="font-semibold text-slate-400">Method:</span> {deleteModalItem.paymentMethod}</div>
              <div className="text-[11px] text-rose-500 font-medium pt-1">
                Note: Deleting will automatically reverse the General Ledger journal entry and adjust cash/bank balances.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Slip Wrapper Helper Component
function DonationSlipWrapper({ donation, onClose }) {
  const rec = resolveVoucherRecipientDetails(donation);
  const typeLabel = donation.donationType === 'CUSTOM'
    ? donation.customDonationType || 'General Donation'
    : donation.donationType?.replace('_', ' ') || 'General Donation';

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title={`${typeLabel.toUpperCase()} RECEIPT`}
      voucherNo={donation.receiptNo || donation.id?.slice(0, 8)?.toUpperCase()}
      fileNo={donation.donor?.donorCode || donation.donor?.cnic || ''}
      date={donation.receiptDate || donation.createdAt}
      name={donation.donor?.fullName || rec.name || 'Donor'}
      cnic={donation.donor?.cnic || rec.cnic || ''}
      mobile={donation.donor?.mobile || rec.mobile || ''}
      address={donation.donor?.address || rec.address || ''}
      paymentMethod={donation.paymentMethod}
      accountName="Donation Income A/c"
      particulars={`Charitable Donation Received - ${typeLabel}${donation.narration ? ` (${donation.narration})` : ''}${donation.chequeNo ? ` [Cheque #${donation.chequeNo}]` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Operator'}
      payeeLabel="Receiver's Sign"
      partyLabel="Donor's Sign"
      type="CREDIT"
    />
  );
}

export default DonationsList;

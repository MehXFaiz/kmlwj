import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import {
  Heart, Search, Plus, Edit2, Trash2, CheckCircle2, X, AlertTriangle,
  Printer, Phone, CreditCard, Banknote, Calendar, MapPin, SlidersHorizontal,
  ChevronDown, ChevronUp, RotateCcw, Building, Users, Sparkles, Undo2, Layers, Eye
} from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

function BeneficiaryBreakdownModal({ donation, isOpen, onClose }) {
  if (!isOpen || !donation) return null;
  const beneficiaries = Array.isArray(donation.beneficiaries) ? donation.beneficiaries : [];
  const isZakat = String(donation.donationType).toUpperCase().includes('ZAKAT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isZakat ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Beneficiary Allocation Breakdown</h3>
              <p className="text-xs text-slate-400">{donation.month || 'Monthly Disbursement'} &middot; Total: Rs. {Number(donation.amount || 0).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
          {beneficiaries.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No individual beneficiary breakdown attached to this batch.</p>
          ) : (
            beneficiaries.map((b, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-200 truncate">{b.name || 'Beneficiary'}</h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    {b.cnic && <span>CNIC: {b.cnic}</span>}
                    {b.remarks && <span className="text-amber-300/90">&middot; {b.remarks}</span>}
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-400 text-sm whitespace-nowrap">
                  Rs. {Number(b.amount || 0).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-xs text-slate-400">
          <span>Total Allocations: <strong>{beneficiaries.length} recipient(s)</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RevertPostingModal({ donation, isOpen, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('');
  if (!isOpen || !donation) return null;

  const isZakat = String(donation.donationType).toUpperCase().includes('ZAKAT');
  const displayCategory = isZakat ? 'Zakat' : 'Monthly Donation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-red-400">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Revert Monthly Posting</h3>
            <p className="text-xs text-slate-400">{donation.month || 'Selected Batch'} &middot; Rs. {Number(donation.amount || 0).toLocaleString()}</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Reverting will reverse the General Ledger journal entry, restore the bank balance by <strong>Rs. {Number(donation.amount || 0).toLocaleString()}</strong>, and allow re-posting for this month.
        </p>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Reversal Reason *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Incorrect bank account selected / allocation error"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(donation.id, reason)}
            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Reverting...' : 'Confirm Reversal'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Donations = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { donations, loading, fetchDonations, deleteDonation, approveDonation, revertDonation } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');

  const [deleteId, setDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [printDonation, setPrintDonation] = useState(null);
  const [viewBeneficiariesDonation, setViewBeneficiariesDonation] = useState(null);
  const [revertTargetDonation, setRevertTargetDonation] = useState(null);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
  }, [fetchDonations, fetchAccountsList]);

  // Unique months available in donations list
  const availableMonths = useMemo(() => {
    const set = new Set();
    donations.forEach(d => {
      if (d.disbursementMonth) set.add(d.disbursementMonth);
      else if (d.month) set.add(d.month);
    });
    return Array.from(set).sort().reverse();
  }, [donations]);

  // Filtered donations
  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      if (d.isDeleted) return false;

      // Status filter
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;

      // Type filter
      const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
      if (filterType === 'ZAKAT' && !isZakat) return false;
      if (filterType === 'DONATION' && isZakat) return false;

      // Month filter
      if (filterMonth !== 'ALL') {
        const matchesMonth = d.disbursementMonth === filterMonth || d.month === filterMonth;
        if (!matchesMonth) return false;
      }

      // Search query
      if (search) {
        const q = search.toLowerCase();
        const matchesName = (d.donorName || d.remarks || d.voucherNo || d.month || '').toLowerCase().includes(q);
        const matchesBank = (d.bankAccount?.accountName || d.donorBankName || '').toLowerCase().includes(q);
        const matchesBeneficiary = Array.isArray(d.beneficiaries) && d.beneficiaries.some(b => (b.name || '').toLowerCase().includes(q) || (b.cnic || '').includes(q));
        if (!matchesName && !matchesBank && !matchesBeneficiary) return false;
      }

      return true;
    });
  }, [donations, filterStatus, filterType, filterMonth, search]);

  // Summary KPIs for filtered records
  const kpis = useMemo(() => {
    let totalDonations = 0;
    let totalZakat = 0;
    let postedCount = 0;

    filteredDonations.forEach(d => {
      if (d.status === 'APPROVED' || d.status === 'POSTED') {
        postedCount++;
        const amt = Number(d.amount) || 0;
        const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
        if (isZakat) {
          totalZakat += amt;
        } else {
          totalDonations += amt;
        }
      }
    });

    return {
      totalDonations,
      totalZakat,
      totalDisbursed: totalDonations + totalZakat,
      postedCount
    };
  }, [filteredDonations]);

  const handleApprove = async (d) => {
    setActionLoading(true);
    try {
      await approveDonation(d.id);
      showToast(`${d.month || 'Monthly'} disbursement approved and posted to General Ledger.`, 'success');
      fetchDonations();
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || 'Failed to approve donation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevert = async (id, reason) => {
    setActionLoading(true);
    try {
      await revertDonation(id, reason);
      showToast('Posting reverted successfully. Bank balance has been restored.', 'success');
      setRevertTargetDonation(null);
      fetchDonations();
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || 'Failed to revert posting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setActionLoading(true);
    try {
      await deleteDonation(deleteId);
      showToast('Record deleted successfully.', 'success');
      setDeleteId(null);
      fetchDonations();
    } catch (err) {
      handleDeleteError(err, 'Donation');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Quick Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Heart className="w-6 h-6 text-amber-500" />
            <span>Donation Distribution</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monthly bank-deducted welfare disbursements with automated General Ledger double-entry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/donation-distribution/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Monthly Disbursement</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Disbursements</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold font-mono text-slate-100 mt-2">
            Rs. {kpis.totalDisbursed.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{kpis.postedCount} posted batch(es)</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Donations</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold font-mono text-amber-400 mt-2">
            Rs. {kpis.totalDonations.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">General & Welfare</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Zakat</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold font-mono text-emerald-400 mt-2">
            Rs. {kpis.totalZakat.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Zakat Fund Disbursed</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Policy</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-200 mt-2">
            Single Bank Deduction
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Strict duplicate prevention</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by month, recipient, bank, voucher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="DONATION">Monthly Donations</option>
            <option value="ZAKAT">Zakat Disbursements</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Posted / Approved</option>
            <option value="PENDING">Pending Drafts</option>
            <option value="REVERTED">Reverted Postings</option>
          </select>

          {/* Month Filter */}
          {availableMonths.length > 0 && (
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Disbursement Cards List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading disbursement records...</div>
      ) : filteredDonations.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No Monthly Disbursements Found"
          description="Log a new monthly disbursement from a donation fund pool or bank account to view postings and generate accounting entries."
          actionText="Log Monthly Disbursement"
          actionUrl="/donation-distribution/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDonations.map((d) => {
            const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
            const isApproved = d.status === 'APPROVED' || d.status === 'POSTED';
            const isReverted = d.status === 'REVERTED';
            const beneficiaries = Array.isArray(d.beneficiaries) ? d.beneficiaries : [];
            const isFundPool = d.paymentMethod === 'DONATION_FUND' || (!d.bankAccountId && d.paymentMethod !== 'CASH');
            const isCash = d.paymentMethod === 'CASH';
            const sourceName = isFundPool ? 'Donation Fund Pool' : isCash ? 'Cash in Hand' : (d.bankAccount?.accountName || d.donorBankName || 'Bank Account');

            return (
              <div
                key={d.id}
                className={`p-5 rounded-2xl border bg-slate-900/90 shadow-xl flex flex-col justify-between transition-all ${
                  isApproved
                    ? 'border-slate-800 hover:border-slate-700'
                    : isReverted
                    ? 'border-red-500/20 bg-red-950/10'
                    : 'border-amber-500/30'
                }`}
              >
                <div>
                  {/* Top Header inside Card */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          isZakat
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {isZakat ? 'Zakat' : 'Monthly Donation'}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isApproved
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isReverted
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {isApproved ? 'Posted' : isReverted ? 'Reverted' : 'Pending'}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-100 mt-1.5 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{d.month || (d.disbursementMonth ? `${d.disbursementMonth}` : 'Monthly Batch')}</span>
                      </h3>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Deduction</span>
                      <p className="text-lg font-black font-mono text-slate-50">
                        Rs. {Number(d.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="py-3.5 space-y-2.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        {isFundPool ? (
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                        ) : isCash ? (
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Building className="w-3.5 h-3.5 text-blue-400" />
                        )} Source:
                      </span>
                      <strong className={`font-semibold truncate max-w-[170px] ${isFundPool ? 'text-amber-300' : isCash ? 'text-emerald-300' : 'text-slate-200'}`}>
                        {sourceName}
                      </strong>
                    </div>

                    {d.voucherNo && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Voucher / Ref:</span>
                        <span className="font-mono text-amber-400 font-bold">{d.voucherNo}</span>
                      </div>
                    )}

                    {/* Beneficiaries Count */}
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" /> Distribution:
                      </span>
                      {beneficiaries.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewBeneficiariesDonation(d)}
                          className="text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{beneficiaries.length} Beneficiaries</span>
                          <Eye className="w-3 h-3" />
                        </button>
                      ) : d.beneficiary ? (
                        <span className="text-slate-200 font-bold truncate max-w-[160px]">
                          {d.beneficiary.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">Lump sum</span>
                      )}
                    </div>

                    {d.remarks && (
                      <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60 truncate">
                        &ldquo;{d.remarks}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPrintDonation(d)}
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title="Print Voucher Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => setRevertTargetDonation(d)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Revert Posting"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isApproved && !isReverted && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleApprove(d)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all cursor-pointer"
                      >
                        Post to GL
                      </button>
                    )}

                    <Link
                      to={`/donation-distribution/edit/${d.id}`}
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => setDeleteId(d.id)}
                      className="p-2 rounded-xl bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Beneficiaries Breakdown Modal */}
      <BeneficiaryBreakdownModal
        donation={viewBeneficiariesDonation}
        isOpen={!!viewBeneficiariesDonation}
        onClose={() => setViewBeneficiariesDonation(null)}
      />

      {/* Revert Posting Modal */}
      <RevertPostingModal
        donation={revertTargetDonation}
        isOpen={!!revertTargetDonation}
        onClose={() => setRevertTargetDonation(null)}
        onConfirm={handleConfirmRevert}
        loading={actionLoading}
      />

      {/* Voucher Slip Modal */}
      {printDonation && (() => {
        const isZakat = String(printDonation.donationType).toUpperCase().includes('ZAKAT');
        const isFundPool = printDonation.paymentMethod === 'DONATION_FUND' || (!printDonation.bankAccountId && printDonation.paymentMethod !== 'CASH');
        const isCash = printDonation.paymentMethod === 'CASH';

        const creditCode = isFundPool ? (isZakat ? '3020409' : '3020408') : isCash ? '1010201' : (printDonation.bankAccount?.glCode || '1010101');
        const creditName = isFundPool ? (isZakat ? 'Zakat Fund' : 'General Donation Account') : isCash ? 'Cash in Hand' : (printDonation.bankAccount?.accountName || 'Bank Account');

        return (
          <VoucherSlipModal
            isOpen={!!printDonation}
            onClose={() => setPrintDonation(null)}
            voucher={{
              voucherNo: printDonation.voucherNo || `DON-${printDonation.id?.slice(0, 6)}`,
              postingDate: printDonation.createdAt,
              voucherType: isFundPool ? 'JV' : (isCash ? 'CP' : 'BP'),
              subsidiary: 'DONATIONS',
              reference: printDonation.month || printDonation.disbursementMonth,
              description: `${printDonation.month || 'Monthly'} ${isZakat ? 'Zakat' : 'Donation'} Disbursement`,
              postedBy: 'Accounting System',
              lines: [
                {
                  account: {
                    code: isZakat ? '4060104' : '4060101',
                    name: isZakat ? 'Zakat Expense' : 'Monthly Donations Expense'
                  },
                  debit: printDonation.amount,
                  credit: 0
                },
                {
                  account: {
                    code: creditCode,
                    name: creditName
                  },
                  debit: 0,
                  credit: printDonation.amount
                }
              ]
            }}
          />
        );
      })()}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Delete Disbursement Record</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this disbursement record? If this transaction was already posted, the journal entry will be removed and the bank balance recalculated.
            </p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                {actionLoading ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Donations;

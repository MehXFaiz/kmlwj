import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { paymentMethodLabel } from '../constants/paymentMethods';

function BeneficiaryBreakdownModal({ donation, isOpen, onClose }) {
  if (!isOpen || !donation) return null;
  const beneficiaries = donation.beneficiaries || [];
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
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
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

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400">Batch Total (Single Bank Deduction):</span>
          <span className="font-mono text-emerald-400 text-base">Rs. {Number(donation.amount || 0).toLocaleString()}</span>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthlyDonationVoucherModal({ donation, onClose }) {
  if (!donation) return null;

  const isZakat = String(donation.donationType).toUpperCase().includes('ZAKAT');
  const title = isZakat ? 'MONTHLY ZAKAT DISBURSEMENT VOUCHER' : 'MONTHLY DONATION DISBURSEMENT VOUCHER';
  const voucherNo = donation.voucherNo || `MDON-${donation.id.slice(0, 8).toUpperCase()}`;

  const hasMulti = Array.isArray(donation.beneficiaries) && donation.beneficiaries.length > 0;
  const beneficiarySummary = hasMulti
    ? `${donation.beneficiaries.length} Beneficiaries (${donation.beneficiaries.map(b => `${b.name}: Rs ${Number(b.amount).toLocaleString()}`).join(', ')})`
    : (donation.beneficiary?.name || donation.donorName || 'Welfare Beneficiary');

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title={title}
      voucherNo={voucherNo}
      fileNo={donation.month || 'Monthly Disbursement'}
      date={donation.createdAt}
      name={beneficiarySummary}
      fatherName={donation.beneficiary?.fatherName || ''}
      cnic={donation.beneficiary?.cnic || ''}
      mobile={donation.beneficiary?.mobile || donation.donorMobile || ''}
      address={donation.beneficiary?.address || ''}
      gham={donation.beneficiary?.gham || donation.beneficiary?.area || ''}
      paymentMethod="BANK"
      accountName={donation.bankAccount ? `${donation.bankAccount.accountName || donation.bankAccount.name} (${donation.bankAccount.glCode || donation.bankAccount.code})` : 'Main Bank Account'}
      particulars={`Monthly ${isZakat ? 'Zakat' : 'Donation'} Aid Disbursement for ${donation.month || 'Current Month'}${donation.remarks ? ` - ${donation.remarks}` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Finance Officer'}
      payeeLabel="Authorized Signature"
    />
  );
}

const DEFAULT_FILTERS = {
  aidType: 'ALL',
  postingStatus: 'ALL',
  dateFrom: '',
  dateTo: '',
  bankAccount: 'ALL',
  sortBy: 'LATEST',
};

export const Donations = () => {
  const { donations, fetchDonations, approveDonation, revertDonation, deleteDonation, bulkDeleteDonations } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperAdmin = useAuthStore((s) => s.user?.role?.name?.toLowerCase()?.includes('super') || s.user?.role?.isPrivileged);
  const isAdmin = useAuthStore((s) => s.user?.role?.name?.toLowerCase()?.includes('admin') || isSuperAdmin);

  const canCreate = hasPermission('donations', 'create');
  const canEdit = hasPermission('donations', 'update');
  const canDelete = hasPermission('donations', 'delete');
  const canPost = hasPermission('donations', 'post');
  const canPrint = hasPermission('donations', 'print') || true;
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [approveId, setApproveId] = useState(null);
  const [revertId, setRevertId] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [printDonation, setPrintDonation] = useState(null);
  const [breakdownDonation, setBreakdownDonation] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
  }, [fetchDonations, fetchAccountsList]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => {
      const nameLower = (a.name || a.accountName || '').toLowerCase();
      const detailLower = (a.detailType || '').toLowerCase();
      return detailLower === 'bank' || nameLower.includes('bank') || a.code === '1010101' || a.glCode === '1010101';
    });
  }, [flatAccounts]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
  };

  const filtered = useMemo(() => {
    return donations.filter(d => {
      const q = search.toLowerCase().trim();
      if (q) {
        const month = (d.month || '').toLowerCase();
        const type = (d.donationType || '').toLowerCase();
        const bankName = (d.bankAccount?.accountName || d.bankAccount?.name || '').toLowerCase();
        const voucherNo = (d.voucherNo || d.chequeNumber || d.id || '').toLowerCase();
        const donorName = (d.donorName || '').toLowerCase();
        const beneficiaryName = (d.beneficiary?.name || '').toLowerCase();
        const remarks = (d.remarks || '').toLowerCase();
        const amountStr = String(d.amount || '');

        const matches =
          month.includes(q) ||
          type.includes(q) ||
          bankName.includes(q) ||
          voucherNo.includes(q) ||
          donorName.includes(q) ||
          beneficiaryName.includes(q) ||
          remarks.includes(q) ||
          amountStr.includes(q);

        if (!matches) return false;
      }

      if (filters.aidType !== 'ALL') {
        const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
        if (filters.aidType === 'ZAKAT' && !isZakat) return false;
        if (filters.aidType === 'DONATION' && isZakat) return false;
      }

      if (filters.postingStatus !== 'ALL') {
        if ((d.status || '') !== filters.postingStatus) return false;
      }

      if (filters.bankAccount !== 'ALL') {
        if (d.bankAccountId !== filters.bankAccount) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [donations, search, filters]);

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await approveDonation(id);
      showToast('Monthly donation disbursement posted to ledger successfully!', 'success');
      setApproveId(null);
    } catch (e) {
      showToast(e.message || 'Failed to post donation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevert = async (id) => {
    setActionLoading(true);
    try {
      await revertDonation(id, revertReason);
      showToast('Disbursement posting reverted successfully from General Ledger', 'success');
      setRevertId(null);
      setRevertReason('');
    } catch (e) {
      showToast(e.message || 'Failed to revert posting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setActionLoading(true);
    try {
      await deleteDonation(id);
      showToast('Disbursement record deleted successfully', 'success');
      setDeleteId(null);
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (e) {
      handleDeleteError(e, 'Failed to delete disbursement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setActionLoading(true);
    try {
      const res = await bulkDeleteDonations(selectedIds);
      if (res?.success) {
        showToast(`${selectedIds.length} disbursement record(s) deleted successfully`, 'success');
        setSelectedIds([]);
      } else {
        showToast(res?.error || 'Failed to bulk delete disbursements', 'error');
      }
    } catch (e) {
      handleDeleteError(e, 'Failed to bulk delete');
    } finally {
      setShowBulkConfirm(false);
      setActionLoading(false);
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Monthly Donation Disbursements</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">
                Bank Outflow
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monthly welfare aid batches disbursed from bank accounts with duplicate protection
            </p>
          </div>
        </div>

        <div className={pageActionsClass}>
          {canDelete && selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-xs font-bold cursor-pointer mr-2 shadow-sm"
            >
              <Trash2 className="h-4 w-4" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => navigate('/donations/new')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/15 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" /> <span>New Monthly Disbursement</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500/80" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Month (e.g. September 2026), Bank, Voucher #, Amount..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Quick Category Buttons */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { label: 'All', value: 'ALL' },
                { label: 'Donations', value: 'DONATION' },
                { label: 'Zakat', value: 'ZAKAT' }
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setFilter('aidType', t.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filters.aidType === t.value
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <span className="text-xs font-semibold text-slate-400 px-3 py-1 bg-slate-950/60 border border-slate-800 rounded-lg">
              <strong className="text-amber-400">{filtered.length}</strong> record(s)
            </span>
          </div>
        </div>
      </div>

      {/* Cards List View */}
      <div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No monthly disbursements found"
            description="Log your first monthly donation or zakat disbursement to record bank deductions and generate voucher slips."
            actionLabel="Log Monthly Disbursement"
            onAction={() => navigate('/donations/new')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(d => {
              const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
              const isPosted = d.status === 'APPROVED' || d.status === 'POSTED';
              const isReverted = d.status === 'REVERTED';
              const hasMulti = Array.isArray(d.beneficiaries) && d.beneficiaries.length > 0;

              return (
                <div
                  key={d.id}
                  className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                    selectedIds.includes(d.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                  }`}
                >
                  <div>
                    {/* Top Row: Checkbox, Icon, Month Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {canDelete && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(d.id)}
                            onChange={(e) => handleSelectOne(d.id, e)}
                            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                          />
                        )}

                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          isZakat
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {isZakat ? <Sparkles className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-extrabold text-slate-100 group-hover:text-amber-300 transition-colors leading-tight truncate">
                            {d.month || (d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Monthly Disbursement')}
                          </h4>
                          <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 border ${
                            isZakat
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {isZakat ? 'Zakat Disbursement' : 'Monthly Donation'}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${
                        isPosted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : isReverted
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {isPosted && <CheckCircle2 className="w-3 h-3" />}
                        {isReverted && <Undo2 className="w-3 h-3" />}
                        {!isPosted && !isReverted && <AlertTriangle className="w-3 h-3" />}
                        <span>{isPosted ? 'POSTED' : isReverted ? 'REVERTED' : 'PENDING'}</span>
                      </span>
                    </div>

                    {/* Disbursement Details Box */}
                    <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                      {/* Amount */}
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5 text-amber-400" /> TOTAL DEDUCTED
                        </span>
                        <span className="font-extrabold font-mono text-amber-400 text-base">
                          Rs. {Number(d.amount || 0).toLocaleString()}
                        </span>
                      </div>

                      {/* Bank Account */}
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-amber-400" /> BANK ACCOUNT
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                          {d.bankAccount?.accountName || d.bankAccount?.name || 'Bank Account'}
                        </span>
                      </div>

                      {/* Beneficiaries / Distribution */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-400" /> RECIPIENTS
                        </span>
                        {hasMulti ? (
                          <button
                            type="button"
                            onClick={() => setBreakdownDonation(d)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{d.beneficiaries.length} Recipients (View Split)</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-300 truncate max-w-[180px]">
                            {d.beneficiary?.name || d.donorName || 'Lump Sum Batch'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Voucher # & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                    <span className="text-[11px] font-mono font-medium text-slate-500">
                      {d.voucherNo || (d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—')}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Print Voucher */}
                      {canPrint && (
                        <button
                          type="button"
                          onClick={() => setPrintDonation(d)}
                          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Print Voucher Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Post to Ledger (if pending) */}
                      {!isPosted && !isReverted && canPost && (
                        <button
                          type="button"
                          onClick={() => setApproveId(d.id)}
                          className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                          title="Post to Ledger"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Post
                        </button>
                      )}

                      {/* Revert Posting (if posted and Admin) */}
                      {isPosted && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setRevertId(d.id)}
                          className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Revert Posting"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Edit */}
                      {canEdit && !isPosted && (
                        <button
                          type="button"
                          onClick={() => navigate(`/donations/edit/${d.id}`)}
                          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Edit Disbursement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(d.id)}
                          className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Delete Disbursement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Post to Ledger Modal */}
      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApproveId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-emerald-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-200">Post Monthly Disbursement to Ledger</h4>
            <p className="text-xs text-slate-400">
              This will deduct the disbursement total from the selected bank account and generate the General Ledger entry. Proceed?
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setApproveId(null)} className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleApprove(approveId)}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Posting...' : 'Post to Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Posting Modal */}
      {revertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRevertId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-amber-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-bold text-slate-200">Revert Posting from Ledger</h4>
            </div>
            <p className="text-xs text-slate-400">
              This will delete the accounting Journal Entry and restore the bank account balance.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Reversal Reason</label>
              <input
                type="text"
                placeholder="e.g. Incorrect bank account selected"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setRevertId(null)} className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleRevert(revertId)}
                className="flex-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Reverting...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" /> Confirm Deletion
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete this disbursement record? Any linked posted journal entries will be automatically reversed.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beneficiary Breakdown Modal */}
      {breakdownDonation && (
        <BeneficiaryBreakdownModal
          donation={breakdownDonation}
          isOpen={true}
          onClose={() => setBreakdownDonation(null)}
        />
      )}

      {/* Print Slip Modal */}
      {printDonation && (
        <MonthlyDonationVoucherModal
          donation={printDonation}
          onClose={() => setPrintDonation(null)}
        />
      )}
    </div>
  );
};

export default Donations;

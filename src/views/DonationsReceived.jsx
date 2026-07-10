import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useDonorStore } from '../store/donorStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import {
  DollarSign, Search, Plus, Printer, CheckCircle, Clock, XCircle,
  Eye, Trash2, UserPlus, Calendar, CreditCard, Building2, Filter,
  ArrowDownLeft, FileText, Check, AlertCircle, X, AlertTriangle, Edit2
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';

const DONATION_TYPES = [
  'GENERAL_DONATION', 'ZAKAT', 'FITRA', 'SADQA', 'QURBANI',
  'HALL_DONATION', 'MARRIAGE_DONATION', 'BUILDING_FUND',
  'MEDICAL_DONATION', 'EDUCATION_DONATION', 'MONTHLY',
  'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION', 'CUSTOM'
];

const PAYMENT_METHODS = ['CASH', 'BANK', 'CHEQUE', 'ONLINE'];

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

function PrintReceiptModal({ donation, onClose }) {
  if (!donation) return null;

  const categoryLabel = donation.donationType ? donation.donationType.replace(/_/g, ' ') : 'Donation';

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title={`${categoryLabel} RECEIPT`}
      voucherNo={donation.receiptNo || donation.id?.slice(0, 8)?.toUpperCase()}
      fileNo={donation.donor?.donorCode || donation.donor?.cnic || ''}
      date={donation.receiptDate || donation.createdAt}
      name={donation.donor?.fullName}
      address={donation.donor?.mobile || donation.donor?.address || ''}
      debitCredit={donation.paymentMethod}
      accountName={`${categoryLabel} A/c`}
      particulars={`Donation Received - ${categoryLabel}${donation.narration ? ` (${donation.narration})` : ''}${donation.chequeNo ? ` [Cheque #${donation.chequeNo}]` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Operator'}
      payeeLabel="Receiver's Sign"
    />
  );
}



export const DonationsReceived = () => {
  const navigate = useNavigate();
  const { donations, stats, loading, fetchDonations, updateDonationStatus, deleteDonation, bulkDeleteDonations } = useDonationReceivedStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [printItem, setPrintItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);



  const filtered = useMemo(() => {
    return donations.filter(d => {
      if (filterType && d.donationType !== filterType) return false;
      if (filterMethod && d.paymentMethod !== filterMethod) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = d.receiptNo?.toLowerCase().includes(q);
        const matchDonor = d.donor?.fullName?.toLowerCase().includes(q) || d.donor?.donorCode?.toLowerCase().includes(q);
        const matchRef = d.referenceNo?.toLowerCase().includes(q) || d.chequeNo?.toLowerCase().includes(q);
        if (!matchNo && !matchDonor && !matchRef) return false;
      }
      return true;
    });
  }, [donations, filterType, filterMethod, filterStatus, search]);



  const handlePostDraft = async (item) => {
    if (!window.confirm(`Are you sure you want to post receipt "${item.receiptNo}" to the ledger?`)) return;
    try {
      await updateDonationStatus(item.id, 'POSTED');
      showToast('Receipt posted to ledger successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to post receipt', 'error');
    }
  };

  const handleCancelReceipt = async (item) => {
    if (!window.confirm(`Are you sure you want to CANCEL/VOID receipt "${item.receiptNo}"? This will reverse/remove the general ledger entry.`)) return;
    try {
      await updateDonationStatus(item.id, 'CANCELLED');
      showToast('Receipt voided and ledger entry reversed', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to void receipt', 'error');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to permanently delete receipt "${item.receiptNo}" from database and ledger?`)) return;
    try {
      await deleteDonation(item.id);
      showToast('Donation receipt deleted permanently', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete donation receipt', 'error');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await bulkDeleteDonations(selectedIds);
      showToast(`${selectedIds.length} donation receipt(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete donation receipts', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <ArrowDownLeft className="h-7 w-7 text-emerald-400" /> Donations Received (Inflow)
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track charitable receipts, Zakat contributions, and automatic Chart of Accounts ledger postings</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          <Link
            to="/donations-received/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Donation Receipt</span>
          </Link>
        </div>
      </div>

      {/* Statistics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Total Collected</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              PKR {Number(stats.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Cash Inflow</p>
            <p className="text-xl font-bold text-slate-200 mt-1">
              PKR {Number(stats.cashAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Bank / Online</p>
            <p className="text-xl font-bold text-slate-200 mt-1">
              PKR {Number(stats.bankAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Total Receipts</p>
            <p className="text-2xl font-black text-slate-200 mt-1">{stats.totalReceipts || donations.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
            <FileText className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by receipt # (REC-2026-0001), donor name, reference, or cheque #"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Categories</option>
            {DONATION_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="POSTED">POSTED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {loading && donations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading received donations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium bg-slate-900/40 rounded-2xl border border-slate-800">No donation receipts found matching your search criteria.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(d => (
              <div
                key={d.id}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(d.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Avatar/Icon, Name & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={(e) => handleSelectOne(d.id, e)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                      />
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-inner shrink-0">
                        {d.donor?.fullName ? d.donor.fullName.charAt(0).toUpperCase() : <DollarSign className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight">
                          {d.donor?.fullName || 'Anonymous Donor'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                          {d.donor?.donorCode ? (
                            <>
                              <CreditCard className="w-3 h-3 text-amber-400/80 shrink-0" /> {d.donor.donorCode}
                            </>
                          ) : 'General Contribution'}
                        </p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide shrink-0 ${
                      d.status === 'POSTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : d.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {d.status === 'POSTED' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" /> POSTED
                        </>
                      ) : d.status === 'DRAFT' ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" /> PENDING POST
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> VOIDED
                        </>
                      )}
                    </span>
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-amber-400" /> AMOUNT
                      </span>
                      <span className="font-bold text-amber-400 text-sm">
                        PKR {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" /> RECEIPT NO
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-xs">
                        {d.receiptNo || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-amber-400" /> CATEGORY
                      </span>
                      <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60">
                        {d.donationType?.replace(/_/g, ' ') || 'GENERAL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> METHOD
                      </span>
                      <span className="font-semibold text-slate-100 text-xs truncate max-w-[150px]">
                        {d.paymentMethod || 'CASH'}
                        {d.bankAccount && <span className="text-slate-400 font-normal ml-1">({d.bankAccount.accountName})</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {d.receiptDate ? new Date(d.receiptDate).toLocaleDateString() : '7/7/2026'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintItem(d)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Print Receipt Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {d.status === 'DRAFT' && canPostToLedger && (
                      <button
                        type="button"
                        onClick={() => handlePostDraft(d)}
                        className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                        title="Post Receipt to Ledger"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Post
                      </button>
                    )}
                    {canEditOrDelete && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/donations-received/edit/${d.id}`)}
                          className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Edit Receipt"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Delete Receipt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Bulk Deletion</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected donation receipt(s)? Their associated ledger entries will be removed/reversed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedIds.length} Receipt(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintReceiptModal
        donation={printItem}
        onClose={() => setPrintItem(null)}
      />
    </div>
  );
};

export default DonationsReceived;

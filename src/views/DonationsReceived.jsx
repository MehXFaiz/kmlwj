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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto print:block">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm print:hidden" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col print:shadow-none print:border-none print:bg-white print:w-full print:static print:block animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">Donation Receipt Details</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <Printer className="h-3.5 w-3.5" /> Print Receipt
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-6 space-y-6 bg-slate-950/40 print:bg-white print:text-black">
          <div className="flex justify-between items-start border-b border-slate-800/80 print:border-slate-300 pb-6">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-100 print:text-black">KACHI MEMON LION WELFARE JAMAT</h2>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">Official Charitable Donation Receipt</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-lg bg-indigo-500/10 print:bg-slate-100 text-indigo-400 print:text-black font-mono font-bold text-sm border border-indigo-500/20 print:border-slate-300">
                {donation.receiptNo}
              </span>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Date: {new Date(donation.receiptDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-900/60 print:bg-slate-50 border border-slate-800/80 print:border-slate-200">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500 print:text-slate-600">Received From (Donor)</p>
              <p className="text-base font-bold text-slate-100 print:text-black mt-1">{donation.donor?.fullName}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Code: {donation.donor?.donorCode} {donation.donor?.cnic ? `| CNIC: ${donation.donor?.cnic}` : ''}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500 print:text-slate-600">Donation Category</p>
              <p className="text-base font-bold text-indigo-400 print:text-black mt-1">{donation.donationType?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Payment: {donation.paymentMethod}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 print:border-slate-300 bg-emerald-500/5 print:bg-slate-50 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-300 print:text-black">Total Amount Received:</span>
            <span className="text-2xl font-black text-emerald-400 print:text-black">
              PKR {Number(donation.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {(donation.referenceNo || donation.chequeNo || donation.narration) && (
            <div className="space-y-2 text-xs text-slate-300 print:text-slate-700 bg-slate-900/40 print:bg-white p-4 rounded-xl border border-slate-800/60 print:border-slate-200">
              {donation.chequeNo && <p><strong className="text-slate-400 print:text-black">Cheque No:</strong> {donation.chequeNo} {donation.chequeDate ? `(Dated: ${new Date(donation.chequeDate).toLocaleDateString()})` : ''}</p>}
              {donation.referenceNo && <p><strong className="text-slate-400 print:text-black">Reference No:</strong> {donation.referenceNo}</p>}
              {donation.narration && <p><strong className="text-slate-400 print:text-black">Remarks / Narration:</strong> {donation.narration}</p>}
            </div>
          )}

          <div className="pt-12 flex justify-between items-end text-xs text-slate-500 print:text-slate-600">
            <div>
              <p>Created By: {donation.createdBy?.fullName || 'Admin'}</p>
              <p className="text-[10px]">System Generated Document</p>
            </div>
            <div className="text-center w-48 border-t border-slate-700 print:border-slate-400 pt-2">
              <p className="font-semibold text-slate-300 print:text-black">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



export const DonationsReceived = () => {
  const navigate = useNavigate();
  const { donations, stats, loading, fetchDonations, updateDonationStatus, deleteDonation, bulkDeleteDonations } = useDonationReceivedStore();
  const { canEditOrDelete } = useAuthStore();
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
              PKR {Number(stats.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              PKR {Number(stats.cashAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Bank / Online</p>
            <p className="text-xl font-bold text-slate-200 mt-1">
              PKR {Number(stats.bankAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
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
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {DONATION_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="POSTED">POSTED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Receipts Table Section */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden shadow-xl">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Receipt No & Date</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Donor Details</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Category</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Payment & Account</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 text-right">Amount (PKR)</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 text-center">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && donations.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500 text-sm">
                      Loading received donations...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500 text-sm">
                      No donation receipts found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(d.id)}
                          onChange={(e) => handleSelectOne(d.id, e)}
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                          {d.receiptNo}
                        </span>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {new Date(d.receiptDate).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-200">{d.donor?.fullName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Code: <span className="font-mono text-indigo-400">{d.donor?.donorCode}</span>
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {d.donationType?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-300">{d.paymentMethod}</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-48 mt-0.5" title={d.cashAccount?.accountName || d.bankAccount?.accountName}>
                          {d.cashAccount?.accountName || d.bankAccount?.accountName || '—'}
                        </p>
                        {d.chequeNo && <p className="text-[10px] text-slate-400 font-mono">Chq: {d.chequeNo}</p>}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {d.status === 'POSTED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">
                            <Check className="h-3 w-3" /> POSTED
                          </span>
                        ) : d.status === 'DRAFT' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> PENDING POST
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">
                            <X className="h-3 w-3" /> VOIDED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setPrintItem(d)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Print Receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          {d.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePostDraft(d)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                              title="Post Receipt to Ledger"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {d.status === 'POSTED' && canEditOrDelete && (
                            <button
                              onClick={() => handleCancelReceipt(d)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                              title="Void Receipt & Reverse Ledger Entry"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canEditOrDelete && (
                            <button
                              onClick={() => { setSelectedReceipt(d); setModalOpen(true); }}
                              className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-colors"
                              title="Edit Receipt"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canEditOrDelete && (
                            <button
                              onClick={() => handleDelete(d)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                              title="Delete Receipt Permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DesktopOnly>

        <MobileOnly>
          <div className="divide-y divide-slate-800/50">
            {loading && donations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading receipts...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No receipts found matching criteria.</div>
            ) : (
              filtered.map(d => (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                        {d.receiptNo}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200">{d.donor?.fullName}</h4>
                      <p className="text-xs text-slate-500">{d.donationType?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-emerald-400">
                        PKR {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {d.status === 'POSTED' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50 inline-block mt-1">POSTED</span>
                      ) : d.status === 'DRAFT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-bold uppercase tracking-wider inline-block mt-1">
                          <AlertTriangle className="h-3 w-3 inline" /> PENDING POST
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50 inline-block mt-1">VOIDED</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Date</span>
                      {new Date(d.receiptDate).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payment</span>
                      {d.paymentMethod}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setPrintItem(d)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                    {d.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePostDraft(d)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Post
                      </button>
                    )}
                    {canEditOrDelete && (
                      <button
                        onClick={() => { setSelectedReceipt(d); setModalOpen(true); }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {canEditOrDelete && (
                      <button
                        onClick={() => handleDelete(d)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </MobileOnly>
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

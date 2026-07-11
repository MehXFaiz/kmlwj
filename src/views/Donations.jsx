import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import { Heart, Search, Plus, Edit2, Trash2, CheckCircle2, X, AlertTriangle, Printer, Phone, CreditCard, Banknote, Calendar, MapPin } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { EmptyState } from '../components/ui/EmptyState';

// Replace null DB values with '' so controlled inputs stay controlled
const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_DONATION = { donorName: '', donorMobile: '', donationType: 'MONTHLY', amount: '', paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '' };

function DonationModal({ isOpen, onClose, onSave, initial, accounts }) {
  const [form, setForm] = useState(
    initial ? nullsToEmpty(initial) : DEFAULT_DONATION
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? nullsToEmpty(initial) : DEFAULT_DONATION);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.donorName || !form.amount || !form.paymentMethod) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }
    if (!/^[a-zA-Z\s.]{3,50}$/.test(form.donorName)) {
      showToast('Donor Name must contain only letters, spaces and dots (3-50 characters).', 'warning');
      return;
    }
    if (form.donorMobile && !/^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/.test(form.donorMobile)) {
      showToast('Invalid Mobile Number. E.g. 0300-1234567', 'warning');
      return;
    }
    if (!/^[1-9]\d*(\.\d{1,2})?$/.test(form.amount)) {
      showToast('Amount must be a positive number with up to 2 decimal places.', 'warning');
      return;
    }
    if ((form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && !form.bankAccountId) {
      showToast('Bank Account is required.', 'warning');
      return;
    }
    if (form.paymentMethod === 'CHEQUE' && !form.chequeNumber) {
      showToast('Cheque number is required.', 'warning');
      return;
    }
    if (form.paymentMethod === 'CHEQUE' && form.chequeNumber && !/^[0-9]{6,20}$/.test(form.chequeNumber)) {
      showToast('Cheque number must be between 6 and 20 digits.', 'warning');
      return;
    }
    onSave({ ...form });
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Heart className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{initial ? 'Edit Donation' : 'New Donation'}</h3>
              <p className="text-[11px] text-slate-500">Log a charitable contribution</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-0 sm:gap-5 p-5">

            {/* Left: Info Panel */}
            <div className="sm:col-span-4 mb-4 sm:mb-0">
              <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-amber-300">Donation Info</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Heart className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Tracks Donation Inflow</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Posts to General Ledger</span>
                  </div>
                </div>
                <div className="border-t border-amber-500/20 my-3" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
                </p>
              </div>
            </div>

            {/* Right: Form Cards */}
            <div className="sm:col-span-8 space-y-4">

              {/* Card 01: Donor Details */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                  <h4 className="text-sm font-semibold text-slate-200">Donor & Amount</h4>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Donor Name *</label>
                    <input type="text" value={form.donorName} onChange={e => setForm(f => ({ ...f, donorName: e.target.value }))}
                      placeholder="E.g. Muhammad Ali" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Donor Mobile</label>
                    <input type="text" value={form.donorMobile} onChange={e => setForm(f => ({ ...f, donorMobile: e.target.value }))}
                      placeholder="E.g. 0300-1234567" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Donation Type *</label>
                    <select value={form.donationType} onChange={e => setForm(f => ({ ...f, donationType: e.target.value }))}
                      className={inputClass}>
                      {['MONTHLY', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION', 'CUSTOM'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Amount *</label>
                    <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="10000" className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Card 02: Payment */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                  <h4 className="text-sm font-semibold text-slate-200">Payment Details</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Payment Method *</label>
                    <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))} className={inputClass}>
                      {['CASH', 'BANK', 'CHEQUE'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Bank Account *</label>
                        <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                          className={inputClass}>
                          <option value="">Select Bank Account</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.accountName}</option>
                          ))}
                        </select>
                      </div>
                      {form.paymentMethod === 'CHEQUE' && (
                        <div>
                          <label className={labelClass}>Cheque/Ref Number *</label>
                          <input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))}
                            placeholder="CHQ-001" className={inputClass} />
                        </div>
                      )}
                    </div>
                  )}

                  {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                    <div>
                      <label className={labelClass}>Donor Bank (Pakistani Banks)</label>
                      <select value={form.donorBankName} onChange={e => setForm(f => ({ ...f, donorBankName: e.target.value }))} className={inputClass}>
                        <option value="">Select Bank (Optional)</option>
                        {['Habib Bank Limited (HBL)', 'National Bank of Pakistan (NBP)', 'Meezan Bank', 'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank Limited (ABL)', 'Bank Alfalah', 'Standard Chartered Bank', 'Askari Bank', 'Bank AL Habib', 'Faysal Bank', 'Soneri Bank', 'Bank of Punjab (BOP)', 'JS Bank', 'Dubai Islamic Bank', 'Al Baraka Bank', 'Bank Islami', 'Sindh Bank', 'Habib Metropolitan Bank', 'First Women Bank', 'Samba Bank', 'Silkbank', 'Summit Bank'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Remarks</label>
                    <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                      className={`${inputClass} h-20 resize-none`} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
            {initial ? 'Save Changes' : 'Create Donation'}
          </button>
        </div>
      </div>
    </div>
  );
}

const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const g = [
    '', 'Thousand', 'Million', 'Billion', 'Trillion'
  ];
  
  const makeGroup = (n) => {
    let s = '';
    const hundred = Math.floor(n / 100);
    const ten = n % 100;
    if (hundred > 0) {
      s += a[hundred] + ' Hundred ';
    }
    if (ten > 0) {
      if (ten < 20) {
        s += a[ten] + ' ';
      } else {
        s += b[Math.floor(ten / 10)] + ' ' + a[ten % 10] + ' ';
      }
    }
    return s.trim();
  };

  let remainder = num;
  let wordResult = '';
  let groupIndex = 0;
  
  while (remainder > 0) {
    const chunk = remainder % 1000;
    if (chunk > 0) {
      wordResult = makeGroup(chunk) + ' ' + g[groupIndex] + ' ' + wordResult;
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex++;
  }
  
  return wordResult.trim() + ' Rupees Only';
};

function DonationInvoiceModal({ donation, onClose }) {
  if (!donation) return null;

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title="DONATION VOUCHER"
      voucherNo={donation.id?.slice(0, 8)?.toUpperCase()}
      fileNo={donation.donationType || ''}
      date={donation.createdAt}
      name={donation.donorName}
      address={donation.donorMobile || donation.donorBankName || ''}
      debitCredit={donation.paymentMethod}
      accountName="Donation Disbursement A/c"
      particulars={`Donation Given / Disbursement - ${donation.donationType}${donation.remarks ? ` (${donation.remarks})` : ''}${donation.chequeNumber ? ` [Cheque #${donation.chequeNumber}]` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Operator'}
      payeeLabel="Payee's Signature"
    />
  );
}

export const Donations = () => {
  const { donations, fetchDonations, approveDonation, deleteDonation, bulkDeleteDonations } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [approveId, setApproveId] = useState(null);
  const [printDonation, setPrintDonation] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
  }, [fetchDonations, fetchAccountsList]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return donations.filter(d => 
      (d.donorName || '').toLowerCase().includes(search.toLowerCase()) || 
      (d.donorMobile || '').includes(search) || 
      (d.donationType || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.paymentMethod || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [donations, search]);

  const handleApprove = async (id) => {
    try {
      await approveDonation(id);
      showToast('Donation posted to ledger successfully', 'success');
      setApproveId(null);
    } catch (e) {
      showToast(e.message || 'Failed to post donation', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDonation(id);
      showToast('Donation deleted successfully', 'success');
      setDeleteId(null);
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (e) {
      showToast(e.message || 'Failed to delete donation', 'error');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await bulkDeleteDonations(selectedIds);
      if (res.success) {
        showToast(`${selectedIds.length} donation(s) deleted successfully`, 'success');
        setSelectedIds([]);
      } else {
        showToast(res.error || 'Failed to bulk delete donations', 'error');
      }
      setShowBulkConfirm(false);
    } catch (e) {
      showToast(e.message || 'Failed to bulk delete donations', 'error');
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

  return (
    <div className="space-y-6 pb-10">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Donations Given (Disbursements)</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">
                Welfare Outflow
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Manage financial assistance and welfare aid disbursements for People We Help</p>
          </div>
        </div>

        <div className={pageActionsClass}>
          {canEditOrDelete && selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-xs font-bold flex-1 sm:flex-none mr-2 shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          <button onClick={() => navigate('/donations/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all flex-1 sm:flex-none cursor-pointer active:scale-95">
            <Plus className="h-4 w-4 stroke-[2.5]" /> <span>Log Aid Disbursement</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search donations by donor, mobile, or type..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-slate-400 px-2">
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> {filtered.length === 1 ? 'donation' : 'donations'}</span>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={search ? 'No donations found' : 'No donations recorded yet'}
            description={search ? `We couldn't find any results matching "${search}". Try adjusting your search term or clearing the filter.` : 'Start by recording your first donation contribution to generate voucher slips and accounting entries.'}
            actionLabel={!search ? 'Log First Donation' : undefined}
            onAction={!search ? () => navigate('/donations/new') : undefined}
          />
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {canEditOrDelete && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(d.id)}
                          onChange={(e) => handleSelectOne(d.id, e)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base shadow-inner shrink-0">
                        {d.donorName ? d.donorName.charAt(0).toUpperCase() : <Heart className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm sm:text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight truncate">
                          {d.donorName || 'Unnamed Donor'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                          {d.donorMobile ? (
                            <>
                              <Phone className="w-3 h-3 text-amber-400/80 shrink-0" /> <span className="truncate">{d.donorMobile}</span>
                            </>
                          ) : 'Welfare Aid Recipient'}
                        </p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide shrink-0 whitespace-nowrap ${
                      d.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {d.status === 'APPROVED' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 shrink-0" /> POSTED
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 shrink-0" /> PENDING POST
                        </>
                      )}
                    </span>
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-amber-400" /> AMOUNT
                      </span>
                      <span className="font-bold text-amber-400 text-sm">
                        PKR {(d.amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-amber-400" /> AID TYPE
                      </span>
                      <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60">
                        {d.donationType || 'GENERAL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> METHOD
                      </span>
                      <span className="font-semibold text-slate-100 text-xs">
                        {d.paymentMethod || 'CASH'}
                        {d.chequeNumber && <span className="text-slate-400 font-normal ml-1">#{d.chequeNumber}</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '7/7/2026'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintDonation(d)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Print Voucher Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {d.status === 'PENDING' && canPostToLedger && (
                      <button
                        type="button"
                        onClick={() => setApproveId(d.id)}
                        className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                        title="Post to Ledger"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Post
                      </button>
                    )}
                    {canEditOrDelete && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/donations/edit/${d.id}`)}
                          className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Edit Aid Disbursement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(d.id)}
                          className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                          title="Delete Disbursement"
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

      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApproveId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-emerald-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Post to Ledger</h4>
            <p className="text-xs text-slate-400 mb-4">This will generate a Journal Entry and update Ledger balances automatically. Proceed?</p>
            <div className="flex gap-3">
              <button onClick={() => setApproveId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold cursor-pointer">Cancel</button>
              <button onClick={() => handleApprove(approveId)} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">Post to Ledger</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" /> Confirm Deletion
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete this donation record? If this donation has already been posted to the ledger, its corresponding journal entry will be automatically reversed.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" /> Bulk Delete Donations
            </h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete <span className="font-bold text-slate-200">{selectedIds.length}</span> selected donation records? Posted entries will be automatically reversed.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowBulkConfirm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={handleBulkDelete} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer">
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}



      {printDonation && (
        <DonationInvoiceModal
          donation={printDonation}
          onClose={() => setPrintDonation(null)}
        />
      )}
    </div>
  );
};

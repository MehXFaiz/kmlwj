import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { Heart, Search, Plus, Edit2, Trash2, CheckCircle2, X, AlertTriangle, Printer, Phone, CreditCard, Banknote, Calendar, MapPin, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { resolveVoucherRecipientDetails } from '../utils/voucherRecipientResolver';
import { EmptyState } from '../components/ui/EmptyState';
import { DONATION_TYPES, donationTypeDisplay } from '../constants/donationTypes';
import { paymentMethodLabel } from '../constants/paymentMethods';

// Replace null DB values with '' so controlled inputs stay controlled
const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_DONATION = { donorName: '', donorMobile: '', donationType: 'ZAKAT', amount: '', paymentMethod: 'BANK', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '', customDonationType: '', date: new Date().toISOString().split('T')[0] };

function DonationModal({ isOpen, onClose, onSave, initial, accounts }) {
  const [form, setForm] = useState(
    initial ? nullsToEmpty(initial) : DEFAULT_DONATION
  );

  const bankAccounts = useMemo(() => {
    return (accounts || []).filter(a => {
      if (a.isLocked || a.isDeleted) return false;
      const nameLower = (a.name || a.accountName || '').toLowerCase();
      const detailLower = (a.detailType || '').toLowerCase();
      if (detailLower === 'bank') return true;
      if (a.code === '1010101' || a.code === '1010102' || a.glCode === '1010101' || a.glCode === '1010102') return true;
      if (nameLower.includes('bank') || nameLower.includes('nbp') || nameLower.includes('mcb') || nameLower.includes('hbl') || nameLower.includes('ubl') || nameLower.includes('habib') || nameLower.includes('allied') || nameLower.includes('faysal') || nameLower.includes('alfalah') || nameLower.includes('meezan') || nameLower.includes('soneri') || nameLower.includes('askari') || nameLower.includes('js bank') || nameLower.includes('bop') || nameLower.includes('dubai islamic')) {
        return true;
      }
      return false;
    });
  }, [accounts]);

  useEffect(() => {
    if (isOpen) {
      const baseForm = initial ? nullsToEmpty({
        ...initial,
        date: initial.createdAt ? new Date(initial.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }) : {
        ...DEFAULT_DONATION,
        bankAccountId: bankAccounts[0]?.id || ''
      };
      setForm(baseForm);
    }
  }, [isOpen, initial, bankAccounts]);

  useEffect(() => {
    if (!initial && (form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && !form.bankAccountId && bankAccounts.length > 0) {
      setForm(f => ({ ...f, bankAccountId: bankAccounts[0].id }));
    }
  }, [initial, form.paymentMethod, form.bankAccountId, bankAccounts]);

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
    if (form.donationType === 'CUSTOM' && !form.customDonationType?.trim()) {
      showToast('Custom Donation / Aid Type is required when "Custom" is selected.', 'warning');
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
              <p className="text-[11px] text-slate-500">Log a charitable disbursement</p>
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
                    <span className="text-xs font-semibold text-slate-300">Tracks Donation Outflow</span>
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
                  <h4 className="text-sm font-semibold text-slate-200">Recipient & Amount</h4>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Recipient / Person Name *</label>
                    <input type="text" value={form.donorName} onChange={e => setForm(f => ({ ...f, donorName: e.target.value }))}
                      placeholder="E.g. Muhammad Ali" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Recipient Mobile</label>
                    <input type="text" value={form.donorMobile} onChange={e => setForm(f => ({ ...f, donorMobile: e.target.value }))}
                      placeholder="E.g. 0300-1234567" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Donation / Aid Type *</label>
                    <select
                      value={form.donationType}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => ({ ...f, donationType: val, customDonationType: val !== 'CUSTOM' ? '' : f.customDonationType }));
                      }}
                      className={inputClass}>
                      {DONATION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {form.donationType === 'CUSTOM' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          required
                          value={form.customDonationType || ''}
                          onChange={e => setForm(f => ({ ...f, customDonationType: e.target.value }))}
                          placeholder="Enter Donation / Aid Type"
                          className={`${inputClass} border-amber-500/50`}
                        />
                        <p className="text-[11px] text-slate-500 mt-1">e.g. Water Filter Assistance</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Amount (PKR) *</label>
                    <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="10000" className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Donation Date *</label>
                    <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Card 02: Payment */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                  <h4 className="text-sm font-semibold text-slate-200">Payment & Bank Source</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Payment Method *</label>
                    <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))} className={inputClass}>
                      {['BANK', 'CASH', 'CHEQUE'].map(t => (
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
                          {bankAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.accountName || a.name} {a.glCode || a.code ? `(${a.glCode || a.code})` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>{form.paymentMethod === 'CHEQUE' ? 'Cheque Number *' : 'Reference / Slip Number'}</label>
                        <input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))}
                          placeholder={form.paymentMethod === 'CHEQUE' ? 'CHQ-001' : 'REF-001'} className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* Accounting Impact Preview */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                    <div className="font-semibold text-slate-400">GL Accounting Entry:</div>
                    <div className="flex items-center justify-between text-emerald-400 font-mono">
                      <span>DR: Donation Expense</span>
                      <span>Rs {Number(form.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-blue-400 font-mono">
                      <span>CR: {form.paymentMethod === 'CASH' ? 'Cash in Hand (1010103)' : (bankAccounts.find(a => a.id === form.bankAccountId)?.accountName || bankAccounts.find(a => a.id === form.bankAccountId)?.name || 'Selected Bank Account')}</span>
                      <span>Rs {Number(form.amount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                    <div>
                      <label className={labelClass}>Donor Bank (Pakistani Banks)</label>
                      <select value={form.donorBankName} onChange={e => setForm(f => ({ ...f, donorBankName: e.target.value }))} className={inputClass}>
                        <option value="">Select Bank (Optional)</option>
                        {['National Bank of Pakistan (NBP)', 'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank Limited (ABL)', 'Bank Alfalah', 'Standard Chartered Bank', 'Askari Bank', 'Bank AL Habib', 'Faysal Bank', 'Soneri Bank', 'Bank of Punjab (BOP)', 'JS Bank', 'Dubai Islamic Bank', 'Al Baraka Bank', 'Bank Islami', 'Sindh Bank', 'Habib Metropolitan Bank', 'First Women Bank', 'Samba Bank', 'Silkbank', 'Summit Bank'].map(b => (
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

  const rec = resolveVoucherRecipientDetails(donation);

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title="DONATION VOUCHER"
      voucherNo={donation.id?.slice(0, 8)?.toUpperCase()}
      fileNo={donationTypeDisplay(donation.donationType, donation.customDonationType)}
      date={donation.createdAt}
      name={rec.name !== '-' ? rec.name : ''}
      fatherName={rec.fatherName !== '-' ? rec.fatherName : ''}
      cnic={rec.cnic !== '-' ? rec.cnic : ''}
      mobile={rec.mobile !== '-' ? rec.mobile : ''}
      address={rec.address !== '-' ? rec.address : ''}
      gham={rec.gham !== '-' ? rec.gham : ''}
      paymentMethod={donation.paymentMethod}
      accountName="Donation Disbursement A/c"
      particulars={`Donation Given / Disbursement - ${donationTypeDisplay(donation.donationType, donation.customDonationType)}${donation.remarks ? ` (${donation.remarks})` : ''}${donation.chequeNumber ? ` [Cheque #${donation.chequeNumber}]` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Operator'}
      payeeLabel="Payee's Signature"
    />
  );
}

const DEFAULT_FILTERS = {
  aidType: 'ALL',
  paymentMethod: 'ALL',
  postingStatus: 'ALL',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  beneficiary: '',
  sortBy: 'LATEST',
  quickFilter: '',
};

export const Donations = () => {
  const { donations, fetchDonations, approveDonation, deleteDonation, bulkDeleteDonations } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('donations', 'create');
  const canEdit = hasPermission('donations', 'update');
  const canDelete = hasPermission('donations', 'delete');
  const canPost = hasPermission('donations', 'post');
  const canPrint = hasPermission('donations', 'print');
  const navigate = useNavigate();


  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [approveId, setApproveId] = useState(null);
  const [printDonation, setPrintDonation] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
  }, [fetchDonations, fetchAccountsList]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) setSearch(q);
    const aidTypeParam = searchParams.get('aidType');
    if (aidTypeParam) {
      setFilters(f => ({ ...f, aidType: aidTypeParam }));
    }
  }, [searchParams]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value, quickFilter: key === 'quickFilter' ? value : (key === 'dateFrom' || key === 'dateTo' ? '' : f.quickFilter) }));

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.aidType !== 'ALL') count++;
    if (filters.paymentMethod !== 'ALL') count++;
    if (filters.postingStatus !== 'ALL') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.amountMin) count++;
    if (filters.amountMax) count++;
    if (filters.beneficiary) count++;
    if (filters.quickFilter) count++;
    if (search) count++;
    return count;
  }, [filters, search]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOf = (unit) => {
      const d = new Date(now);
      if (unit === 'day') { d.setHours(0,0,0,0); }
      else if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); }
      else if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
      else if (unit === 'year') { d.setMonth(0,1); d.setHours(0,0,0,0); }
      return d;
    };

    let result = donations.filter(d => {
      const q = search.toLowerCase().trim();
      if (q) {
        const beneficiaryName = (d.beneficiary?.name || d.donorName || '').toLowerCase();
        const fatherName = (d.beneficiary?.fatherName || d.beneficiary?.husbandName || '').toLowerCase();
        const mobile = (d.donorMobile || d.beneficiary?.mobile || '').toLowerCase();
        const cnic = (d.donorCnic || d.beneficiary?.cnic || d.cnic || '').toLowerCase();
        const donationType = (d.donationType || '').toLowerCase();
        const customType = (d.customDonationType || '').toLowerCase();
        const paymentMethod = (d.paymentMethod || '').toLowerCase();
        const voucherNo = (d.voucherNo || d.receiptNo || d.id || '').toLowerCase();
        const chequeNo = (d.chequeNumber || '').toLowerCase();
        const notes = (d.description || d.notes || '').toLowerCase();
        const gham = (d.beneficiary?.gham || d.beneficiary?.area || '').toLowerCase();
        const amountStr = String(d.amount || '');

        const matches =
          beneficiaryName.includes(q) ||
          fatherName.includes(q) ||
          mobile.includes(q) ||
          cnic.includes(q) ||
          donationType.includes(q) ||
          customType.includes(q) ||
          paymentMethod.includes(q) ||
          voucherNo.includes(q) ||
          chequeNo.includes(q) ||
          notes.includes(q) ||
          gham.includes(q) ||
          amountStr.includes(q);

        if (!matches) return false;
      }

      if (filters.beneficiary) {
        const bq = filters.beneficiary.toLowerCase().trim();
        const bName = (d.beneficiary?.name || d.donorName || '').toLowerCase();
        const bFather = (d.beneficiary?.fatherName || d.beneficiary?.husbandName || '').toLowerCase();
        const bCnic = (d.beneficiary?.cnic || d.donorCnic || d.cnic || '').toLowerCase();
        const bMobile = (d.beneficiary?.mobile || d.donorMobile || '').toLowerCase();
        if (!bName.includes(bq) && !bFather.includes(bq) && !bCnic.includes(bq) && !bMobile.includes(bq)) {
          return false;
        }
      }

      if (filters.aidType !== 'ALL' && (d.donationType || '') !== filters.aidType) return false;

      if (filters.paymentMethod !== 'ALL' && (d.paymentMethod || '') !== filters.paymentMethod) return false;

      if (filters.postingStatus !== 'ALL') {
        const statusMap = { POSTED: 'APPROVED', PENDING: 'PENDING', DRAFT: 'DRAFT' };
        if ((d.status || '') !== (statusMap[filters.postingStatus] || filters.postingStatus)) return false;
      }

      const createdAt = d.createdAt ? new Date(d.createdAt) : null;
      if (filters.quickFilter && createdAt) {
        const unitMap = { TODAY: 'day', THIS_WEEK: 'week', THIS_MONTH: 'month', THIS_YEAR: 'year' };
        const start = startOf(unitMap[filters.quickFilter]);
        if (createdAt < start || createdAt > now) return false;
      } else {
        if (filters.dateFrom && createdAt && createdAt < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && createdAt) {
          const to = new Date(filters.dateTo); to.setHours(23,59,59,999);
          if (createdAt > to) return false;
        }
      }

      const amt = parseFloat(d.amount) || 0;
      if (filters.amountMin && amt < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && amt > parseFloat(filters.amountMax)) return false;

      return true;
    });

    result = [...result].sort((a, b) => {
      switch (filters.sortBy) {
        case 'OLDEST': return new Date(a.createdAt) - new Date(b.createdAt);
        case 'HIGHEST': return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        case 'LOWEST': return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        case 'NAME_AZ': return (a.donorName || '').localeCompare(b.donorName || '');
        case 'NAME_ZA': return (b.donorName || '').localeCompare(a.donorName || '');
        default: return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return result;
  }, [donations, search, filters]);

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
      handleDeleteError(e, 'Failed to delete donation');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await bulkDeleteDonations(selectedIds);
      if (res?.success) {
        showToast(`${selectedIds.length} donation(s) deleted successfully`, 'success');
        setSelectedIds([]);
      } else {
        const isForbidden = res?.error?.includes('403') || res?.error?.includes('Restricted') || res?.error?.includes('permission');
        showToast(isForbidden ? 'You do not have permission to delete this record.' : (res?.error || 'Failed to bulk delete donations'), 'error');
      }
    } catch (e) {
      handleDeleteError(e, 'Failed to bulk delete donations');
    } finally {
      setShowBulkConfirm(false);
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
          {canDelete && selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-xs font-bold flex-1 sm:flex-none mr-2 shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          {canCreate && (
            <button onClick={() => navigate('/donations/new')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all flex-1 sm:flex-none cursor-pointer active:scale-95">
              <Plus className="h-4 w-4 stroke-[2.5]" /> <span>Log Aid Disbursement</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden">
        {/* Top bar: search + filters toggle */}
        <div className="p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500/80" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Beneficiary Name, CNIC, Mobile, Voucher #, Aid Type, Amount..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${filtersOpen ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm' : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Advanced Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold leading-none">{activeFilterCount}</span>
              )}
              {filtersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            <span className="ml-auto sm:ml-0 text-xs font-semibold text-slate-400 whitespace-nowrap px-2 py-1 bg-slate-950/60 border border-slate-800 rounded-lg">
              <strong className="text-amber-400">{filtered.length}</strong> {filtered.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Quick Aid Type Filter Tags */}
        <div className="px-3.5 pb-3 flex items-center gap-1.5 overflow-x-auto text-xs border-t border-slate-800/40 pt-2.5 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 uppercase mr-1 flex items-center gap-1 shrink-0">
            Quick:
          </span>
          {[
            { label: 'All Aid', value: 'ALL' },
            { label: 'Monthly Aid', value: 'MONTHLY' },
            { label: 'Zakat Aid', value: 'ZAKAT' },
            { label: 'General Aid', value: 'GENERAL_DONATION' },
            { label: 'Sadqah', value: 'SADQAH' },
            { label: 'Medical', value: 'MEDICAL' },
            { label: 'Education', value: 'EDUCATION' },
            { label: 'Ration', value: 'RATION' },
          ].map(tag => {
            const isSelected = filters.aidType === tag.value;
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => setFilter('aidType', isSelected && tag.value !== 'ALL' ? 'ALL' : tag.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="border-t border-slate-800/80 p-4 space-y-4">
            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today', value: 'TODAY' },
                { label: 'This Week', value: 'THIS_WEEK' },
                { label: 'This Month', value: 'THIS_MONTH' },
                { label: 'This Year', value: 'THIS_YEAR' },
              ].map(q => (
                <button
                  key={q.value}
                  onClick={() => setFilter('quickFilter', filters.quickFilter === q.value ? '' : q.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${filters.quickFilter === q.value ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {/* Aid Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Aid Type</label>
                <select
                  value={filters.aidType}
                  onChange={e => setFilter('aidType', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                >
                  <option value="ALL">All Types</option>
                  {DONATION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment Method</label>
                <select
                  value={filters.paymentMethod}
                  onChange={e => setFilter('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                >
                  <option value="ALL">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              {/* Posting Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Posting Status</label>
                <select
                  value={filters.postingStatus}
                  onChange={e => setFilter('postingStatus', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="POSTED">Posted</option>
                  <option value="PENDING">Pending</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={e => setFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                >
                  <option value="LATEST">Latest First</option>
                  <option value="OLDEST">Oldest First</option>
                  <option value="HIGHEST">Highest Amount</option>
                  <option value="LOWEST">Lowest Amount</option>
                  <option value="NAME_AZ">Name (A–Z)</option>
                  <option value="NAME_ZA">Name (Z–A)</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilter('dateFrom', e.target.value)}
                  disabled={!!filters.quickFilter}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilter('dateTo', e.target.value)}
                  disabled={!!filters.quickFilter}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Min Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={filters.amountMin}
                  onChange={e => setFilter('amountMin', e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={filters.amountMax}
                  onChange={e => setFilter('amountMax', e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                />
              </div>
            </div>

            {/* Beneficiary search – full width */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Beneficiary</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={filters.beneficiary}
                  onChange={e => setFilter('beneficiary', e.target.value)}
                  placeholder="Search by Name, CNIC, Mobile, or Membership ID…"
                  className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={activeFilterCount > 0 ? 'No donations match your filters' : 'No donations recorded yet'}
            description={activeFilterCount > 0 ? 'Try adjusting or resetting your filters to see more results.' : 'Start by recording your first donation contribution to generate voucher slips and accounting entries.'}
            actionLabel={activeFilterCount > 0 ? 'Reset Filters' : 'Log First Donation'}
            onAction={activeFilterCount > 0 ? resetFilters : () => navigate('/donations/new')}
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
                      {canDelete && (
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
                        {donationTypeDisplay(d.donationType, d.customDonationType) || 'GENERAL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> METHOD
                      </span>
                      <span className="font-semibold text-slate-100 text-xs">
                        {paymentMethodLabel(d.paymentMethod)}
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
                    {d.status === 'PENDING' && canPost && (
                      <button
                        type="button"
                        onClick={() => setApproveId(d.id)}
                        className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                        title="Post to Ledger"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Post
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => navigate(`/donations/edit/${d.id}`)}
                        className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Edit Aid Disbursement"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

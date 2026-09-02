import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import {
  Heart, ChevronLeft, Save, ShieldCheck, CheckCircle2,
  Users, UserCheck, Sparkles, AlertCircle, Plus, Trash2,
  Building, Calendar, Banknote, FileText, AlertTriangle, Loader2
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getMonthLabel(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yyyyMm)) {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  const [y, m] = yyyyMm.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const getCurrentYyyyMm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const DonationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { donations, fetchDonations, addDonation, updateDonation, checkDuplicate } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  const [donationType, setDonationType] = useState('DONATION'); // 'DONATION' | 'ZAKAT'
  const [disbursementMonth, setDisbursementMonth] = useState(getCurrentYyyyMm());
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [referenceNo, setReferenceNo] = useState('');

  // Beneficiary distribution mode
  const [beneficiaryMode, setBeneficiaryMode] = useState('none'); // 'none' | 'single' | 'multiple'
  const [singleBeneficiaryId, setSingleBeneficiaryId] = useState('');
  const [multiBeneficiaries, setMultiBeneficiaries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState(null);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
    fetchBeneficiaries();
  }, [fetchDonations, fetchAccountsList, fetchBeneficiaries]);

  // Filter valid active bank accounts from Chart of Accounts
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => {
      if (a.isLocked || a.isDeleted) return false;
      const nameLower = (a.name || a.accountName || '').toLowerCase();
      const detailLower = (a.detailType || '').toLowerCase();
      if (detailLower === 'bank') return true;
      if (a.code === '1010101' || a.code === '1010102' || a.glCode === '1010101' || a.glCode === '1010102') return true;
      if (
        nameLower.includes('bank') || nameLower.includes('nbp') || nameLower.includes('mcb') ||
        nameLower.includes('hbl') || nameLower.includes('ubl') || nameLower.includes('habib') ||
        nameLower.includes('allied') || nameLower.includes('faysal') || nameLower.includes('alfalah') ||
        nameLower.includes('meezan') || nameLower.includes('soneri') || nameLower.includes('askari') ||
        nameLower.includes('js bank') || nameLower.includes('bop') || nameLower.includes('dubai islamic')
      ) {
        return true;
      }
      return false;
    });
  }, [flatAccounts]);

  // Auto-select first bank account if none selected
  useEffect(() => {
    if (!id && !bankAccountId && bankAccounts.length > 0) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [id, bankAccountId, bankAccounts]);

  // Load existing donation when in edit mode
  useEffect(() => {
    if (id && donations.length > 0) {
      const existing = donations.find(d => d.id === id);
      if (existing) {
        const isZakat = String(existing.donationType).toUpperCase().includes('ZAKAT');
        setDonationType(isZakat ? 'ZAKAT' : 'DONATION');
        if (existing.disbursementMonth) {
          setDisbursementMonth(existing.disbursementMonth);
        } else if (existing.createdAt) {
          const d = new Date(existing.createdAt);
          setDisbursementMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        setAmount(String(existing.amount || ''));
        setBankAccountId(existing.bankAccountId || '');
        setRemarks(existing.remarks || '');
        setReferenceNo(existing.voucherNo || existing.chequeNumber || '');

        if (Array.isArray(existing.beneficiaries) && existing.beneficiaries.length > 0) {
          setBeneficiaryMode('multiple');
          setMultiBeneficiaries(existing.beneficiaries);
        } else if (existing.beneficiaryId) {
          setBeneficiaryMode('single');
          setSingleBeneficiaryId(existing.beneficiaryId);
        } else {
          setBeneficiaryMode('none');
        }
      }
    }
  }, [id, donations]);

  // Selected Bank details
  const selectedBank = useMemo(() => {
    return bankAccounts.find(a => a.id === bankAccountId) || null;
  }, [bankAccounts, bankAccountId]);

  // Selected single beneficiary details
  const selectedBeneficiary = useMemo(() => {
    if (!singleBeneficiaryId) return null;
    return beneficiaries.find(b => b.id === singleBeneficiaryId) || null;
  }, [singleBeneficiaryId, beneficiaries]);

  // Multi-beneficiary total calculation
  const multiBeneficiariesTotal = useMemo(() => {
    return multiBeneficiaries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [multiBeneficiaries]);

  // Live Server & Local Duplicate Check
  const verifyDuplicate = useCallback(async () => {
    if (!disbursementMonth || !bankAccountId) {
      setDuplicateMessage(null);
      return;
    }

    const monthLabel = getMonthLabel(disbursementMonth);
    const displayType = donationType === 'ZAKAT' ? 'Zakat' : 'donation';

    // 1. Check local store records
    const localDuplicate = donations.find(d => {
      if (d.id === id || d.isDeleted) return false;
      if (d.status !== 'APPROVED' && d.status !== 'POSTED') return false;
      if (d.bankAccountId !== bankAccountId) return false;
      const isZakat = String(d.donationType).toUpperCase().includes('ZAKAT');
      if (donationType === 'ZAKAT' && !isZakat) return false;
      if (donationType === 'DONATION' && isZakat) return false;

      let recordMonth = d.disbursementMonth;
      if (!recordMonth && d.createdAt) {
        const cd = new Date(d.createdAt);
        recordMonth = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`;
      }
      return recordMonth === disbursementMonth;
    });

    if (localDuplicate) {
      setDuplicateMessage(`Monthly ${displayType} for ${monthLabel} has already been posted for this bank account.`);
      return;
    }

    // 2. Query server for remote verification
    setCheckingDuplicate(true);
    try {
      const res = await checkDuplicate(disbursementMonth, donationType, bankAccountId);
      if (res?.isDuplicate && res.data?.id !== id) {
        setDuplicateMessage(res.message || `Monthly ${displayType} for ${monthLabel} has already been posted for this bank account.`);
      } else {
        setDuplicateMessage(null);
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setCheckingDuplicate(false);
    }
  }, [disbursementMonth, donationType, bankAccountId, donations, id, checkDuplicate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      verifyDuplicate();
    }, 200);
    return () => clearTimeout(timer);
  }, [verifyDuplicate]);

  // Quick Amount setter
  const handleQuickAmount = (val) => {
    setAmount(String(val));
  };

  // Add Beneficiary row in multi-mode
  const handleAddBeneficiaryRow = () => {
    setMultiBeneficiaries(prev => [
      ...prev,
      { id: '', name: '', cnic: '', amount: '', remarks: '' }
    ]);
  };

  const handleUpdateBeneficiaryRow = (index, field, value) => {
    setMultiBeneficiaries(prev => {
      const updated = [...prev];
      if (field === 'beneficiaryId') {
        const b = beneficiaries.find(item => item.id === value);
        if (b) {
          updated[index] = {
            ...updated[index],
            id: b.id,
            name: b.name,
            cnic: b.cnic || '',
            mobile: b.mobile || ''
          };
        } else {
          updated[index] = { ...updated[index], id: '', name: value };
        }
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleRemoveBeneficiaryRow = (index) => {
    setMultiBeneficiaries(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-sync total amount from multi-beneficiary allocation
  const handleSyncAmountFromMulti = () => {
    if (multiBeneficiariesTotal > 0) {
      setAmount(String(multiBeneficiariesTotal));
      showToast(`Total amount updated to Rs. ${multiBeneficiariesTotal.toLocaleString()}`, 'info');
    }
  };

  const selectedBank = useMemo(() => {
    if (!form.bankAccountId) return null;
    return bankAccounts.find(a => a.id === form.bankAccountId) || null;
  }, [form.bankAccountId, bankAccounts]);

  const bankBalance = selectedBank ? (selectedBank.currentBalance ?? selectedBank.balance ?? 0) : 0;
  const numAmount = Number(form.amount || 0);
  const isInsufficient = (form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && numAmount > 0 && numAmount > bankBalance;

  const handleSave = async (e) => {
    e.preventDefault();

    if (!disbursementMonth) {
      showToast('Please select a disbursement month.', 'warning');
      return;
    }
<<<<<<< HEAD
    if (!amount || Number(amount) <= 0) {
      showToast('Please enter a valid disbursement amount greater than 0.', 'warning');
      return;
=======
    if (!/^[a-zA-Z\s.]{3,50}$/.test(form.donorName)) {
      showToast('Recipient / Beneficiary Name must contain only letters, spaces and dots (3-50 characters).', 'warning'); return;
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
    }
    if (!bankAccountId) {
      showToast('Please select a bank account to disburse funds from.', 'warning');
      return;
    }

    if (duplicateMessage) {
      showToast(duplicateMessage, 'error');
      return;
    }
<<<<<<< HEAD

    // Beneficiary checks
    let payloadBeneficiaries = null;
    let payloadBeneficiaryId = null;

    if (beneficiaryMode === 'single' && singleBeneficiaryId) {
      payloadBeneficiaryId = singleBeneficiaryId;
    } else if (beneficiaryMode === 'multiple' && multiBeneficiaries.length > 0) {
      if (Math.abs(multiBeneficiariesTotal - Number(amount)) > 1) {
        showToast(
          `The sum of beneficiary allocations (Rs. ${multiBeneficiariesTotal.toLocaleString()}) does not match the total disbursement amount (Rs. ${Number(amount).toLocaleString()}).`,
          'warning'
        );
        return;
      }
      payloadBeneficiaries = multiBeneficiaries.filter(b => b.name && Number(b.amount) > 0);
=======
    if (Number(form.amount) > 100000000) {
      showToast('Amount cannot exceed 100,000,000.', 'warning'); return;
    }
    if (form.donationType === 'MONTHLY' && form.paymentMethod === 'CASH') {
      showToast('Monthly donation disbursements must be paid from a Bank Account.', 'warning'); return;
    }
    if ((form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && !form.bankAccountId) {
      showToast('Bank Account is required.', 'warning'); return;
    }
    if (isInsufficient) {
      showToast(`Insufficient Bank Balance. Available: Rs ${bankBalance.toLocaleString()}, Required: Rs ${numAmount.toLocaleString()}`, 'error'); return;
    }
    if (form.paymentMethod === 'CHEQUE' && !form.chequeNumber) {
      showToast('Cheque number is required.', 'warning'); return;
    }
    if (form.paymentMethod === 'CHEQUE' && form.chequeNumber && !/^[0-9]{6,20}$/.test(form.chequeNumber)) {
      showToast('Cheque number must be between 6 and 20 digits.', 'warning'); return;
    }
    if (form.donationType === 'CUSTOM' && !form.customDonationType?.trim()) {
      showToast('Custom Donation / Aid Type is required when "Custom" is selected.', 'warning'); return;
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
    }

    const monthLabel = getMonthLabel(disbursementMonth);
    const displayCategory = donationType === 'ZAKAT' ? 'Zakat' : 'Donation';

    const payload = {
      month: monthLabel,
      disbursementMonth,
      donationType,
      amount: Number(amount),
      paymentMethod: 'BANK',
      bankAccountId,
      beneficiaryId: payloadBeneficiaryId,
      beneficiaries: payloadBeneficiaries,
      remarks: remarks ? remarks.trim() : null,
      chequeNumber: referenceNo ? referenceNo.trim() : null,
      status: 'APPROVED'
    };

    setLoading(true);
    try {
      if (id) {
<<<<<<< HEAD
        await updateDonation(id, payload);
        showToast(`${monthLabel} monthly ${displayCategory} updated successfully!`, 'success');
      } else {
        const res = await addDonation(payload);
        showToast(
          res?.message || `${monthLabel} monthly ${displayCategory} of Rs. ${Number(amount).toLocaleString()} posted successfully.`,
          'success'
        );
=======
        await updateDonation(id, form);
        showToast('Disbursement updated successfully!', 'success');
      } else {
        await addDonation(form);
        showToast('Monthly Aid / Disbursement logged successfully!', 'success');
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
      }
      setTimeout(() => navigate('/donations'), 1000);
    } catch (err) {
      const errMsg = err?.response?.data?.error?.message || err.message || 'Failed to post monthly donation';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5';

  const monthLabel = getMonthLabel(disbursementMonth);
  const displayCategory = donationType === 'ZAKAT' ? 'Zakat' : 'Donation';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/donations"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              {id ? 'Edit Monthly Disbursement' : 'Monthly Donation / Aid Disbursement'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute monthly welfare disbursements with automatic bank deduction and duplicate prevention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{monthLabel}</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Form Controls */}
          <div className="lg:col-span-8 space-y-6">

            {/* Duplicate Prevention Alert Banner */}
            {duplicateMessage && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-start gap-3.5 text-red-300 shadow-xl animate-in fade-in duration-200">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-red-200">Duplicate Monthly Posting Prevented</h4>
                  <p className="text-xs text-red-300/90 mt-1 leading-relaxed">{duplicateMessage}</p>
                  <p className="text-[11px] text-red-400/80 mt-1 font-medium">
                    The system prevents double bank deduction for the same month, category, and bank account. Choose another month or bank account.
                  </p>
                </div>
              </div>
            )}

            {/* Card 01: Category & Period */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center">01</span>
                  <h3 className="text-sm font-bold text-slate-200">Disbursement Category & Monthly Period</h3>
                </div>
                {checkingDuplicate && (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking monthly duplicate...
                  </span>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* 1. Donation / Aid Type Toggle */}
                <div>
                  <label className={labelClass}>1. Donation / Aid Type *</label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setDonationType('DONATION')}
                      className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                        donationType === 'DONATION'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      <span>General / Monthly Donation</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDonationType('ZAKAT')}
                      className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                        donationType === 'ZAKAT'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Zakat Disbursement</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Donation and Zakat are maintained as separate categories with independent monthly tracking and GL heads.
                  </p>
                </div>

                {/* 2. Month Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className={labelClass}>2. Disbursement Month *</label>
                    <input
                      type="month"
                      required
                      value={disbursementMonth}
                      onChange={(e) => setDisbursementMonth(e.target.value)}
                      className={`${inputClass} text-base font-bold text-amber-400 cursor-pointer`}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Active Period: <strong className="text-slate-300">{monthLabel}</strong>
                    </p>
                  </div>

                  {/* 3. Donation Amount */}
                  <div>
                    <label className={labelClass}>3. Total Disbursement Amount (PKR) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">Rs</span>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        placeholder="100,000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${inputClass} pl-10 text-base font-extrabold font-mono text-slate-50`}
                      />
                    </div>
                    {/* Quick Amount Pills */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Quick:</span>
                      {[25000, 50000, 100000, 200000, 500000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleQuickAmount(val)}
                          className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700/60 transition-all cursor-pointer"
                        >
                          {(val / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 02: Bank Account (Single Bank Deduction) */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center">02</span>
                  <h3 className="text-sm font-bold text-slate-200">Bank Account (Single Deduction Source)</h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Deducted ONCE for Monthly Total
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div>
<<<<<<< HEAD
                  <label className={labelClass}>4. Selected Bank Account *</label>
                  <select
                    required
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className={`${inputClass} text-sm font-bold text-slate-100 cursor-pointer`}
                  >
                    <option value="">-- Select Bank Account --</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200 py-1">
                        {a.accountName || a.name} {a.glCode || a.code ? `(${a.glCode || a.code})` : ''} — Current Bal: Rs. {(a.currentBalance || 0).toLocaleString()}
                      </option>
                    ))}
=======
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelClass}>Payment Method *</label>
                    {form.donationType === 'MONTHLY' && (
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Bank Required for Monthly Aid
                      </span>
                    )}
                  </div>
                  <select
                    value={form.paymentMethod}
                    disabled={form.donationType === 'MONTHLY'}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))}
                    className={inputClass}
                  >
                    {form.donationType === 'MONTHLY' ? (
                      ['BANK', 'CHEQUE'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                    ) : (
                      ['BANK', 'CASH', 'CHEQUE'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                    )}
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
                  </select>
                </div>

                {selectedBank && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
<<<<<<< HEAD
                      <span className="text-[10px] font-bold text-slate-500 uppercase">GL Code</span>
                      <p className="text-xs font-mono font-bold text-amber-400 mt-0.5">{selectedBank.glCode || selectedBank.code || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Bank Name</span>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate">{selectedBank.accountName || selectedBank.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Current Ledger Balance</span>
                      <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                        Rs. {Number(selectedBank.currentBalance || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className={labelClass}>7. Reference / Voucher Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. CHQ-9901 or REF-01"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>6. Remarks / Narration (Optional)</label>
                    <input
                      type="text"
                      placeholder="Optional notes for this monthly disbursement..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 03: Beneficiaries Distribution (Optional) */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center">03</span>
                  <h3 className="text-sm font-bold text-slate-200">5. Beneficiaries & Distribution (Optional)</h3>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { key: 'none', label: 'Lump Sum' },
                    { key: 'single', label: 'Single Recipient' },
                    { key: 'multiple', label: 'Multi-Beneficiary Batch' }
                  ].map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setBeneficiaryMode(m.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        beneficiaryMode === m.key
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                {beneficiaryMode === 'none' && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-3">
                    <Building className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Recording as general monthly {displayCategory} fund disbursement without individual beneficiary attachments.
                    </span>
                  </div>
                )}

                {beneficiaryMode === 'single' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Select Recipient from People We Help</label>
                      <select
                        value={singleBeneficiaryId}
                        onChange={(e) => setSingleBeneficiaryId(e.target.value)}
                        className={`${inputClass} text-sm font-bold`}
                      >
                        <option value="">-- Choose Registered Beneficiary --</option>
                        {beneficiaries.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} {b.cnic ? `• CNIC: ${b.cnic}` : ''} {b.mobile ? `• Ph: ${b.mobile}` : ''} {b.gham ? `• Gham: ${b.gham}` : ''}
=======
                      <label className={labelClass}>Bank Account *</label>
                      <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                        className={inputClass}>
                        <option value="">Select Bank Account</option>
                        {bankAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name || a.accountName} {a.code ? `(${a.code})` : ''} • Bal: Rs {Number(a.currentBalance || 0).toLocaleString()}
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedBeneficiary && (
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-semibold">Name:</span>
                          <p className="text-slate-100 font-bold mt-0.5">{selectedBeneficiary.name}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">CNIC:</span>
                          <p className="text-slate-100 font-mono font-bold mt-0.5">{selectedBeneficiary.cnic || '—'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">Gham / Area:</span>
                          <p className="text-amber-300 font-semibold mt-0.5">{selectedBeneficiary.gham || selectedBeneficiary.area || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {beneficiaryMode === 'multiple' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Beneficiary Allocation Breakdown</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Bank is deducted once for the total. Allocate individual portions below.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBeneficiaryRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Beneficiary Row
                      </button>
                    </div>

                    {multiBeneficiaries.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl">
                        <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-semibold">No beneficiaries added yet</p>
                        <button
                          type="button"
                          onClick={handleAddBeneficiaryRow}
                          className="mt-2 text-xs font-bold text-amber-400 hover:underline"
                        >
                          + Click here to add the first beneficiary
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {multiBeneficiaries.map((row, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Beneficiary Name / Selection</label>
                              <select
                                value={row.id || ''}
                                onChange={(e) => handleUpdateBeneficiaryRow(idx, 'beneficiaryId', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Choose from List --</option>
                                {beneficiaries.map(b => (
                                  <option key={b.id} value={b.id}>{b.name} ({b.cnic || b.mobile || 'No CNIC'})</option>
                                ))}
                              </select>
                              {!row.id && (
                                <input
                                  type="text"
                                  placeholder="Or type custom recipient name..."
                                  value={row.name}
                                  onChange={(e) => handleUpdateBeneficiaryRow(idx, 'name', e.target.value)}
                                  className="w-full mt-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                                />
                              )}
                            </div>

                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Portion Amount (PKR)</label>
                              <input
                                type="number"
                                min="1"
                                placeholder="30,000"
                                value={row.amount}
                                onChange={(e) => handleUpdateBeneficiaryRow(idx, 'amount', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks</label>
                              <input
                                type="text"
                                placeholder="e.g. Ration"
                                value={row.remarks || ''}
                                onChange={(e) => handleUpdateBeneficiaryRow(idx, 'remarks', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                              />
                            </div>

                            <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                              <button
                                type="button"
                                onClick={() => handleRemoveBeneficiaryRow(idx)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Remove recipient"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Multi-beneficiary reconciliation summary */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 font-semibold">Allocated Total: </span>
                            <strong className="font-mono font-bold text-amber-400">Rs. {multiBeneficiariesTotal.toLocaleString()}</strong>
                            <span className="text-slate-500 ml-2">across {multiBeneficiaries.length} recipient(s)</span>
                          </div>
                          {Number(amount) > 0 && Math.abs(multiBeneficiariesTotal - Number(amount)) > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-red-400 font-semibold">
                                Difference: Rs. {Math.abs(multiBeneficiariesTotal - Number(amount)).toLocaleString()}
                              </span>
                              <button
                                type="button"
                                onClick={handleSyncAmountFromMulti}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-500/20"
                              >
                                Set Batch Total to Rs. {multiBeneficiariesTotal.toLocaleString()}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
<<<<<<< HEAD
=======

                {/* Live Bank Balance Status Banner */}
                {selectedBank && (form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                  <div>
                    {isInsufficient ? (
                      <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-3 shadow-inner">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                          <div className="font-bold text-rose-300">Insufficient Bank Balance!</div>
                          <div className="text-[11px] text-rose-300/90 mt-0.5">
                            Selected Bank ({selectedBank.name || selectedBank.accountName}) has <strong>Rs {bankBalance.toLocaleString()}</strong> available, but disbursement requires <strong>Rs {numAmount.toLocaleString()}</strong>.
                          </div>
                        </div>
                      </div>
                    ) : numAmount > 0 ? (
                      <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Bank Balance Verified: <strong>Rs {bankBalance.toLocaleString()}</strong> available in {selectedBank.name || selectedBank.accountName}</span>
                        </div>
                        <span className="text-[11px] text-emerald-400/90 font-mono bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                          Remaining: Rs {(bankBalance - numAmount).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                        <span>Selected Bank Available Balance:</span>
                        <strong className="text-amber-400 font-mono">Rs {bankBalance.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}

                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                  <div>
                    <label className={labelClass}>Recipient / Donor Bank (Pakistani Banks)</label>
                    <select value={form.donorBankName} onChange={e => setForm(f => ({ ...f, donorBankName: e.target.value }))}
                      className={inputClass}>
                      <option value="">Select Bank (Optional)</option>
                      {PAKISTANI_BANKS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Accounting Impact Preview */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-400">General Ledger Accounting Entry:</div>
                  <div className="flex items-center justify-between text-emerald-400 font-mono">
                    <span>DR: Donation Expense Account ({form.donationType || 'General'})</span>
                    <span>Rs {Number(form.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-blue-400 font-mono">
                    <span>CR: {form.paymentMethod === 'CASH' ? 'Cash in Hand (1010103)' : (bankAccounts.find(a => a.id === form.bankAccountId)?.name || bankAccounts.find(a => a.id === form.bankAccountId)?.accountName || 'Selected Bank Account')}</span>
                    <span>Rs {Number(form.amount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Remarks</label>
                  <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    className={`${inputClass} h-24 resize-none`} placeholder="Optional notes..." />
                </div>
>>>>>>> febbad100121eaf83047003e34ac7932fa78c2c9
              </div>
            </div>

          </div>

          {/* Right Column: Accounting Impact & Summary Panel */}
          <div className="lg:col-span-4 space-y-5">

            {/* Accounting Entry Preview Card */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Accounting Ledger Impact</h3>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  Upon posting, the General Ledger creates <strong>exactly ONE</strong> accounting transaction:
                </p>

                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 font-mono">
                  <div className="flex items-start justify-between gap-2 text-emerald-400">
                    <div>
                      <span className="font-bold">DEBIT:</span>
                      <p className="text-[11px] text-emerald-300/80 mt-0.5">
                        {donationType === 'ZAKAT' ? 'Zakat Expense A/c (4060104)' : 'Monthly Donation Expense (4060101)'}
                      </p>
                    </div>
                    <span className="font-bold text-sm">Rs. {Number(amount || 0).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 flex items-start justify-between gap-2 text-blue-400">
                    <div>
                      <span className="font-bold">CREDIT:</span>
                      <p className="text-[11px] text-blue-300/80 mt-0.5 truncate max-w-[170px]">
                        {selectedBank ? (selectedBank.accountName || selectedBank.name) : 'Selected Bank Account'}
                      </p>
                    </div>
                    <span className="font-bold text-sm">Rs. {Number(amount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-slate-400 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Strict Single Monthly Deduction</span>
                  </div>
                  <p>
                    Regardless of recipient count, the bank account is credited only once for the batch total. Duplicate monthly postings for this bank account are locked.
                  </p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Period:</span>
                  <strong className="text-slate-200">{monthLabel}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Category:</span>
                  <strong className={donationType === 'ZAKAT' ? 'text-emerald-400' : 'text-amber-400'}>
                    {displayCategory}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Bank Deduction:</span>
                  <strong className="text-slate-100 font-mono">
                    Rs. {Number(amount || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <button
                  type="submit"
                  disabled={loading || !!duplicateMessage}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {loading ? 'Posting to Ledger...' : (id ? 'Update Monthly Posting' : `Post ${monthLabel} ${displayCategory}`)}
                  </span>
                </button>

                <Link
                  to="/donations"
                  className="w-full flex items-center justify-center py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-slate-700/60 transition-colors"
                >
                  Cancel and Return
                </Link>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );
};

export default DonationForm;

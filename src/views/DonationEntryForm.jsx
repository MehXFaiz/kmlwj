import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Heart,
  ArrowLeft,
  Save,
  RefreshCw,
  User,
  Plus,
  Building,
  CreditCard,
  Wallet,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Phone,
  Hash,
  X
} from 'lucide-react';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useDonorStore } from '../store/donorStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { isGenuineBankAccount } from '../utils/accountFilters';
import { showToast } from '../components/ui/Toast';
import { donationReceivedService } from '../services/donationReceivedService';

const DONATION_TYPES = [
  { value: 'GENERAL_DONATION', label: 'General Donation' },
  { value: 'MONTHLY', label: 'Monthly Donation' },
  { value: 'MARRIAGE', label: 'Marriage Donation' },
  { value: 'MEDICAL', label: 'Medical Donation' },
  { value: 'EDUCATION', label: 'Education Donation' },
  { value: 'CUSTOM', label: 'Other / Custom Donation' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash (Cash in Hand)', icon: Wallet, description: 'Debits Cash in Hand GL Account' },
  { value: 'BANK', label: 'Bank Transfer / Online', icon: Building, description: 'Debits Selected Bank GL Account' },
  { value: 'CHEQUE', label: 'Cheque', icon: CreditCard, description: 'Requires Cheque # & Bank Account' },
];

export const DonationEntryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const { addDonation, updateDonation } = useDonationReceivedStore();
  const { donors, fetchDonors, addDonor } = useDonorStore();
  const { accounts, fetchAccounts } = useCoaStore();
  const user = useAuthStore((state) => state.user);
  const isPrivileged = useAuthStore((state) => state.isPrivileged);

  // Form State
  const [formData, setFormData] = useState({
    donorId: '',
    donationType: 'GENERAL_DONATION',
    customDonationType: '',
    amount: '',
    paymentMethod: 'CASH',
    bankAccountId: '',
    chequeNo: '',
    chequeDate: '',
    donationDate: new Date().toISOString().split('T')[0],
    mobile: '',
    referenceNo: '',
    notes: '',
    autoPostGL: true,
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);

  // Quick Add Donor Modal State
  const [showQuickDonorModal, setShowQuickDonorModal] = useState(false);
  const [quickDonorData, setQuickDonorData] = useState({
    fullName: '',
    mobile: '',
    cnic: '',
    address: '',
    donorType: 'INDIVIDUAL',
  });
  const [isAddingDonor, setIsAddingDonor] = useState(false);
  const [quickDonorError, setQuickDonorError] = useState('');

  // Initial Load: Donors & Accounts
  useEffect(() => {
    fetchDonors();
    fetchAccounts();
  }, [fetchDonors, fetchAccounts]);

  // Load existing donation if editing
  useEffect(() => {
    if (isEditing && id) {
      setIsLoadingRecord(true);
      donationReceivedService.getById(id)
        .then((res) => {
          const rec = res.data;
          if (rec) {
            setFormData({
              donorId: rec.donorId || '',
              donationType: rec.donationType || 'GENERAL_DONATION',
              customDonationType: rec.customDonationType || '',
              amount: rec.amount ? String(rec.amount) : '',
              paymentMethod: rec.paymentMethod || 'CASH',
              bankAccountId: rec.bankAccountId || '',
              chequeNo: rec.chequeNo || '',
              chequeDate: rec.chequeDate ? rec.chequeDate.split('T')[0] : '',
              donationDate: rec.receiptDate ? rec.receiptDate.split('T')[0] : (rec.createdAt ? rec.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
              mobile: rec.donor?.mobile || '',
              referenceNo: rec.referenceNo || '',
              notes: rec.narration || '',
              autoPostGL: rec.status === 'POSTED',
            });
          }
        })
        .catch((err) => {
          showToast(err.response?.data?.error?.message || 'Failed to load donation record', 'error');
          navigate('/donations');
        })
        .finally(() => {
          setIsLoadingRecord(false);
        });
    }
  }, [isEditing, id, navigate]);

  // Filter Bank Accounts from Chart of Accounts
  const bankAccounts = useMemo(() => {
    return accounts.filter(isGenuineBankAccount);
  }, [accounts]);

  // Auto-fill mobile when donor is selected
  const handleDonorChange = (selectedId) => {
    const selected = donors.find((d) => d.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      donorId: selectedId,
      mobile: selected?.mobile || prev.mobile,
    }));
    if (formErrors.donorId) {
      setFormErrors((prev) => ({ ...prev, donorId: null }));
    }
  };

  // Validation
  const validate = () => {
    const errors = {};
    if (!formData.donorId) errors.donorId = 'Please select a donor.';
    if (!formData.donationType) errors.donationType = 'Please select a donation type.';
    if (formData.donationType === 'CUSTOM' && !formData.customDonationType?.trim()) {
      errors.customDonationType = 'Please specify custom donation type.';
    }

    const numAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    }

    if (!formData.paymentMethod) errors.paymentMethod = 'Please select a payment method.';

    if ((formData.paymentMethod === 'BANK' || formData.paymentMethod === 'CHEQUE') && !formData.bankAccountId && bankAccounts.length > 0) {
      errors.bankAccountId = 'Please select a bank account.';
    }

    if (formData.paymentMethod === 'CHEQUE' && !formData.chequeNo?.trim()) {
      errors.chequeNo = 'Cheque number is required for cheque payments.';
    }

    if (!formData.donationDate) errors.donationDate = 'Donation date is required.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fix the validation errors in the form.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        donorId: formData.donorId,
        donationType: formData.donationType,
        customDonationType: formData.donationType === 'CUSTOM' ? formData.customDonationType.trim() : null,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        bankAccountId: (formData.paymentMethod !== 'CASH') ? (formData.bankAccountId || null) : null,
        chequeNo: formData.paymentMethod === 'CHEQUE' ? (formData.chequeNo.trim() || null) : null,
        chequeDate: formData.paymentMethod === 'CHEQUE' && formData.chequeDate ? formData.chequeDate : null,
        receiptDate: formData.donationDate,
        referenceNo: formData.referenceNo?.trim() || null,
        narration: formData.notes?.trim() || null,
        status: formData.autoPostGL ? 'POSTED' : 'DRAFT',
      };

      if (isEditing) {
        await updateDonation(id, payload);
        showToast('Donation record updated successfully.', 'success');
      } else {
        await addDonation(payload);
        showToast('Donation recorded and posted to General Ledger successfully.', 'success');
      }

      navigate('/donations');
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to save donation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Register New Donor Handler
  const handleQuickAddDonor = async (e) => {
    e.preventDefault();
    if (!quickDonorData.fullName?.trim()) {
      setQuickDonorError('Full Name is required');
      return;
    }

    setIsAddingDonor(true);
    setQuickDonorError('');
    try {
      const newDonor = await addDonor({
        fullName: quickDonorData.fullName.trim(),
        mobile: quickDonorData.mobile?.trim() || null,
        cnic: quickDonorData.cnic?.trim() || null,
        address: quickDonorData.address?.trim() || null,
        isActive: true,
      });

      showToast(`Donor "${newDonor.fullName}" registered successfully.`, 'success');
      setShowQuickDonorModal(false);
      setQuickDonorData({ fullName: '', mobile: '', cnic: '', address: '' });

      // Automatically select the new donor
      if (newDonor?.id) {
        setFormData((prev) => ({
          ...prev,
          donorId: newDonor.id,
          mobile: newDonor.mobile || prev.mobile,
        }));
      }
    } catch (err) {
      setQuickDonorError(err.response?.data?.error?.message || err.message || 'Failed to register donor');
    } finally {
      setIsAddingDonor(false);
    }
  };

  if (isLoadingRecord) {
    return (
      <div className="p-16 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">Loading donation details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* ── Top Navigation / Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/donations')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Back to Donations List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
              {isEditing ? 'Edit Donation Record' : 'Record New Donation'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEditing
                ? 'Update donation receipt and adjust General Ledger double-entry transactions'
                : 'Collect charitable donation, issue official receipt & post automatically to General Ledger'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Form Card ── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm space-y-6">

          {/* Section 1: Donor & Donation Classification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <User className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                1. Donor & Donation Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Donor Select with Quick Add Button */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Donor <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickDonorModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Quick Register New Donor
                  </button>
                </div>
                <select
                  value={formData.donorId}
                  onChange={(e) => handleDonorChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    formErrors.donorId
                      ? 'border-rose-500 bg-rose-50/30'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50'
                  } text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer`}
                >
                  <option value="">-- Select Donor from Database --</option>
                  {donors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} &middot; {d.donorCode || 'No Code'} &middot; {d.mobile || d.cnic || 'Donor'}
                    </option>
                  ))}
                </select>
                {formErrors.donorId && (
                  <p className="text-[11px] text-rose-500 font-medium">{formErrors.donorId}</p>
                )}
              </div>

              {/* Donation Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Donation Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.donationType}
                  onChange={(e) => setFormData({ ...formData, donationType: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  {DONATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Donation Type (if selected) */}
              {formData.donationType === 'CUSTOM' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Type Description <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customDonationType}
                    onChange={(e) => setFormData({ ...formData, customDonationType: e.target.value })}
                    placeholder="e.g. Ramadan Ration Fund, Orphan Welfare"
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                      formErrors.customDonationType
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50'
                    } text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all`}
                  />
                  {formErrors.customDonationType && (
                    <p className="text-[11px] text-rose-500 font-medium">{formErrors.customDonationType}</p>
                  )}
                </div>
              )}

              {/* Donation Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Donation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.donationDate}
                  onChange={(e) => setFormData({ ...formData, donationDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Mobile Number (Optional / Pre-filled) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mobile Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Financials & Payment Method */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                2. Financials & Payment Method
              </h2>
            </div>

            <div className="space-y-4">
              {/* Amount Input */}
              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Donation Amount (PKR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rs
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={formData.amount}
                    onChange={(e) => {
                      setFormData({ ...formData, amount: e.target.value });
                      if (formErrors.amount) setFormErrors({ ...formErrors, amount: null });
                    }}
                    placeholder="e.g. 5000"
                    className={`w-full pl-10 pr-3.5 py-3 text-base font-bold font-mono rounded-xl border ${
                      formErrors.amount
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50'
                    } text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all`}
                  />
                </div>
                {formErrors.amount && (
                  <p className="text-[11px] text-rose-500 font-medium">{formErrors.amount}</p>
                )}
              </div>

              {/* Payment Method Selector Cards */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const isSelected = formData.paymentMethod === m.value;
                    return (
                      <div
                        key={m.value}
                        onClick={() => setFormData({ ...formData, paymentMethod: m.value })}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {m.label}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {m.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bank Account Selection (for Bank / Cheque) */}
              {(formData.paymentMethod === 'BANK' || formData.paymentMethod === 'CHEQUE') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Deposit Bank Account <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.bankAccountId}
                      onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.accountName} ({b.glCode})
                        </option>
                      ))}
                    </select>
                    {formErrors.bankAccountId && (
                      <p className="text-[11px] text-rose-500 font-medium">{formErrors.bankAccountId}</p>
                    )}
                  </div>

                  {formData.paymentMethod === 'CHEQUE' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Cheque Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.chequeNo}
                          onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
                          placeholder="e.g. 0987654"
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        />
                        {formErrors.chequeNo && (
                          <p className="text-[11px] text-rose-500 font-medium">{formErrors.chequeNo}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Cheque Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.chequeDate}
                          onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Reference & Accounting Notes */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                3. Reference, Notes & Ledger Automation
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reference Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  External Reference / Transaction ID (Optional)
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    placeholder="e.g. TRX-998822"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* GL Automation Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Post to General Ledger Immediately
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Creates double-entry journal & updates Cash/Bank balances
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoPostGL}
                  onChange={(e) => setFormData({ ...formData, autoPostGL: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                />
              </div>

              {/* Notes / Narration */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Narration / Notes (Optional)
                </label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional details regarding this donation receipt..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/donations')}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isEditing ? 'Update Donation' : 'Record & Issue Receipt'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* ── Quick Register New Donor Modal ── */}
      {showQuickDonorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Quick Register New Donor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickDonorModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickDonorError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {quickDonorError}
              </div>
            )}

            <form onSubmit={handleQuickAddDonor} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Donor Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickDonorData.fullName}
                  onChange={(e) => setQuickDonorData({ ...quickDonorData, fullName: e.target.value })}
                  placeholder="e.g. Muhammad Farooq"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={quickDonorData.mobile}
                    onChange={(e) => setQuickDonorData({ ...quickDonorData, mobile: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    CNIC / ID Number
                  </label>
                  <input
                    type="text"
                    value={quickDonorData.cnic}
                    onChange={(e) => setQuickDonorData({ ...quickDonorData, cnic: e.target.value })}
                    placeholder="42101-1234567-1"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Address / Location (Optional)
                </label>
                <input
                  type="text"
                  value={quickDonorData.address}
                  onChange={(e) => setQuickDonorData({ ...quickDonorData, address: e.target.value })}
                  placeholder="e.g. Garden West, Karachi"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuickDonorModal(false)}
                  disabled={isAddingDonor}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDonor}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isAddingDonor && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Register & Select Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationEntryForm;

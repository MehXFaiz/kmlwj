import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { Heart, ChevronLeft, Save, ShieldCheck, CheckCircle2, Users, UserCheck, Sparkles, AlertCircle } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { DONATION_TYPES } from '../constants/donationTypes';

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_DONATION = {
  beneficiaryId: '',
  donorName: '', donorMobile: '', donationType: 'ZAKAT', amount: '',
  paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '',
  customDonationType: ''
};

const PAKISTANI_BANKS = [
  'Habib Bank Limited (HBL)', 'National Bank of Pakistan (NBP)', 'Meezan Bank',
  'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank Limited (ABL)', 'Bank Alfalah',
  'Standard Chartered Bank', 'Askari Bank', 'Bank AL Habib', 'Faysal Bank', 'Soneri Bank',
  'Bank of Punjab (BOP)', 'JS Bank', 'Dubai Islamic Bank', 'Al Baraka Bank', 'Bank Islami',
  'Sindh Bank', 'Habib Metropolitan Bank', 'First Women Bank', 'Samba Bank', 'Silkbank', 'Summit Bank'
];

export const DonationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { donations, fetchDonations, addDonation, updateDonation } = useDonationStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  const [form, setForm] = useState(DEFAULT_DONATION);
  const [loading, setLoading] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchAccountsList();
    fetchBeneficiaries();
  }, [fetchDonations, fetchAccountsList, fetchBeneficiaries]);

  useEffect(() => {
    if (id && donations.length > 0) {
      const existing = donations.find(d => d.id === id);
      if (existing) {
        setForm(nullsToEmpty({ ...existing, customDonationType: existing.customDonationType || '' }));
        setIsCustom(!existing.beneficiaryId && !!existing.donorName);
      }
    }
  }, [id, donations]);

  const hasDonationThisMonth = useMemo(() => {
    if (!form.beneficiaryId) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return donations.some(d => {
      if (id && d.id === id) return false;
      if (d.beneficiaryId !== form.beneficiaryId) return false;
      if (d.status !== 'APPROVED') return false;

      const dDate = new Date(d.createdAt);
      return dDate.getFullYear() === currentYear && dDate.getMonth() === currentMonth;
    });
  }, [form.beneficiaryId, donations, id]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a =>
      (a.name || '').toLowerCase().includes('bank') || (a.type || '').toLowerCase().includes('bank')
    );
  }, [flatAccounts]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.donorName || !form.amount || !form.paymentMethod) {
      showToast('Please fill in all required fields.', 'warning'); return;
    }
    if (!/^[a-zA-Z\s.]{3,50}$/.test(form.donorName)) {
      showToast('Donor Name must contain only letters, spaces and dots (3-50 characters).', 'warning'); return;
    }
    if (form.donorMobile && !/^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/.test(form.donorMobile)) {
      showToast('Invalid Mobile Number. E.g. 0300-1234567', 'warning'); return;
    }
    if (!/^[1-9]\d*(\.\d{1,2})?$/.test(form.amount)) {
      showToast('Amount must be a positive number with up to 2 decimal places.', 'warning'); return;
    }
    if ((form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && !form.bankAccountId) {
      showToast('Bank Account is required.', 'warning'); return;
    }
    if (form.paymentMethod === 'CHEQUE' && !form.chequeNumber) {
      showToast('Cheque number is required.', 'warning'); return;
    }
    if (form.paymentMethod === 'CHEQUE' && form.chequeNumber && !/^[0-9]{6,20}$/.test(form.chequeNumber)) {
      showToast('Cheque number must be between 6 and 20 digits.', 'warning'); return;
    }
    if (form.donationType === 'CUSTOM' && !form.customDonationType?.trim()) {
      showToast('Custom Donation / Aid Type is required when "Custom" is selected.', 'warning'); return;
    }

    setLoading(true);
    try {
      if (id) {
        await updateDonation(id, form);
        showToast('Donation updated successfully!', 'success');
      } else {
        await addDonation(form);
        showToast('Donation logged successfully!', 'success');
      }
      setTimeout(() => navigate('/donations'), 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save donation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/donations" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? 'Edit Welfare Aid / Disbursement' : 'Log New Aid / Donation Disbursement'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Record financial assistance and aid distributed to People We Help</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Disbursement' : 'New Disbursement'}
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Info Panel */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Donation Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Heart className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Tracks Welfare Disbursement Outflow</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Posts to General Ledger</span>
                </div>
              </div>
              <div className="border-t border-amber-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory. You can auto-fill recipient details by selecting from <strong className="text-slate-300">People We Help</strong>.
              </p>
            </div>
          </div>

          {/* Right: Form Cards */}
          <div className="lg:col-span-8 space-y-5">

            {/* Card 01: Beneficiary & Amount */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">Recipient & Amount (Beneficiary Aid)</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Main Recipient Dropdown (People We Help) */}
                <div className="sm:col-span-2 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80 p-4 rounded-xl border border-amber-500/30 shadow-inner">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-400 shrink-0" /> Recipient / Beneficiary Name (People We Help) *
                    </label>
                    <Link to="/beneficiaries/new" target="_blank" className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline">
                      + Register New Beneficiary
                    </Link>
                  </div>
                  <select
                    required
                    value={isCustom ? 'Custom / Other Recipient' : (form.beneficiaryId || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Custom / Other Recipient') {
                        setIsCustom(true);
                        setForm(f => ({
                          ...f,
                          beneficiaryId: '',
                          donorName: 'Custom / Other Recipient',
                          donorMobile: '',
                        }));
                      } else if (val === '') {
                        setIsCustom(false);
                        setForm(f => ({
                          ...f,
                          beneficiaryId: '',
                          donorName: '',
                          donorMobile: '',
                        }));
                      } else {
                        setIsCustom(false);
                        const b = beneficiaries.find(item => item.id === val);
                        if (b) {
                          setForm(f => ({
                            ...f,
                            beneficiaryId: b.id,
                            donorName: b.name || '',
                            donorMobile: b.mobile || '',
                            remarks: f.remarks ? `${f.remarks} (Beneficiary CNIC: ${b.cnic || 'N/A'})` : `Beneficiary CNIC: ${b.cnic || 'N/A'}`
                          }));
                          showToast(`Selected beneficiary: ${b.name}`, 'success');
                        }
                      }
                    }}
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-amber-500/40 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500 transition-all cursor-pointer shadow-md"
                  >
                    <option value="">-- Select Recipient from People We Help (Dropdown) --</option>
                    {beneficiaries.map(b => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200 py-1 font-semibold">
                        {b.name} {b.mobile ? `• Ph: ${b.mobile}` : ''} {b.cnic ? `• CNIC: ${b.cnic}` : ''}
                      </option>
                    ))}
                    <option value="Custom / Other Recipient" className="bg-slate-900 text-amber-400 font-bold">
                      ➕ Other / Custom Recipient (Not in list)...
                    </option>
                  </select>
                  {isCustom && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom recipient name here..."
                      value={form.donorName === 'Custom / Other Recipient' ? '' : form.donorName}
                      onChange={e => setForm(f => ({ ...f, donorName: e.target.value }))}
                      className="w-full mt-3 px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-amber-500 text-sm font-semibold text-amber-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  )}
                  {hasDonationThisMonth && (
                    <div className="mt-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 animate-pulse animate-duration-1000">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-400">
                          This beneficiary has already received a donation for this month. The next donation can only be issued next month.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Select from your registered welfare beneficiaries to automatically populate contact details below.</span>
                  </div>
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
                      setForm(f => ({
                        ...f,
                        donationType: val,
                        customDonationType: val !== 'CUSTOM' ? '' : f.customDonationType
                      }));
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
                        className={`${inputClass} border-amber-500/50 focus:border-amber-400`}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Describe the specific type of aid (e.g. Water Filter Assistance)</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Amount (PKR) *</label>
                  <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="10000" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Card 02: Payment Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Payment Details</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>Payment Method *</label>
                  <select value={form.paymentMethod}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))}
                    className={inputClass}>
                    {['CASH', 'BANK', 'CHEQUE'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Bank Account *</label>
                      <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                        className={inputClass}>
                        <option value="">Select Bank Account</option>
                        {bankAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name || a.accountName}</option>
                        ))}
                      </select>
                    </div>
                    {form.paymentMethod === 'CHEQUE' && (
                      <div>
                        <label className={labelClass}>Cheque / Ref Number *</label>
                        <input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))}
                          placeholder="CHQ-001" className={inputClass} />
                      </div>
                    )}
                  </div>
                )}

                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                  <div>
                    <label className={labelClass}>Donor Bank (Pakistani Banks)</label>
                    <select value={form.donorBankName} onChange={e => setForm(f => ({ ...f, donorBankName: e.target.value }))}
                      className={inputClass}>
                      <option value="">Select Bank (Optional)</option>
                      {PAKISTANI_BANKS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Remarks</label>
                  <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    className={`${inputClass} h-24 resize-none`} placeholder="Optional notes..." />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/donations" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={loading || hasDonationThisMonth}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (id ? 'Update Donation' : 'Log Donation')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default DonationForm;

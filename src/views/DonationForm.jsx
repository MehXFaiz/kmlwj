import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useCoaStore } from '../store/coaStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { beneficiaryService } from '../services/beneficiaryService';
import { Heart, ChevronLeft, Save, ShieldCheck, CheckCircle2, Users, UserCheck, Sparkles, AlertCircle, Camera, Loader2, Upload } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { DONATION_TYPES } from '../constants/donationTypes';

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_DONATION = {
  beneficiaryId: '',
  donorName: '', donorMobile: '', donationType: 'ZAKAT', amount: '',
  paymentMethod: 'BANK', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '',
  customDonationType: '', date: new Date().toISOString().split('T')[0]
};

const PAKISTANI_BANKS = [
  'National Bank of Pakistan (NBP)', 'United Bank Limited (UBL)', 'MCB Bank',
  'Allied Bank Limited (ABL)', 'Bank Alfalah', 'Standard Chartered Bank', 'Askari Bank',
  'Bank AL Habib', 'Faysal Bank', 'Soneri Bank', 'Bank of Punjab (BOP)', 'JS Bank',
  'Dubai Islamic Bank', 'Al Baraka Bank', 'Bank Islami', 'Sindh Bank',
  'Habib Metropolitan Bank', 'First Women Bank', 'Samba Bank', 'Silkbank', 'Summit Bank'
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
        setForm(nullsToEmpty({
          ...existing,
          customDonationType: existing.customDonationType || '',
          date: existing.createdAt ? new Date(existing.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));
        setIsCustom(!existing.beneficiaryId && !!existing.donorName);
      }
    }
  }, [id, donations]);

  const selectedBeneficiary = useMemo(() => {
    if (!form.beneficiaryId) return null;
    return beneficiaries.find(b => b.id === form.beneficiaryId) || null;
  }, [form.beneficiaryId, beneficiaries]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(null);
  const fileInputRef = useRef(null);

  const handleUploadRecipientPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBeneficiary) return;
    e.target.value = '';

    const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      showToast('Please choose a valid image file (JPEG, PNG, WEBP).', 'warning');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Image is too large. Maximum size is 8MB.', 'warning');
      return;
    }

    setUploadingPhoto(true);
    setPhotoProgress(0);

    try {
      const urls = await beneficiaryService.uploadFile('photo', file, (pct) => setPhotoProgress(pct));
      const newPhotoUrl = urls?.photoUrl || urls?.url;
      if (newPhotoUrl) {
        await beneficiaryService.update(selectedBeneficiary.id, { photoUrl: newPhotoUrl });
        await fetchBeneficiaries();
        showToast('Recipient photo uploaded & updated successfully!', 'success');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
      setTimeout(() => setPhotoProgress(null), 800);
    }
  };

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => {
      if (a.isLocked || a.isDeleted) return false;
      const nameLower = (a.name || a.accountName || '').toLowerCase();
      const detailLower = (a.detailType || '').toLowerCase();
      if (detailLower === 'bank') return true;
      if (a.code === '1010101' || a.code === '1010102') return true;
      if (nameLower.includes('bank') || nameLower.includes('nbp') || nameLower.includes('mcb') || nameLower.includes('hbl') || nameLower.includes('ubl') || nameLower.includes('habib') || nameLower.includes('allied') || nameLower.includes('faysal') || nameLower.includes('alfalah') || nameLower.includes('meezan') || nameLower.includes('soneri') || nameLower.includes('askari') || nameLower.includes('js bank') || nameLower.includes('bop') || nameLower.includes('dubai islamic')) {
        return true;
      }
      return false;
    });
  }, [flatAccounts]);

  // Auto-select first bank account when bank payment is active and none is selected
  useEffect(() => {
    if (!id && (form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && !form.bankAccountId && bankAccounts.length > 0) {
      setForm(f => ({ ...f, bankAccountId: bankAccounts[0].id }));
    }
  }, [id, form.paymentMethod, form.bankAccountId, bankAccounts]);

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
    if (Number(form.amount) > 100000000) {
      showToast('Amount cannot exceed 100,000,000.', 'warning'); return;
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
      showToast(err?.response?.data?.error?.message || err.message || 'Failed to save donation', 'error');
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
                  {selectedBeneficiary && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/40 flex flex-col sm:flex-row items-center sm:items-start gap-4 shadow-lg">
                      {/* Profile Picture Frame with Interactive Click-to-Upload */}
                      <div className="relative group shrink-0">
                        <div
                          onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                          title="Click to upload or change recipient photo"
                          className={`relative w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-2 border-dashed
                            ${uploadingPhoto ? 'cursor-wait border-amber-400' : 'cursor-pointer border-amber-500/60 hover:border-amber-400'}
                            overflow-hidden bg-slate-900 flex flex-col items-center justify-center shadow-lg transition-all`}
                        >
                          {selectedBeneficiary.photoUrl ? (
                            <>
                              <img
                                src={selectedBeneficiary.photoUrl}
                                alt={selectedBeneficiary.name}
                                className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-1 text-center">
                                <Camera className="w-5 h-5 text-amber-400 mb-1" />
                                <span className="text-[9.5px] font-bold text-amber-300">Change Photo</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center group-hover:text-amber-300 transition-colors">
                              <Camera className="w-7 h-7 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-[9.5px] font-bold text-amber-400">Upload Photo</span>
                            </div>
                          )}

                          {uploadingPhoto && (
                            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-1.5 z-20">
                              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                              <span className="text-[10px] font-bold text-amber-300">{photoProgress ?? 0}%</span>
                            </div>
                          )}
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleUploadRecipientPhoto}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                      </div>

                      {/* Recipient Data & Badges */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-base font-bold text-slate-100 truncate">{selectedBeneficiary.name}</h4>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            Registered Recipient Profile
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div><span className="text-slate-500 font-semibold">CNIC:</span> <strong className="text-slate-200">{selectedBeneficiary.cnic || '—'}</strong></div>
                          <div><span className="text-slate-500 font-semibold">Mobile:</span> <strong className="text-slate-200">{selectedBeneficiary.mobile || '—'}</strong></div>
                          <div><span className="text-slate-500 font-semibold">Gham Name:</span> <strong className="text-amber-300">{selectedBeneficiary.gham || selectedBeneficiary.ghamName || '—'}</strong></div>
                          <div><span className="text-slate-500 font-semibold">Address:</span> <strong className="text-slate-200 truncate">{selectedBeneficiary.address || '—'}</strong></div>
                        </div>
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
                <div>
                  <label className={labelClass}>Donation Date *</label>
                  <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>
            </div>

            {/* Card 02: Payment Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Payment & Bank Source</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>Payment Method *</label>
                  <select value={form.paymentMethod}
                    onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))}
                    className={inputClass}>
                    {['BANK', 'CASH', 'CHEQUE'].map(t => (
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
                          <option key={a.id} value={a.id}>{a.name || a.accountName} {a.code ? `(${a.code})` : ''}</option>
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
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/donations" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={loading}
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

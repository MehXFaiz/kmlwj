import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useDonorStore } from '../store/donorStore';
import { useCoaStore } from '../store/coaStore';
import { PhoneInput } from '../components/ui/PhoneInput';
import { CNICInput } from '../components/ui/CNICInput';
import {
  ArrowDownLeft, Receipt, CreditCard, ChevronLeft, CheckCircle, AlertCircle, Save, UserPlus
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { DONATION_TYPES } from '../constants/donationTypes';

const PAYMENT_METHODS = ['CASH', 'BANK', 'CHEQUE', 'ONLINE'];

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

function QuickDonorModal({ isOpen, onClose, onCreated }) {
  const { addDonor } = useDonorStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Donor name is required', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await addDonor({ fullName: name, mobile: phone || null, cnic: cnic || null, isActive: true });
      showToast('Donor registered successfully', 'success');
      onCreated(res.data || res);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to create donor', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-emerald-400" /> Quick Add Donor
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Donor Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Muhammad Ali"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Mobile Phone</label>
            <PhoneInput
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">CNIC / ID No</label>
            <CNICInput
              value={cnic}
              onChange={e => setCnic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all font-medium"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">Cancel</button>
          <button type="button" onClick={handleCreate} disabled={loading} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50">
            {loading ? 'Saving...' : 'Create & Select'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DonationReceiptForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { donations, fetchDonations, addDonation, updateDonationStatus } = useDonationReceivedStore();
  const { donors, fetchDonors } = useDonorStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();

  const [toast, setToast] = useState(null);
  const [quickDonorOpen, setQuickDonorOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    receiptDate: new Date().toISOString().slice(0, 10),
    donorId: '',
    donationType: 'GENERAL_DONATION',
    customDonationType: '',
    amount: '',
    paymentMethod: 'CASH',
    cashAccountId: '',
    bankAccountId: '',
    chequeNo: '',
    chequeDate: '',
    referenceNo: '',
    narration: '',
    status: 'DRAFT'
  });

  useEffect(() => {
    fetchDonations();
    fetchDonors();
    fetchAccountsList();
  }, [fetchDonations, fetchDonors, fetchAccountsList]);

  const cashAccounts = useMemo(() => {
    return flatAccounts.filter(a =>
      (a.name || a.accountName || '').toLowerCase().includes('cash') ||
      (a.type || '').toLowerCase().includes('cash')
    );
  }, [flatAccounts]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a =>
      (a.name || a.accountName || '').toLowerCase().includes('bank') ||
      (a.type || '').toLowerCase().includes('bank') ||
      (a.name || a.accountName || '').toLowerCase().includes('cheque')
    );
  }, [flatAccounts]);

  // Set defaults once dependencies load if it's a new form
  useEffect(() => {
    if (!id && !form.donorId && donors.length > 0) {
      setForm(prev => ({ ...prev, donorId: donors[0].id }));
    }
    if (!id && !form.cashAccountId && cashAccounts.length > 0) {
      setForm(prev => ({ ...prev, cashAccountId: cashAccounts[0].id }));
    }
    if (!id && !form.bankAccountId && bankAccounts.length > 0) {
      setForm(prev => ({ ...prev, bankAccountId: bankAccounts[0].id }));
    }
  }, [id, donors, cashAccounts, bankAccounts]);

  // Load existing data if editing
  useEffect(() => {
    if (id && donations.length > 0) {
      const existing = donations.find(d => d.id === id);
      if (existing) {
        setForm({
          ...nullsToEmpty(existing),
          receiptDate: existing.receiptDate ? new Date(existing.receiptDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          chequeDate: existing.chequeDate ? new Date(existing.chequeDate).toISOString().slice(0, 10) : '',
          customDonationType: existing.customDonationType || '',
        });
      }
    }
  }, [id, donations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.donorId) {
      setToast({ type: 'error', message: 'Please select a donor' });
      return;
    }
    if (form.donationType === 'CUSTOM' && (!form.customDonationType || !form.customDonationType.trim())) {
      setToast({ type: 'error', message: 'Custom Donation Type is required when CUSTOM is selected' });
      return;
    }
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0 || !/^[1-9]\d*$/.test(String(form.amount))) {
      setToast({ type: 'error', message: 'Please enter a valid positive whole donation amount' });
      return;
    }
    if (Number(form.amount) > 100000000) {
      setToast({ type: 'error', message: 'Amount cannot exceed 100,000,000' });
      return;
    }
    if (form.paymentMethod === 'CASH' && !form.cashAccountId && cashAccounts.length === 0) {
      setToast({ type: 'error', message: 'No Cash account available in Chart of Accounts' });
      return;
    }
    if (form.paymentMethod !== 'CASH' && !form.bankAccountId && bankAccounts.length === 0) {
      setToast({ type: 'error', message: 'No Bank account available in Chart of Accounts' });
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, amount: Math.round(Number(form.amount)) };
      if (id) {
        await updateDonationStatus(id, form.status, payload);
        setToast({ type: 'success', message: 'Donation receipt updated successfully!' });
      } else {
        await addDonation(payload);
        setToast({ type: 'success', message: 'Donation receipt generated successfully!' });
      }
      setTimeout(() => navigate('/donations-received'), 1500);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save donation receipt' });
      setLoading(false);
    }
  };

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';
  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all font-medium';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all ${
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <QuickDonorModal
        isOpen={quickDonorOpen}
        onClose={() => setQuickDonorOpen(false)}
        onCreated={(newDonor) => {
          fetchDonors();
          setForm(prev => ({ ...prev, donorId: newDonor.id }));
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/donations-received" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? 'Edit Donation Receipt' : 'New Donation Received (Inflow)'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Record charitable contribution and update ledger balances</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
          {id ? 'Editing Receipt' : 'New Receipt'}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Info */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-300">Donation Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Tracks Inflow Automatically</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Posts to General Ledger</span>
                </div>
              </div>
              <div className="border-t border-emerald-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
              </p>
            </div>
          </div>

          {/* RIGHT: Form Cards */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Card 01: Core Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">Receipt Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Receipt No (Auto)</label>
                  <input
                    type="text"
                    disabled
                    value={form.receiptNo || 'REC-YYYY-XXXX (Generated on Save)'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs font-mono text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className={labelClass}>Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={form.receiptDate}
                    onChange={e => setForm({ ...form, receiptDate: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-400">Donor *</label>
                    <button type="button" onClick={() => setQuickDonorOpen(true)} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                      <UserPlus className="h-3.5 w-3.5" /> + Quick Add Donor
                    </button>
                  </div>
                  <select
                    required
                    value={form.donorId}
                    onChange={e => setForm({ ...form, donorId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">-- Select Donor --</option>
                    {donors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.donorCode}){d.cnic ? ` - CNIC: ${d.cnic}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Donation Type *</label>
                  <select
                    required
                    value={form.donationType}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        donationType: val,
                        customDonationType: val === 'CUSTOM' ? prev.customDonationType : ''
                      }));
                    }}
                    className={inputClass}
                  >
                    {DONATION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {form.donationType === 'CUSTOM' && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Custom Donation Type *</label>
                    <input
                      type="text"
                      required
                      value={form.customDonationType}
                      onChange={e => setForm({ ...form, customDonationType: e.target.value })}
                      placeholder="Enter Donation Type"
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Amount (PKR) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">PKR</span>
                    <input
                      type="number"
                      step="1"
                      required
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0"
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500/60 transition-all font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 02: Payment & Accounts */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Payment & Account</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Payment Method *</label>
                  <select required value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className={inputClass}>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {form.paymentMethod === 'CASH' ? (
                  <div>
                    <label className={labelClass}>Cash Account *</label>
                    <select required value={form.cashAccountId} onChange={e => setForm({ ...form, cashAccountId: e.target.value })} className={inputClass}>
                      <option value="">-- Select Cash Account --</option>
                      {cashAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.accountName || a.name} ({a.glCode || a.code})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Bank / Online Account *</label>
                    <select required value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })} className={inputClass}>
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.accountName || a.name} ({a.glCode || a.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.paymentMethod === 'CHEQUE' && (
                  <>
                    <div>
                      <label className={labelClass}>Cheque No</label>
                      <input type="text" value={form.chequeNo} onChange={e => setForm({ ...form, chequeNo: e.target.value })} placeholder="e.g. CHQ-987654" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Cheque Date</label>
                      <input type="date" value={form.chequeDate} onChange={e => setForm({ ...form, chequeDate: e.target.value })} className={inputClass} />
                    </div>
                  </>
                )}

                <div>
                  <label className={labelClass}>Reference No</label>
                  <input type="text" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} placeholder="e.g. Slip #123 / Transfer Ref" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Card 03: Narration & Status */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">03</span>
                <h3 className="text-sm font-semibold text-slate-200">Notes & Posting</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Narration / Remarks</label>
                  <textarea rows={2} value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} placeholder="Enter receipt details, donor instructions..." className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className={labelClass}>Status *</label>
                  <select required value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputClass} font-semibold`}>
                    <option value="DRAFT">PENDING POST (Do not auto-post to GL)</option>
                    <option value="POSTED">POSTED (Auto-post to GL)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/donations-received" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (id ? 'Update Receipt' : 'Save & Post Receipt')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default DonationReceiptForm;

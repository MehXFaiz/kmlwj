import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { Users, Search, ChevronLeft, Save, ShieldCheck } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_BENEFICIARY = { name: '', cnic: '', mobile: '', address: '', remarks: '', isActive: true };

export const BeneficiaryForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { beneficiaries, fetchBeneficiaries, addBeneficiary, updateBeneficiary } = useBeneficiaryStore();

  const [form, setForm] = useState(DEFAULT_BENEFICIARY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  useEffect(() => {
    if (id && beneficiaries.length > 0) {
      const existing = beneficiaries.find(b => b.id === id);
      if (existing) setForm(nullsToEmpty(existing));
    }
  }, [id, beneficiaries]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'warning'); return; }
    if (!/^[a-zA-Z\s.-]{3,50}$/.test(form.name)) {
      showToast('Name should only contain letters, spaces, hyphens, and dots (3-50 chars)', 'warning');
      return;
    }
    if (form.cnic && !/^\d{5}-\d{7}-\d{1}$/.test(form.cnic)) {
      showToast('CNIC must be in format: 00000-0000000-0', 'warning');
      return;
    }
    if (form.mobile && !/^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/.test(form.mobile)) {
      showToast('Invalid mobile number. E.g. 0300-1234567', 'warning');
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await updateBeneficiary(id, form);
        showToast('Beneficiary updated successfully!', 'success');
      } else {
        await addBeneficiary(form);
        showToast('Beneficiary added successfully!', 'success');
      }
      setTimeout(() => navigate('/beneficiaries'), 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save beneficiary', 'error');
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
          <Link to="/beneficiaries" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? "Update Person's Details" : 'Add Person to Welfare List'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {id ? 'Update contact and status information' : 'Register a new beneficiary'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Record' : 'New Registration'}
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Info Panel */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Welfare Registry</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Track Aid Recipients</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Search className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Searchable by CNIC & Mobile</span>
                </div>
              </div>
              <div className="border-t border-amber-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
              </p>
            </div>
          </div>

          {/* Right: Form Cards */}
          <div className="lg:col-span-8 space-y-5">

            {/* Card 01: Personal Information */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">Personal Information</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ahmed Khan" className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>ID Card Number (CNIC)</label>
                    <input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))}
                      placeholder="42101-1234567-8" className={inputClass} />
                    <p className="text-[10px] text-slate-600 mt-1">Format: 00000-0000000-0</p>
                  </div>
                  <div>
                    <label className={labelClass}>Mobile Number</label>
                    <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                      placeholder="0300-0000000" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 02: Additional Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Additional Details</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>Home Address</label>
                  <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className={`${inputClass} h-24 resize-none`} placeholder="Street, area, city..." />
                </div>
                <div>
                  <label className={labelClass}>Notes / Remarks</label>
                  <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    className={inputClass} placeholder="Any additional notes..." />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer" />
                  <label htmlFor="isActive" className="text-sm font-semibold text-slate-300 cursor-pointer">
                    This person is currently receiving aid
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/beneficiaries" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (id ? 'Update Beneficiary' : 'Create Beneficiary')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default BeneficiaryForm;

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { CNICInput, validateCNIC } from '../components/ui/CNICInput';
import { Users, Search, ChevronLeft, Save, ShieldCheck } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_BENEFICIARY = {
  name: '', fatherName: '', husbandName: '', cnic: '', dob: '', mobile: '', email: '',
  familySize: '', monthlyIncome: '', monthlyExpenses: '', debtAmount: '',
  housingStatus: '', housingOther: '',
  address: '', town: '', area: '', gham: '', husbandGham: '', fatherGham: '',
  education: '', profession: '', firm: '', remarks: '', isActive: true,
};

function formatDobForInput(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toISOString().split('T')[0];
}

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
      if (existing) {
        const cleaned = nullsToEmpty(existing);
        cleaned.dob = formatDobForInput(existing.dob);
        cleaned.monthlyIncome = existing.monthlyIncome != null ? String(existing.monthlyIncome) : '';
        cleaned.monthlyExpenses = existing.monthlyExpenses != null ? String(existing.monthlyExpenses) : '';
        cleaned.debtAmount = existing.debtAmount != null ? String(existing.debtAmount) : '';
        cleaned.familySize = existing.familySize != null ? String(existing.familySize) : '';
        setForm(cleaned);
      }
    }
  }, [id, beneficiaries]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Full Name is required', 'warning'); return; }
    if (!/^[a-zA-Z\s.\-']{3,50}$/.test(form.name)) {
      showToast('Name should only contain letters, spaces, hyphens, and dots (3-50 chars)', 'warning');
      return;
    }
    if (!form.fatherName.trim()) { showToast("Father's Name is required", 'warning'); return; }
    if (!form.cnic || !validateCNIC(form.cnic)) {
      showToast('Valid CNIC is required (13 digits)', 'warning');
      return;
    }
    if (!form.mobile || !validatePhoneNumber(form.mobile)) {
      showToast('Valid Contact Number is required (11 digits)', 'warning');
      return;
    }
    if (!form.address.trim()) { showToast('Full Address is required', 'warning'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    if (form.monthlyIncome && isNaN(Number(form.monthlyIncome))) {
      showToast('Monthly Income must be a number', 'warning'); return;
    }
    if (form.monthlyExpenses && isNaN(Number(form.monthlyExpenses))) {
      showToast('Monthly Expenses must be a number', 'warning'); return;
    }
    if (form.debtAmount && isNaN(Number(form.debtAmount))) {
      showToast('Debt Amount must be a number', 'warning'); return;
    }
    if (form.familySize && (isNaN(Number(form.familySize)) || Number(form.familySize) < 0)) {
      showToast('Family Size must be a valid number', 'warning'); return;
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

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setChecked = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.checked }));

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Full Name *</label>
                    <input value={form.name} onChange={set('name')}
                      placeholder="e.g. Ahmed Khan" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Father's Name *</label>
                    <input value={form.fatherName} onChange={set('fatherName')}
                      placeholder="e.g. Mohammad Khan" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Husband's Name</label>
                    <input value={form.husbandName} onChange={set('husbandName')}
                      placeholder="If applicable" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>CNIC *</label>
                    <CNICInput
                      value={form.cnic}
                      onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date of Birth</label>
                    <input type="date" value={form.dob} onChange={set('dob')}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Contact Number *</label>
                    <PhoneInput
                      value={form.mobile}
                      onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" value={form.email} onChange={set('email')}
                    placeholder="Optional" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Card 02: Economic Status */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Economic Status</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Family Size</label>
                    <input type="number" min="0" value={form.familySize} onChange={set('familySize')}
                      placeholder="e.g. 5" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Income (PKR)</label>
                    <input type="number" min="0" step="0.01" value={form.monthlyIncome} onChange={set('monthlyIncome')}
                      placeholder="e.g. 15000" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Monthly Expenses (PKR)</label>
                    <input type="number" min="0" step="0.01" value={form.monthlyExpenses} onChange={set('monthlyExpenses')}
                      placeholder="e.g. 12000" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Debt Amount (PKR)</label>
                    <input type="number" min="0" step="0.01" value={form.debtAmount} onChange={set('debtAmount')}
                      placeholder="e.g. 50000" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Housing Status</label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {['Owned', 'Rented', 'Homeless', 'Other'].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="housingStatus"
                          value={opt}
                          checked={form.housingStatus === opt}
                          onChange={set('housingStatus')}
                          className="h-4 w-4 border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-slate-300 font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {form.housingStatus === 'Other' && (
                  <div>
                    <label className={labelClass}>Specify Housing Status</label>
                    <input value={form.housingOther} onChange={set('housingOther')}
                      placeholder="Please specify..." className={inputClass} />
                  </div>
                )}
              </div>
            </div>

            {/* Card 03: Background & Address */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">03</span>
                <h3 className="text-sm font-semibold text-slate-200">Background & Address</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>Full Address *</label>
                  <textarea value={form.address} onChange={set('address')}
                    className={`${inputClass} h-24 resize-none`} placeholder="Street, area, city..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Town</label>
                    <input value={form.town} onChange={set('town')}
                      placeholder="e.g. Lyari" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Area</label>
                    <input value={form.area} onChange={set('area')}
                      placeholder="e.g. New Kalri" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Ghaam</label>
                    <input value={form.gham} onChange={set('gham')}
                      placeholder="Ghaam name" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Husband Ghaam Name</label>
                    <input value={form.husbandGham} onChange={set('husbandGham')}
                      placeholder="If applicable" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Father's Ghaam Name</label>
                    <input value={form.fatherGham} onChange={set('fatherGham')}
                      placeholder="Father's ghaam" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Education</label>
                    <input value={form.education} onChange={set('education')}
                      placeholder="e.g. Matric" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Profession</label>
                    <input value={form.profession} onChange={set('profession')}
                      placeholder="e.g. Tailor" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Firm</label>
                    <input value={form.firm} onChange={set('firm')}
                      placeholder="Workplace" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Observations / Notes</label>
                  <textarea value={form.remarks} onChange={set('remarks')}
                    className={`${inputClass} h-20 resize-none`} placeholder="Any additional observations..." />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={setChecked('isActive')}
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

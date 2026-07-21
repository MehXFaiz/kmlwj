import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { beneficiaryService } from '../services/beneficiaryService';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { CNICInput, validateCNIC } from '../components/ui/CNICInput';
import {
  Camera, Image as ImageIcon, ShieldCheck, QrCode,
  ChevronLeft, CheckCircle, AlertCircle, Save, X,
  Upload, Loader2, IdCard, Users, Search,
} from 'lucide-react';
import { sanitizeInputValue } from '../utils/validation';

// ── Single image upload widget (identical to MemberForm) ─────────────────────
function ImageUploadField({ label, fieldName, currentUrl, onUploaded, onError }) {
  const [preview, setPreview]     = useState(currentUrl || null);
  const [progress, setProgress]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const handleSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldError(null);
    e.target.value = '';

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    setProgress(0);

    try {
      const urls = await beneficiaryService.uploadFile(fieldName, file, (pct) => setProgress(pct));
      const urlKey = fieldName === 'photo' ? 'photoUrl' : fieldName === 'cnicFront' ? 'cnicFrontUrl' : 'cnicBackUrl';
      onUploaded(urls[urlKey]);
      setProgress(100);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Upload failed. Please try again.';
      setFieldError(msg);
      setPreview(currentUrl || null);
      onUploaded(currentUrl || null);
      onError?.(msg);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 800);
    }
  }, [fieldName, currentUrl, onUploaded, onError]);

  const handleRemove = () => {
    setPreview(null);
    setFieldError(null);
    setProgress(null);
    onUploaded(null);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative aspect-square w-full max-w-[180px] mx-auto rounded-xl border-2 border-dashed
          ${uploading ? 'cursor-wait' : 'cursor-pointer'}
          ${fieldError ? 'border-red-500/60' : 'border-slate-700 hover:border-amber-500/50'}
          bg-slate-950/40 flex flex-col items-center justify-center overflow-hidden group transition-all`}
      >
        {preview ? (
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors text-center px-2">
              Click to upload
            </span>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs font-bold text-amber-300">{progress ?? 0}%</span>
            <div className="w-3/4 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-200"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          onChange={handleSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {preview && !uploading && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 transition-colors flex items-center gap-1 mx-auto"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      )}

      {fieldError && (
        <p className="text-xs text-red-400 text-center flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {fieldError}
        </p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_BENEFICIARY = {
  name: '', fatherName: '', husbandName: '', cnic: '', dob: '', mobile: '', email: '',
  familySize: '', monthlyIncome: '', monthlyExpenses: '', debtAmount: '',
  housingStatus: '', housingOther: '',
  address: '', town: '', area: '', gham: '', husbandGham: '', fatherGham: '',
  education: '', profession: '', firm: '', remarks: '',
  photoUrl: '', cnicFrontUrl: '', cnicBackUrl: '',
  isActive: true,
};

function formatDobForInput(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toISOString().split('T')[0];
}

// ── Main form ────────────────────────────────────────────────────────────────
export const BeneficiaryForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { beneficiaries, fetchBeneficiaries, addBeneficiary, updateBeneficiary } = useBeneficiaryStore();

  const [form, setForm] = useState(DEFAULT_BENEFICIARY);
  const [loading, setLoading] = useState(false);

  const [uploadErrors, setUploadErrors] = useState({});
  const [anyUploading, setAnyUploading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchBeneficiaries(); }, [fetchBeneficiaries]);

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

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onUploadError = useCallback((field, msg) => {
    setUploadErrors(prev => ({ ...prev, [field]: msg }));
  }, []);

  const onUploadSuccess = useCallback((field) => {
    setUploadErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();

    if (Object.keys(uploadErrors).length > 0) {
      showToast('error', 'Please fix the upload errors before submitting.');
      return;
    }

    if (!form.name.trim()) { showToast('error', 'Full Name is required'); return; }
    if (!/^[a-zA-Z\s.\-']{3,50}$/.test(form.name)) {
      showToast('error', 'Name should only contain letters, spaces, hyphens, and dots (3-50 chars)');
      return;
    }
    if (!form.fatherName.trim()) { showToast('error', "Father's Name is required"); return; }
    if (!form.cnic || !validateCNIC(form.cnic)) {
      showToast('error', 'Valid CNIC is required (13 digits)');
      return;
    }
    if (!form.mobile || !validatePhoneNumber(form.mobile)) {
      showToast('error', 'Valid Contact Number is required (11 digits)');
      return;
    }
    if (!form.address.trim()) { showToast('error', 'Full Address is required'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      showToast('error', 'Please enter a valid email address');
      return;
    }
    if (form.monthlyIncome && isNaN(Number(form.monthlyIncome))) {
      showToast('error', 'Monthly Income must be a number'); return;
    }
    if (form.monthlyExpenses && isNaN(Number(form.monthlyExpenses))) {
      showToast('error', 'Monthly Expenses must be a number'); return;
    }
    if (form.debtAmount && isNaN(Number(form.debtAmount))) {
      showToast('error', 'Debt Amount must be a number'); return;
    }
    if (form.familySize && (isNaN(Number(form.familySize)) || Number(form.familySize) < 0)) {
      showToast('error', 'Family Size must be a valid number'); return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      if (id) {
        await updateBeneficiary(id, payload);
        showToast('success', 'Beneficiary updated successfully!');
      } else {
        await addBeneficiary(payload);
        showToast('success', 'Beneficiary added successfully!');
      }
      setTimeout(() => navigate('/beneficiaries'), 1500);
    } catch (err) {
      showToast('error', err.message || 'Failed to save beneficiary');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setSanitized = (key, type, maxLength) => (e) => {
    const sanitized = sanitizeInputValue(e.target.value, type, { maxLength });
    setForm(f => ({ ...f, [key]: sanitized }));
  };
  const setChecked = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.checked }));

  const inputClass = (hasError) =>
    `w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-600
     focus:outline-none focus:border-amber-500/60 transition-all font-medium
     ${hasError ? 'border-red-500/60' : 'border-slate-800'}`;

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  const isDisabled = loading || anyUploading;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/beneficiaries"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? "Update Person's Details" : 'Add Person to Welfare List'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {id ? 'Update contact and status information' : 'Welfare Registry & Records'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Record' : 'New Registration'}
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT COLUMN: Photos + CNIC + Info ── */}
          <div className="lg:col-span-4 space-y-5">

            {/* Profile Photo */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">Profile Photo</h3>
              </div>

              <ImageUploadField
                label="Profile Photo"
                fieldName="photo"
                currentUrl={form.photoUrl}
                onUploaded={(url) => { setForm(f => ({ ...f, photoUrl: url || '' })); onUploadSuccess('photo'); }}
                onError={(msg) => onUploadError('photo', msg)}
              />

              <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed px-2">
                1:1 ratio portrait works best for ID card printing.
              </p>
            </div>

            {/* CNIC Images */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <IdCard className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">CNIC Images</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Front Side</p>
                  <ImageUploadField
                    label="CNIC Front"
                    fieldName="cnicFront"
                    currentUrl={form.cnicFrontUrl}
                    onUploaded={(url) => { setForm(f => ({ ...f, cnicFrontUrl: url || '' })); onUploadSuccess('cnicFront'); }}
                    onError={(msg) => onUploadError('cnicFront', msg)}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Back Side</p>
                  <ImageUploadField
                    label="CNIC Back"
                    fieldName="cnicBack"
                    currentUrl={form.cnicBackUrl}
                    onUploaded={(url) => { setForm(f => ({ ...f, cnicBackUrl: url || '' })); onUploadSuccess('cnicBack'); }}
                    onError={(msg) => onUploadError('cnicBack', msg)}
                  />
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">System Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Images upload instantly on selection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Track Aid Recipients</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Secure Entry Protocol Active</span>
                </div>
              </div>
              <div className="border-t border-amber-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
              </p>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Form Cards ── */}
          <div className="lg:col-span-8 space-y-5">

            {/* Card 01: Personal Information */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">Personal Information</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input value={form.name} onChange={setSanitized('name', 'letters', 80)}
                    placeholder="e.g. Ahmed Khan" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Father's Name *</label>
                  <input value={form.fatherName} onChange={setSanitized('fatherName', 'letters', 80)}
                    placeholder="e.g. Mohammad Khan" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Husband's Name</label>
                  <input value={form.husbandName} onChange={setSanitized('husbandName', 'letters', 80)}
                    placeholder="If applicable" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>National ID (CNIC) *</label>
                  <CNICInput
                    value={form.cnic}
                    onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))}
                    className={inputClass(false)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" value={form.dob} onChange={set('dob')}
                    className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Primary Contact *</label>
                  <PhoneInput
                    value={form.mobile}
                    onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                    className={inputClass(false)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Email Address (Optional)</label>
                  <input type="email" value={form.email} onChange={set('email')}
                    placeholder="beneficiary@example.com" className={inputClass(false)} />
                </div>
              </div>
            </div>

            {/* Card 02: Economic Status */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Economic Status</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Family Size</label>
                  <input type="number" min="0" value={form.familySize} onChange={set('familySize')}
                    placeholder="e.g. 5" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Monthly Income (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.monthlyIncome} onChange={set('monthlyIncome')}
                    placeholder="e.g. 15000" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Monthly Expenses (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.monthlyExpenses} onChange={set('monthlyExpenses')}
                    placeholder="e.g. 12000" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Debt Amount (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.debtAmount} onChange={set('debtAmount')}
                    placeholder="e.g. 50000" className={inputClass(false)} />
                </div>
                <div className="sm:col-span-2">
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
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Specify Housing Status</label>
                    <input value={form.housingOther} onChange={setSanitized('housingOther', 'letters', 80)}
                      placeholder="Please specify..." className={inputClass(false)} />
                  </div>
                )}
              </div>
            </div>

            {/* Card 03: Background & Address */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">03</span>
                <h3 className="text-sm font-semibold text-slate-200">Background &amp; Address</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Full Residential Address *</label>
                  <textarea rows={3} value={form.address} onChange={setSanitized('address', 'address', 200)}
                    placeholder="House #, Street, Block, Area..."
                    className={inputClass(false) + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Town / City</label>
                  <input value={form.town} onChange={setSanitized('town', 'letters', 80)}
                    placeholder="e.g. Karachi / Hyderabad" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Specific Area</label>
                  <input value={form.area} onChange={set('area')}
                    placeholder="e.g. Saddar / Defence / Gulshan" className={inputClass(false)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Gham Name</label>
                  <input value={form.gham} onChange={set('gham')}
                    placeholder="e.g. Anjar / Bhuj / Mandvi / Mundra" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Husband Gham Name</label>
                  <input value={form.husbandGham} onChange={set('husbandGham')}
                    placeholder="If applicable" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Father's Gham Name</label>
                  <input value={form.fatherGham} onChange={set('fatherGham')}
                    placeholder="Father's gham" className={inputClass(false)} />
                </div>
              </div>
            </div>

            {/* Card 04: Professional & System Info */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">04</span>
                <h3 className="text-sm font-semibold text-slate-200">Professional &amp; System Info</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Highest Education</label>
                  <input value={form.education} onChange={set('education')}
                    placeholder="e.g. Masters / Bachelors / Matric" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Current Profession</label>
                  <input value={form.profession} onChange={set('profession')}
                    placeholder="e.g. Engineer / Businessman / Doctor" className={inputClass(false)} />
                </div>
                <div>
                  <label className={labelClass}>Firm / Company</label>
                  <input value={form.firm} onChange={set('firm')}
                    placeholder="e.g. Al-Karim Enterprises / Self" className={inputClass(false)} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={setChecked('isActive')}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer" />
                  <label htmlFor="isActive" className="text-sm font-semibold text-slate-300 cursor-pointer">
                    Currently receiving aid
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Observations / Notes</label>
                  <textarea rows={3} value={form.remarks} onChange={set('remarks')}
                    placeholder="Any additional observations..."
                    className={inputClass(false) + ' resize-none'} />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/beneficiaries"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isDisabled}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                ) : anyUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Uploading...</span></>
                ) : (
                  <><Save className="w-4 h-4" /><span>{id ? 'Update Beneficiary' : 'Register Beneficiary'}</span></>
                )}
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default BeneficiaryForm;

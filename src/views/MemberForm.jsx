import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useMemberStore } from '../store/memberStore';
import { memberService } from '../services/memberService';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { CNICInput, validateCNIC } from '../components/ui/CNICInput';
import {
  Camera, Image as ImageIcon, ShieldCheck, QrCode,
  ChevronLeft, CheckCircle, AlertCircle, Save, X,
  Upload, Loader2, IdCard,
} from 'lucide-react';

// ── Single image upload widget ────────────────────────────────────────────────
// No file-type, size, or dimension restrictions — any file the user selects
// is uploaded as-is. Validation, if ever needed, belongs at the point where
// the file is actually consumed (e.g. card printing), not here.
function ImageUploadField({ label, fieldName, currentUrl, onUploaded, onError }) {
  const [preview, setPreview]     = useState(currentUrl || null);
  const [progress, setProgress]   = useState(null);   // null | 0-100
  const [uploading, setUploading] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const inputRef = useRef(null);

  // Sync preview when parent resets the form (e.g. after load of existing member)
  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const handleSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldError(null);
    e.target.value = '';

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    setProgress(0);

    try {
      const urls = await memberService.uploadFile(fieldName, file, (pct) => setProgress(pct));
      const urlKey = fieldName === 'photo' ? 'photoUrl' : fieldName === 'cnicFront' ? 'cnicFrontUrl' : 'cnicBackUrl';
      onUploaded(urls[urlKey]);
      setProgress(100);
    } catch (err) {
      // Surface the backend's actual error message rather than a generic one
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

        {/* Progress overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs font-bold text-amber-300">{progress ?? 0}%</span>
            {/* Progress bar */}
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

      {/* Actions */}
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

      {/* Field-level error */}
      {fieldError && (
        <p className="text-xs text-red-400 text-center flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {fieldError}
        </p>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export const MemberForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members, fetchMembers, addMember, updateMember, loading } = useMemberStore();

  // Uploaded URLs (stored separately, injected into form data on submit)
  const [photoUrl,     setPhotoUrl]     = useState('');
  const [cnicFrontUrl, setCnicFrontUrl] = useState('');
  const [cnicBackUrl,  setCnicBackUrl]  = useState('');

  const [uploadErrors, setUploadErrors] = useState({});
  const [anyUploading, setAnyUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm({
    defaultValues: {
      fullName: '', fatherName: '', cnic: '', dob: '', address: '',
      mobile: '', email: '', city: '', area: '', ghamName: '',
      education: '', profession: '', company: '',
      doi: new Date().toISOString().split('T')[0],
      isActive: true,
    },
  });

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    if (id && members.length > 0) {
      const existing = members.find(m => m.id === id);
      if (existing) {
        const { photoUrl: p, cnicFrontUrl: cf, cnicBackUrl: cb, ...rest } = existing;
        reset(rest);
        setPhotoUrl(p || '');
        setCnicFrontUrl(cf || '');
        setCnicBackUrl(cb || '');
      }
    }
  }, [id, members, reset]);

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

  const onSubmit = async (data) => {
    // Block submit if an upload error is outstanding
    if (Object.keys(uploadErrors).length > 0) {
      showToast('error', 'Please fix the upload errors before submitting.');
      return;
    }

    const payload = {
      ...data,
      photoUrl:     photoUrl     || null,
      cnicFrontUrl: cnicFrontUrl || null,
      cnicBackUrl:  cnicBackUrl  || null,
    };

    try {
      if (id) {
        await updateMember(id, payload);
        showToast('success', 'Member details updated successfully!');
      } else {
        await addMember(payload);
        showToast('success', 'New member registered successfully!');
      }
      setTimeout(() => navigate('/members'), 1500);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save member details.';
      showToast('error', msg);
    }
  };

  const inputClass = (hasError) =>
    `w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-600
     focus:outline-none focus:border-amber-500/60 transition-all font-medium
     ${hasError ? 'border-red-500/60' : 'border-slate-800'}`;

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  const isDisabled = isSubmitting || loading || anyUploading;

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
            to="/members"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? 'Edit Member Record' : 'Register New Member'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Jamia Community Census &amp; Records</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Record' : 'New Registration'}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: Photos + Info */}
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
                currentUrl={photoUrl}
                onUploaded={(url) => { setPhotoUrl(url || ''); onUploadSuccess('photo'); }}
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
                    currentUrl={cnicFrontUrl}
                    onUploaded={(url) => { setCnicFrontUrl(url || ''); onUploadSuccess('cnicFront'); }}
                    onError={(msg) => onUploadError('cnicFront', msg)}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Back Side</p>
                  <ImageUploadField
                    label="CNIC Back"
                    fieldName="cnicBack"
                    currentUrl={cnicBackUrl}
                    onUploaded={(url) => { setCnicBackUrl(url || ''); onUploadSuccess('cnicBack'); }}
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
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Instant QR Generation</span>
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

          {/* RIGHT: Form Cards */}
          <div className="lg:col-span-8 space-y-5">

            {/* Card 01: Identification */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">Identification Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Member Name *</label>
                  <input
                    {...register('fullName', { required: 'Full name is required' })}
                    placeholder="Mohammed Ali"
                    className={inputClass(errors.fullName)}
                  />
                  {errors.fullName && <span className="text-xs text-red-400 mt-1 block">{errors.fullName.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Father's Name *</label>
                  <input
                    {...register('fatherName', { required: "Father's name is required" })}
                    placeholder="Ahmed Khan"
                    className={inputClass(errors.fatherName)}
                  />
                  {errors.fatherName && <span className="text-xs text-red-400 mt-1 block">{errors.fatherName.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>National ID (CNIC) *</label>
                  <Controller
                    name="cnic"
                    control={control}
                    rules={{
                      required: 'CNIC is required',
                      validate: (v) => validateCNIC(v) || 'CNIC must contain exactly 13 digits',
                    }}
                    render={({ field }) => (
                      <CNICInput {...field} className={inputClass(errors.cnic)} />
                    )}
                  />
                  {errors.cnic && <span className="text-xs text-red-400 mt-1 block">{errors.cnic.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input
                    type="date"
                    {...register('dob', { required: 'Date of birth is required' })}
                    className={inputClass(errors.dob)}
                  />
                  {errors.dob && <span className="text-xs text-red-400 mt-1 block">{errors.dob.message}</span>}
                </div>
              </div>
            </div>

            {/* Card 02: Contact & Background */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Contact &amp; Background</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Full Residential Address *</label>
                  <textarea
                    rows={3}
                    {...register('address', { required: 'Residential address is required' })}
                    placeholder="House #, Street, Block, Area..."
                    className={inputClass(errors.address) + ' resize-none'}
                  />
                  {errors.address && <span className="text-xs text-red-400 mt-1 block">{errors.address.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Primary Contact *</label>
                  <Controller
                    name="mobile"
                    control={control}
                    rules={{
                      required: 'Contact number is required',
                      validate: (v) => validatePhoneNumber(v) || 'Phone number must contain exactly 11 digits',
                    }}
                    render={({ field }) => (
                      <PhoneInput {...field} className={inputClass(errors.mobile)} />
                    )}
                  />
                  {errors.mobile && <span className="text-xs text-red-400 mt-1 block">{errors.mobile.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Email Address (Optional)</label>
                  <input type="email" {...register('email')} placeholder="member@example.com" className={inputClass(false)} />
                </div>

                <div>
                  <label className={labelClass}>Town / City</label>
                  <input {...register('city')} placeholder="e.g. Karachi / Hyderabad" className={inputClass(false)} />
                </div>

                <div>
                  <label className={labelClass}>Specific Area</label>
                  <input {...register('area')} placeholder="e.g. Saddar / Defence / Gulshan" className={inputClass(false)} />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Gham Name</label>
                  <input {...register('ghamName')} placeholder="e.g. Anjar / Bhuj / Mandvi / Mundra" className={inputClass(false)} />
                </div>
              </div>
            </div>

            {/* Card 03: Professional & System Info */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">03</span>
                <h3 className="text-sm font-semibold text-slate-200">Professional &amp; System Info</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Highest Education</label>
                  <input {...register('education')} placeholder="e.g. Masters / Bachelors / Matric" className={inputClass(false)} />
                </div>

                <div>
                  <label className={labelClass}>Current Profession</label>
                  <input {...register('profession')} placeholder="e.g. Engineer / Businessman / Doctor" className={inputClass(false)} />
                </div>

                <div>
                  <label className={labelClass}>Firm / Company</label>
                  <input {...register('company')} placeholder="e.g. Al-Karim Enterprises / Self" className={inputClass(false)} />
                </div>

                <div>
                  <label className={labelClass}>Date of Insertion (DOI)</label>
                  <input type="date" {...register('doi')} className={inputClass(false)} />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/members"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isDisabled}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting || loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                ) : anyUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Uploading...</span></>
                ) : (
                  <><Save className="w-4 h-4" /><span>{id ? 'Update Member' : 'Register Member'}</span></>
                )}
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

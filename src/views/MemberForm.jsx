import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useMemberStore } from '../store/memberStore';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { CNICInput, validateCNIC } from '../components/ui/CNICInput';
import {
  Camera, Image as ImageIcon, ShieldCheck, QrCode, ArrowRight,
  ChevronLeft, CheckCircle, AlertCircle, Save
} from 'lucide-react';

export const MemberForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members, fetchMembers, addMember, updateMember, loading } = useMemberStore();

  const [photoPreview, setPhotoPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset, control } = useForm({
    defaultValues: {
      fullName: '',
      fatherName: '',
      cnic: '',
      dob: '',
      address: '',
      mobile: '',
      email: '',
      city: '',
      area: '',
      ghamName: '',
      education: '',
      profession: '',
      company: '',
      doi: new Date().toISOString().split('T')[0],
      photoUrl: '',
      isActive: true
    }
  });

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (id && members.length > 0) {
      const existing = members.find(m => m.id === id);
      if (existing) {
        reset(existing);
        if (existing.photoUrl) {
          setPhotoPreview(existing.photoUrl);
        }
      }
    }
  }, [id, members, reset]);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setPhotoPreview(base64);
      setValue('photoUrl', base64);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data) => {
    try {
      if (id) {
        await updateMember(id, data);
        setToast({ type: 'success', message: 'Member details updated successfully!' });
      } else {
        await addMember(data);
        setToast({ type: 'success', message: 'New member registered successfully!' });
      }
      setTimeout(() => {
        navigate('/members');
      }, 1500);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save member details' });
    }
  };

  const inputClass = (hasError) =>
    `w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium ${hasError ? 'border-red-500/60' : 'border-slate-800'}`;

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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

          {/* LEFT: Photo + Info */}
          <div className="lg:col-span-4 space-y-5">

            {/* Photo Card */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">Profile Photo</h3>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full max-w-[200px] mx-auto rounded-xl border-2 border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-950/40 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group transition-all"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Portrait preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
                      Click to upload
                    </span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>

              {photoPreview && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => { setPhotoPreview(null); setValue('photoUrl', ''); }}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 transition-colors"
                  >
                    Remove Photo
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed px-2">
                1:1 ratio portrait works best for ID card printing.
              </p>
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
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Secure Entry Protocol Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Instant QR Generation</span>
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
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  01
                </span>
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
                      validate: (value) => validateCNIC(value) || 'CNIC must contain exactly 13 digits'
                    }}
                    render={({ field }) => (
                      <CNICInput
                        {...field}
                        className={inputClass(errors.cnic)}
                      />
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
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
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
                      validate: (value) => validatePhoneNumber(value) || 'Phone number must contain exactly 11 digits'
                    }}
                    render={({ field }) => (
                      <PhoneInput
                        {...field}
                        className={inputClass(errors.mobile)}
                      />
                    )}
                  />
                  {errors.mobile && <span className="text-xs text-red-400 mt-1 block">{errors.mobile.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Email Address (Optional)</label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="member@example.com"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Town / City</label>
                  <input
                    {...register('city')}
                    placeholder="e.g. Karachi / Hyderabad"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Specific Area</label>
                  <input
                    {...register('area')}
                    placeholder="e.g. Saddar / Defence / Gulshan"
                    className={inputClass(false)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Gham Name</label>
                  <input
                    {...register('ghamName')}
                    placeholder="e.g. Anjar / Bhuj / Mandvi / Mundra"
                    className={inputClass(false)}
                  />
                </div>
              </div>
            </div>

            {/* Card 03: System Metadata */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  03
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Professional &amp; System Info</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Highest Education</label>
                  <input
                    {...register('education')}
                    placeholder="e.g. Masters / Bachelors / Matric"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Current Profession</label>
                  <input
                    {...register('profession')}
                    placeholder="e.g. Engineer / Businessman / Doctor"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Firm / Company</label>
                  <input
                    {...register('company')}
                    placeholder="e.g. Al-Karim Enterprises / Self"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Date of Insertion (DOI)</label>
                  <input
                    type="date"
                    {...register('doi')}
                    className={inputClass(false)}
                  />
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
                disabled={isSubmitting || loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting || loading ? 'Saving...' : (id ? 'Update Member' : 'Register Member')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

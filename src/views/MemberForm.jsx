import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMemberStore } from '../store/memberStore';
import { 
  Camera, Image as ImageIcon, ShieldCheck, QrCode, ArrowRight, 
  ChevronLeft, CheckCircle, AlertCircle, User, Users, Building, 
  MapPin, Phone, Mail, Briefcase, GraduationCap, Calendar
} from 'lucide-react';

export const MemberForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members, fetchMembers, addMember, updateMember, loading } = useMemberStore();
  
  const [photoPreview, setPhotoPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset } = useForm({
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

  return (
    <div className="min-h-screen bg-[#11141c] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' 
            : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className="text-xs font-bold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex items-center justify-between">
        <Link to="/members" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors bg-[#1e2330] px-4 py-2.5 rounded-xl border border-slate-800">
          <ChevronLeft className="w-4 h-4" /> Back to Members Directory
        </Link>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            {id ? 'EDITING MEMBER RECORD' : 'NEW REGISTRATION PROTOCOL'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT COLUMN: Profile Photo & System Integrity (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* PROFILE PHOTO CARD */}
            <div className="bg-[#1e2330] rounded-3xl border border-slate-800/80 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-5">
                <Camera className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">PROFILE PHOTO</h3>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full max-w-[220px] mx-auto rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-amber-500/60 bg-[#151922] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group transition-all shadow-inner"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Portrait preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase group-hover:text-slate-200 transition-colors">
                      SELECT PORTRAIT
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
                    className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20"
                  >
                    Remove Photo
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center mt-5 leading-relaxed font-medium px-2">
                High quality portraits ensure clear ID card printing. Aspect ratio 1:1 is best.
              </p>
            </div>

            {/* SYSTEM INTEGRITY CARD (Dark Copper / Amber Theme) */}
            <div className="bg-gradient-to-br from-[#382318] to-[#241710] rounded-3xl border border-[#5c3724] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[#e8a574]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-4 h-4 text-[#e8a574]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#e8a574]">SYSTEM INTEGRITY</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#523121] flex items-center justify-center shrink-0 border border-[#6d422c]">
                    <ShieldCheck className="w-4 h-4 text-[#f3ba8e]" />
                  </div>
                  <span className="text-xs font-extrabold text-[#ebd0be] uppercase tracking-wider">
                    SECURE ENTRY PROTOCOL ACTIVE
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#523121] flex items-center justify-center shrink-0 border border-[#6d422c]">
                    <QrCode className="w-4 h-4 text-[#f3ba8e]" />
                  </div>
                  <span className="text-xs font-extrabold text-[#ebd0be] uppercase tracking-wider">
                    INSTANT QR GENERATION
                  </span>
                </div>
              </div>

              <div className="border-t border-[#5c3724]/80 my-5" />

              <p className="text-[10px] font-extrabold tracking-widest text-[#d19b75] uppercase leading-relaxed">
                FIELDS WITH * ARE MANDATORY FOR SYSTEM COMPLIANCE.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: 3 Numbered Details Cards (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* CARD 01: IDENTIFICATION DETAILS */}
            <div className="bg-[#1e2330] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
              <div className="bg-[#252b3b] px-6 py-4 border-b border-slate-800/80 flex items-center gap-3.5">
                <span className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  01
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                  IDENTIFICATION DETAILS
                </h3>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    FULL MEMBER NAME *
                  </label>
                  <input 
                    {...register('fullName', { required: 'Full Member Name is required' })}
                    placeholder="MOHAMMED ALI"
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase ${errors.fullName ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.fullName && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.fullName.message}</span>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    FATHER'S NAME *
                  </label>
                  <input 
                    {...register('fatherName', { required: "Father's Name is required" })}
                    placeholder="AHMED KHAN"
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase ${errors.fatherName ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.fatherName && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.fatherName.message}</span>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    NATIONAL ID (CNIC) *
                  </label>
                  <input 
                    {...register('cnic', { required: 'CNIC is required' })}
                    placeholder="00000-0000000-0"
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-mono font-semibold ${errors.cnic ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.cnic && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.cnic.message}</span>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    DATE OF BIRTH *
                  </label>
                  <input 
                    type="date"
                    {...register('dob', { required: 'Date of birth is required' })}
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold ${errors.dob ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.dob && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.dob.message}</span>}
                </div>
              </div>
            </div>

            {/* CARD 02: CONTACT & BACKGROUND */}
            <div className="bg-[#1e2330] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
              <div className="bg-[#252b3b] px-6 py-4 border-b border-slate-800/80 flex items-center gap-3.5">
                <span className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  02
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                  CONTACT & BACKGROUND
                </h3>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    FULL RESIDENTIAL ADDRESS *
                  </label>
                  <textarea 
                    rows={3}
                    {...register('address', { required: 'Residential address is required' })}
                    placeholder="House #, Street, Block, Area..."
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-medium resize-none ${errors.address ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.address && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.address.message}</span>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    PRIMARY CONTACT *
                  </label>
                  <input 
                    {...register('mobile', { required: 'Primary contact number is required' })}
                    placeholder="03XXXXXXXXX"
                    className={`w-full px-4 py-3 rounded-2xl bg-[#151922] border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-mono font-semibold ${errors.mobile ? 'border-red-500/60' : 'border-slate-800'}`}
                  />
                  {errors.mobile && <span className="text-[11px] text-red-400 mt-1 block font-medium">⚠️ {errors.mobile.message}</span>}
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    EMAIL ADDRESS (OPTIONAL)
                  </label>
                  <input 
                    type="email"
                    {...register('email')}
                    placeholder="member@example.com"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    TOWN / CITY
                  </label>
                  <input 
                    {...register('city')}
                    placeholder="e.g. Karachi / Hyderabad"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    SPECIFIC AREA
                  </label>
                  <input 
                    {...register('area')}
                    placeholder="e.g. Saddar / Defence / Gulshan"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    GHAM NAME
                  </label>
                  <input 
                    {...register('ghamName')}
                    placeholder="e.g. Anjar / Bhuj / Mandvi / Mundra"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>
              </div>
            </div>

            {/* CARD 03: SYSTEM METADATA */}
            <div className="bg-[#1e2330] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
              <div className="bg-[#252b3b] px-6 py-4 border-b border-slate-800/80 flex items-center gap-3.5">
                <span className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  03
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                  SYSTEM METADATA
                </h3>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    HIGHEST EDUCATION
                  </label>
                  <input 
                    {...register('education')}
                    placeholder="e.g. Masters / Bachelors / Matric"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    CURRENT PROFESSION
                  </label>
                  <input 
                    {...register('profession')}
                    placeholder="e.g. Engineer / Businessman / Doctor"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    FIRM / COMPANY
                  </label>
                  <input 
                    {...register('company')}
                    placeholder="e.g. Al-Karim Enterprises / Self"
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                    DOI (DATE OF INSERTION)
                  </label>
                  <input 
                    type="date"
                    {...register('doi')}
                    className="w-full px-4 py-3 rounded-2xl bg-[#151922] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-[#181d28] transition-all font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* BOTTOM SUBMIT BAR */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link 
                to="/members" 
                className="px-6 py-4 rounded-2xl bg-[#1e2330] hover:bg-slate-800 text-slate-300 font-extrabold text-xs uppercase tracking-wider border border-slate-800 transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#5c3624] to-[#4a2b1c] hover:from-[#6d402a] hover:to-[#583321] text-[#ebd0be] font-extrabold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-[#382318]/50 border border-[#7a4831]/60 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting || loading ? 'REGISTERING...' : (id ? 'UPDATE MEMBER' : 'REGISTER MEMBER')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </form>

      {/* FOOTER */}
      <footer className="mt-16 mb-6 text-center border-t border-slate-800/60 pt-8">
        <p className="text-xs font-semibold text-slate-500 tracking-wide">
          © 2026 Kutchi Muslim Loharwada Jangadh. Built with passion for the community.
        </p>
      </footer>
    </div>
  );
};

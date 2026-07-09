import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useDonorStore } from '../store/donorStore';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { CNICInput, validateCNIC } from '../components/ui/CNICInput';
import {
  Users, ShieldCheck, QrCode, ChevronLeft, CheckCircle, AlertCircle, Save
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const DonorForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { donors, fetchDonors, addDonor, updateDonor, loading } = useDonorStore();

  const [toast, setToast] = useState(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control } = useForm({
    defaultValues: {
      fullName: '',
      fatherName: '',
      cnic: '',
      mobile: '',
      email: '',
      address: '',
      city: '',
      isActive: true
    }
  });

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  useEffect(() => {
    if (id && donors.length > 0) {
      const existing = donors.find(d => d.id === id);
      if (existing) {
        reset(existing);
      }
    }
  }, [id, donors, reset]);

  const onSubmit = async (data) => {
    try {
      if (id) {
        await updateDonor(id, data);
        setToast({ type: 'success', message: 'Donor details updated successfully!' });
      } else {
        await addDonor(data);
        setToast({ type: 'success', message: 'New donor registered successfully!' });
      }
      setTimeout(() => {
        navigate('/donors');
      }, 1500);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to save donor details' });
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
            to="/donors"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? 'Edit Donor Record' : 'Register New Donor'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Charitable Donors Directory</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Record' : 'New Registration'}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: Info */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Donor Registration Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Manage Charitable Contributors</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Auto-Generated Donor Codes</span>
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
                <h3 className="text-sm font-semibold text-slate-200">Personal Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Full Name *</label>
                  <input
                    {...register('fullName', { required: 'Full name is required' })}
                    placeholder="e.g. Muhammad Ali"
                    className={inputClass(errors.fullName)}
                  />
                  {errors.fullName && <span className="text-xs text-red-400 mt-1 block">{errors.fullName.message}</span>}
                </div>

                <div>
                  <label className={labelClass}>Father / Husband Name</label>
                  <input
                    {...register('fatherName')}
                    placeholder="e.g. Abdul Rahman"
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>CNIC / ID No</label>
                  <Controller
                    name="cnic"
                    control={control}
                    rules={{ 
                      validate: (value) => !value || validateCNIC(value) || 'CNIC must contain exactly 13 digits'
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
              </div>
            </div>

            {/* Card 02: Contact Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Contact Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Mobile Phone</label>
                  <Controller
                    name="mobile"
                    control={control}
                    rules={{ 
                      validate: (value) => !value || validatePhoneNumber(value) || 'Phone number must contain exactly 11 digits'
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
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="e.g. donor@example.com"
                    className={inputClass(false)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Address</label>
                  <input
                    {...register('address')}
                    placeholder="Street address, house number, etc."
                    className={inputClass(false)}
                  />
                </div>

                <div>
                  <label className={labelClass}>City</label>
                  <input
                    {...register('city')}
                    placeholder="e.g. Karachi"
                    className={inputClass(false)}
                  />
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden p-5 flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-300 font-semibold">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-slate-800 bg-slate-950/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer"
                />
                Active Donor Account
              </label>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                to="/donors"
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
                <span>{isSubmitting || loading ? 'Saving...' : (id ? 'Update Donor' : 'Register Donor')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default DonorForm;

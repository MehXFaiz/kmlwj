import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { PhoneInput, validatePhoneNumber } from '../components/ui/PhoneInput';
import { Save, ChevronLeft, Calendar, User, Phone, MapPin, Clock, CreditCard, Landmark, Info } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useHallBookingStore } from '../store/hallBookingStore';
import { useCoaStore } from '../store/coaStore';
import { showToast } from '../components/ui/Toast';
import { HallBookingReceiptModal } from '../components/receipts/HallBookingReceiptModal';
import api from '../services/api';
import HallBookingConflictModal from '../components/common/HallBookingConflictModal';
import HallBookingCalendar from '../components/common/HallBookingCalendar';

const getNormalizedHallName = (name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('bagh') || n.includes('hajiani') || n.includes('hajiyani') || n.includes('kareema')) return 'Bagh-e-Hajiani Kareema';
  if (n.includes('sadaya') || n.includes('sada')) return 'Sadaya Hall';
  if (n.includes('zikarya') || n.includes('zikriya') || n.includes('zakaria') || n.includes('zakriya')) return 'Zikarya Hall';
  if (n.includes('annexy') || n.includes('anexy') || n.includes('gosha') || n.includes('anxy')) return 'Annexy Hall';
  return null;
};

export const HallBookingForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { bookings, fetchBookings, addBooking, updateBooking, fetchBookingById } = useHallBookingStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const [newlyCreatedBooking, setNewlyCreatedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [availability, setAvailability] = useState({ checking: false, available: true, conflict: null });
  const [showConflictModal, setShowConflictModal] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, dirtyFields, errors }, control } = useForm({
    defaultValues: {
      bookerName: '',
      fatherHusbandName: '',
      mobile: '',
      address: '',
      bookingDate: new Date().toISOString().split('T')[0],
      programDate: '',
      programType: '',
      functionType: '',
      functionTypeOther: '',
      timeFrom: '',
      timeTo: '',
      timings: 'Evening',
      hallId: '',
      isForJamaat: false,
      amount: '',
      discount: '0',
      netAmount: '',
      receivedAmount: '',
      paymentMethod: 'CASH',
      bankAccountId: '',
      chequeNumber: '',
      chequeBankName: '',
      remarks: ''
    }
  });

  const paymentMethod = watch('paymentMethod');
  const hallId = watch('hallId');
  const isForJamaat = watch('isForJamaat');
  const programDate = watch('programDate');
  const timings = watch('timings');
  const functionType = watch('functionType');
  const amountVal = watch('amount');
  const discountVal = watch('discount');

  useEffect(() => {
    fetchAccountsList();
    fetchBookings();
  }, [fetchAccountsList, fetchBookings]);

  useEffect(() => {
    if (!id) return;

    const loadBooking = async () => {
      setLoading(true);
      try {
        const booking = await fetchBookingById(id);
        if (booking) {
          const formattedDate = booking.programDate ? new Date(booking.programDate).toISOString().split('T')[0] : '';
          const formattedBookingDate = booking.bookingDate ? new Date(booking.bookingDate).toISOString().split('T')[0] : (booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          let resolvedHallId = booking.hallId || '';
          if (resolvedHallId && flatAccounts) {
            const acc = flatAccounts.find(a => a.id === resolvedHallId);
            if (acc) {
              const normName = getNormalizedHallName(acc.name || acc.accountName);
              if (normName) {
                const canonicalAcc = flatAccounts.find(a => (a.type === 'Revenue' || a.accountTypeName === 'REVENUE' || a.accountTypeName === 'Revenue') && getNormalizedHallName(a.name || a.accountName) === normName);
                if (canonicalAcc) resolvedHallId = canonicalAcc.id;
              }
            }
          }
          reset({
            bookerName: booking.bookerName || '',
            fatherHusbandName: booking.fatherHusbandName || '',
            mobile: booking.mobile || '',
            address: booking.address || '',
            bookingDate: formattedBookingDate,
            programDate: formattedDate,
            programType: booking.programType || '',
            functionType: booking.functionType || '',
            functionTypeOther: '',
            timeFrom: booking.timeFrom || '',
            timeTo: booking.timeTo || '',
            timings: booking.timings || 'Evening',
            hallId: resolvedHallId,
            isForJamaat: booking.isForJamaat || false,
            amount: booking.amount || '',
            discount: booking.discount != null ? String(booking.discount) : '0',
            netAmount: booking.netAmount != null ? String(booking.netAmount) : '',
            receivedAmount: booking.receivedAmount != null ? String(booking.receivedAmount) : '',
            paymentMethod: booking.paymentMethod || 'CASH',
            bankAccountId: booking.bankAccountId || '',
            chequeNumber: booking.chequeNumber || '',
            chequeBankName: booking.chequeBankName || '',
            remarks: booking.remarks || ''
          });
        }
      } catch (err) {
        showToast(err.message || 'Failed to load booking details', 'error');
        navigate('/hall-bookings');
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [id, fetchBookingById, reset, navigate]);

  const hallAccounts = React.useMemo(() => {
    const seen = new Set();
    const result = [];
    const standardHalls = ['Bagh-e-Hajiani Kareema', 'Sadaya Hall', 'Zikarya Hall', 'Annexy Hall'];

    (flatAccounts || []).forEach(a => {
      if (a.type === 'Revenue' || a.accountTypeName === 'REVENUE' || a.accountTypeName === 'Revenue') {
        const normalized = getNormalizedHallName(a.name || a.accountName);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          result.push({
            ...a,
            name: normalized
          });
        }
      }
    });

    return result.sort((a, b) => {
      const idxA = standardHalls.indexOf(a.name);
      const idxB = standardHalls.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [flatAccounts]);

  const bankAccounts = flatAccounts.filter(a =>
    (a.type === 'Asset' || a.accountTypeName === 'ASSET') &&
    a.level === 'SUBSIDIARY' &&
    a.name.toLowerCase().includes('bank')
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const activeBookings = (bookings || [])
    .filter(b => b.id !== id && b.status !== 'Cancelled' && b.status !== 'Rejected')
    .filter(b => {
      if (!b.programDate) return false;
      if (showAllDates) return true;
      const bDate = new Date(b.programDate).toISOString().split('T')[0];
      return bDate >= todayStr;
    })
    .filter(b => !hallId || b.hallId === hallId || b.hallAccount?.id === hallId || b.hallAccount?.accountId === hallId)
    .sort((a, b) => new Date(a.programDate) - new Date(b.programDate));

  const conflictBooking = (bookings || []).find(b => {
    if (b.id === id || b.status === 'Cancelled' || b.status === 'Rejected') return false;
    if (!b.programDate || !programDate) return false;
    const bDate = new Date(b.programDate).toISOString().split('T')[0];
    if (bDate !== programDate) return false;
    if (hallId && b.hallId !== hallId && b.hallAccount?.id !== hallId && b.hallAccount?.accountId !== hallId) return false;
    if (b.timings === timings || b.timings === 'Full Day' || timings === 'Full Day' || !timings || !b.timings) return true;
    return false;
  });

  useEffect(() => {
    if (!hallId || !programDate) {
      setAvailability({ checking: false, available: true, conflict: null });
      return;
    }
    let isMounted = true;
    setAvailability(prev => ({ ...prev, checking: true }));

    api.get('/api/v1/hall-bookings/check-availability', {
      params: {
        hallId,
        bookingDate: programDate,
        excludeId: id || undefined
      }
    })
    .then(res => {
      if (!isMounted) return;
      if (res.data && res.data.available === false) {
        setAvailability({ checking: false, available: false, conflict: res.data });
        setShowConflictModal(true);
      } else {
        setAvailability({ checking: false, available: true, conflict: null });
      }
    })
    .catch(err => {
      if (!isMounted) return;
      console.error('Availability check error:', err);
      setAvailability({ checking: false, available: true, conflict: null });
    });

    return () => { isMounted = false; };
  }, [hallId, programDate, id]);

  // Fixed payment rates removed per user request so amounts can be entered manually

  const onSubmit = async (data) => {
    if (!data.bookerName || !data.bookingDate || !data.programDate || !data.hallId || !data.amount) {
      showToast('Please fill all required fields.', 'warning');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (data.programDate < todayStr) {
      showToast('Program date must be today or a future date.', 'warning');
      return;
    }

    // Resolve functionType: if 'Other' use the free-text field
    const resolvedFunctionType = data.functionType === 'Other'
      ? (data.functionTypeOther || 'Other')
      : data.functionType;

    const parsedAmount = Math.round(parseFloat(data.amount));
    const parsedDiscount = parseFloat(data.discount) || 0;
    const parsedNetAmount = data.netAmount ? Math.round(parseFloat(data.netAmount)) : parsedAmount - parsedDiscount;
    const parsedReceivedAmount = data.receivedAmount ? Math.round(parseFloat(data.receivedAmount)) : null;

    try {
      let savedBooking;
      const payload = {
        ...data,
        functionType: resolvedFunctionType,
        amount: parsedAmount,
        discount: parsedDiscount,
        netAmount: parsedNetAmount,
        receivedAmount: parsedReceivedAmount,
      };
      if (id) {
        savedBooking = await updateBooking(id, payload);
        showToast('Booking updated successfully!', 'success');
      } else {
        savedBooking = await addBooking(payload);
        showToast('Booking saved successfully!', 'success');
      }
      setNewlyCreatedBooking(savedBooking);
    } catch (err) {
      showToast(err.message || "Couldn't save booking. Try again.", 'error');
    }
  };

  const handleCloseReceipt = () => {
    setNewlyCreatedBooking(null);
    navigate('/hall-bookings');
  };

  const inputClass = (hasError) =>
    `w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium ${hasError ? 'border-red-500/60' : 'border-slate-800'}`;

  const inputWithIconClass = (hasError) =>
    `w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium ${hasError ? 'border-red-500/60' : 'border-slate-800'}`;

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title'), id ? 'Edit Booking' : 'New Booking']}>
        <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading booking details...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title'), id ? 'Edit Booking' : 'New Booking']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/hall-bookings"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-100">
                {id ? 'Edit Booking' : t('tables.hallBookings.newBooking')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {id ? 'Edit details for this hall booking' : t('tables.hallBookings.newBookingDesc')}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            {id ? 'Editing Record' : 'New Booking'}
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Info & Reserved Dates */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">Booking Guidelines</h3>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Check the <strong>Reserved Dates Panel</strong> below to avoid booking conflicts.
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Timings: Morning, Afternoon, Evening, Night</span>
                  </div>
                </div>
                <div className="border-t border-amber-500/20 my-4" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory. Jamaat discounts apply automatically when checked.
                </p>
              </div>

              {/* Reserved / Booked Dates Panel */}
              <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 space-y-3 shadow-lg shadow-black/20">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        {hallId ? `Reserved Dates: ${hallAccounts.find(h => h.id === hallId)?.name || 'Selected Hall'}` : 'All Reserved Program Dates'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {hallId ? 'Showing booked programs for the selected hall' : 'Select a hall above to filter bookings specifically for that hall'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/80">
                      <button
                        type="button"
                        onClick={() => setActiveTab('list')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${activeTab === 'list' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        List View
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('calendar')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${activeTab === 'calendar' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Calendar Grid
                      </button>
                    </div>
                    {activeTab === 'list' && (
                      <button
                        type="button"
                        onClick={() => setShowAllDates(!showAllDates)}
                        className="px-2.5 py-1 text-xs font-medium rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        {showAllDates ? 'Showing All Dates' : 'Showing Upcoming Only'}
                      </button>
                    )}
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {activeBookings.length} Booked
                    </span>
                  </div>
                </div>

                {activeTab === 'calendar' ? (
                  <HallBookingCalendar
                    bookings={bookings}
                    selectedHallId={hallId}
                    selectedDate={programDate}
                    onSelectDate={(d) => setValue('programDate', d, { shouldValidate: true })}
                  />
                ) : activeBookings.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60">
                    No {showAllDates ? '' : 'upcoming'} bookings found {hallId ? 'for this hall' : ''}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                    {activeBookings.map((b) => {
                      const bDateStr = b.programDate ? new Date(b.programDate).toISOString().split('T')[0] : '';
                      const isConflict = bDateStr && programDate && bDateStr === programDate &&
                        (!hallId || b.hallId === hallId || b.hallAccount?.id === hallId || b.hallAccount?.accountId === hallId) &&
                        (!timings || timings === 'Full Day' || b.timings === 'Full Day' || b.timings === timings);

                      return (
                        <div
                          key={b.id}
                          className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                            isConflict
                              ? 'bg-red-500/10 border-red-500 text-red-200 shadow-md shadow-red-500/10 animate-pulse'
                              : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5 border-b border-slate-800/60 pb-1.5">
                              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[13px]">
                                <Clock className="h-3.5 w-3.5 text-amber-400" />
                                {b.programDate ? new Date(b.programDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isConflict ? 'bg-red-500 text-white font-black' : 'bg-slate-800 text-amber-300 border border-slate-700'
                              }`}>
                                {b.timings || 'Any time'}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-300 truncate mt-1">
                              {b.programType ? `${b.programType} • ` : ''}{b.bookerName}
                            </div>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                            <span className="truncate flex items-center gap-1">
                              📍 {b.hallAccount?.accountName || b.hallAccount?.name || 'Hall'}
                            </span>
                            {isConflict && (
                              <span className="font-bold text-red-400 flex items-center gap-0.5">
                                ⚠️ Conflict!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Form Cards */}
            <div className="lg:col-span-8 space-y-5">
              {/* Card 01: Booker Details */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    01
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-400" /> {t('receipt.bookerName')} Details
                  </h3>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t('receipt.bookerName')} *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input {...register('bookerName', {
                        required: 'Booker name is required',
                        pattern: {
                          value: /^[a-zA-Z\s.-]{3,50}$/,
                          message: 'Only letters, spaces, hyphens, and dots (3-50 chars)'
                        }
                      })} required
                        className={inputWithIconClass(errors.bookerName)} />
                    </div>
                    {errors.bookerName && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.bookerName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Father / Husband Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input {...register('fatherHusbandName', {
                        pattern: {
                          value: /^$|^[a-zA-Z\s.-]{3,50}$/,
                          message: 'Only letters, spaces, hyphens, and dots (3-50 chars)'
                        }
                      })}
                        placeholder="Father or Husband name"
                        className={inputWithIconClass(errors.fatherHusbandName)} />
                    </div>
                    {errors.fatherHusbandName && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.fatherHusbandName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>{t('receipt.mobile')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Controller
                        name="mobile"
                        control={control}
                        rules={{
                          validate: (value) => !value || validatePhoneNumber(value) || 'Phone number must contain exactly 11 digits'
                        }}
                        render={({ field }) => (
                          <PhoneInput
                            {...field}
                            className={`${inputWithIconClass(errors.mobile)}`}
                          />
                        )}
                      />
                    </div>
                    {errors.mobile && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.mobile.message}</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t('receipt.address')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input {...register('address', {
                        pattern: {
                          value: /^$|^[a-zA-Z0-9\s.,#\/-]{5,100}$/,
                          message: 'Alphanumeric, spaces, and basic punctuation only (5-100 chars)'
                        }
                      })}
                        className={inputWithIconClass(errors.address)} />
                    </div>
                    {errors.address && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.address.message}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 02: Program Details */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    02
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" /> Program Details
                  </h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>{t('receipt.bookingDate') || 'Booking Date'} *</label>
                      <input type="date" {...register('bookingDate', {
                        required: 'Booking date is required',
                        pattern: {
                          value: /^\d{4}-\d{2}-\d{2}$/,
                          message: 'Date must be in YYYY-MM-DD format'
                        }
                      })} required
                        className={inputClass(errors.bookingDate)} />
                      {errors.bookingDate && (
                        <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.bookingDate.message}</span>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>{t('receipt.programDate')} *</label>
                      <input type="date" {...register('programDate', {
                        required: 'Program date is required',
                        pattern: {
                          value: /^\d{4}-\d{2}-\d{2}$/,
                          message: 'Date must be in YYYY-MM-DD format'
                        }
                      })} required
                        className={`${inputClass(errors.programDate || !availability.available)} ${!availability.available ? '!border-red-500 !bg-red-950/30 !text-red-200 ring-2 ring-red-500/50' : ''}`} />
                      {errors.programDate && (
                        <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.programDate.message}</span>
                      )}
                      {(!availability.available || conflictBooking) && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 animate-pulse shadow-md shadow-red-500/10">
                          <span className="text-sm">⚠️</span>
                          <span>
                            <strong>Booked:</strong> {availability.conflict?.hallName || conflictBooking?.hallAccount?.accountName || 'This hall'} is already booked on this date by <strong>{availability.conflict?.bookedBy || conflictBooking?.bookerName || 'another customer'}</strong>. Please choose another date.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Function Type */}
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Function Type</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {['Nikah', 'Wedding', 'Mehndi', 'Birthday', 'Meeting', 'Other'].map((type) => (
                          <label
                            key={type}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                              functionType === type
                                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                                : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              value={type}
                              {...register('functionType')}
                              className="sr-only"
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                      {functionType === 'Other' && (
                        <input
                          {...register('functionTypeOther')}
                          placeholder="Specify function type..."
                          className={`${inputClass(false)} mt-2`}
                        />
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>{t('receipt.timings')}</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <select {...register('timings', {
                          pattern: {
                            value: /^(Morning|Afternoon|Evening|Night|Full Day)$/,
                            message: 'Invalid timing selected'
                          }
                        })}
                          className={inputWithIconClass(errors.timings)}>
                          <option value="Morning">Morning</option>
                          <option value="Afternoon">Afternoon</option>
                          <option value="Evening">Evening</option>
                          <option value="Night">Night</option>
                          <option value="Full Day">Full Day</option>
                        </select>
                      </div>
                      {errors.timings && (
                        <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.timings.message}</span>
                      )}
                    </div>

                    {/* Time From / To */}
                    <div>
                      <label className={labelClass}>Time: From – To</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          {...register('timeFrom')}
                          className={`${inputClass(false)} flex-1`}
                        />
                        <span className="text-slate-500 text-xs font-semibold shrink-0">to</span>
                        <input
                          type="time"
                          {...register('timeTo')}
                          className={`${inputClass(false)} flex-1`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>{t('receipt.hall')} *</label>
                      <select {...register('hallId', {
                        required: 'Hall selection is required',
                        pattern: {
                          value: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
                          message: 'Invalid Hall selection'
                        }
                      })} required
                        className={inputClass(errors.hallId)}>
                        <option value="">-- Select Hall --</option>
                        {hallAccounts.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                      {errors.hallId && (
                        <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.hallId.message}</span>
                      )}
                    </div>

                    <div className="flex items-end">
                      <label className="w-full flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 transition-colors">
                        <input type="checkbox" {...register('isForJamaat')} className="w-4 h-4 accent-amber-500" />
                        <span className="text-sm font-semibold text-slate-300">{t('receipt.forJamaat')}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 03: Payment Details */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    03
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-amber-400" /> Payment Details
                  </h3>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hall Charges */}
                  <div>
                    <label className={labelClass}>Hall Charges (Rs) *</label>
                    <input type="text" {...register('amount', {
                      required: 'Amount is required',
                      pattern: {
                        value: /^[1-9]\d*$/,
                        message: 'Positive whole number'
                      }
                    })} required
                      onChange={(e) => {
                        register('amount').onChange(e);
                        const amt = parseFloat(e.target.value) || 0;
                        const disc = parseFloat(discountVal) || 0;
                        setValue('netAmount', String(Math.max(0, amt - disc)));
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-lg font-bold text-emerald-400 focus:outline-none focus:border-amber-500/60 transition-all ${errors.amount ? 'border-red-500/60' : 'border-slate-800'}`} />
                    {errors.amount && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.amount.message}</span>
                    )}
                  </div>

                  {/* Discount */}
                  <div>
                    <label className={labelClass}>Discount (Rs)</label>
                    <input type="text" {...register('discount', {
                      pattern: {
                        value: /^\d*(\.\d+)?$/,
                        message: 'Must be a non-negative number'
                      }
                    })}
                      placeholder="0"
                      onChange={(e) => {
                        register('discount').onChange(e);
                        const amt = parseFloat(amountVal) || 0;
                        const disc = parseFloat(e.target.value) || 0;
                        setValue('netAmount', String(Math.max(0, amt - disc)));
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-lg font-bold text-orange-400 focus:outline-none focus:border-amber-500/60 transition-all ${errors.discount ? 'border-red-500/60' : 'border-slate-800'}`} />
                    {errors.discount && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.discount.message}</span>
                    )}
                  </div>

                  {/* Net Amount */}
                  <div>
                    <label className={labelClass}>Net Amount (Rs)</label>
                    <input type="text" {...register('netAmount', {
                      pattern: {
                        value: /^\d*(\.\d+)?$/,
                        message: 'Must be a non-negative number'
                      }
                    })}
                      placeholder="Auto-computed"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-lg font-bold text-amber-400 focus:outline-none focus:border-amber-500/60 transition-all ${errors.netAmount ? 'border-red-500/60' : 'border-slate-700'}`} />
                    {errors.netAmount && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.netAmount.message}</span>
                    )}
                    <p className="text-xs text-slate-500 mt-1">Auto-filled as Hall Charges − Discount. Editable.</p>
                  </div>

                  {/* Received Amount */}
                  <div>
                    <label className={labelClass}>Received Amount (Rs)</label>
                    <input type="text" {...register('receivedAmount', {
                      pattern: {
                        value: /^\d*(\.\d+)?$/,
                        message: 'Must be a non-negative number'
                      }
                    })}
                      placeholder="Amount received"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border text-lg font-bold text-sky-400 focus:outline-none focus:border-amber-500/60 transition-all ${errors.receivedAmount ? 'border-red-500/60' : 'border-slate-800'}`} />
                    {errors.receivedAmount && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.receivedAmount.message}</span>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className={labelClass}>Payment Method *</label>
                    <select {...register('paymentMethod', {
                      required: 'Payment method is required',
                      pattern: {
                        value: /^(CASH|BANK|CHEQUE)$/,
                        message: 'Invalid payment method selected'
                      }
                    })}
                      className={inputClass(errors.paymentMethod)}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                    {errors.paymentMethod && (
                      <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.paymentMethod.message}</span>
                    )}
                  </div>

                  {paymentMethod !== 'CASH' && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Select Receiving Bank Account *</label>
                      <div className="relative">
                        <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <select {...register('bankAccountId', {
                          required: 'Bank account is required',
                          pattern: {
                            value: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
                            message: 'Invalid bank account selection'
                          }
                        })} required
                          className={inputWithIconClass(errors.bankAccountId)}>
                          <option value="">-- Select Bank Account --</option>
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      {errors.bankAccountId && (
                        <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.bankAccountId.message}</span>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'CHEQUE' && (
                    <>
                      <div>
                        <label className={labelClass}>Cheque Number *</label>
                        <input type="text" {...register('chequeNumber', {
                          required: 'Cheque number is required',
                          pattern: {
                            value: /^[0-9]{6,20}$/,
                            message: 'Cheque number must contain only digits (6-20 digits)'
                          }
                        })} required
                          className={inputClass(errors.chequeNumber)} />
                        {errors.chequeNumber && (
                          <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.chequeNumber.message}</span>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>Drawn On Bank *</label>
                        <div className="relative">
                          <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          <select {...register('chequeBankName', {
                            required: 'Bank selection is required',
                            pattern: {
                              value: /^[a-zA-Z0-9\s.()\&-]{3,50}$/,
                              message: 'Invalid bank name selection'
                            }
                          })} required
                            className={inputWithIconClass(errors.chequeBankName)}>
                            <option value="">-- Select Bank --</option>
                            <option value="Meezan Bank">Meezan Bank</option>
                            <option value="Habib Bank Limited (HBL)">Habib Bank Limited (HBL)</option>
                            <option value="United Bank Limited (UBL)">United Bank Limited (UBL)</option>
                            <option value="MCB Bank">MCB Bank</option>
                            <option value="Allied Bank Limited (ABL)">Allied Bank Limited (ABL)</option>
                            <option value="Bank Alfalah">Bank Alfalah</option>
                            <option value="Standard Chartered Bank">Standard Chartered Bank</option>
                            <option value="Askari Bank">Askari Bank</option>
                            <option value="Bank Al Habib">Bank Al Habib</option>
                            <option value="Faysal Bank">Faysal Bank</option>
                            <option value="Soneri Bank">Soneri Bank</option>
                            <option value="JS Bank">JS Bank</option>
                            <option value="Habib Metropolitan Bank">Habib Metropolitan Bank</option>
                            <option value="Dubai Islamic Bank">Dubai Islamic Bank</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        {errors.chequeBankName && (
                          <span className="text-xs text-red-400 mt-1 block">⚠️ {errors.chequeBankName.message}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Submit Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Link to="/hall-bookings"
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                  Cancel
                </Link>
                <button type="submit" disabled={isSubmitting || !availability.available}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : id ? 'Update Booking' : 'Save Booking'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {newlyCreatedBooking && (
        <HallBookingReceiptModal
          booking={newlyCreatedBooking}
          onClose={handleCloseReceipt}
        />
      )}

      <HallBookingConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onChooseAnotherDate={() => {
          setValue('programDate', '', { shouldValidate: true });
          setShowConflictModal(false);
        }}
        conflictInfo={availability.conflict}
      />
    </DashboardLayout>
  );
};

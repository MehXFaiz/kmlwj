import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Save, ChevronLeft, Calendar, User, Phone, MapPin, Clock, CreditCard, Landmark } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useHallBookingStore } from '../store/hallBookingStore';
import { useCoaStore } from '../store/coaStore';
import { showToast } from '../components/ui/Toast';
import { HallBookingReceiptModal } from '../components/receipts/HallBookingReceiptModal';

export const HallBookingForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addBooking, updateBooking, fetchBookingById } = useHallBookingStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const [newlyCreatedBooking, setNewlyCreatedBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, dirtyFields, errors } } = useForm({
    defaultValues: {
      bookerName: '',
      mobile: '',
      address: '',
      programDate: '',
      programType: '',
      timings: 'Evening',
      hallId: '',
      isForJamaat: false,
      amount: '',
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

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  useEffect(() => {
    if (!id) return;

    const loadBooking = async () => {
      setLoading(true);
      try {
        const booking = await fetchBookingById(id);
        if (booking) {
          const formattedDate = booking.programDate ? new Date(booking.programDate).toISOString().split('T')[0] : '';
          reset({
            bookerName: booking.bookerName || '',
            mobile: booking.mobile || '',
            address: booking.address || '',
            programDate: formattedDate,
            programType: booking.programType || '',
            timings: booking.timings || 'Evening',
            hallId: booking.hallId || '',
            isForJamaat: booking.isForJamaat || false,
            amount: booking.amount || '',
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

  const isOneOfFourHalls = (name) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return (
      n.includes('bagh') || n.includes('hajiani') || n.includes('hajiyani') ||
      n.includes('sadaya') || n.includes('sada') ||
      n.includes('zikarya') || n.includes('zikriya') || n.includes('zakaria') || n.includes('zakriya') ||
      n.includes('annexy') || n.includes('anexy') || n.includes('gosha') || n.includes('anxy')
    );
  };

  const hallAccounts = flatAccounts.filter(a => 
    (a.type === 'Revenue' || a.accountTypeName === 'REVENUE') &&
    isOneOfFourHalls(a.name)
  );

  const bankAccounts = flatAccounts.filter(a => 
    (a.type === 'Asset' || a.accountTypeName === 'ASSET') && 
    a.level === 'SUBSIDIARY' && 
    a.name.toLowerCase().includes('bank')
  );

  useEffect(() => {
    // Only auto-calculate amount if hallId or isForJamaat was touched/modified by the user
    // or if it's a new booking
    if (id && !dirtyFields.hallId && !dirtyFields.isForJamaat) return;

    if (!hallId) return;

    const hall = hallAccounts.find(h => h.id === hallId);
    if (!hall) return;

    const hallName = hall.name.toLowerCase();
    let baseRate = 0;

    if (hallName.includes('hajiani') || hallName.includes('hajiyani')) {
      baseRate = 43000;
    } else if (hallName.includes('anxy') || hallName.includes('annexy') || hallName.includes('anexy')) {
      baseRate = 33000;
    } else if (hallName.includes('sadaya')) {
      baseRate = 28000;
    } else if (hallName.includes('zikarya') || hallName.includes('zikriya') || hallName.includes('zakariya') || hallName.includes('zakriya')) {
      baseRate = 28000;
    }

    if (baseRate > 0) {
      const finalRate = isForJamaat ? baseRate * 0.5 : baseRate;
      setValue('amount', finalRate);
    }
  }, [id, hallId, isForJamaat, hallAccounts, setValue, dirtyFields.hallId, dirtyFields.isForJamaat]);

  const onSubmit = async (data) => {
    if (!data.bookerName || !data.programDate || !data.hallId || !data.amount) {
      showToast('Please fill all required fields.', 'warning');
      return;
    }

    try {
      let savedBooking;
      if (id) {
        savedBooking = await updateBooking(id, {
          ...data,
          amount: parseFloat(data.amount)
        });
        showToast('Booking updated successfully!', 'success');
      } else {
        savedBooking = await addBooking({
          ...data,
          amount: parseFloat(data.amount)
        });
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

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title'), id ? 'Edit Booking' : 'New Booking']}>
        <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading booking details...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title'), id ? 'Edit Booking' : 'New Booking']}>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Link to="/hall-bookings" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              {id ? 'Edit Booking' : t('tables.hallBookings.newBooking')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {id ? 'Edit details for this hall booking' : t('tables.hallBookings.newBookingDesc')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-6 space-y-8">
          
          {/* Booker Details Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <User className="h-4 w-4" /> {t('receipt.bookerName')} Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.bookerName')} *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input {...register('bookerName', {
                    required: 'Booker name is required',
                    pattern: {
                      value: /^[a-zA-Z\s.-]{3,50}$/,
                      message: 'Only letters, spaces, hyphens, and dots (3-50 chars)'
                    }
                  })} required
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.bookerName ? 'border-red-500/50' : 'border-slate-800'}`} />
                </div>
                {errors.bookerName && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.bookerName.message}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.mobile')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input {...register('mobile', {
                    pattern: {
                      value: /^$|^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/,
                      message: 'Invalid mobile number. E.g. 0300-1234567'
                    }
                  })}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.mobile ? 'border-red-500/50' : 'border-slate-800'}`} />
                </div>
                {errors.mobile && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.mobile.message}</span>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.address')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input {...register('address', {
                    pattern: {
                      value: /^$|^[a-zA-Z0-9\s.,#\/-]{5,100}$/,
                      message: 'Alphanumeric, spaces, and basic punctuation only (5-100 chars)'
                    }
                  })}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.address ? 'border-red-500/50' : 'border-slate-800'}`} />
                </div>
                {errors.address && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.address.message}</span>
                )}
              </div>
            </div>
          </div>

          {/* Program Details Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Calendar className="h-4 w-4" /> Program Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.programDate')} *</label>
                <input type="date" {...register('programDate', {
                  required: 'Program date is required',
                  pattern: {
                    value: /^\d{4}-\d{2}-\d{2}$/,
                    message: 'Date must be in YYYY-MM-DD format'
                  }
                })} required
                  className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.programDate ? 'border-red-500/50' : 'border-slate-800'}`} />
                {errors.programDate && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.programDate.message}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.programType')}</label>
                <input {...register('programType', {
                  pattern: {
                    value: /^$|^[a-zA-Z\s.-]{3,30}$/,
                    message: 'Only letters, spaces, hyphens, and dots (3-30 chars)'
                  }
                })} placeholder="e.g. Wedding, Valima"
                  className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.programType ? 'border-red-500/50' : 'border-slate-800'}`} />
                {errors.programType && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.programType.message}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.timings')}</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <select {...register('timings', {
                    pattern: {
                      value: /^(Morning|Afternoon|Evening|Night|Full Day)$/,
                      message: 'Invalid timing selected'
                    }
                  })}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.timings ? 'border-red-500/50' : 'border-slate-800'}`}>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                    <option value="Full Day">Full Day</option>
                  </select>
                </div>
                {errors.timings && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.timings.message}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.hall')} *</label>
                <select {...register('hallId', {
                  required: 'Hall selection is required',
                  pattern: {
                    value: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
                    message: 'Invalid Hall selection'
                  }
                })} required
                  className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.hallId ? 'border-red-500/50' : 'border-slate-800'}`}>
                  <option value="">-- Select Hall --</option>
                  {hallAccounts.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                {errors.hallId && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.hallId.message}</span>
                )}
              </div>
              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-colors">
                  <input type="checkbox" {...register('isForJamaat')} className="w-4 h-4 accent-indigo-500" />
                  <span className="text-sm font-bold text-slate-300">{t('receipt.forJamaat')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <CreditCard className="h-4 w-4" /> Payment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.totalAmount')} (Rs) *</label>
                <input type="text" {...register('amount', {
                  required: 'Amount is required',
                  pattern: {
                    value: /^[1-9]\d*(\.\d{1,2})?$/,
                    message: 'Positive decimal number up to 2 decimal places'
                  }
                })} required
                  className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-lg font-bold text-emerald-400 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.amount ? 'border-red-500/50' : 'border-slate-800'}`} />
                {errors.amount && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.amount.message}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
                <select {...register('paymentMethod', {
                  required: 'Payment method is required',
                  pattern: {
                    value: /^(CASH|BANK|CHEQUE)$/,
                    message: 'Invalid payment method selected'
                  }
                })}
                  className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.paymentMethod ? 'border-red-500/50' : 'border-slate-800'}`}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
                {errors.paymentMethod && (
                  <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.paymentMethod.message}</span>
                )}
              </div>

              {paymentMethod !== 'CASH' && (
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Receiving Bank Account *</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <select {...register('bankAccountId', {
                      required: 'Bank account is required',
                      pattern: {
                        value: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
                        message: 'Invalid bank account selection'
                      }
                    })} required
                      className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.bankAccountId ? 'border-red-500/50' : 'border-slate-800'}`}>
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  {errors.bankAccountId && (
                    <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.bankAccountId.message}</span>
                  )}
                </div>
              )}

              {paymentMethod === 'CHEQUE' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cheque Number *</label>
                    <input type="text" {...register('chequeNumber', {
                      required: 'Cheque number is required',
                      pattern: {
                        value: /^[0-9]{6,20}$/,
                        message: 'Cheque number must contain only digits (6-20 digits)'
                      }
                    })} required
                      className={`w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.chequeNumber ? 'border-red-500/50' : 'border-slate-800'}`} />
                    {errors.chequeNumber && (
                      <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.chequeNumber.message}</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Drawn On Bank *</label>
                    <div className="relative">
                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select {...register('chequeBankName', {
                        required: 'Bank selection is required',
                        pattern: {
                          value: /^[a-zA-Z0-9\s.()&-]{3,50}$/,
                          message: 'Invalid bank name selection'
                        }
                      })} required
                        className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors ${errors.chequeBankName ? 'border-red-500/50' : 'border-slate-800'}`}>
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
                      <span className="text-[11px] text-red-500 mt-1 block">⚠️ {errors.chequeBankName.message}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50">
              <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : id ? 'Update Booking' : 'Save Booking'}
            </button>
          </div>
        </form>
      </div>

      {newlyCreatedBooking && (
        <HallBookingReceiptModal 
          booking={newlyCreatedBooking} 
          onClose={handleCloseReceipt} 
        />
      )}
    </DashboardLayout>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { addBooking } = useHallBookingStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const [newlyCreatedBooking, setNewlyCreatedBooking] = useState(null);

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
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

  const hallAccounts = flatAccounts.filter(a => 
    (a.type === 'Revenue' || a.accountTypeName === 'REVENUE') &&
    a.level === 'SUBSIDIARY' && 
    (a.name.toLowerCase().includes('hall') || a.name.toLowerCase().includes('garden'))
  );

  const bankAccounts = flatAccounts.filter(a => 
    (a.type === 'Asset' || a.accountTypeName === 'ASSET') && 
    a.level === 'SUBSIDIARY' && 
    a.name.toLowerCase().includes('bank')
  );

  useEffect(() => {
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
  }, [hallId, isForJamaat, hallAccounts, setValue]);

  const onSubmit = async (data) => {
    if (!data.bookerName || !data.programDate || !data.hallId || !data.amount) {
      showToast('Please fill all required fields.', 'warning');
      return;
    }

    try {
      const savedBooking = await addBooking({
        ...data,
        amount: parseFloat(data.amount)
      });
      showToast('Booking saved successfully!', 'success');
      setNewlyCreatedBooking(savedBooking);
    } catch (err) {
      showToast(err.message || "Couldn't save booking. Try again.", 'error');
    }
  };

  const handleCloseReceipt = () => {
    setNewlyCreatedBooking(null);
    navigate('/hall-bookings');
  };

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title'), 'New Booking']}>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Link to="/hall-bookings" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.hallBookings.newBooking')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('tables.hallBookings.newBookingDesc')}</p>
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
                  <input {...register('bookerName')} required
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.mobile')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input {...register('mobile')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.address')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input {...register('address')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
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
                <input type="date" {...register('programDate')} required
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.programType')}</label>
                <input {...register('programType')} placeholder="e.g. Wedding, Valima"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.timings')}</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <select {...register('timings')}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors">
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                    <option value="Full Day">Full Day</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('receipt.hall')} *</label>
                <select {...register('hallId')} required
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors">
                  <option value="">-- Select Hall --</option>
                  {hallAccounts.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
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
                <input type="number" {...register('amount')} required min="1" step="0.01"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-lg font-bold text-emerald-400 focus:outline-none focus:border-indigo-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
                <select {...register('paymentMethod')}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              {paymentMethod !== 'CASH' && (
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Receiving Bank Account *</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <select {...register('bankAccountId')} required
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors">
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {paymentMethod === 'CHEQUE' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cheque Number *</label>
                    <input type="text" {...register('chequeNumber')} required
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Drawn On Bank *</label>
                    <div className="relative">
                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select {...register('chequeBankName')} required
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors">
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
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex justify-end">
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50">
              <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Booking'}
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

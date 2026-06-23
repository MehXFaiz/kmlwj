import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, AlertTriangle, CheckCircle, Calendar, CalendarRange, Clock, User, Phone, MapPin, X } from 'lucide-react';
import { useHallBookingStore } from '../store/hallBookingStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';

const numberToWords = (num) => {
  if (num === 0) return 'zero';
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Rupees Only';
};

export const HallBookings = () => {
  const { t, i18n } = useTranslation();
  const { bookings, loading, fetchBookings, postBooking, deleteBooking } = useHallBookingStore();
  const [search, setSearch] = useState('');
  const [printItem, setPrintItem] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const handlePost = async (id) => {
    try {
      await postBooking(id);
      showToast('Booking posted to ledger successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to post booking', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await deleteBooking(id);
        showToast('Booking deleted', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to delete booking', 'error');
      }
    }
  };

  const filtered = bookings.filter(b => 
    b.bookerName?.toLowerCase().includes(search.toLowerCase()) ||
    b.mobile?.includes(search) ||
    b.receiptNo?.toString().includes(search)
  );

  const PrintModal = ({ booking, onClose }) => {
    useEffect(() => {
      const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handlePrint = () => {
      window.print();
    };

    const bookingDateStr = new Date(booking.bookingDate).toLocaleDateString('en-GB');
    const programDateStr = new Date(booking.programDate).toLocaleDateString('en-GB');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bookingDay = dayNames[new Date(booking.programDate).getDay()];
    const amountWords = numberToWords(booking.amount);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-blur-none">
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
          {/* Header Actions - hidden in print */}
          <div className="flex justify-between items-center p-4 border-b border-slate-200 print:hidden shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Print Booking Receipt</h2>
            <div className="flex items-center gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm transition-colors">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Content Area */}
          <div className="overflow-y-auto p-8 print:p-4 print:overflow-visible text-slate-900 bg-white" dir={i18n.language === 'ur' ? 'rtl' : 'ltr'}>
            
            {/* Logo and Header Block */}
            <div className="relative text-center border-b-2 border-emerald-800 pb-4 mb-6">
              <h1 className="text-3xl font-bold text-emerald-700 font-urdu mb-1 leading-tight">
                کچھی مسلم لوہارواڑھا ویلفیئر جماعت
              </h1>
              <h2 className="text-xl font-bold text-slate-700">Kutiyana Memon Lohar Wadha Welfare Jamaat</h2>
              <div className="mt-2 text-sm text-slate-600">
                <span>جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی</span>
                <span className="mx-2">|</span>
                <span>(رجسٹرڈ: 1319)</span>
              </div>
            </div>

            {/* Receipt Title */}
            <div className="text-center mb-6 relative">
              <h3 className="inline-block text-2xl font-bold text-red-600 px-6 py-1 border-2 border-red-600 rounded-full bg-red-50">
                {t('receipt.bookingReceipt')}
              </h3>
            </div>

            {/* Receipt Details Grid */}
            <div className="space-y-6 text-[15px] font-medium border-2 border-slate-300 p-6 rounded-xl">
              
              {/* Row 1: Booking Date & Receipt No */}
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-3">
                  <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.bookingDate')}:</span>
                  <span className="px-4 py-1 border-b border-slate-400 min-w-[150px] text-center">{bookingDateStr}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold whitespace-nowrap">{t('receipt.receiptNo')}:</span>
                  <span className="px-4 py-1 border-b border-slate-400 min-w-[150px] text-center text-red-600 font-bold">{booking.receiptNo}</span>
                </div>
              </div>

              {/* Row 2: Booker Name & Mobile */}
              <div className="flex flex-wrap gap-6 pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                  <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.bookerName')}:</span>
                  <span className="flex-1 border-b border-slate-400 px-2 pb-1">{booking.bookerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold whitespace-nowrap">{t('receipt.mobile')}:</span>
                  <span className="border-b border-slate-400 px-2 pb-1 min-w-[150px] text-center">{booking.mobile || '—'}</span>
                </div>
              </div>

              {/* Row 3: Address */}
              <div className="flex items-center gap-3 pb-4 border-b border-dashed border-slate-300">
                <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.address')}:</span>
                <span className="flex-1 border-b border-slate-400 px-2 pb-1">{booking.address || '—'}</span>
              </div>

              {/* Row 4: Program Date, Day & Type */}
              <div className="flex flex-wrap gap-4 pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-3">
                  <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.programDate')}:</span>
                  <span className="border-b border-slate-400 px-4 pb-1 text-center font-bold">{programDateStr}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold whitespace-nowrap">{t('receipt.bookingDay')}:</span>
                  <span className="border-b border-slate-400 px-4 pb-1 text-center">{bookingDay}</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-bold whitespace-nowrap">{t('receipt.programType')}:</span>
                  <span className="flex-1 border-b border-slate-400 px-2 pb-1">{booking.programType || '—'}</span>
                </div>
              </div>

              {/* Row 5: Timings & Hall Selection */}
              <div className="flex flex-col md:flex-row gap-6 pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="font-bold min-w-[120px]">{t('receipt.timings')}:</span>
                  <span className="border-b border-slate-400 px-4 pb-1 min-w-[100px] text-center">{booking.timings || '—'}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap flex-1">
                  <span className="font-bold whitespace-nowrap">{t('receipt.hall')}:</span>
                  <span className="flex-1 border-b border-slate-400 px-2 pb-1 font-bold text-indigo-700">
                    {booking.hallAccount?.accountName || '—'}
                  </span>
                </div>
              </div>

              {/* Row 6: Jamaat & Amount */}
              <div className="flex flex-wrap gap-6 pb-4 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-4">
                  <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.forJamaat')}:</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={booking.isForJamaat} readOnly className="w-4 h-4 accent-emerald-600" /> {t('receipt.yes')}</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!booking.isForJamaat} readOnly className="w-4 h-4 accent-emerald-600" /> {t('receipt.no')}</label>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <span className="font-bold whitespace-nowrap">{t('receipt.totalAmount')}:</span>
                  <span className="border-b border-slate-400 px-6 pb-1 text-lg font-bold text-slate-800">
                    Rs. {booking.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Row 7: Amount in words */}
              <div className="flex items-center gap-3 pb-8">
                <span className="font-bold whitespace-nowrap min-w-[120px]">{t('receipt.amountInWords')}:</span>
                <span className="flex-1 border-b border-slate-400 px-2 pb-1 capitalize italic text-slate-600">{amountWords}</span>
              </div>

              {/* Signature Area */}
              <div className="flex justify-end pt-8">
                <div className="text-center">
                  <div className="w-48 border-b-2 border-slate-400 mb-2"></div>
                  <span className="font-bold text-slate-600">{t('receipt.signatureClerk')}</span>
                </div>
              </div>
            </div>

            {/* Footer Rules */}
            <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
              <p>{t('receipt.rulesNote')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title')]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.hallBookings.title')}</h1>
            <p className="text-sm text-slate-400 mt-1">{t('tables.hallBookings.desc')}</p>
          </div>
          <Link to="/hall-bookings/new"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all">
            <Plus className="h-4 w-4" /> {t('tables.hallBookings.newBooking')}
          </Link>
        </div>

        <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800/80">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tables.hallBookings.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading bookings...</span>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4">{t('receipt.receiptNo')}</th>
                    <th className="px-6 py-4">{t('receipt.bookerName')}</th>
                    <th className="px-6 py-4">{t('receipt.programDate')}</th>
                    <th className="px-6 py-4">{t('receipt.hall')}</th>
                    <th className="px-6 py-4">{t('receipt.totalAmount')}</th>
                    <th className="px-6 py-4">{t('tables.bankVouchers.status')}</th>
                    <th className="px-6 py-4 text-right">{t('tables.bankVouchers.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {filtered.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">#{booking.receiptNo}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">{booking.bookerName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {booking.mobile || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{new Date(booking.programDate).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{booking.timings || 'Any time'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                          {booking.hallAccount?.accountName}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">Rs. {booking.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {booking.status === 'Confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Pending Post
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="h-3 w-3" /> Posted
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {booking.status === 'Confirmed' && (
                          <button onClick={() => handlePost(booking.id)}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
                            Post to Ledger
                          </button>
                        )}
                        <button onClick={() => setPrintItem(booking)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors inline-flex">
                          <Printer className="h-4 w-4" />
                        </button>
                        {booking.status === 'Confirmed' && (
                          <button onClick={() => handleDelete(booking.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors inline-flex ml-1">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-500 text-sm">
                        {t('tables.hallBookings.noBookingsFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      {printItem && (
        <PrintModal booking={printItem} onClose={() => setPrintItem(null)} />
      )}
    </DashboardLayout>
  );
};

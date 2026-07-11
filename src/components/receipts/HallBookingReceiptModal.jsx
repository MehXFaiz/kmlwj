import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoImg from '../../assets/logo.png';

const numberToWords = (num) => {
  if (!num) return '';
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if ((num = num.toString()).length > 9) return 'Overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Rupees Only';
};

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!booking) return null;

  const bookingDateStr = formatDateDDMMYYYY(booking.bookingDate || booking.createdAt);
  const programDateStr = formatDateDDMMYYYY(booking.programDate);

  // Format day name in Urdu
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const programDayUrdu = booking.programDate ? daysUrdu[new Date(booking.programDate).getDay()] : '';

  const amountWords = numberToWords(booking.amount);

  // Identify hall
  const hallName = (booking.hallName || booking.hallAccount?.accountName || booking.hallAccount?.name || '').toLowerCase();
  const isBagh = hallName.includes('bagh') || hallName.includes('hajiani') || hallName.includes('hajiyani') || hallName.includes('باغ') || hallName.includes('گارڈن');
  const isSadaBahar = hallName.includes('sada') || hallName.includes('sadaya') || hallName.includes('سدا');
  const isZakaria = hallName.includes('zakaria') || hallName.includes('zikarya') || hallName.includes('zikriya') || hallName.includes('zakriya') || hallName.includes('zakariya') || hallName.includes('زکریا');
  const isGosha = hallName.includes('gosha') || hallName.includes('annexy') || hallName.includes('anexy') || hallName.includes('anxy') || hallName.includes('گوشہ') || hallName.includes('اینیکسی');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-blur-none">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Actions (Hidden in Print) */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 print:hidden shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Print Booking Receipt</h2>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#5d3c28] hover:bg-[#4a2e1d] text-white rounded-lg font-bold text-sm transition-colors shadow">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Receipt Container */}
        <div className="overflow-y-auto print:overflow-visible bg-white flex justify-center p-4 sm:p-6 print:p-0">
          <div
            id="print-receipt"
            className="w-[820px] bg-white border border-gray-300 print:border-none px-10 py-8 font-urdu relative text-slate-900 mx-auto leading-relaxed"
            style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            dir="rtl"
          >
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-receipt, #print-receipt * {
                  visibility: visible !important;
                }
                #print-receipt {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none !important;
                  padding: 24px 32px !important;
                }
              }
            `}</style>

            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              {/* Left side (Logo in RTL) */}
              <div className="w-28 h-24 flex items-center justify-center shrink-0">
                <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
              </div>

              {/* Center Title Area */}
              <div className="flex-1 flex flex-col items-center text-center px-4">
                <h1 className="text-4xl sm:text-[40px] font-extrabold text-[#1a6e35] tracking-normal leading-tight">
                  کچھی مسلم لوھارواڑھا ویلفیئر جماعت
                </h1>

                <div className="border-2 border-[#1a6e35] rounded-full px-6 py-0.5 text-xs sm:text-sm font-bold text-[#1a6e35] mt-1.5 inline-block">
                  جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
                </div>

                <div className="text-xs sm:text-sm text-slate-600 font-bold mt-1">
                  (رجسٹرڈ: 1319)
                </div>

                <div className="mt-1 mb-1">
                  <span
                    className="inline-block text-4xl sm:text-[42px] font-extrabold text-[#ff0000] leading-none select-none"
                    style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      textShadow: '0.5px 0.5px 0px rgba(0,0,0,0.1)'
                    }}
                  >
                    بکنگ رسید
                  </span>
                </div>
              </div>

              {/* Right spacer to balance center alignment */}
              <div className="w-28 shrink-0"></div>
            </div>

            {/* Form Rows */}
            <div className="space-y-4 text-base sm:text-lg mt-2">

              {/* Row 1: Booking Date & Receipt Number */}
              <div className="flex items-end justify-between">
                <div className="flex items-end gap-2">
                  <span className="font-bold whitespace-nowrap text-slate-900">بکنگ تاریخ:</span>
                  <span className="w-44 border-b border-black text-center pb-0.5 font-sans font-medium text-slate-900 tracking-wide">
                    {bookingDateStr}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <span className="font-bold text-[#ff0000] text-2xl leading-none">نمبر</span>
                  <span className="w-32 border-b border-black text-center pb-0.5 font-sans font-bold text-xl text-slate-900">
                    {booking.receiptNo}
                  </span>
                </div>
              </div>

              {/* Row 2: Booker Name & Mobile */}
              <div className="flex items-end justify-between gap-6">
                <div className="flex items-end gap-3 flex-[1.6]">
                  <span className="font-bold whitespace-nowrap text-slate-900">نام بکنگ کنندہ</span>
                  <span className="flex-1 border-b border-black text-center pb-0.5 font-bold text-slate-900">
                    {booking.bookerName || ''}
                  </span>
                </div>

                <div className="flex items-end gap-3 flex-1">
                  <span className="font-bold whitespace-nowrap text-slate-900">موبائل</span>
                  <span className="flex-1 border-b border-black text-center pb-0.5 font-sans font-medium tracking-wide text-slate-900" dir="ltr">
                    {booking.mobile || ''}
                  </span>
                </div>
              </div>

              {/* Row 3: Address */}
              <div className="flex items-end gap-3">
                <span className="font-bold whitespace-nowrap text-slate-900">پتہ</span>
                <span className="flex-1 border-b border-black text-center pb-0.5 text-slate-900">
                  {booking.address || ''}
                </span>
              </div>

              {/* Row 4: Program Nature, Program Date, Booking Day */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-end gap-2 flex-[1.4]">
                  <span className="font-bold whitespace-nowrap text-slate-900">پروگرام کی نوعیت</span>
                  <span className="flex-1 border-b border-black text-center pb-0.5 text-slate-900 font-sans">
                    {booking.programType || ''}
                  </span>
                </div>

                <div className="flex items-end gap-2 flex-[1.2]">
                  <span className="font-bold whitespace-nowrap text-slate-900">پروگرام کی تاریخ</span>
                  <span className="flex-1 border-b border-black text-center pb-0.5 font-sans font-medium text-slate-900 tracking-wide">
                    {programDateStr}
                  </span>
                </div>

                <div className="flex items-end gap-2 flex-1">
                  <span className="font-bold whitespace-nowrap text-slate-900">بکنگ بروز</span>
                  <span className="flex-1 border-b border-black text-center pb-0.5 font-bold text-slate-900">
                    {programDayUrdu}
                  </span>
                </div>
              </div>

              {/* Row 5: Timings */}
              <div className="flex items-end gap-3 w-[65%]">
                <span className="font-bold whitespace-nowrap text-slate-900">اوقات</span>
                <span className="flex-1 border-b border-black text-center pb-0.5 font-sans font-medium text-slate-900">
                  {booking.timings || ''}
                </span>
                <span className="font-bold whitespace-nowrap px-1 text-slate-900">سے</span>
                <span className="flex-1 border-b border-black pb-0.5"></span>
              </div>

              {/* Row 6 & 7: 4 Halls Grid */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 pt-3 pl-8 pr-4">
                {/* Right Column Row 1 */}
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold text-slate-900">باغ حاجیانی گارڈن</span>
                  <span className="w-32 border-b border-black text-center pb-0.5 font-bold text-xl text-slate-900 leading-none h-6">
                    {isBagh ? '✓' : ''}
                  </span>
                </div>

                {/* Left Column Row 1 */}
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold text-slate-900">صدایا ہال</span>
                  <span className="w-32 border-b border-black text-center pb-0.5 font-bold text-xl text-slate-900 leading-none h-6">
                    {isSadaBahar ? '✓' : ''}
                  </span>
                </div>

                {/* Right Column Row 2 */}
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold text-slate-900">زکریا ہال</span>
                  <span className="w-32 border-b border-black text-center pb-0.5 font-bold text-xl text-slate-900 leading-none h-6">
                    {isZakaria ? '✓' : ''}
                  </span>
                </div>

                {/* Left Column Row 2 */}
                <div className="flex items-end justify-between gap-4">
                  <span className="font-bold text-slate-900">اینیکسی ہال</span>
                  <span className="w-32 border-b border-black text-center pb-0.5 font-bold text-xl text-slate-900 leading-none h-6">
                    {isGosha ? '✓' : ''}
                  </span>
                </div>
              </div>

              {/* Row 8: Jamaat & Total Amount */}
              <div className="flex items-end justify-between gap-6 pt-3">
                <div className="flex items-center gap-6">
                  <span className="font-bold text-slate-900">بکنگ برائے جماعت</span>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">ہاں</span>
                      <span className="w-6 h-6 border border-black inline-flex items-center justify-center font-bold text-base text-slate-900 leading-none">
                        {booking.isForJamaat ? '✓' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">نہیں</span>
                      <span className="w-6 h-6 border border-black inline-flex items-center justify-center font-bold text-base text-slate-900 leading-none">
                        {!booking.isForJamaat ? '✓' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-3 flex-1 justify-end">
                  <span className="font-bold whitespace-nowrap text-slate-900">کل وصولیابی رقم</span>
                  <span className="w-48 border-b border-black text-center pb-0.5 font-bold font-sans text-xl text-slate-900 tracking-wide">
                    {Number(booking.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Row 9: Amount in Words */}
              <div className="flex items-end gap-3 pt-1">
                <span className="font-bold text-slate-900 whitespace-nowrap">مبلغ</span>
                <span className="flex-1 border-b border-black text-center pb-0.5 font-sans italic text-sm text-slate-800 capitalize">
                  {amountWords}
                </span>
                <span className="font-bold text-slate-900 whitespace-nowrap">روپے</span>
              </div>

              {/* Signatures & Secretary */}
              <div className="flex items-end justify-between pt-12 pb-2 px-2">
                <div className="flex items-end gap-3">
                  <span className="font-bold text-slate-900 whitespace-nowrap">دستخط بکنگ کلرک</span>
                  <span className="w-64 border-b border-black"></span>
                </div>

                <div className="relative flex items-end">
                  <span
                    className="absolute -top-7 left-14 text-3xl text-slate-400 font-bold opacity-60 select-none pointer-events-none"
                    style={{ fontFamily: "'Jameel Noori Nastaleeq', serif" }}
                  >
                    سیکریٹری
                  </span>
                  <span className="w-56 border-b border-black"></span>
                </div>
              </div>

            </div>

            {/* Footer Notice */}
            <div className="mt-5 pt-2 text-center font-bold text-sm text-slate-700 w-full">
              پشت پر لکھی ہوئی ہدایات کی پابندی لازمی ہوگی، بصورت دیگر بکنگ منسوخ کر دی جائے گی۔
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};


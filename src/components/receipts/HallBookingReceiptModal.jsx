import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoImg from '../../assets/logo.png';

const numberToWords = (num) => {
  if (!num) return '';
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

  const bookingDateStr = new Date(booking.bookingDate || booking.createdAt).toLocaleDateString('en-GB');
  const programDateStr = new Date(booking.programDate).toLocaleDateString('en-GB');
  
  // Format day name in Urdu
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const programDayUrdu = daysUrdu[new Date(booking.programDate).getDay()];

  const amountWords = numberToWords(booking.amount);
  
  // Identify hall
  const hallName = (booking.hallName || booking.hallAccount?.accountName || '').toLowerCase();
  const isBagh = hallName.includes('bagh') || hallName.includes('hajiani') || hallName.includes('hajiyani') || hallName.includes('باغ') || hallName.includes('گارڈن');
  const isSadaBahar = hallName.includes('sada') || hallName.includes('sadaya') || hallName.includes('سدا');
  const isZakaria = hallName.includes('zakaria') || hallName.includes('zikarya') || hallName.includes('zikriya') || hallName.includes('zakriya') || hallName.includes('zakariya') || hallName.includes('زکریا');
  const isGosha = hallName.includes('gosha') || hallName.includes('annexy') || hallName.includes('anexy') || hallName.includes('anxy') || hallName.includes('گوشہ') || hallName.includes('اینیکسی');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-blur-none">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Actions (Hidden in Print) */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 print:hidden shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Print Booking Receipt</h2>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold text-sm transition-colors">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Receipt Container */}
        <div className="overflow-y-auto print:overflow-visible bg-white flex justify-center p-4 sm:p-8 print:p-0">
          {/* A5 Landscape shape approx */}
          <div id="print-receipt" className="w-[800px] min-h-[550px] flex flex-col bg-white border border-gray-300 print:border-none p-8 font-urdu relative text-slate-900 mx-auto" style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Jameel Noori Nastaleeq Kasheeda', 'Noto Nastaliq Urdu', serif" }} dir="rtl">
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
                }
              }
            `}</style>
            
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              {/* Right side (Empty to balance) */}
              <div className="w-24"></div>
              
              {/* Center */}
              <div className="flex-1 flex flex-col items-center text-center">
                <h1 className="text-4xl font-extrabold text-[#1a6e35] tracking-wide mb-2 leading-tight drop-shadow-sm">
                  کچھی مسلم لوھارواڑھا ویلفیئر جماعت
                </h1>
                
                <div className="border-2 border-[#1a6e35] rounded-full px-6 py-1 text-sm font-semibold text-[#1a6e35] mt-1 inline-block">
                  جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
                </div>
                
                <div className="text-sm text-slate-500 mt-1 font-bold">
                  (رجسٹرڈ: 1319)
                </div>
              </div>

              {/* Left side (Logo) */}
              <div className="w-24 h-24 flex items-center justify-center p-1">
                <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Receipt Title */}
            <div className="text-center relative mt-0 mb-4">
              <span className="inline-block text-3xl font-extrabold" style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Jameel Noori Nastaleeq Kasheeda', 'Noto Nastaliq Urdu', serif", WebkitTextStroke: '1px #ff0000', WebkitTextFillColor: 'white', letterSpacing: '1px', textShadow: '1px 1px 0px rgba(255,0,0,0.2)' }}>
                بکنگ رسید
              </span>
            </div>

            {/* Top Info (Date & No) */}
            <div className="flex justify-between items-center mb-4 px-4">
              <div className="flex items-end gap-2 text-lg">
                <span className="font-bold">بکنگ تاریخ:</span>
                <span className="w-32 border-b border-black text-center pb-1 font-sans">{bookingDateStr}</span>
              </div>
              <div className="flex items-end gap-2 text-lg" dir="ltr">
                <span className="w-24 border-b border-black text-center font-bold text-xl">{booking.receiptNo}</span>
                <span className="font-bold text-[#ff0000] ml-2">نمبر</span>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="space-y-4 px-4 text-base flex-1">
              
              {/* Row 1: Booker Name & Mobile */}
              <div className="flex gap-4">
                <div className="flex items-end gap-2 flex-[2]">
                  <span className="font-bold whitespace-nowrap">نام بکنگ کنندہ</span>
                  <span className="flex-1 border-b border-black pb-1 text-center font-bold">{booking.bookerName}</span>
                </div>
                <div className="flex items-end gap-2 flex-1">
                  <span className="font-bold whitespace-nowrap">موبائل</span>
                  <span className="flex-1 border-b border-black pb-1 text-center font-sans tracking-wide">{booking.mobile || ''}</span>
                </div>
              </div>

              {/* Row 2: Address */}
              <div className="flex items-end gap-2">
                <span className="font-bold whitespace-nowrap">پتہ</span>
                <span className="flex-1 border-b border-black pb-1 px-4">{booking.address || ''}</span>
              </div>

              {/* Row 3: Booking Day & Program Date & Nature */}
              <div className="flex gap-4">
                <div className="flex items-end gap-2 flex-[1.5]">
                  <span className="font-bold whitespace-nowrap">پروگرام کی نوعیت</span>
                  <span className="flex-1 border-b border-black pb-1 text-center">{booking.programType || ''}</span>
                </div>
                <div className="flex items-end gap-2 flex-1">
                  <span className="font-bold whitespace-nowrap">پروگرام کی تاریخ</span>
                  <span className="flex-1 border-b border-black pb-1 text-center font-sans">{programDateStr}</span>
                </div>
                <div className="flex items-end gap-2 flex-1">
                  <span className="font-bold whitespace-nowrap">بکنگ بروز</span>
                  <span className="flex-1 border-b border-black pb-1 text-center">{programDayUrdu}</span>
                </div>
              </div>

              {/* Row 4: Timings */}
              <div className="flex items-end gap-2 w-[60%]">
                <span className="font-bold whitespace-nowrap">اوقات</span>
                <span className="flex-1 border-b border-black pb-1 text-center font-sans">{booking.timings || ''}</span>
                <span className="font-bold whitespace-nowrap px-2">سے</span>
                <span className="flex-1 border-b border-black pb-1"></span>
              </div>

              {/* Row 5: Halls 1 */}
              <div className="flex gap-12 items-center mt-2 pl-8">
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-bold">باغ حاجیانی گارڈن</span>
                  <div className="w-16 border-b border-black text-center text-xl font-bold">{isBagh ? '✓' : ''}</div>
                </div>
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-bold">سدایا ہال</span>
                  <div className="w-16 border-b border-black text-center text-xl font-bold">{isSadaBahar ? '✓' : ''}</div>
                </div>
              </div>

              {/* Row 6: Halls 2 */}
              <div className="flex gap-12 items-center pl-8">
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-bold">زکریا ہال</span>
                  <div className="w-16 border-b border-black text-center text-xl font-bold">{isZakaria ? '✓' : ''}</div>
                </div>
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-bold">اینیکسی ہال</span>
                  <div className="w-16 border-b border-black text-center text-xl font-bold">{isGosha ? '✓' : ''}</div>
                </div>
              </div>

              {/* Row 7: Jamaat & Amount */}
              <div className="flex gap-4 items-end mt-4">
                <div className="flex items-center gap-6">
                  <span className="font-bold">بکنگ برائے جماعت</span>
                  <div className="flex gap-4 items-center">
                    <label className="flex items-center gap-2 font-bold">ہاں <span className="inline-block w-6 h-6 border border-black flex items-center justify-center font-bold">{booking.isForJamaat ? '✓' : ''}</span></label>
                    <label className="flex items-center gap-2 font-bold">نہیں <span className="inline-block w-6 h-6 border border-black flex items-center justify-center font-bold">{!booking.isForJamaat ? '✓' : ''}</span></label>
                  </div>
                </div>
                <div className="flex items-end gap-2 flex-1 justify-end">
                  <span className="font-bold whitespace-nowrap">کل وصولیابی رقم</span>
                  <span className="w-48 border-b border-black pb-1 text-center font-bold font-sans text-xl">{booking.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Row 8: Amount in words */}
              <div className="flex gap-4 items-end mt-2">
                <div className="flex items-end gap-2 flex-1">
                  <span className="font-bold">مبلغ</span>
                  <span className="flex-1 border-b border-black pb-1 text-center capitalize italic font-sans text-sm">{amountWords}</span>
                  <span className="font-bold">روپے</span>
                </div>
              </div>
              
              {/* Signatures */}
              <div className="flex justify-between items-end mt-12 px-4">
                <div className="flex items-end gap-2">
                  <span className="font-bold">دستخط بکنگ کلرک</span>
                  <span className="w-48 border-b border-black"></span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-bold text-2xl text-slate-400 opacity-50">سیکریٹری</span>
                </div>
              </div>

            </div>


            {/* Footer */}
            <div className="mt-auto pt-4 mb-2 border-t border-slate-300 text-center font-bold text-sm text-slate-600 w-full">
              پشت پر لکھی ہوئی ہدایات کی پابندی لازمی ہوگی، بصورت دیگر بکنگ منسوخ کر دی جائے گی۔
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Check,
  Award,
  CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoImg from '../../assets/logo.png';

const numberToWordsPKR = (num) => {
  if (!num || isNaN(num) || Number(num) === 0) return 'Zero Rupees Only';
  const n = Math.floor(Number(num));
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigitsToWords = (val) => {
    if (val === 0) return '';
    if (val < 20) return a[val] + ' ';
    return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '') + ' ';
  };

  const threeDigitsToWords = (val) => {
    let str = '';
    const hundred = Math.floor(val / 100);
    const rem = val % 100;
    if (hundred > 0) {
      str += a[hundred] + ' Hundred ';
    }
    if (rem > 0) {
      str += twoDigitsToWords(rem);
    }
    return str;
  };

  let str = '';
  const crore = Math.floor(n / 10000000);
  let remainder = n % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundredRem = remainder % 1000;

  if (crore > 0) str += twoDigitsToWords(crore) + 'Crore ';
  if (lakh > 0) str += twoDigitsToWords(lakh) + 'Lakh ';
  if (thousand > 0) str += twoDigitsToWords(thousand) + 'Thousand ';
  if (hundredRem > 0) str += threeDigitsToWords(hundredRem);

  return str.replace(/\s+/g, ' ').trim() + ' Rupees Only';
};

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d)) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getDayNameUrdu = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  return daysUrdu[d.getDay()];
};

const getDayNameEnglish = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const daysEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return daysEnglish[d.getDay()];
};

const format12HourTime = (timeVal) => {
  if (!timeVal) return '';
  const raw = String(timeVal).trim();
  if (!raw || !/^\d{1,2}:\d{2}$/.test(raw)) return '';

  const [hoursStr, minutesStr] = raw.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return '';

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatEventTiming = (booking) => {
  const session = (booking?.timings || '').trim();
  const from = format12HourTime(booking?.timeFrom);
  const to = format12HourTime(booking?.timeTo);

  if (!session || !from || !to) return 'N/A';
  return `${session} (${from} - ${to})`;
};

const ReceiptSlip = ({ booking, copyType, copyUrduTitle, copyEnglishTitle }) => {
  const bookingDateStr = formatDateDDMMYYYY(booking.bookingDate || booking.createdAt || new Date());
  const programDateStr = formatDateDDMMYYYY(booking.programDate);
  const programDayUrdu = getDayNameUrdu(booking.programDate);
  const programDayEnglish = getDayNameEnglish(booking.programDate);

  const eventName = (booking.programType || booking.functionType || '').trim() || 'N/A';
  const eventTiming = formatEventTiming(booking);

  const hallCharges = Number(booking.hallCharges ?? booking.amount ?? 0);
  const discountAmt = Number(booking.discount || 0);
  const netAmount = booking.netAmount != null ? Number(booking.netAmount) : Math.max(0, hallCharges - discountAmt);
  const receivedAmount = Number(booking.receivedAmount || 0);
  const remainingAmount = booking.remainingAmount != null ? Number(booking.remainingAmount) : Math.max(0, netAmount - receivedAmount);
  const isRefundish = Number(booking.refundAmount || 0) > 0 || booking.status === 'Cancelled' || booking.status === 'Refunded';
  const amountWords = numberToWordsPKR(receivedAmount);

  const rawHallName = (
    booking.hallName ||
    booking.hallAccount?.accountName ||
    booking.hallAccount?.name ||
    ''
  ).toLowerCase();

  const isBagh =
    rawHallName.includes('bagh') ||
    rawHallName.includes('hajiani') ||
    rawHallName.includes('hajiyani') ||
    rawHallName.includes('kareema') ||
    rawHallName.includes('karima') ||
    rawHallName.includes('باغ') ||
    rawHallName.includes('کریمہ') ||
    rawHallName.includes('گارڈن');

  const isSadaBahar =
    rawHallName.includes('sada') ||
    rawHallName.includes('sadaya') ||
    rawHallName.includes('سدا');

  const isZakaria =
    rawHallName.includes('zakaria') ||
    rawHallName.includes('zikarya') ||
    rawHallName.includes('zikriya') ||
    rawHallName.includes('zakriya') ||
    rawHallName.includes('zakariya') ||
    rawHallName.includes('زکریا');

  const isGosha =
    rawHallName.includes('gosha') ||
    rawHallName.includes('annexy') ||
    rawHallName.includes('anexy') ||
    rawHallName.includes('anxy') ||
    rawHallName.includes('گوشہ') ||
    rawHallName.includes('اینیکسی');

  const hallsList = [
    {
      id: 'bagh',
      urduName: 'باغ حاجیانی کریمہ',
      englishName: 'Bagh-e-Hajiani Kareema',
      selected: isBagh || (!isSadaBahar && !isZakaria && !isGosha && rawHallName.includes('bagh'))
    },
    {
      id: 'sada',
      urduName: 'صدایا ہال',
      englishName: 'Sadaya Hall',
      selected: isSadaBahar
    },
    {
      id: 'zakaria',
      urduName: 'زکریا ہال',
      englishName: 'Zakaria Hall',
      selected: isZakaria
    },
    {
      id: 'gosha',
      urduName: 'اینیکسی ہال (گوشہ)',
      englishName: 'Annexy Hall (Gosha)',
      selected: isGosha
    }
  ];

  const isCustomer = copyType === 'customer';

  return (
    <div
      className="w-full max-w-[780px] print:max-w-full bg-white text-slate-900 mx-auto box-border"
      style={{
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Outer Executive Light Frame */}
      <div
        className="relative bg-white border-0 print:border-none rounded-none shadow-none overflow-hidden p-2.5 print:p-1.5 box-border"
      >
        {/* Subtle Watermark Emblem */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
          <img src={logoImg} alt="Watermark" className="w-[140px] h-[140px] object-contain" />
        </div>

        {/* ══════════════════════════════════════════════════════════
           1. COMPACT VOUCHER HEADER
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border-b border-emerald-800/40 pb-1.5 mb-1.5 print:pb-1 print:mb-1 flex items-center justify-between gap-2">
          {/* Left Block: Logo + Organization Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center p-0.5 border border-emerald-700/30 rounded-lg bg-white">
              <img src={logoImg} alt="KMLWJ Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="font-bold text-slate-900 tracking-normal"
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Alvi Nastaleeq', serif",
                    color: '#0f172a',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    paddingTop: '0.1em',
                    paddingBottom: '0.1em',
                    wordSpacing: '0.1em',
                    fontWeight: 600,
                  }}
                >
                  کچھی مسلم لوہارواڈھا ویلفیئر جماعت
                </h1>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border shrink-0"
                  style={{
                    backgroundColor: '#ecfdf5',
                    borderColor: '#10b981',
                    color: '#065f46'
                  }}
                >
                  REG # 1319
                </span>
              </div>
              <h2
                className="text-[10px] sm:text-[11px] font-black tracking-wide uppercase mt-0.5"
                style={{ color: '#065f46' }}
              >
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAAT (REGD.)
              </h2>
            </div>
          </div>

          {/* Right Block: Copy Badge & Receipt Number */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Badge */}
            <div
              className="px-2.5 py-1 rounded border text-right"
              style={{
                backgroundColor: isCustomer ? '#ecfdf5' : '#fffbeb',
                borderColor: isCustomer ? '#059669' : '#d97706',
                color: isCustomer ? '#064e3b' : '#78350f'
              }}
            >
              <span className="text-[9px] font-black uppercase tracking-wider block">
                {copyEnglishTitle}
              </span>
              <span
                className="text-[11px] font-bold block leading-relaxed"
                style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
              >
                {copyUrduTitle}
              </span>
            </div>

            {/* Receipt No & Issue Date */}
            <div
              className="flex flex-col items-end justify-center bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-right"
              style={{ color: '#0f172a' }}
            >
              <div className="text-[10px] font-black font-mono">
                #{String(booking.receiptNo || '0001').padStart(4, '0')}
              </div>
              <div className="text-[8px] font-bold text-slate-600 mt-0.5">
                {bookingDateStr}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           2. CLIENT & PROGRAM SPECIFICATION GRID
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-1.5 print:mb-1 bg-white box-border">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[9px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
          >
            <span>1. BOOKING SPECIFICATIONS & EVENT SCHEDULE</span>
            <span
              className="text-[11px] font-bold leading-relaxed"
              style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              تفصیلاتِ بکنگ کنندہ و تقریب
            </span>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-300">
            {/* Column 1: Booker Name */}
            <div className="p-2 print:p-1.5 flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">
                BOOKER NAME / نام بکنگ کنندہ
              </span>
              <div
                className="text-xs font-black leading-tight break-words"
                style={{ color: '#0f172a' }}
              >
                {booking.bookerName || '—'}
              </div>
            </div>

            {/* Column 2: Contact & Membership */}
            <div className="p-2 print:p-1.5 flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">
                CONTACT / رابطہ و حیثیت
              </span>
              <div className="flex items-center justify-between gap-1.5 mt-0.5">
                <span
                  className="text-xs font-black font-mono"
                  style={{ color: '#0f172a' }}
                  dir="ltr"
                >
                  {booking.mobile || '—'}
                </span>
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0"
                  style={{
                    backgroundColor: booking.isForJamaat ? '#ecfdf5' : '#f1f5f9',
                    borderColor: booking.isForJamaat ? '#10b981' : '#cbd5e1',
                    color: booking.isForJamaat ? '#065f46' : '#334155'
                  }}
                >
                  {booking.isForJamaat ? 'Member' : 'Public'}
                </span>
              </div>
            </div>

            {/* Column 3: Event Date & Day */}
            <div className="p-2 print:p-1.5 flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">
                EVENT DATE / تاریخِ تقریب
              </span>
              <div
                className="text-xs font-black"
                style={{ color: '#0f172a' }}
              >
                {programDateStr}
              </div>
              <div className="text-[8.5px] font-semibold text-slate-600 mt-0.5">
                {programDayEnglish} {programDayUrdu ? `(${programDayUrdu})` : ''}
              </div>
            </div>

            {/* Column 4: Program & Timing */}
            <div className="p-2 print:p-1.5 flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase block tracking-wider mb-0.5">
                PROGRAM & TIMING / تقریب
              </span>
              <div className="space-y-0.5">
                <div
                  className="text-[9.5px] font-black leading-tight break-words"
                  style={{ color: '#0f172a' }}
                >
                  {eventName}
                </div>
                <div
                  className="text-[9.5px] font-black leading-tight break-words"
                  style={{ color: '#0f172a' }}
                >
                  {eventTiming}
                </div>
              </div>
              <div className="text-[8.5px] text-slate-500 break-words leading-tight mt-0.5">
                {booking.address || 'KMLWJ Complex, Lyari'}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           3. ASSIGNED VENUE MATRIX
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-1.5 print:mb-1 bg-white box-border">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[9px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
          >
            <span>2. ASSIGNED VENUE VERIFICATION MATRIX</span>
            <span
              className="text-[11px] font-bold leading-relaxed"
              style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              منتخب کردہ ہال / تقریب کا مقام
            </span>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-300">
            {hallsList.map((hall) => {
              const selected = hall.selected;
              return (
                <div
                  key={hall.id}
                  className="p-2 print:p-1.5 flex flex-col justify-between min-h-[42px] print:min-h-[38px] relative box-border"
                  style={
                    selected
                      ? {
                          backgroundColor: '#ecfdf5',
                          boxShadow: 'inset 0 0 0 1.5px #059669',
                          color: '#064e3b'
                        }
                      : {
                          backgroundColor: '#ffffff',
                          color: '#475569'
                        }
                  }
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className="text-[11px] font-bold leading-relaxed"
                      style={{
                        fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        color: selected ? '#064e3b' : '#334155'
                      }}
                    >
                      {hall.urduName}
                    </span>
                    {selected ? (
                      <span
                        className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider border"
                        style={{
                          backgroundColor: '#10b981',
                          borderColor: '#059669',
                          color: '#ffffff'
                        }}
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3]" /> ASSIGNED
                      </span>
                    ) : (
                      <span className="shrink-0 w-3 h-3 rounded-xs border border-slate-300 inline-block" />
                    )}
                  </div>
                  <span
                    className="text-[8px] font-bold uppercase tracking-wider block"
                    style={{ color: selected ? '#065f46' : '#64748b' }}
                  >
                    {hall.englishName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           4. FINANCIAL ASSESSMENT & SETTLEMENT BOX
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-1.5 print:mb-1 bg-white box-border">
          <div className="grid grid-cols-4 divide-x divide-slate-300 border-b border-slate-300">
            <div className="p-2 print:p-1.5 text-center flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Hall Charges
              </span>
              <div className="text-xs font-black" style={{ color: '#0f172a' }}>
                Rs. {Math.round(hallCharges).toLocaleString()}
              </div>
            </div>
            <div className="p-2 print:p-1.5 text-center flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Discount
              </span>
              <div className="text-xs font-black" style={{ color: '#c2410c' }}>
                - Rs. {Math.round(discountAmt).toLocaleString()}
              </div>
            </div>
            <div className="p-2 print:p-1.5 text-center flex flex-col justify-center box-border" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Net Amount
              </span>
              <div className="text-xs font-black" style={{ color: '#0f172a' }}>
                Rs. {Math.round(netAmount).toLocaleString()}
              </div>
            </div>
            <div className="p-2 print:p-1.5 text-center flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                Received
              </span>
              <div className="text-xs font-black" style={{ color: '#0369a1' }}>
                Rs. {Math.round(receivedAmount).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-300">
            {/* Amount in Words */}
            <div className="p-2 print:p-1.5 col-span-2 bg-slate-50 flex flex-col justify-center box-border">
              <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                AMOUNT RECEIVED IN WORDS / رقم حرفی
              </span>
              <p
                className="text-[10.5px] font-bold italic capitalize border-l-2 border-emerald-600 pl-2 leading-snug break-words"
                style={{ color: '#0f172a' }}
              >
                "{amountWords}"
              </p>
            </div>

            {/* Balance / Settled Currency Card */}
            <div
              className="p-2 print:p-1.5 flex flex-col justify-center items-end text-right box-border"
              style={
                isRefundish
                  ? { backgroundColor: '#fff1f2', borderLeft: '2px solid #e11d48', color: '#881337' }
                  : remainingAmount > 0
                    ? { backgroundColor: '#fffbeb', borderLeft: '2px solid #d97706', color: '#78350f' }
                    : { backgroundColor: '#ecfdf5', borderLeft: '2px solid #10b981', color: '#064e3b' }
              }
            >
              <span
                className="text-[7.5px] font-bold uppercase tracking-widest block mb-0.5"
                style={{ color: isRefundish ? '#9f1239' : remainingAmount > 0 ? '#92400e' : '#065f46' }}
              >
                {isRefundish
                  ? 'REFUNDED / SETTLED AMOUNT'
                  : remainingAmount > 0
                    ? 'BALANCE DUE / بقایا رقم'
                    : 'SETTLED AMOUNT / کل رقم'}
              </span>
              <div
                className="text-sm sm:text-base font-black font-mono tracking-tight my-0.5"
                style={{ color: isRefundish ? '#be123c' : remainingAmount > 0 ? '#b45309' : '#064e3b' }}
              >
                Rs. {Math.round(isRefundish ? netAmount : (remainingAmount > 0 ? remainingAmount : netAmount)).toLocaleString()}/-
              </div>
              {Number(booking.refundAmount || 0) > 0 && (
                <div className="text-[9px] font-bold text-rose-600 mb-0.5">
                  Refunded: -Rs. {Number(booking.refundAmount).toLocaleString()}/-
                </div>
              )}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider mt-0.5"
                style={{
                  backgroundColor: isRefundish ? '#ffe4e6' : remainingAmount > 0 ? '#fef3c7' : '#d1fae5',
                  color: isRefundish ? '#e11d48' : remainingAmount > 0 ? '#d97706' : '#059669'
                }}
              >
                <CheckCircle2 className="h-2.5 w-2.5" />{' '}
                {isRefundish
                  ? (booking.status ? booking.status.toUpperCase() : 'REFUNDED')
                  : remainingAmount > 0 ? 'PARTIALLY PAID' : 'SETTLED'}
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           5. THREE EXECUTIVE SIGNATURE BLOCKS & FOOTER
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 grid grid-cols-3 items-end gap-2 text-center pt-2.5 print:pt-2 pb-1.5">
          {/* Sign 1: Received By */}
          <div className="flex flex-col items-center">
            <div className="h-6 sm:h-7 w-full flex items-end justify-center pb-1">
              <div className="w-20 sm:w-24 border-b border-slate-800" />
            </div>
            <span
              className="text-xs font-bold block leading-relaxed my-0.5"
              style={{
                fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              وصول کنندہ
            </span>
            <span className="text-[7.5px] font-extrabold text-slate-600 uppercase tracking-wider block">
              Received By
            </span>
          </div>

          {/* Sign 2: Discount Approval */}
          <div className="flex flex-col items-center">
            <div className="h-6 sm:h-7 w-full flex items-end justify-center pb-1">
              <div className="w-20 sm:w-24 border-b border-slate-800" />
            </div>
            <span
              className="text-xs font-bold block leading-relaxed my-0.5"
              style={{
                fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              رعایت کی منظوری
            </span>
            <span className="text-[7.5px] font-extrabold text-slate-600 uppercase tracking-wider block">
              Discount Approval
            </span>
          </div>

          {/* Sign 3: General Secretary */}
          <div className="flex flex-col items-center relative">
            <div className="h-6 sm:h-7 w-full flex items-end justify-center pb-1">
              <div className="w-20 sm:w-24 border-b border-slate-800" />
            </div>
            <span
              className="text-xs font-bold block leading-relaxed my-0.5"
              style={{
                fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              جنرل سیکریٹری
            </span>
            <span className="text-[7.5px] font-extrabold text-slate-600 uppercase tracking-wider block">
              General Secretary
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="relative z-10 mt-1 pt-1.5 border-t border-slate-200 text-center px-2">
          <p
            className="text-[9px] font-bold leading-relaxed"
            style={{
              fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              color: '#334155'
            }}
          >
            ہدایات: تقریب کے وقت اصل رسید دکھانا اور مقررہ اوقات و جماعت کے تمام قواعد و ضوابط کی پابندی لازمی ہے۔
          </p>
        </div>
      </div>
    </div>
  );
};

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  // Default to Portrait 2-in-1 (Top Half & Bottom Half on exactly 1 A4 Page)
  const [printMode, setPrintMode] = useState('both-1page');

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!booking) return null;

  return createPortal(
    <div
      id="print-receipt-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none print:static print:inset-auto print:block"
    >
      <div className="w-full max-w-4xl bg-slate-100 rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden print:overflow-visible border-0 print:border-none print:static print:block print:w-full print:bg-white">
        {/* ══════════════════════════════════════════════════════════
           TOP ACTION BAR (HIDDEN IN PRINT)
           ══════════════════════════════════════════════════════════ */}
        <div className="print-hide-bar flex flex-col sm:flex-row justify-between items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Official Hall Booking Voucher (Print Preview)
              </h2>
              <p className="text-xs text-emerald-300">
                Optimized 1-Page A4 Portrait Layout — Exactly 2 Slips per A4 Page
              </p>
            </div>
          </div>

          {/* Layout Selector Tabs */}
          <div className="flex flex-wrap items-center bg-slate-950/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPrintMode('both-1page')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both-1page'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Both Copies (1 Page Portrait)
            </button>
            <button
              onClick={() => setPrintMode('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Customer Copy Only
            </button>
            <button
              onClick={() => setPrintMode('office')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'office'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Office Copy Only
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Preview (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           RECEIPT PREVIEW CONTAINER (EXACTLY 2 SLIPS ON 1 A4 PORTRAIT PAGE)
           ══════════════════════════════════════════════════════════ */}
        <div className="overflow-y-auto print:overflow-visible bg-slate-200/80 print:bg-white flex flex-col items-center p-3 sm:p-4 print:p-0 print:static print:block">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 3mm 4mm !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                width: 100% !important;
                height: 100% !important;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body > *:not(#print-receipt-modal) {
                display: none !important;
              }
              .print-hide-bar,
              .print-hide-bar * {
                display: none !important;
              }
              #print-receipt-modal {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                outline: none !important;
                z-index: 99999999 !important;
              }
              #print-receipt-modal img, #print-receipt-modal svg {
                filter: none !important;
              }
            }
          `}</style>

          <div
            id="print-receipt-wrapper"
            className="w-full max-w-[780px] print:max-w-full flex flex-col items-center"
          >
            {/* Customer Copy */}
            {(printMode === 'both-1page' || printMode === 'customer') && (
              <div className="w-full">
                <ReceiptSlip
                  key="customer-copy"
                  booking={booking}
                  copyType="customer"
                  copyUrduTitle="صارف کاپی (Customer Copy)"
                  copyEnglishTitle="CUSTOMER COPY"
                />
              </div>
            )}

            {/* Scissor Cut Line Separator (Fits comfortably between both slips on 1 A4 page) */}
            {printMode === 'both-1page' && (
              <div className="w-full my-1 print:my-0.5 flex items-center gap-2 text-slate-500 select-none px-4">
                <div className="flex-1 border-b border-dashed border-slate-400" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <span>✂</span> CUT HERE / یہاں سے علیحدہ کریں <span>✂</span>
                </span>
                <div className="flex-1 border-b border-dashed border-slate-400" />
              </div>
            )}

            {/* Office Copy */}
            {(printMode === 'both-1page' || printMode === 'office') && (
              <div className="w-full">
                <ReceiptSlip
                  key="office-copy"
                  booking={booking}
                  copyType="office"
                  copyUrduTitle="دفتری کاپی (Office Record Copy)"
                  copyEnglishTitle="OFFICE RECORD COPY"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

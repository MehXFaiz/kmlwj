import React, { useEffect, useState } from 'react';
import { X, Printer, BookOpen, Loader2 } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import api from '../../services/api';

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d)) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const HallBookingGLModal = ({ booking, onClose }) => {
  const [glData, setGlData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!booking?.journalEntryId) {
      setError('No journal entry linked to this booking.');
      setLoading(false);
      return;
    }
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/journal-entries?id=${booking.journalEntryId}`);
        setGlData(res.data.data);
      } catch (err) {
        setError(err?.response?.data?.error?.message || err.message || 'Failed to load GL data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [booking]);

  const handlePrint = () => window.print();

  if (!booking) return null;

  const lines = glData?.lines || glData?.JournalLine || glData?.journalLines || [];
  const postingDate = formatDateDDMMYYYY(glData?.date || booking?.bookingDate || booking?.createdAt);
  const reference = glData?.referenceNo || glData?.reference || `HB-${booking.receiptNo}`;
  const description = glData?.description || `Hall Booking — ${booking.bookerName}`;
  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit || l.debitAmount || 0)), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit || l.creditAmount || 0)), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md print:p-0 print:bg-white print:backdrop-blur-none overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden border border-slate-200">

        {/* Toolbar — hidden on print */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">General Ledger Voucher</h2>
              <p className="text-xs text-slate-400">Journal Entry — {reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print GL
            </button>
            <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto print:overflow-visible bg-slate-100/60 print:bg-white flex flex-col items-center p-4 sm:p-8 print:p-0">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #gl-print-wrapper, #gl-print-wrapper * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #gl-print-wrapper {
                position: absolute !important;
                left: 0 !important; top: 0 !important;
                width: 100% !important; max-width: 100% !important;
                margin: 0 !important; padding: 0 !important;
              }
              @page { size: A4 landscape; margin: 10mm; }
            }
          `}</style>

          <div id="gl-print-wrapper" className="w-full max-w-[900px] print:max-w-full">

            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                <p className="text-sm font-medium">Loading GL data…</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-500">
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="bg-white border border-slate-300 print:border-none rounded-2xl print:rounded-none p-6 sm:p-8 print:p-4 shadow-xl print:shadow-none font-sans text-slate-900">

                {/* ── Header ── */}
                <div className="border-b-2 border-[#482F1E] pb-5 mb-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Logo */}
                    <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                      <img src={logoImg} alt="Logo" className="w-14 h-14 object-contain" />
                    </div>

                    {/* Org Name */}
                    <div className="flex-1 text-center">
                      <h1
                        className="text-xl font-extrabold text-[#482F1E] leading-snug"
                        style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                      >
                        کچھی مسلم لوہارواڈھا ویلفیئر جماعت
                      </h1>
                      <p className="text-[11px] font-bold text-slate-500 mt-1">
                        جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">REGISTERED NO: 1319</p>
                    </div>

                    {/* GL Voucher badge */}
                    <div className="shrink-0 text-right">
                      <div
                        className="inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white mb-2"
                        style={{ backgroundColor: '#482F1E', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                      >
                        GL VOUCHER
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">REF NO</span>
                        <span className="text-xl font-black text-[#482F1E] block leading-none mt-0.5">{reference}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Voucher Type</span>
                      <span className="font-black text-[#482F1E] text-base mt-0.5 block">Bank Receipt (BR)</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Posting Date</span>
                      <span className="font-bold text-slate-800 text-base mt-0.5 block">{postingDate}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Hall Booking Ref</span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">Receipt #{booking.receiptNo} — {booking.bookerName}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Narration / تفصیل</span>
                  <p className="text-sm font-medium text-slate-800 mt-1">{description}</p>
                </div>

                {/* Journal Lines Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#482F1E', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-white">#</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-white">Account Name</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-white">GL Code</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-white">Debit (Dr)</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-white">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">No journal lines found</td>
                        </tr>
                      ) : (
                        lines.map((line, idx) => {
                          const debit = parseFloat(line.debit ?? line.debitAmount ?? 0);
                          const credit = parseFloat(line.credit ?? line.creditAmount ?? 0);
                          const accountName = line.account?.name || line.accountName || '—';
                          const glCode = line.account?.glCode || line.glCode || '—';
                          return (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                              <td className="px-4 py-3 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{accountName}</td>
                              <td className="px-4 py-3 font-mono text-[#482F1E] font-bold">{glCode}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">
                                {debit > 0 ? `Rs. ${debit.toLocaleString()}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">
                                {credit > 0 ? `Rs. ${credit.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {/* Totals */}
                    <tfoot>
                      <tr style={{ backgroundColor: '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        <td colSpan={3} className="px-4 py-3 text-right font-black text-sm text-slate-700 border-t border-slate-300">TOTAL</td>
                        <td className="px-4 py-3 text-right font-black text-base text-[#482F1E] border-t border-slate-300">
                          Rs. {totalDebit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-base text-[#482F1E] border-t border-slate-300">
                          Rs. {totalCredit.toLocaleString()}
                        </td>
                      </tr>
                      {/* Balance check */}
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-right border-t border-slate-200">
                          {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              ✓ Balanced Entry — Dr = Cr
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                              ⚠ Unbalanced! Difference: Rs. {Math.abs(totalDebit - totalCredit).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatures */}
                <div className="pt-10 pb-2 grid grid-cols-3 gap-8 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b-2 border-slate-700 pb-1 mb-2"></div>
                    <span className="text-xs font-bold text-slate-700">Prepared By</span>
                    <span className="text-[10px] text-slate-400">Accounts Officer</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b-2 border-slate-700 pb-1 mb-2"></div>
                    <span className="text-xs font-bold text-slate-700">Checked By</span>
                    <span className="text-[10px] text-slate-400">Finance Manager</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b-2 border-slate-700 pb-1 mb-2"></div>
                    <span className="text-xs font-bold text-slate-700">Approved By</span>
                    <span className="text-[10px] text-slate-400">General Secretary</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-center">
                  <p className="text-[10px] text-slate-400 font-sans">
                    Kutchi Muslim Loharwadha Welfare Jamaat Lyari Karachi &bull; General Ledger Voucher &bull; Printed on {new Date().toLocaleDateString('en-GB')}
                  </p>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

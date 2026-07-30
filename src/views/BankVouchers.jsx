import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { useAuthStore } from '../store/authStore';
import { FileSpreadsheet, Search, Plus, Printer, CheckCircle, XCircle, Trash2, AlertTriangle, Edit, X, Banknote, Building2, Calendar, ArrowUpRight, ArrowDownLeft, FileText, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../components/ui/ConfirmationModal';
import logoImg from '../assets/logo.png';

// Helper to render number to English words for standard printed receipt
const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  
  const makeGroup = (n) => {
    let s = '';
    const hundred = Math.floor(n / 100);
    const ten = n % 100;
    if (hundred > 0) s += a[hundred] + ' Hundred ';
    if (ten > 0) {
      if (ten < 20) s += a[ten] + ' ';
      else s += b[Math.floor(ten / 10)] + ' ' + a[ten % 10] + ' ';
    }
    return s.trim();
  };

  let remainder = num;
  let wordResult = '';
  let groupIndex = 0;
  while (remainder > 0) {
    const chunk = remainder % 1000;
    if (chunk > 0) {
      wordResult = makeGroup(chunk) + ' ' + g[groupIndex] + ' ' + wordResult;
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex++;
  }
  return wordResult.trim() + ' Rupees Only';
};

// ── Design tokens (Mocha Brown palette) ──
const C = {
  paper:      '#FEFCF8',
  cream:      '#F6EBDF',
  creamDeep:  '#ECD9C6',
  primary:    '#4A2C11',
  secondary:  '#8A5E3D',
  gold:       '#C9A227',
  goldLight:  '#E8C97A',
  border:     '#D8C1A1',
  borderSoft: '#EDE0CE',
  ink:        '#24170F',
  muted:      '#7B6751',
  mutedLight: '#A8917A',
};

// ── Premium Bank Payment Voucher slip ──
function VoucherReceiptSlip({ voucher, amount, copyType, t }) {
  const isBank = useMemo(() => {
    return voucher.lines?.some(line =>
      line.accountCode?.startsWith('102') ||
      line.description?.toLowerCase().includes('bank') ||
      line.accountName?.toLowerCase().includes('bank')
    ) || voucher.reference?.length > 0;
  }, [voucher]);

  const totalDebit  = voucher.lines?.reduce((s, l) => s + (Number(l.debit)  || 0), 0) ?? 0;
  const totalCredit = voucher.lines?.reduce((s, l) => s + (Number(l.credit) || 0), 0) ?? 0;
  const dateStr = new Date(voucher.postingDate || voucher.date).toLocaleDateString('en-GB');
  const isOffice = copyType === 'office';

  return (
    <div style={{
      backgroundColor: C.paper,
      color: C.ink,
      fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(74,44,17,0.08)',
    }}>

      {/* Watermark */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 0, opacity: 0.045,
      }}>
        <img src={logoImg} alt="" style={{ width: '200px', height: '200px', objectFit: 'contain' }} />
      </div>

      {/* ── HEADER BAND ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, #6B3E1F 100%)`,
        padding: '12px 16px 10px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Top row: logo + org name + voucher title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo */}
          <div style={{
            width: '52px', height: '52px', flexShrink: 0,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px',
          }}>
            <img src={logoImg} alt="KMLWJ" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {/* Org name (center) */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Alvi Nastaleeq', serif",
              fontSize: '0.92rem', color: '#FFFFFF', lineHeight: 2.1, paddingTop: '0.45em', wordSpacing: '0.12em', fontWeight: 500,
              direction: 'rtl', textAlign: 'right',
            }}>
              کچھی مسلم لوہارواڈھا ویلفیئر جماعت
            </div>
            <div style={{
              fontSize: '7.5px', color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px',
            }}>
              Kutchi Muslim Loharwada Welfare Jamat
            </div>
          </div>

          {/* Voucher title + copy badge (right) */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{
              fontSize: '9px', fontWeight: 900, color: C.goldLight,
              letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>
              {voucher.voucherType === 'BP' ? 'Bank Payment Voucher' : 'Bank Receipt Voucher'}
            </div>
            <div style={{
              display: 'inline-block', marginTop: '4px',
              background: isOffice ? C.gold : 'rgba(255,255,255,0.18)',
              color: isOffice ? C.primary : '#fff',
              fontSize: '7px', fontWeight: 900, letterSpacing: '0.2em',
              textTransform: 'uppercase', padding: '2px 8px', borderRadius: '20px',
              border: isOffice ? 'none' : '1px solid rgba(255,255,255,0.35)',
            }}>
              {isOffice ? 'Office Copy' : 'Customer Copy'}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '10px 0 8px' }} />

        {/* Sub-row: voucher no + date */}
        <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Voucher No.
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '5px', padding: '1px 8px',
              fontSize: '10px', fontWeight: 900, color: C.goldLight,
              letterSpacing: '0.05em',
            }}>
              {voucher.voucherNo}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Date
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '5px', padding: '1px 8px',
              fontSize: '9.5px', fontWeight: 800, color: '#ffffff',
            }}>
              {dateStr}
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: '10px', position: 'relative', zIndex: 1 }}>

        {/* ── PAYMENT INFORMATION ── */}
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{
            background: C.cream, padding: '5px 10px',
            borderBottom: `1px solid ${C.borderSoft}`,
            fontSize: '7.5px', fontWeight: 900, color: C.secondary,
            textTransform: 'uppercase', letterSpacing: '0.22em',
          }}>
            Payment Information
          </div>
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Paid To + Payment Method row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '7px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3px' }}>
                  Payee Name
                </div>
                <div style={{
                  borderBottom: `1.5px solid ${C.creamDeep}`, paddingBottom: '3px',
                  fontSize: '10px', fontWeight: 700, color: C.ink, minHeight: '16px',
                }}>
                  {voucher.reference || <span style={{ color: C.mutedLight }}>—</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '7px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3px' }}>
                  Payment Method
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '3px', borderBottom: `1.5px solid ${C.creamDeep}` }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 600, color: C.ink }}>
                    <input type="checkbox" readOnly checked={!isBank} style={{ accentColor: C.primary, width: '10px', height: '10px' }} />
                    Cash
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 600, color: C.ink }}>
                    <input type="checkbox" readOnly checked={isBank} style={{ accentColor: C.primary, width: '10px', height: '10px' }} />
                    Bank / Cheque
                  </label>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            <div>
              <div style={{ fontSize: '7px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3px' }}>
                Amount in Words
              </div>
              <div style={{
                background: C.cream, borderRadius: '5px', padding: '4px 8px',
                fontSize: '9px', fontWeight: 600, color: C.ink, fontStyle: 'italic',
                border: `1px solid ${C.borderSoft}`,
              }}>
                {numberToWords(amount)}
              </div>
            </div>

            {/* Amount figure + Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '7px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '3px' }}>
                  Remarks / Particulars
                </div>
                <div style={{
                  borderBottom: `1.5px solid ${C.creamDeep}`, paddingBottom: '3px',
                  fontSize: '9.5px', fontWeight: 500, color: C.ink, minHeight: '16px',
                }}>
                  {voucher.description || <span style={{ color: C.mutedLight }}>—</span>}
                </div>
              </div>
              <div style={{
                background: `linear-gradient(135deg, ${C.primary} 0%, #6B3E1F 100%)`,
                borderRadius: '8px', padding: '6px 12px', textAlign: 'right', flexShrink: 0,
              }}>
                <div style={{ fontSize: '6.5px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Net Amount
                </div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: C.goldLight, marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>
                  Rs. {Number(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ACCOUNTING ENTRIES ── */}
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{
            background: C.cream, padding: '5px 10px',
            borderBottom: `1px solid ${C.borderSoft}`,
            fontSize: '7.5px', fontWeight: 900, color: C.secondary,
            textTransform: 'uppercase', letterSpacing: '0.22em',
          }}>
            Accounting Ledger Entries
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ background: C.creamDeep }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '7px', borderBottom: `1px solid ${C.border}`, width: '60px' }}>Code</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '7px', borderBottom: `1px solid ${C.border}` }}>Account Name / Description</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '7px', borderBottom: `1px solid ${C.border}`, width: '100px' }}>Debit</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '7px', borderBottom: `1px solid ${C.border}`, width: '100px' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines?.map((line, idx) => (
                <tr key={line.id || idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : C.paper, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: '5px 8px', fontWeight: 700, color: C.secondary, fontSize: '8px' }}>
                    {line.accountCode}
                  </td>
                  <td style={{ padding: '5px 8px', color: C.ink, fontWeight: 500 }}>
                    <div style={{ fontWeight: 600, fontSize: '9px' }}>{line.accountName || t('tables.bankVouchers.entry')}</div>
                    {line.description && line.description !== line.accountName && (
                      <div style={{ fontSize: '7.5px', color: C.muted, marginTop: '1px' }}>{line.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: Number(line.debit) > 0 ? C.ink : C.mutedLight, fontSize: '9px', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(line.debit) > 0 ? Number(line.debit).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: Number(line.credit) > 0 ? C.ink : C.mutedLight, fontSize: '9px', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(line.credit) > 0 ? Number(line.credit).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 2 - (voucher.lines?.length || 0)) }).map((_, idx) => (
                <tr key={`empty-${idx}`} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: '8px 8px' }}>&nbsp;</td>
                  <td style={{ padding: '8px 8px' }}></td>
                  <td style={{ padding: '8px 8px' }}></td>
                  <td style={{ padding: '8px 8px' }}></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: `linear-gradient(90deg, ${C.cream} 0%, ${C.creamDeep} 100%)`, borderTop: `1.5px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: '6px 8px', fontSize: '8px', fontWeight: 900, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                  Total
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 900, color: C.primary, fontSize: '9.5px', fontVariantNumeric: 'tabular-nums' }}>
                  {totalDebit > 0 ? totalDebit.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 900, color: C.primary, fontSize: '9.5px', fontVariantNumeric: 'tabular-nums' }}>
                  {totalCredit > 0 ? totalCredit.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── APPROVAL / SIGNATURES ── */}
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{
            background: C.cream, padding: '5px 10px',
            borderBottom: `1px solid ${C.borderSoft}`,
            fontSize: '7.5px', fontWeight: 900, color: C.secondary,
            textTransform: 'uppercase', letterSpacing: '0.22em',
          }}>
            Authorizations & Approval
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', borderTop: 'none' }}>
            {['Prepared By', 'Checked By', 'Approved By', "Authorized Sign"].map((label, i) => (
              <div key={label} style={{
                padding: '8px 8px 6px',
                borderRight: i < 3 ? `1px solid ${C.borderSoft}` : 'none',
                textAlign: 'center',
              }}>
                <div style={{
                  height: '28px', borderBottom: `1px solid ${C.creamDeep}`, marginBottom: '5px',
                }} />
                <div style={{ fontSize: '7px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          borderTop: `1px dashed ${C.border}`,
          paddingTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <div style={{ fontSize: '7px', color: C.mutedLight, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: C.muted }}>Kutchi Muslim Loharwada Welfare Jamat</div>
            <div>Karachi, Pakistan &nbsp;|&nbsp; info@kmlwj.com &nbsp;|&nbsp; www.kmlwj.com</div>
          </div>
          <div style={{
            fontSize: '6.5px', color: C.mutedLight, textAlign: 'right', maxWidth: '160px', lineHeight: 1.4,
          }}>
            This is a computer-generated voucher. Please retain for your records.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Print Modal ──
function BankVoucherPrintModal({ voucher, onClose }) {
  const { t } = useTranslation();

  const handlePrint = () => {
    window.print();
  };

  const amount = useMemo(() => {
    return voucher.lines ? voucher.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) : 0;
  }, [voucher]);

  return createPortal(
    <div id="print-modal-portal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print:p-0 print:static print:inset-auto print:block overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm print:hidden" onClick={onClose} />

      <div className="relative z-10 w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block print:max-w-none"
        style={{ background: '#1C140E', border: '1px solid #3B2A20', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

        {/* Modal header — hidden on print */}
        <div className="print-hide flex items-center justify-between px-6 py-3.5 shrink-0 print:hidden"
          style={{ borderBottom: '1px solid #3B2A20', background: '#150F09' }}>
          <div className="flex items-center gap-2.5">
            <Printer className="h-4 w-4" style={{ color: C.goldLight }} />
            <span className="text-sm font-bold text-slate-200">
              {voucher.voucherType === 'BP' ? t('tables.bankVouchers.printBankPayment') : t('tables.bankVouchers.printBankReceipt')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={{ background: C.secondary, color: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = C.primary}
              onMouseLeave={e => e.currentTarget.style.background = C.secondary}>
              <Printer className="h-3.5 w-3.5" /> {t('tables.bankVouchers.print')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div id="print-receipt" className="p-5 overflow-y-auto flex-1 print:overflow-visible print:p-0 print:static print:w-full print:block"
          style={{ background: '#2A1C12' }}>
          <style>{`
            @media print {
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body * { visibility: hidden !important; }
              #print-modal-portal, #print-modal-portal * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              #print-modal-portal img, #print-modal-portal svg { filter: none !important; }
              #print-modal-portal {
                position: absolute !important;
                left: 0 !important; top: 0 !important;
                width: 100% !important; max-width: 100% !important;
                height: auto !important; min-height: 100% !important;
                background: white !important;
                padding: 0 !important; margin: 0 !important;
                overflow: visible !important;
                z-index: 999999 !important;
                display: block !important;
              }
              .print-hide { display: none !important; }
              #print-receipt {
                width: 100% !important; max-width: 100% !important;
                margin: 0 !important; padding: 0 !important;
                display: block !important; background: white !important;
              }
              @page { size: A4 landscape; margin: 6mm; }
            }
          `}</style>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full print:grid-cols-2 print:gap-3 print:w-full">
            <VoucherReceiptSlip voucher={voucher} amount={amount} copyType="office"   t={t} />
            <VoucherReceiptSlip voucher={voucher} amount={amount} copyType="customer" t={t} />
          </div>
        </div>

        {/* Footer actions — hidden on print */}
        <div className="print-hide flex justify-end gap-3 px-6 py-3 shrink-0 print:hidden"
          style={{ borderTop: '1px solid #3B2A20', background: '#150F09' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{ border: '1px solid #3B2A20', color: '#94867A', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2A1C12'; e.currentTarget.style.color = '#D4C4B0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94867A'; }}>
            {t('tables.bankVouchers.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BankVoucherEditModal({ voucher, onClose, onSave }) {
  const [date, setDate] = useState(() => {
    const d = voucher.postingDate || voucher.date;
    return d ? new Date(d).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  });
  const [reference, setReference] = useState(voucher.reference || '');
  const [description, setDescription] = useState(voucher.description || '');
  const [amount, setAmount] = useState(() => {
    const sum = voucher.lines?.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    return sum ? sum.toString() : '';
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await onSave({
        id: voucher.dbId || voucher.id,
        postingDate: date,
        reference,
        description,
        amount: Number(amount)
      });
      onClose();
    } catch (err) {
      console.error("Failed to update voucher:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-900/40 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center">
              <Edit className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Edit {voucher.voucherType === 'BP' ? 'Expense' : 'Voucher'} ({voucher.voucherNo})</h3>
              <p className="text-[11px] text-slate-500">Update voucher details & amount</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (PKR) *</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Paid To / Reference</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. Vendor name, Cheque no..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description / Memo</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide details..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !amount}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50">
              {loading && <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const BankVouchers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { vouchers, fetchVouchers, updateVoucher, updateVoucherStatus, deleteVoucher, bulkDeleteVouchers, loading } = useBankVoucherStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const confirm = useConfirm();
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('BP'); // BP (Payments), BR (Receipts)
  const [printItem, setPrintItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVouchers(activeTab);
  }, [activeTab, fetchVouchers]);

  const handleSaveEdit = async (updatedData) => {
    try {
      await updateVoucher(updatedData.id, updatedData, activeTab);
      showToast('Voucher updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update voucher', 'error');
      throw err;
    }
  };

  const filtered = useMemo(() => {
    return vouchers.filter(v => 
      (v.voucherNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [vouchers, search]);

  const getVoucherTotal = (v) => {
    if (!v.lines || !Array.isArray(v.lines)) return 0;
    return v.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  };

  const getOffsetAccount = (v) => {
    // For BP: Offset is the debit account (the expense/asset being paid to)
    // For BR: Offset is the credit account (the revenue/liability received from)
    const targetLine = v.lines?.find(line => v.voucherType === 'BP' ? Number(line.debit) > 0 : Number(line.credit) > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const getBankCode = (v) => {
    // For BP: Credit account is the Bank account
    // For BR: Debit account is the Bank account
    const targetLine = v.lines?.find(line => v.voucherType === 'BP' ? Number(line.credit) > 0 : Number(line.debit) > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const getVoucherTypeOrRef = (v) => {
    if (v.reference && v.reference !== '—') {
      const cleaned = v.reference.replace(/\s*Payout$/i, '').trim();
      if (cleaned && cleaned !== v.voucherNo) return cleaned;
    }
    if (v.description) {
      const match = v.description.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1];
    }
    const targetLine = v.lines?.find(line => v.voucherType === 'BP' ? line.debit > 0 : line.credit > 0);
    if (targetLine?.accountName) return targetLine.accountName;
    if (targetLine?.description) {
      const match = targetLine.description.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1];
    }
    return v.reference || '—';
  };

  const handlePost = async (v) => {
    await confirm({
      title: 'Post Voucher to General Ledger',
      description: 'Are you sure you want to post this voucher to the General Ledger?',
      details: {
        'Voucher No': v.voucherNo,
        'Amount': `Rs. ${v.amount?.toLocaleString()}`,
        'Warning': 'This action will create Ledger Entries and post this transaction to the General Ledger. It cannot be undone.'
      },
      type: 'warning',
      confirmLabel: 'Post',
      loadingLabel: 'Posting...',
      successMessage: 'Voucher has been posted successfully.',
      action: async () => {
        await updateVoucherStatus(v.dbId, 'Posted', activeTab);
      }
    });
  };

  const handleCancel = async (v) => {
    await confirm({
      title: 'Void Voucher',
      description: 'Are you sure you want to void this voucher and reverse ledger records?',
      details: {
        'Voucher No': v.voucherNo,
        'Amount': `Rs. ${v.amount?.toLocaleString()}`,
        'Warning': 'This will cancel the voucher and automatically reverse/remove its ledger postings.'
      },
      type: 'warning',
      confirmLabel: 'Yes, Void',
      loadingLabel: 'Voiding...',
      successMessage: 'Voucher has been voided successfully.',
      action: async () => {
        await updateVoucherStatus(v.dbId, 'Cancelled', activeTab);
      }
    });
  };

  const handleDeleteVoucher = async (v) => {
    await confirm({
      title: 'Delete Bank Voucher',
      description: `Are you sure you want to permanently delete bank voucher ${v.voucherNo}?`,
      details: {
        'Voucher No': v.voucherNo,
        'Amount': `Rs. ${v.amount?.toLocaleString()}`,
        'Warning': 'This will remove the voucher from the database and adjust account balances.'
      },
      type: 'error',
      confirmLabel: 'Delete',
      loadingLabel: 'Deleting...',
      successMessage: 'Voucher has been deleted successfully.',
      action: async () => {
        await deleteVoucher(v.dbId, activeTab);
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(v => v.dbId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await bulkDeleteVouchers(selectedIds, activeTab);
      showToast(`${selectedIds.length} voucher(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete vouchers', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">{t('tables.bankVouchers.draft')}</span>;
      case 'Posted':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/60 text-amber-400 border-amber-900/50">{t('tables.bankVouchers.posted')}</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">{t('tables.bankVouchers.cancelled')}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="h-3 w-3" /> {t('tables.bankVouchers.cashBankVouchers')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.bankVouchers.bankVouchers')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('tables.bankVouchers.bankVouchersDesc')}</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && canEditOrDelete && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-lg active:scale-95 flex-1 sm:flex-none cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          {activeTab === 'BR' ? (
            <>
              <Link to="/bank-vouchers/revenue/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> {t('forms.addRevenue')}
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                {t('tables.bankVouchers.advancedReceipt')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/bank-vouchers/expense/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> {t('forms.addExpense')}
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                {t('tables.bankVouchers.advancedPayment')}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 scrollbar-none overflow-x-auto whitespace-nowrap">
        <button onClick={() => setActiveTab('BP')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BP' ? 'text-amber-400 border-amber-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          {t('tables.bankVouchers.bankPaymentsBP')}
        </button>
        <button onClick={() => setActiveTab('BR')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BR' ? 'text-amber-400 border-amber-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          {t('tables.bankVouchers.bankReceiptsBR')}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tables.bankVouchers.searchPlaceholder') || "Search by voucher #, reference or remarks..."}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
        </div>
        <div className="flex items-center gap-4 self-end sm:self-auto text-xs font-medium text-slate-400 px-2">
          {canEditOrDelete && filtered.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                onChange={handleSelectAll}
                className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer w-4 h-4"
              />
              <span>Select All</span>
            </label>
          )}
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> {filtered.length === 1 ? 'voucher' : 'vouchers'}</span>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="h-8 w-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">{t('tables.bankVouchers.loadingVouchers') || 'Loading Vouchers...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
              <FileSpreadsheet className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">{search ? 'No vouchers found' : 'No vouchers recorded yet'}</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6">{search ? `We couldn't find any results matching "${search}". Try adjusting your search term or clearing the filter.` : 'Start by recording your first bank payment or receipt voucher to generate accounting entries and ledger records.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(v => (
              <div
                key={v.dbId}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(v.dbId) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Icon, Voucher No & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      {canEditOrDelete && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(v.dbId)}
                          onChange={(e) => handleSelectOne(v.dbId, e)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                        />
                      )}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner shrink-0 border ${
                        v.voucherType === 'BP' 
                          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 text-amber-400' 
                          : 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/30 text-emerald-400'
                      }`}>
                        {v.voucherType === 'BP' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight font-mono">
                          {v.voucherNo || 'BP-0000'}
                        </h4>
                        <p className="text-xs text-slate-200 font-bold mt-0.5">
                          {getVoucherTypeOrRef(v)}
                        </p>
                        {v.description && (
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-2" title={v.description}>
                            {v.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(v.status)}
                    </div>
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.totalAmount') || 'TOTAL AMOUNT'}
                      </span>
                      <span className="font-bold text-amber-400 text-sm">
                        PKR {getVoucherTotal(v).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.bankAccount') || 'BANK ACCOUNT'}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded">
                        {getBankCode(v)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.offsetAccount') || 'OFFSET ACCOUNT'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800/45 border border-slate-700/40 px-2 py-0.5 rounded">
                        {getOffsetAccount(v)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.referenceCheque') || 'REFERENCE'}
                      </span>
                      <span className="font-semibold text-slate-200 text-xs truncate max-w-[150px]" title={v.reference}>
                        {v.reference || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Expand Ledger Lines Button */}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === v.dbId ? null : v.dbId)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      {expandedId === v.dbId ? 'Hide Ledger Entries' : 'View Ledger Entries'} ({v.lines ? v.lines.length : 0})
                      {expandedId === v.dbId ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    
                    {expandedId === v.dbId && (
                      <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-950/90 overflow-hidden animate-in fade-in duration-150">
                        <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>{t('tables.bankVouchers.accountCode') || 'ACCOUNT / ENTRY'}</span>
                          <div className="flex gap-4">
                            <span className="w-16 text-right">{t('tables.bankVouchers.debit') || 'DEBIT'}</span>
                            <span className="w-16 text-right">{t('tables.bankVouchers.credit') || 'CREDIT'}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-800/50 max-h-48 overflow-y-auto">
                          {v.lines && v.lines.map(line => (
                            <div key={line.id} className="p-2.5 flex justify-between items-center text-xs">
                              <div className="pr-2 truncate flex-1 font-medium text-slate-300" title={line.description}>
                                <span className="font-mono text-slate-400 bg-slate-800/50 border border-slate-700/40 px-1 py-0.5 rounded mr-1.5 text-[10px]">{line.accountCode}</span>
                                {line.description || t('tables.bankVouchers.entry')}
                              </div>
                              <div className="flex gap-4 shrink-0 font-mono font-semibold">
                                <span className="w-16 text-right text-slate-200">{line.debit > 0 ? line.debit.toLocaleString() : '—'}</span>
                                <span className="w-16 text-right text-slate-200">{line.credit > 0 ? line.credit.toLocaleString() : '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {v.postedBy && (
                          <div className="px-3 py-1.5 bg-slate-900/40 border-t border-slate-800/60 text-[10px] text-slate-400">
                            <span className="font-bold">{t('tables.bankVouchers.postedBy') || 'Posted By'}:</span> {v.postedBy}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 mt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {v.postingDate}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPrintItem(v)} className="w-8 h-8 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer shadow-sm" title="Print physical voucher">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    {(v.status === 'Draft' || canEditOrDelete) && (
                      <button onClick={() => setEditItem(v)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Edit Voucher">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {v.status === 'Draft' && canPostToLedger && (
                      <button onClick={() => handlePost(v)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title={t('tables.bankVouchers.post') || "Post Voucher"}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {v.status === 'Posted' && (
                      <button onClick={() => handleCancel(v)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title={t('tables.bankVouchers.void') || "Void Voucher & Reverse Ledger Entry"}>
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEditOrDelete && (
                      <button onClick={() => handleDeleteVoucher(v)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Delete from database">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {printItem && (
        <BankVoucherPrintModal
          voucher={printItem}
          onClose={() => setPrintItem(null)}
        />
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Bulk Deletion</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-white">{selectedIds.length}</span> selected bank voucher(s)? Any associated ledger entries and account balances will be automatically re-adjusted. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedIds.length} Voucher(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <BankVoucherEditModal
          voucher={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

import React from 'react';
import { Banknote, BadgeCheck, CalendarDays, CheckSquare2, FileText, Printer, ScrollText, Signature, SquarePen, Wallet, X } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { paymentMethodLabel } from '../../constants/paymentMethods';

const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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

  let remainder = Math.floor(num);
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  let wordResult = '';
  let groupIndex = 0;
  while (remainder > 0) {
    const group = remainder % 1000;
    if (group > 0) {
      const groupWords = makeGroup(group);
      wordResult = groupWords + (g[groupIndex] ? ' ' + g[groupIndex] : '') + ' ' + wordResult;
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex++;
  }
  return wordResult.trim() || 'Zero';
};

const theme = {
  paper: '#fcf8f2',
  paperDeep: '#f5ebde',
  ink: '#24170f',
  muted: '#6f5a45',
  accent: '#8a5e3d',
  accentSoft: '#b88b63',
  border: '#d8c1a1',
  line: '#e9dcc9',
  success: '#5b4a39'
};

function FieldChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#e7d7bf] bg-white/80 px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6751]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-[#24170f]">{value || '—'}</div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-[20px] border border-[#e7d7bf] bg-white/80 p-3 shadow-[0_12px_32px_rgba(120,85,46,0.06)]">
      <div className="mb-2 flex items-center gap-2 border-b border-[#efe2cf] pb-2">
        {Icon ? <Icon className="h-4 w-4 text-[#8a5e3d]" /> : null}
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#7b6751]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LedgerTable({ rows, total }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#e7d7bf] bg-[#fcf7ef]">
      <div className="grid grid-cols-[1.2fr_0.8fr] border-b border-[#e7d7bf] bg-[#f6ebdf] px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6751]">
        <span>Ledger Entry</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.map((row, index) => (
        <div key={`${row.account}-${index}`} className={`grid grid-cols-[1.2fr_0.8fr] items-start px-3 py-2.5 text-sm ${index % 2 ? 'bg-white/60' : 'bg-transparent'}`}>
          <div className="pr-2">
            <div className="font-semibold text-[#24170f]">{row.account}</div>
            <div className="mt-0.5 text-[11px] text-[#7b6751]">{row.narration}</div>
          </div>
          <div className="text-right font-semibold text-[#24170f]">Rs {Number(row.amount || 0).toLocaleString('en-PK')}</div>
        </div>
      ))}
      <div className="grid grid-cols-[1.2fr_0.8fr] border-t border-[#e7d7bf] bg-[#f6ebdf] px-3 py-2.5 text-sm font-black text-[#24170f]">
        <span className="uppercase tracking-[0.2em]">Total</span>
        <span className="text-right">Rs {Number(total || 0).toLocaleString('en-PK')}</span>
      </div>
    </div>
  );
}

function SignatureBlock({ label, name, checked = false }) {
  return (
    <div className="rounded-[16px] border border-[#e7d7bf] bg-[#fcf7ef] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6751]">
        <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-[#8a5e3d] bg-[#8a5e3d]' : 'border-[#cdb79f] bg-white'}`}>
          {checked ? <CheckSquare2 className="h-3 w-3 text-white" /> : null}
        </span>
        {label}
      </div>
      <div className="mt-2 border-b border-dashed border-[#cdb79f] pb-1 text-sm font-semibold text-[#24170f]">{name || '________________'}</div>
    </div>
  );
}

function CopySheet({ copyLabel, title, voucherNo, fileNo, formattedDate, paidTo, paymentMethod, amount, words, remarks, ledgerRows, preparedBy, verifiedBy, authorizedSign, payeeLabel, partyLabel = 'Paid To' }) {
  return (
    <div className="rounded-[24px] border border-[#d8c1a1] bg-[#fefcf8] p-3 shadow-[0_18px_40px_rgba(29,18,12,0.08)] print:rounded-none print:shadow-none">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-[#e7d7bf] bg-gradient-to-r from-[#f6ebdf] to-[#fbf4e9] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8c1a1] bg-white/80">
            <img src={logoImg} alt="Logo" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8a5e3d]">{copyLabel}</div>
            <div
              className="font-semibold text-[#24170f]"
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Alvi Nastaleeq', serif",
                fontSize: '0.82rem',
                lineHeight: 2.1,
                paddingTop: '0.4em',
                wordSpacing: '0.12em',
                fontWeight: 500,
              }}
            >
              کچھی مسلم لوہارواڈھا ویلفیئر جماعت
            </div>
          </div>
        </div>
        <div className="rounded-full border border-[#d8c1a1] bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#8a5e3d]">
          {title}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <SectionCard title="Voucher Details" icon={FileText}>
            <div className="grid gap-2 md:grid-cols-2">
              <FieldChip label="Voucher No" value={voucherNo || '—'} icon={ScrollText} />
              <FieldChip label="Date" value={formattedDate} icon={CalendarDays} />
              <FieldChip label={partyLabel} value={paidTo || '—'} icon={Wallet} />
              <FieldChip label="Payment Method" value={paymentMethod} icon={Banknote} />
            </div>
          </SectionCard>

          <SectionCard title="Remarks & Amount" icon={SquarePen}>
            <div className="space-y-2">
              <div className="rounded-[16px] border border-[#e7d7bf] bg-[#fcf7ef] p-2.5 text-sm text-[#24170f]">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6751]">Amount in Words</div>
                <div className="mt-1 font-semibold">{words} Only</div>
              </div>
              <div className="rounded-[16px] border border-[#e7d7bf] bg-[#fcf7ef] p-2.5 text-sm text-[#24170f]">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6751]">Remarks</div>
                <div className="mt-1 font-medium">{remarks || 'No remarks provided.'}</div>
              </div>
              <div className="rounded-[16px] border border-[#8a5e3d] bg-[#f6ebdf] p-3 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7b6751]">Net Amount</div>
                <div className="mt-1 text-2xl font-black text-[#24170f]">Rs {Number(amount || 0).toLocaleString('en-PK')}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          <SectionCard title="Ledger Entries" icon={BadgeCheck}>
            <LedgerTable rows={ledgerRows} total={amount || 0} />
          </SectionCard>

          <SectionCard title="Authorizations" icon={Signature}>
            <div className="grid gap-2 sm:grid-cols-2">
              <SignatureBlock label="Prepared By" name={preparedBy || 'Operator'} checked />
              <SignatureBlock label="Verified By" name={verifiedBy || '—'} />
              <SignatureBlock label="Authorized Sign" name={authorizedSign || '—'} />
              <SignatureBlock label="Receiver" name={payeeLabel || 'Payee'} />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[16px] border border-dashed border-[#d8c1a1] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[#7b6751]">
        <span>Reference: {fileNo || '—'}</span>
        <span>Commercial Print Ready</span>
      </div>
    </div>
  );
}

export const VoucherSlipModal = ({
  isOpen = true,
  onClose,
  title = 'BANK PAYMENT SLIP',
  voucherNo = '',
  fileNo = '',
  date = '',
  name = '',
  address = '',
  // Actual saved payment method code (CASH/BANK/CHEQUE/ONLINE). `paymentMethod`
  // is the preferred prop; `debitCredit` is accepted for backward compatibility
  // since existing callers wire the record's method through it.
  paymentMethod: paymentMethodProp,
  debitCredit = '',
  accountName = '',
  particulars = '',
  amount = 0,
  preparedBy = 'Operator',
  payeeLabel = "Payee's Signature",
  partyLabel,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCollectionOrReceipt = /RECEIPT|COLLECTION|INCOME|REVENUE|MEMBERSHIP|FEE|DONATION RECEIVED/i.test(title);
  const computedPartyLabel = partyLabel || (isCollectionOrReceipt ? 'Paid By' : 'Paid To');

  const formattedDate = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const amountRs = Math.floor(amount || 0).toLocaleString('en-PK');
  const words = numberToWords(amount || 0);
  // Always derive from the actual saved transaction record — never inferred from
  // the account name and never defaulted to "Bank Transfer".
  const paymentMethod = paymentMethodLabel(paymentMethodProp ?? debitCredit);
  const ledgerRows = [
    {
      account: accountName || 'Primary Ledger Account',
      narration: particulars || 'Narration / particulars entry',
      amount: amount || 0
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-4 print:p-0 print:static print:inset-auto print:block">
      <div className="absolute inset-0 print:hidden" onClick={onClose} />

      <div className="relative z-10 flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-[#2d2118] bg-[#24170f] shadow-2xl print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block">
        <div className="flex items-center justify-between border-b border-[#3b2a20] bg-[#1c140e] px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2.5">
            <Printer className="h-4 w-4 text-[#e8c58a]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-200">Premium Voucher Preview</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-full bg-[#8a5e3d] px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white transition hover:bg-[#a06a43]">
              <Printer className="h-3.5 w-3.5" /> Print Slip
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f5ebde] p-3 sm:p-5 print:p-0 print:overflow-visible print:bg-white">
          <style>{`
            @page {
              size: A4 landscape;
              margin: 7mm;
            }
            @media print {
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body * { visibility: hidden !important; }
              #print-voucher-slip, #print-voucher-slip * { visibility: visible !important; }
              #print-voucher-slip { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; }
            }
          `}</style>

          <div id="print-voucher-slip" className="mx-auto w-full max-w-[1800px] rounded-[28px] border border-[#d8c1a1] bg-[#fcf8f2] p-2 shadow-[0_20px_45px_rgba(36,23,15,0.12)] print:rounded-none print:shadow-none">
            <div className="relative overflow-hidden rounded-[24px] border border-[#e7d7bf] bg-[radial-gradient(circle_at_top_left,_rgba(138,94,61,0.06),_transparent_45%),linear-gradient(135deg,_#fcf8f2_0%,_#f6ebdf_100%)] p-3 print:p-0">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] print:opacity-[0.08]">
                <img src={logoImg} alt="Watermark" className="h-[320px] w-[320px] object-contain" />
              </div>
              <div className="relative z-10 grid gap-3 xl:grid-cols-2 print:grid-cols-2">
                <CopySheet
                  copyLabel="Office Copy"
                  title={title}
                  voucherNo={voucherNo}
                  fileNo={fileNo}
                  formattedDate={formattedDate}
                  paidTo={name}
                  paymentMethod={paymentMethod}
                  amount={amount}
                  words={words}
                  remarks={particulars}
                  ledgerRows={ledgerRows}
                  preparedBy={preparedBy}
                  verifiedBy="Director"
                  authorizedSign="Authorized Sign"
                  payeeLabel={payeeLabel}
                  partyLabel={computedPartyLabel}
                />
                <CopySheet
                  copyLabel="Customer Copy"
                  title={title}
                  voucherNo={voucherNo}
                  fileNo={fileNo}
                  formattedDate={formattedDate}
                  paidTo={name}
                  paymentMethod={paymentMethod}
                  amount={amount}
                  words={words}
                  remarks={particulars}
                  ledgerRows={ledgerRows}
                  preparedBy={preparedBy}
                  verifiedBy="Director"
                  authorizedSign="Authorized Sign"
                  payeeLabel={payeeLabel}
                  partyLabel={computedPartyLabel}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherSlipModal;

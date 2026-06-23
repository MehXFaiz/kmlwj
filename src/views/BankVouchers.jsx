import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { FileSpreadsheet, Search, Plus, Printer, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

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

// Printable Modal
function BankVoucherPrintModal({ voucher, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const amount = useMemo(() => {
    // Total is sum of debits (which balances credit lines)
    return voucher.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  }, [voucher]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto print:block">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm print:hidden" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block animate-in zoom-in-95 duration-150">
        
        {/* Header - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Print {voucher.voucherType === 'BP' ? 'Bank Payment' : 'Bank Receipt'}
            </h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-550 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-slate-900 text-slate-300 print:bg-white print:text-black print:overflow-visible print:p-0 print:static print:w-full print:block">
          
          <div className="flex justify-between items-start border-b border-slate-800 pb-6 print:border-black print:pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 print:text-black" style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", lineHeight: 1.6 }}>کچھی مسلم لوہار واڈہ ویلفیئر جماعت</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold print:text-black">Kutchi Muslim Loharwada Welfare Jamaat</p>
              <p className="text-xs text-slate-400 font-bold mt-1 print:text-black">
                {voucher.voucherType === 'BP' ? 'BANK PAYMENT VOUCHER' : 'BANK RECEIPT VOUCHER'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-550 print:text-black">VOUCHER: <span className="font-bold text-slate-300 print:text-black">{voucher.voucherNo}</span></div>
              <div className="text-xs text-slate-550 print:text-black mt-1">Date: {new Date(voucher.postingDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
              <div className="text-xs text-slate-550 print:text-black mt-1">Ref/Cheque: <span className="font-bold text-slate-350 print:text-black">{voucher.reference}</span></div>
            </div>
          </div>

          {/* Description */}
          {voucher.description && (
            <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-xl print:border-black print:rounded-none print:bg-transparent">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-black">Remarks / Memo</h4>
              <p className="text-xs text-slate-350 print:text-black font-semibold">{voucher.description}</p>
            </div>
          )}

          {/* Double-entry rows */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">Accounting Ledger Lines</h4>
            <div className="rounded-xl border border-slate-850 bg-slate-950/20 overflow-hidden print:border-black print:rounded-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 print:bg-gray-100 print:border-black text-[10px] font-bold uppercase text-slate-500 print:text-black">
                    <th className="px-4 py-2.5">Account Code & Name</th>
                    <th className="px-4 py-2.5 text-right w-28">Debit</th>
                    <th className="px-4 py-2.5 text-right w-28">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 print:divide-black text-xs">
                  {voucher.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-slate-300 print:text-black font-medium">
                        <span className="font-mono text-slate-500 bg-slate-800/25 border border-slate-700/20 px-1 py-0.2 rounded mr-1.5 print:bg-transparent print:border-none print:text-black">{line.accountCode}</span>
                        {line.description || 'Voucher Account Entry'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 print:text-black font-semibold">
                        {line.debit > 0 ? `PKR ${line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 print:text-black font-semibold">
                        {line.credit > 0 ? `PKR ${line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount in words */}
          <div className="bg-slate-950/20 border border-slate-850/60 p-3.5 rounded-xl text-xs print:bg-transparent print:border-black print:rounded-none">
            <span className="font-semibold text-slate-500 print:text-black mr-2 uppercase tracking-wide text-[10px]">Amount in Words:</span>
            <span className="font-bold text-slate-300 print:text-black italic">{numberToWords(amount)}</span>
          </div>

          {/* Signatures */}
          <div className="pt-10 flex justify-between items-end gap-12 print:pt-8">
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">Prepared By</p>
            </div>
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">Verified By</p>
            </div>
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">Authorized Sign</p>
            </div>
          </div>
        </div>

        {/* Footer actions - Hidden when printing */}
        <div className="bg-slate-955/40 border-t border-slate-800 px-6 py-4 flex justify-end gap-3 shrink-0 print:hidden">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export const BankVouchers = () => {
  const navigate = useNavigate();
  const { vouchers, fetchVouchers, updateVoucherStatus, loading } = useBankVoucherStore();
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('BP'); // BP (Payments), BR (Receipts)
  const [printItem, setPrintItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchVouchers(activeTab);
  }, [activeTab, fetchVouchers]);

  const filtered = useMemo(() => {
    return vouchers.filter(v => 
      (v.voucherNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [vouchers, search]);

  const getVoucherTotal = (v) => {
    return v.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  };

  const getOffsetAccount = (v) => {
    // For BP: Offset is the debit account (the expense/asset being paid to)
    // For BR: Offset is the credit account (the revenue/liability received from)
    const targetLine = v.lines.find(line => v.voucherType === 'BP' ? line.debit > 0 : line.credit > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const getBankCode = (v) => {
    // For BP: Credit account is the Bank account
    // For BR: Debit account is the Bank account
    const targetLine = v.lines.find(line => v.voucherType === 'BP' ? line.credit > 0 : line.debit > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const handlePost = async (id) => {
    setStatusLoading(true);
    try {
      await updateVoucherStatus(id, 'Posted', activeTab);
    } catch (err) {
      alert(err.message || "Failed to post voucher");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Are you sure you want to void this voucher and reverse ledger records?")) return;
    setStatusLoading(true);
    try {
      await updateVoucherStatus(id, 'Cancelled', activeTab);
    } catch (err) {
      alert(err.message || "Failed to cancel voucher");
    } finally {
      setStatusLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Draft</span>;
      case 'Posted':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-950/60 text-indigo-400 border-indigo-900/50">Posted</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400 bg-indigo-950/50 border border-indigo-900/60 px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="h-3 w-3" /> Cash & Bank Vouchers
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Bank Vouchers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage bank payout payments and incoming receipt vouchers</p>
        </div>
        <div className={pageActionsClass}>
          {activeTab === 'BR' ? (
            <>
              <Link to="/bank-vouchers/revenue/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> Add Revenue
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                Advanced Receipt
              </Link>
            </>
          ) : (
            <>
              <Link to="/bank-vouchers/expense/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> Add Expense
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                Advanced Payment
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 scrollbar-none overflow-x-auto whitespace-nowrap">
        <button onClick={() => setActiveTab('BP')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BP' ? 'text-indigo-400 border-indigo-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          Bank Payments (BP)
        </button>
        <button onClick={() => setActiveTab('BR')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BR' ? 'text-indigo-400 border-indigo-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          Bank Receipts (BR)
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by voucher #, reference or remarks..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-650 focus:outline-none focus:border-indigo-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading vouchers...</span>
          </div>
        ) : (
          <>
            <DesktopOnly>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase text-slate-500">
                      <th className="px-6 py-3.5 w-10"></th>
                      <th className="px-6 py-3.5">Voucher No</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Bank Account</th>
                      <th className="px-6 py-3.5">Offset Account</th>
                      <th className="px-6 py-3.5">Total Amount</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filtered.map(v => (
                      <optgroup key={v.dbId} label="" className="contents">
                        <tr className="hover:bg-slate-800/10 transition-colors group">
                          <td className="px-6 py-4">
                            <button onClick={() => setExpandedId(expandedId === v.dbId ? null : v.dbId)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-500">
                              {expandedId === v.dbId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-bold text-slate-350 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">{v.voucherNo}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-300">{v.postingDate}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.2 rounded">{getBankCode(v)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/45 border border-slate-700/40 px-2 py-0.2 rounded">{getOffsetAccount(v)}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-200">PKR {getVoucherTotal(v).toLocaleString()}</td>
                          <td className="px-6 py-4">{getStatusBadge(v.status)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setPrintItem(v)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer" title="Print physical voucher"><Printer className="h-3.5 w-3.5" /></button>
                              {v.status === 'Draft' && (
                                <button onClick={() => handlePost(v.dbId)} disabled={statusLoading}
                                  className="px-2 py-1 rounded bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-900/50 text-[10px] font-bold">
                                  Post
                                </button>
                              )}
                              {v.status === 'Posted' && (
                                <button onClick={() => handleCancel(v.dbId)} disabled={statusLoading}
                                  className="px-2 py-1 rounded bg-red-950/20 text-red-400 hover:bg-red-950/40 border border-red-900/30 text-[10px] font-bold">
                                  Void
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expanded details container */}
                        {expandedId === v.dbId && (
                          <tr className="bg-slate-950/30 border-y border-slate-850">
                            <td colSpan="8" className="px-8 py-4 space-y-3">
                              <div className="grid grid-cols-2 gap-4 text-xs text-slate-450 mb-2">
                                <div><span className="font-bold text-slate-500">Reference/Cheque:</span> {v.reference}</div>
                                <div><span className="font-bold text-slate-500">Posted By:</span> {v.postedBy}</div>
                                {v.description && <div className="col-span-2"><span className="font-bold text-slate-500">Memo:</span> {v.description}</div>}
                              </div>
                              <div className="rounded-lg border border-slate-850 bg-slate-900/40 overflow-hidden max-w-2xl">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-850 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase">
                                      <th className="px-4 py-1.5">Account Code</th>
                                      <th className="px-4 py-1.5 text-right w-24">Debit</th>
                                      <th className="px-4 py-1.5 text-right w-24">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850/60">
                                    {v.lines.map(line => (
                                      <tr key={line.id}>
                                        <td className="px-4 py-2 font-medium text-slate-350">{line.accountCode} - {line.description || 'Entry'}</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-200">{line.debit > 0 ? line.debit.toLocaleString() : '—'}</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-200">{line.credit > 0 ? line.credit.toLocaleString() : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </optgroup>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-slate-500 text-sm">No vouchers recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DesktopOnly>
            <MobileOnly className="p-3 space-y-3">
              {filtered.map(v => (
                <div key={v.dbId} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-350">{v.voucherNo}</span>
                      <p className="text-xs text-slate-400 mt-1">Date: {v.postingDate} | Ref: {v.reference}</p>
                    </div>
                    {getStatusBadge(v.status)}
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/50">
                    <span className="font-bold text-slate-250">PKR {getVoucherTotal(v).toLocaleString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPrintItem(v)} className="text-xs text-indigo-400 flex items-center gap-1 cursor-pointer"><Printer className="h-3.5 w-3.5" /> Print</button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">No vouchers recorded.</div>
              )}
            </MobileOnly>
          </>
        )}
      </div>

      {printItem && (
        <BankVoucherPrintModal
          voucher={printItem}
          onClose={() => setPrintItem(null)}
        />
      )}
    </div>
  );
};

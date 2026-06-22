import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInvoiceStore } from '../store/invoiceStore';
import { useCoaStore } from '../store/coaStore';
import { FileSpreadsheet, ChevronLeft, Calendar, FileText, CheckCircle, CreditCard, DollarSign, XCircle, Printer, Book } from 'lucide-react';

export const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentInvoice, fetchInvoiceById, postInvoice, payInvoice, cancelInvoice, loading: invLoading } = useInvoiceStore();
  const { flatAccounts, fetchAccountsList, loading: coaLoading } = useCoaStore();

  const [showPostModal, setShowPostModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Post State
  const [revenueAccountId, setRevenueAccountId] = useState('');

  // Pay State
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [bankAccountId, setBankAccountId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');

  // Cancel State
  const [cancelRevenueAccountId, setCancelRevenueAccountId] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchInvoiceById(id).catch(err => {
      console.error(err);
      alert("Invoice not found");
      navigate('/invoices');
    });
    fetchAccountsList();
  }, [id, fetchInvoiceById, fetchAccountsList, navigate]);

  // Filters for dropdown selectors
  const revenueAccounts = flatAccounts.filter(acc => acc.type === 'Revenue' && acc.level === 'SUBSIDIARY');
  const assetAccounts = flatAccounts.filter(acc => 
    acc.type === 'Asset' && 
    acc.level === 'SUBSIDIARY' && 
    (acc.detailType === 'Cash' || (acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('cash'))
  );

  // Pre-fill selectors
  useEffect(() => {
    if (revenueAccounts.length > 0) {
      setRevenueAccountId(revenueAccounts[0].id);
      setCancelRevenueAccountId(revenueAccounts[0].id);
    }
    if (assetAccounts.length > 0) {
      setBankAccountId(assetAccounts[0].id);
    }
  }, [flatAccounts]);

  const handlePost = async () => {
    if (!revenueAccountId) {
      alert("Please select a Revenue account");
      return;
    }
    setActionLoading(true);
    try {
      await postInvoice(id, revenueAccountId);
      setShowPostModal(false);
    } catch (err) {
      alert(err.message || "Failed to post invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePay = async () => {
    if (!bankAccountId) {
      alert("Please select a Cash/Bank account");
      return;
    }
    setActionLoading(true);
    try {
      await payInvoice(id, { paymentMethod, bankAccountId, chequeNumber });
      setShowPayModal(false);
    } catch (err) {
      alert(err.message || "Failed to record payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if ((currentInvoice.status === 'POSTED' || currentInvoice.status === 'PAID') && !cancelRevenueAccountId) {
      alert("Please select the original Revenue account to reverse ledger entries");
      return;
    }
    setActionLoading(true);
    try {
      await cancelInvoice(id, cancelRevenueAccountId);
      setShowCancelModal(false);
    } catch (err) {
      alert(err.message || "Failed to cancel invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (invLoading || !currentInvoice) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getStatusBanner = (status) => {
    switch (status) {
      case 'DRAFT':
        return (
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Draft Invoice</p>
                <p className="text-[11px] text-slate-500">This invoice has not been posted to the general ledger yet. Edit is allowed.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelModal(true)} className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold">Cancel</button>
              <button onClick={() => setShowPostModal(true)} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow shadow-indigo-900/40">Post Invoice</button>
            </div>
          </div>
        );
      case 'POSTED':
        return (
          <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/50 text-indigo-300">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-950 border border-indigo-900 flex items-center justify-center text-indigo-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Posted & Outstanding</p>
                <p className="text-[11px] text-indigo-400/70">A/R ledger records created. Waiting for client payment.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelModal(true)} className="px-3 py-1.5 rounded border border-indigo-900/40 hover:bg-red-950/20 text-red-400 text-xs font-semibold">Cancel & Reverse</button>
              <button onClick={() => setShowPayModal(true)} className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow shadow-emerald-900/40">Record Payment</button>
            </div>
          </div>
        );
      case 'PAID':
        return (
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 text-emerald-300">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-950 border border-emerald-900 flex items-center justify-center text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Settled / Paid</p>
                <p className="text-[11px] text-emerald-400/70">Payment received to cash/bank accounts. Invoice fully closed.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCancelModal(true)} className="px-3 py-1.5 rounded border border-emerald-900/40 hover:bg-red-950/20 text-red-400 text-xs font-semibold">Cancel & Reverse</button>
            </div>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-red-300">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-950 border border-red-900 flex items-center justify-center text-red-400">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Cancelled & Reversed</p>
                <p className="text-[11px] text-red-400/70">This invoice has been voided. Any double-entry postings are completely reversed.</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-0">
      {/* Back button & Action list */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Invoice Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">Audit transaction logs and print physical copy</p>
          </div>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-200 text-xs font-bold transition-all shadow-md cursor-pointer">
          <Printer className="h-4 w-4" /> Print Invoice
        </button>
      </div>

      {/* Action panel banner */}
      <div className="print:hidden">
        {getStatusBanner(currentInvoice.status)}
      </div>

      {/* Invoice Sheet */}
      <div className="rounded-2xl border border-slate-850 bg-slate-900/35 p-8 max-w-4xl mx-auto space-y-8 print:border-none print:bg-white print:text-black print:p-0 print:m-0">
        
        {/* Invoice Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-indigo-400 print:text-black">KMLWJ</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider print:text-slate-700">Accounting ERP Terminal</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-200 print:text-black">INVOICE</h2>
            <span className="text-xs font-mono font-bold text-slate-450 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/40 print:bg-transparent print:border-none print:text-black print:px-0">
              #{currentInvoice.invoiceNo}
            </span>
          </div>
        </div>

        {/* Client details & meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-y border-slate-800/80 py-6 print:border-slate-300">
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 print:text-slate-650">Billed To</h4>
            <p className="text-sm font-bold text-slate-200 print:text-black">{currentInvoice.customer?.name}</p>
            {currentInvoice.customer?.company && (
              <p className="text-xs text-slate-450 mt-0.5 print:text-slate-700">{currentInvoice.customer.company}</p>
            )}
            {currentInvoice.customer?.email && (
              <p className="text-xs text-slate-500 mt-1 print:text-slate-700">{currentInvoice.customer.email}</p>
            )}
            {currentInvoice.customer?.phone && (
              <p className="text-xs text-slate-500 print:text-slate-700">{currentInvoice.customer.phone}</p>
            )}
            {currentInvoice.customer?.address && (
              <p className="text-xs text-slate-500 mt-2 max-w-64 print:text-slate-700">{currentInvoice.customer.address}</p>
            )}
          </div>
          <div className="sm:text-right space-y-3">
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-slate-650">Dates</h4>
              <p className="text-xs text-slate-350 print:text-black">Issued: {new Date(currentInvoice.issueDate).toLocaleDateString()}</p>
              <p className="text-xs text-slate-350 print:text-black">Due: {new Date(currentInvoice.dueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-slate-650">Status</h4>
              <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${currentInvoice.status === 'PAID' ? 'bg-emerald-950/40 text-emerald-450 border-emerald-900/30' : currentInvoice.status === 'POSTED' ? 'bg-indigo-950/40 text-indigo-450 border-indigo-900/30' : currentInvoice.status === 'CANCELLED' ? 'bg-red-950/40 text-red-450 border-red-900/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {currentInvoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase text-slate-500 print:border-slate-300">
                <th className="py-2.5">Description</th>
                <th className="py-2.5 text-right w-16">Qty</th>
                <th className="py-2.5 text-right w-28">Unit Price</th>
                <th className="py-2.5 text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 print:divide-slate-200">
              {currentInvoice.items.map((item, index) => (
                <tr key={item.id} className="text-sm">
                  <td className="py-4 font-semibold text-slate-300 print:text-black">{item.description}</td>
                  <td className="py-4 text-right text-slate-400 print:text-black">{item.quantity}</td>
                  <td className="py-4 text-right text-slate-400 print:text-black">PKR {item.unitPrice.toLocaleString()}</td>
                  <td className="py-4 text-right font-bold text-slate-250 print:text-black">PKR {item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total details */}
        <div className="flex justify-end pt-6 border-t border-slate-800/80 print:border-slate-300">
          <div className="w-64 space-y-3 text-sm text-slate-400 print:text-black">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-250 print:text-black">PKR {currentInvoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {currentInvoice.tax > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-semibold text-slate-250 print:text-black">PKR {currentInvoice.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {currentInvoice.discount > 0 && (
              <div className="flex justify-between text-red-400 print:text-red-700">
                <span>Discount</span>
                <span className="font-semibold">- PKR {currentInvoice.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-800/80 pt-3 text-slate-200 font-extrabold print:border-slate-300 print:text-black">
              <span>Grand Total</span>
              <span className="text-indigo-400 print:text-black">PKR {currentInvoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Remarks / payment instructions */}
        {currentInvoice.remarks && (
          <div className="border-t border-slate-800/60 pt-6 print:border-slate-300">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 print:text-slate-650">Notes / Remarks</h4>
            <p className="text-xs text-slate-450 leading-relaxed print:text-slate-700">{currentInvoice.remarks}</p>
          </div>
        )}
      </div>

      {/* Modals for actions */}
      
      {/* 1. Post/Approve Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPostModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Post Invoice to Ledger</h4>
              <p className="text-xs text-slate-500 mt-1">This will lock the invoice, debit Accounts Receivable, and credit a Revenue account.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Credit Revenue Account</label>
              <select value={revenueAccountId} onChange={e => setRevenueAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50">
                {revenueAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
                {revenueAccounts.length === 0 && (
                  <option value="">-- No Subsidiary Revenue Accounts --</option>
                )}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPostModal(false)} disabled={actionLoading} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold">Cancel</button>
              <button onClick={handlePost} disabled={actionLoading || !revenueAccountId} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/30">
                {actionLoading ? 'Posting...' : 'Post Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPayModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Record Payment</h4>
              <p className="text-xs text-slate-500 mt-1">Record receiving total billing amount to Cash or Bank accounts.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50">
                <option value="BANK">Bank Account / Transfer</option>
                <option value="CASH">Cash Drawer</option>
                <option value="CHEQUE">Cheque / Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Debit Cash/Bank Account</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50">
                {assetAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
                {assetAccounts.length === 0 && (
                  <option value="">-- No Subsidiary Cash/Bank Accounts --</option>
                )}
              </select>
            </div>

            {paymentMethod === 'CHEQUE' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cheque Reference Number</label>
                <input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="e.g. CHQ-92841"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 placeholder-slate-600" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPayModal(false)} disabled={actionLoading} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold">Cancel</button>
              <button onClick={handlePay} disabled={actionLoading || !bankAccountId} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md">
                {actionLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cancel / Reversal Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Cancel & Void Invoice</h4>
              <p className="text-xs text-slate-500 mt-1">This will change the status to CANCELLED. If already posted or paid, it generates a reversing double-entry ledger record to balance books.</p>
            </div>

            {(currentInvoice.status === 'POSTED' || currentInvoice.status === 'PAID') && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Original Revenue Account</label>
                <select value={cancelRevenueAccountId} onChange={e => setCancelRevenueAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50">
                  {revenueAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCancelModal(false)} disabled={actionLoading} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold">Cancel</button>
              <button onClick={handleCancel} disabled={actionLoading} className="flex-1 px-4 py-2 rounded-lg bg-red-650 hover:bg-red-600 text-white text-xs font-bold shadow-md">
                {actionLoading ? 'Voiding...' : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

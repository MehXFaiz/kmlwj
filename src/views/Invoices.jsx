<<<<<<< HEAD
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Plus, Search, Edit2, Trash2, X, CheckCircle2, Ban,
  ChevronDown, AlertTriangle, Printer, Download, Eye, Calendar,
  User, Building2, CreditCard, Hash, DollarSign, Filter,
} from 'lucide-react';
import { useInvoiceStore } from '../store/invoiceStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
};

const invoiceNumber = () =>
  `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

const TYPES = ['MEMBER', 'VENDOR'];
const STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID'];
const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'];

const STATUS_CONFIG = {
  DRAFT:   { label: 'Draft',   color: 'bg-slate-700/60 text-slate-300  border-slate-600/40' },
  ISSUED:  { label: 'Issued',  color: 'bg-blue-950/60  text-blue-300   border-blue-800/40'  },
  PAID:    { label: 'Paid',    color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-950/60   text-red-300    border-red-800/40'   },
  VOID:    { label: 'Void',    color: 'bg-slate-900/60  text-slate-500  border-slate-700/40' },
};

const TYPE_CONFIG = {
  MEMBER: { label: 'Member Invoice',   icon: User,      color: 'text-indigo-400', bg: 'bg-indigo-950/60 border-indigo-800/40' },
  VENDOR: { label: 'Vendor Invoice',   icon: Building2, color: 'text-amber-400',  bg: 'bg-amber-950/60  border-amber-800/40'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Empty line item ──────────────────────────────────────────────────────────
const emptyLine = () => ({ description: '', qty: 1, unitPrice: '', total: 0 });

function LineItems({ lines, onChange }) {
  const updateLine = (idx, field, val) => {
    const updated = lines.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, [field]: val };
      if (field === 'qty' || field === 'unitPrice') {
        next.total = (parseFloat(next.qty) || 0) * (parseFloat(next.unitPrice) || 0);
      }
      return next;
    });
    onChange(updated);
  };

  const addLine = () => onChange([...lines, emptyLine()]);
  const removeLine = (idx) => onChange(lines.filter((_, i) => i !== idx));

  const grandTotal = lines.reduce((s, l) => s + (l.total || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Line Items *</label>
        <button type="button" onClick={addLine}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
          <Plus className="h-3 w-3" /> Add Line
        </button>
      </div>

      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60">
            <tr>
              <th className="text-left px-3 py-2 text-slate-400 font-semibold">Description</th>
              <th className="text-right px-3 py-2 text-slate-400 font-semibold w-16">Qty</th>
              <th className="text-right px-3 py-2 text-slate-400 font-semibold w-28">Unit Price</th>
              <th className="text-right px-3 py-2 text-slate-400 font-semibold w-28">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {lines.map((line, idx) => (
              <tr key={idx} className="bg-slate-900/40">
                <td className="px-2 py-1.5">
                  <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                    placeholder="Item / service description"
                    className="w-full bg-transparent border-b border-slate-700/50 focus:border-indigo-500 text-slate-200 text-xs py-0.5 outline-none transition-colors placeholder-slate-600" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="1" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)}
                    className="w-full text-right bg-transparent border-b border-slate-700/50 focus:border-indigo-500 text-slate-200 text-xs py-0.5 outline-none transition-colors" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', e.target.value)}
                    placeholder="0"
                    className="w-full text-right bg-transparent border-b border-slate-700/50 focus:border-indigo-500 text-slate-200 text-xs py-0.5 outline-none transition-colors" />
                </td>
                <td className="px-3 py-1.5 text-right text-slate-300 font-semibold">
                  {fmt(line.total)}
                </td>
                <td className="px-1 py-1.5">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)}
                      className="p-0.5 text-slate-600 hover:text-red-400 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800/80 border-t border-slate-700/60">
              <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Grand Total</td>
              <td className="px-3 py-2 text-right text-sm font-black text-emerald-400">{fmt(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ isOpen, onClose, onSave, initial, beneficiaries }) {
  const blankForm = {
    invoiceNo: invoiceNumber(),
    type: 'MEMBER',
    partyId: '',
    partyName: '',
    partyEmail: '',
    partyPhone: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentMethod: 'BANK_TRANSFER',
    status: 'DRAFT',
    notes: '',
    lines: [emptyLine()],
  };

  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setForm({
          ...blankForm,
          ...initial,
          lines: initial.lines?.length ? initial.lines : [emptyLine()],
          issueDate: initial.issueDate ? initial.issueDate.slice(0, 10) : blankForm.issueDate,
          dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : '',
        });
      } else {
        setForm({ ...blankForm, invoiceNo: invoiceNumber() });
      }
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const total = form.lines.reduce((s, l) => s + (l.total || 0), 0);

  const handleSave = async () => {
    if (!form.partyName || !total) return;
    setSaving(true);
    try {
      await onSave({ ...form, amount: total });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const setF = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const TI = TYPE_CONFIG[form.type]?.icon || User;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[95dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-950/70 border border-indigo-800/40 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                {initial ? 'Edit Invoice' : 'New Invoice'}
              </h3>
              <p className="text-[11px] text-slate-500">{form.invoiceNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Invoice Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Invoice Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <button key={t} type="button" onClick={() => setF('type', t)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all
                      ${form.type === t
                        ? `${cfg.bg} ${cfg.color} shadow-inner`
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                      }`}>
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Party Details */}
          <div className="rounded-xl border border-slate-700/50 p-4 space-y-3 bg-slate-800/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {form.type === 'MEMBER' ? 'Member Details' : 'Vendor Details'}
            </p>
            {form.type === 'MEMBER' ? (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Member</label>
                <select value={form.partyId}
                  onChange={e => {
                    const b = beneficiaries.find(x => x.id === e.target.value);
                    setForm(f => ({ ...f, partyId: e.target.value, partyName: b?.name || '', partyPhone: b?.phone || '', partyEmail: b?.email || '' }));
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all">
                  <option value="">— Select member / beneficiary —</option>
                  {beneficiaries.map(b => (
                    <option key={b.id} value={b.id}>{b.name}{b.cnic ? ` (${b.cnic})` : ''}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {form.type === 'MEMBER' ? 'Member Name' : 'Vendor Name'} *
                </label>
                <input value={form.partyName} onChange={e => setF('partyName', e.target.value)}
                  placeholder={form.type === 'MEMBER' ? 'Full member name' : 'Vendor / supplier name'}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone</label>
                <input value={form.partyPhone} onChange={e => setF('partyPhone', e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
              <input type="email" value={form.partyEmail} onChange={e => setF('partyEmail', e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all" />
            </div>
          </div>

          {/* Dates + Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Issue Date *</label>
              <input type="date" value={form.issueDate} onChange={e => setF('issueDate', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setF('dueDate', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => setF('paymentMethod', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Status (edit only) */}
          {initial && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setF('status', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Line Items */}
          <LineItems lines={form.lines} onChange={(lines) => setForm(f => ({ ...f, lines }))} />

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notes / Remarks</label>
            <textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)}
              placeholder="Additional terms, instructions, or remarks..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-indigo-500/60 outline-none transition-all resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0 bg-slate-950/30">
          <div className="text-sm">
            <span className="text-slate-500">Total: </span>
            <span className="font-black text-emerald-400 text-base">{fmt(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.partyName || !total}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              {saving && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {initial ? 'Save Changes' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteModal({ invoice, onConfirm, onCancel }) {
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-950/60 border border-red-800/40 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-slate-200 mb-1">Delete Invoice</h3>
        <p className="text-sm text-slate-400 mb-6">
          Delete <span className="font-bold text-slate-300">{invoice.invoiceNo}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-all">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Print Invoice Modal ─────────────────────────────────────────────────────
function PrintInvoiceModal({ invoice, onClose }) {
  const printRef = useRef(null);

  if (!invoice) return null;

  const total = invoice.lines?.reduce((s, l) => s + (l.total || 0), 0) || invoice.amount || 0;
  const typeCfg = TYPE_CONFIG[invoice.type] || TYPE_CONFIG.MEMBER;
  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = '__inv_print_style';
    style.innerHTML = `
      @media print {
        body > *:not(#__inv_print_root) { display: none !important; }
        #__inv_print_root { display: block !important; position: fixed; inset: 0; z-index: 99999; background: white; }
        #__inv_print_root .no-print { display: none !important; }
        @page { margin: 12mm 14mm; size: A4; }
      }
    `;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = '__inv_print_root';
    root.style.display = 'none';
    root.innerHTML = printRef.current.innerHTML;
    document.body.appendChild(root);
    window.print();
    setTimeout(() => {
      document.head.removeChild(style);
      document.body.removeChild(root);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl flex flex-col max-h-[95dvh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-sky-950/70 border border-sky-800/40 flex items-center justify-center">
              <Printer className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Print Invoice</h3>
              <p className="text-[11px] text-slate-500">{invoice.invoiceNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-all shadow-lg shadow-sky-900/30">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Print preview */}
        <div className="overflow-y-auto flex-1 p-4">
          <div
            ref={printRef}
            className="bg-white text-gray-900 rounded-xl shadow-inner p-8 font-sans text-sm"
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", minHeight: '29.7cm' }}
          >
            {/* Letterhead */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-indigo-600">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                    <span className="text-white font-black text-xs tracking-wider">KW</span>
                  </div>
                  <div>
                    <h1 className="text-base font-black text-gray-900 tracking-tight">KMLWJ</h1>
                    <p
                      className="text-xs text-indigo-600 font-semibold"
                      style={{ fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif", lineHeight: 2 }}
                    >
                      کچھی مسلم لوہار واڈہ ویلفیئر جماعت
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Enterprise Financial Suite</p>
              </div>
              <div className="text-right">
                <div
                  className="inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider mb-2"
                  style={{
                    background: invoice.status === 'PAID' ? '#dcfce7' : invoice.status === 'OVERDUE' ? '#fee2e2' : invoice.status === 'VOID' ? '#f1f5f9' : '#eff6ff',
                    color: invoice.status === 'PAID' ? '#166534' : invoice.status === 'OVERDUE' ? '#991b1b' : invoice.status === 'VOID' ? '#94a3b8' : '#1d4ed8',
                  }}
                >
                  {statusCfg.label}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p><span className="font-semibold text-gray-700">Invoice No:</span> {invoice.invoiceNo}</p>
                  <p><span className="font-semibold text-gray-700">Issued:</span> {fmtDate(invoice.issueDate)}</p>
                  {invoice.dueDate && <p><span className="font-semibold text-gray-700">Due:</span> {fmtDate(invoice.dueDate)}</p>}
                  <p><span className="font-semibold text-gray-700">Type:</span> {typeCfg.label}</p>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">
                {invoice.type === 'VENDOR' ? 'Vendor / Supplier' : 'Bill To'}
              </p>
              <p className="font-bold text-gray-900 text-base">{invoice.partyName || '—'}</p>
              {invoice.partyEmail && <p className="text-xs text-gray-500 mt-0.5">{invoice.partyEmail}</p>}
              {invoice.partyPhone && <p className="text-xs text-gray-500">{invoice.partyPhone}</p>}
            </div>

            {/* Line Items */}
            <table className="w-full mb-6 border-collapse">
              <thead>
                <tr style={{ background: '#312e81' }}>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white rounded-tl-lg">#</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white">Description</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white">Qty</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white">Unit Price</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white rounded-tr-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lines?.length ? invoice.lines : [{ description: invoice.notes || 'Service / Contribution', qty: 1, unitPrice: total, total }]).map((line, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-800 font-medium">{line.description || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right">{line.qty || 1}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 text-right">{fmt(line.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-gray-900 text-right">{fmt(line.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #312e81' }}>
                  <td colSpan={3} />
                  <td className="px-3 py-3 text-xs font-black uppercase tracking-wider text-gray-600 text-right">Grand Total</td>
                  <td className="px-3 py-3 text-base font-black text-indigo-700 text-right">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Payment + Notes */}
            <div className="grid grid-cols-2 gap-6 mt-2">
              <div>
                {invoice.paymentMethod && (
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Payment Method</p>
                    <p className="text-sm font-semibold text-gray-800">{invoice.paymentMethod.replace('_', ' ')}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Notes</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{invoice.notes}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="inline-block border-t-2 border-gray-300 pt-2 mt-8 min-w-[140px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Authorised Signature</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-4 border-t border-gray-200 text-center">
              <p className="text-[10px] text-gray-400">Generated by KMLWJ Enterprise Financial Suite · {new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onEdit, onDelete, onMarkPaid, onVoid, onPrint }) {
  const TypeIcon = TYPE_CONFIG[inv.type]?.icon || User;
  const typeCfg = TYPE_CONFIG[inv.type] || TYPE_CONFIG.MEMBER;
  const canMarkPaid = ['ISSUED', 'OVERDUE'].includes(inv.status);
  const canVoid = ['DRAFT', 'ISSUED'].includes(inv.status);
  const canEdit = ['DRAFT'].includes(inv.status);
  const canDelete = ['DRAFT', 'VOID'].includes(inv.status);

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-lg border flex items-center justify-center ${typeCfg.bg}`}>
            <TypeIcon className={`h-3.5 w-3.5 ${typeCfg.color}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">{inv.invoiceNo}</p>
            <p className="text-[10px] text-slate-500">{typeCfg.label}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-300">{inv.partyName || '—'}</p>
        {inv.partyEmail && <p className="text-[10px] text-slate-500">{inv.partyEmail}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(inv.issueDate)}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(inv.dueDate)}</td>
      <td className="px-4 py-3">
        <span className="text-sm font-black text-slate-200">{fmt(inv.amount)}</span>
      </td>
      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Print — always available */}
          <button onClick={() => onPrint(inv)} title="Print Invoice"
            className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-950/40 hover:text-sky-300 transition-all">
            <Printer className="h-3.5 w-3.5" />
          </button>
          {canMarkPaid && (
            <button onClick={() => onMarkPaid(inv.id)} title="Mark as Paid"
              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-950/40 hover:text-emerald-400 transition-all">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(inv)} title="Edit"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canVoid && (
            <button onClick={() => onVoid(inv.id)} title="Void Invoice"
              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-950/40 hover:text-amber-400 transition-all">
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(inv)} title="Delete"
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-950/40 hover:text-red-400 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function Invoices() {
  const { invoices, loading, error, fetchInvoices, addInvoice, updateInvoice, deleteInvoice, markPaid, voidInvoice } = useInvoiceStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchBeneficiaries?.();
  }, []);

  // ── Local demo state (fallback when API not ready) ────────────────────────
  const [localInvoices, setLocalInvoices] = useState([
    {
      id: 'demo-1', invoiceNo: 'INV-2026-10021', type: 'MEMBER', partyName: 'Ahmed Ali',
      partyEmail: 'ahmed@example.com', partyPhone: '0300-1234567', issueDate: '2026-06-01',
      dueDate: '2026-06-15', amount: 5000, paymentMethod: 'BANK_TRANSFER', status: 'ISSUED',
      notes: 'Monthly membership contribution', lines: [{ description: 'Monthly Membership Fee', qty: 1, unitPrice: 5000, total: 5000 }],
    },
    {
      id: 'demo-2', invoiceNo: 'INV-2026-10022', type: 'VENDOR', partyName: 'Al-Noor Printers',
      partyEmail: 'info@alnoor.pk', partyPhone: '042-3456789', issueDate: '2026-06-05',
      dueDate: '2026-06-20', amount: 18500, paymentMethod: 'CHEQUE', status: 'PAID',
      notes: 'Printing services for Eid newsletter', lines: [
        { description: 'Newsletter Printing (500 copies)', qty: 500, unitPrice: 35, total: 17500 },
        { description: 'Design Fee', qty: 1, unitPrice: 1000, total: 1000 },
      ],
    },
    {
      id: 'demo-3', invoiceNo: 'INV-2026-10023', type: 'MEMBER', partyName: 'Fatima Bibi',
      partyEmail: '', partyPhone: '0321-9876543', issueDate: '2026-05-01',
      dueDate: '2026-05-15', amount: 3000, paymentMethod: 'CASH', status: 'OVERDUE',
      notes: '', lines: [{ description: 'Medical Aid Contribution', qty: 1, unitPrice: 3000, total: 3000 }],
    },
    {
      id: 'demo-4', invoiceNo: 'INV-2026-10024', type: 'VENDOR', partyName: 'City Electricals',
      partyEmail: 'info@cityelectrical.pk', partyPhone: '', issueDate: '2026-06-10',
      dueDate: '2026-06-25', amount: 45000, paymentMethod: 'BANK_TRANSFER', status: 'DRAFT',
      notes: 'Hall rewiring project', lines: [
        { description: 'Wiring Material', qty: 1, unitPrice: 32000, total: 32000 },
        { description: 'Labour', qty: 4, unitPrice: 3250, total: 13000 },
      ],
    },
  ]);

  // Use local demo data if API returns nothing
  const allInvoices = (invoices?.length ? invoices : localInvoices);

  const filtered = useMemo(() => {
    return allInvoices.filter(inv => {
      if (filterType !== 'ALL' && inv.type !== filterType) return false;
      if (filterStatus !== 'ALL' && inv.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.partyName?.toLowerCase().includes(q) ||
          inv.partyEmail?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allInvoices, filterType, filterStatus, search]);

  // Stats
  const stats = useMemo(() => ({
    total: allInvoices.length,
    totalAmount: allInvoices.reduce((s, i) => s + (i.amount || 0), 0),
    paid: allInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.amount || 0), 0),
    outstanding: allInvoices.filter(i => ['ISSUED', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0),
    overdue: allInvoices.filter(i => i.status === 'OVERDUE').length,
  }), [allInvoices]);

  const handleSave = async (data) => {
    try {
      if (editTarget) {
        await updateInvoice(editTarget.id, data);
      } else {
        await addInvoice(data);
      }
    } catch {
      // Fallback to local state
      if (editTarget) {
        setLocalInvoices(ls => ls.map(i => i.id === editTarget.id ? { ...i, ...data } : i));
      } else {
        setLocalInvoices(ls => [...ls, { ...data, id: `local-${Date.now()}` }]);
      }
    }
    setEditTarget(null);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(deleteTarget.id);
    } catch {
      setLocalInvoices(ls => ls.filter(i => i.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleMarkPaid = async (id) => {
    try {
      await markPaid(id);
    } catch {
      setLocalInvoices(ls => ls.map(i => i.id === id ? { ...i, status: 'PAID' } : i));
    }
  };

  const handleVoid = async (id) => {
    try {
      await voidInvoice(id);
    } catch {
      setLocalInvoices(ls => ls.map(i => i.id === id ? { ...i, status: 'VOID' } : i));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-indigo-950/70 border border-indigo-800/40 flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo-400" />
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">Invoice System</h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">Manage member &amp; vendor invoices, track payments</p>
        </div>
        <button
          id="new-invoice-btn"
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-900/30 hover:shadow-indigo-900/50">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoices', value: stats.total, icon: Hash, color: 'text-slate-300', bg: 'bg-slate-800/60 border-slate-700/50' },
          { label: 'Total Invoiced', value: fmt(stats.totalAmount), icon: DollarSign, color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/30' },
          { label: 'Paid Amount', value: fmt(stats.paid), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/30' },
          { label: 'Outstanding', value: fmt(stats.outstanding), icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <p className={`text-lg font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Overdue Warning */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><span className="font-bold">{stats.overdue}</span> invoice{stats.overdue > 1 ? 's are' : ' is'} overdue. Follow up required.</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            id="invoice-search"
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice no., party name or email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:border-indigo-500/60 outline-none transition-all"
          />
        </div>
        <select id="filter-type" value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-sm focus:border-indigo-500/60 outline-none transition-all">
          <option value="ALL">All Types</option>
          <option value="MEMBER">Member</option>
          <option value="VENDOR">Vendor</option>
        </select>
        <select id="filter-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-sm focus:border-indigo-500/60 outline-none transition-all">
          <option value="ALL">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-slate-600" />
            </div>
            <p className="text-sm font-bold text-slate-400">No invoices found</p>
            <p className="text-xs text-slate-600 mt-1">Create your first invoice to get started</p>
            <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all">
              New Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-800/60 border-b border-slate-700/50">
                <tr>
                  {['Invoice', 'Party', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    onEdit={(inv) => { setEditTarget(inv); setModalOpen(true); }}
                    onDelete={setDeleteTarget}
                    onMarkPaid={handleMarkPaid}
                    onVoid={handleVoid}
                    onPrint={setPrintTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Result count */}
      {filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-right">
          Showing {filtered.length} of {allInvoices.length} invoice{allInvoices.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modals */}
      <InvoiceModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        beneficiaries={beneficiaries || []}
      />
      <DeleteModal
        invoice={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <PrintInvoiceModal
        invoice={printTarget}
        onClose={() => setPrintTarget(null)}
      />
    </div>
  );
}
=======
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useInvoiceStore } from '../store/invoiceStore';
import { useAuthStore } from '../store/authStore';
import { FileSpreadsheet, Search, Plus, Edit2, Trash2, ChevronRight, Eye, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';

export const Invoices = () => {
  const navigate = useNavigate();
  const { invoices, fetchInvoices, deleteInvoice, bulkDeleteInvoices } = useInvoiceStore();
  const { canEditOrDelete } = useAuthStore();
  
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, DRAFT, POSTED, PAID, CANCELLED
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = 
        (inv.invoiceNo || '').toLowerCase().includes(search.toLowerCase()) || 
        (inv.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.remarks || '').toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await deleteInvoice(id);
      setDeleteId(null);
    } catch (err) {
      alert(err.message || "Failed to delete invoice");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(inv => inv.id));
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
      await bulkDeleteInvoices(selectedIds);
      showToast(`${selectedIds.length} invoice(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete invoices', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Draft</span>;
      case 'POSTED':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-950/60 text-indigo-400 border-indigo-900/50">Posted</span>;
      case 'PAID':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Paid</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">Cancelled</span>;
      default:
        return null;
    }
  };

  const tabs = [
    { label: 'All Bills', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Posted', value: 'POSTED' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Cancelled', value: 'CANCELLED' }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400 bg-indigo-950/50 border border-indigo-900/60 px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="h-3 w-3" /> Sales Invoices
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Invoices</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer billing documentation and general ledger postings</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-lg active:scale-95 flex-1 sm:flex-none cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          <Link to="/invoices/new"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 scrollbar-none overflow-x-auto whitespace-nowrap">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-3 text-xs font-bold transition-all relative cursor-pointer border-b-2 -mb-[2px] ${statusFilter === tab.value ? 'text-indigo-400 border-indigo-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice #, customer name, memo..."
            name="invoice-search" autoComplete="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-650 focus:outline-none focus:border-indigo-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Invoice No</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Customer</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Dates</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Total Amount</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(inv.id)}
                        onChange={(e) => handleSelectOne(inv.id, e)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-slate-350 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">
                        {inv.invoiceNo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-200">{inv.customer?.name || 'Unknown'}</p>
                      {inv.remarks && <p className="text-[11px] text-slate-500 truncate max-w-44 mt-0.5">{inv.remarks}</p>}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <p className="text-xs text-slate-300">Issued: {new Date(inv.issueDate).toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-500">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-250">
                        PKR {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/invoices/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-250" title="View details"><Eye className="h-3.5 w-3.5" /></button>
                        {(inv.status === 'DRAFT' || canEditOrDelete) && (
                          <>
                            <button onClick={() => navigate(`/invoices/edit/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-250" title="Edit invoice"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleteId(inv.id)} className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400" title="Delete invoice"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500 text-sm">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(inv => (
              <div key={inv.id} className="rounded-lg border bg-slate-950/40 p-3 transition-colors border-slate-800/60" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-350">{inv.invoiceNo}</span>
                    <h4 className="text-sm font-bold text-slate-200 mt-1">{inv.customer?.name}</h4>
                  </div>
                  {getStatusBadge(inv.status)}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                  <div className="text-[11px] text-slate-500">
                    Total: <span className="text-xs font-bold text-slate-300">PKR {inv.total.toLocaleString()}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-550" />
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                No invoices found.
              </div>
            )}
        </MobileOnly>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Confirm Delete</h4>
            <p className="text-xs text-slate-500 mb-4">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected invoice(s)? Any associated ledger entries will be removed/reversed. This action cannot be undone.
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
                    Delete {selectedIds.length} Invoice(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
>>>>>>> ba24d0d986ab9a65b77d214e666d9da4e92f8a83

import { useState, useEffect, useMemo } from 'react';
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

// ─── Invoice Row ──────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onEdit, onDelete, onMarkPaid, onVoid }) {
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
    </div>
  );
}

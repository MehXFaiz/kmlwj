import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCustomerStore } from '../store/customerStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const InvoiceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, fetchCustomers } = useCustomerStore();
  const { addInvoice, updateInvoice, fetchInvoiceById } = useInvoiceStore();

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  const [taxRate, setTaxRate] = useState(0); // in percent
  const [discount, setDiscount] = useState(0); // flat discount
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
    if (id) {
      setLoading(true);
      fetchInvoiceById(id)
        .then(inv => {
          setCustomerId(inv.customerId);
          setIssueDate(new Date(inv.issueDate).toISOString().split('T')[0]);
          setDueDate(new Date(inv.dueDate).toISOString().split('T')[0]);
          setRemarks(inv.remarks || '');
          setItems(inv.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount
          })));
          setDiscount(inv.discount);
          // calculate original tax rate
          const sub = inv.subtotal;
          if (sub > 0) {
            setTaxRate(Math.round((inv.tax / sub) * 100));
          } else {
            setTaxRate(0);
          }
        })
        .catch(err => {
          console.error(err);
          alert("Failed to load invoice");
          navigate('/invoices');
        })
        .finally(() => setLoading(false));
    }
  }, [id, fetchCustomers, fetchInvoiceById, navigate]);

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
        const p = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
        updated.amount = q * p;
      }
      return updated;
    }));
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [items]);

  const tax = useMemo(() => {
    return subtotal * (taxRate / 100);
  }, [subtotal, taxRate]);

  const total = useMemo(() => {
    return subtotal + tax - discount;
  }, [subtotal, tax, discount]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!customerId) {
      showToast("Please select a customer", "warning");
      return;
    }
    const emptyDesc = items.some(item => !item.description.trim());
    if (emptyDesc) {
      showToast("Please provide a description for all items", "warning");
      return;
    }
    if (remarks && !/^[a-zA-Z0-9\s.,#\/-]{3,100}$/.test(remarks)) {
      showToast('Remarks must contain only letters, numbers, spaces, and basic punctuation (3-100 chars).', 'warning');
      return;
    }
    const invalidDesc = items.some(item => !/^[a-zA-Z0-9\s.,#\/-]{3,100}$/.test(item.description));
    if (invalidDesc) {
      showToast('Item descriptions must contain only letters, numbers, spaces, and basic punctuation (3-100 chars).', 'warning');
      return;
    }

    const payload = {
      customerId,
      issueDate: new Date(issueDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      remarks,
      subtotal,
      discount,
      tax,
      total,
      items
    };

    setLoading(true);
    try {
      if (id) {
        await updateInvoice(id, payload);
      } else {
        await addInvoice(payload);
      }
      navigate('/invoices');
    } catch (err) {
      showToast(err.message || "Failed to save invoice", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  if (loading && id) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/invoices"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? 'Edit Invoice' : 'Create Invoice'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {id ? 'Modify current draft billing parameters' : 'Generate a new invoice request'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
          {id ? 'Editing Invoice' : 'New Invoice'}
        </span>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form area */}
        <div className="lg:col-span-2 space-y-5">

          {/* Card 01: Invoice Attributes */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
              <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                01
              </span>
              <h3 className="text-sm font-semibold text-slate-200">Invoice Attributes</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Select Customer *</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className={inputClass}>
                  <option value="">-- Choose Customer --</option>
                  {customers.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Remarks / Memo</label>
                <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Project Phase 2 Billing"
                  pattern="^[a-zA-Z0-9\s.,#\/-]{3,100}$" title="Only letters, numbers, spaces, and basic punctuation (3-100 characters)"
                  className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Issue Date *</label>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                  className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Due Date *</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className={inputClass} />
              </div>
            </div>
          </div>

          {/* Card 02: Line Items */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Line Items</h3>
              </div>
              <button type="button" onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20 transition-all text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
            <div className="p-5 space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">Description</label>
                    <input value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      pattern="^[a-zA-Z0-9\s.,#\/-]{3,100}$" title="Only letters, numbers, spaces, and basic punctuation (3-100 characters)"
                      placeholder="Item description"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/60 transition-all font-medium placeholder-slate-600" />
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">Qty</label>
                    <input type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm text-center focus:outline-none focus:border-indigo-500/60 transition-all font-medium" />
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">Unit Price</label>
                    <input type="number" min="0" step="any" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm text-right focus:outline-none focus:border-indigo-500/60 transition-all font-medium" />
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">Amount</label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400 text-sm text-right font-semibold">
                      PKR {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(idx)}
                      className="p-2 rounded-xl bg-red-950/20 text-red-500 hover:bg-red-950/40 border border-red-900/30 transition-colors self-end sm:self-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Financial Computations & Actions */}
        <div className="space-y-5">
          {/* Card 03: Financial Computations */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
              <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                03
              </span>
              <h3 className="text-sm font-semibold text-slate-200">Financial Computations</h3>
            </div>
            <div className="p-5 space-y-4 text-sm text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-200">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div>
                <label className={labelClass}>Tax Rate (%)</label>
                <input type="number" min="0" max="100" value={taxRate} onChange={e => setTaxRate(Math.max(0, parseInt(e.target.value) || 0))}
                  className={inputClass + ' text-right'} />
              </div>

              <div>
                <label className={labelClass}>Flat Discount (PKR)</label>
                <input type="number" min="0" step="any" value={discount} onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass + ' text-right'} />
              </div>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-baseline">
                <span className="text-slate-200 font-bold text-sm">Total Bill</span>
                <span className="text-xl font-extrabold text-indigo-400">
                  PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/invoices')}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

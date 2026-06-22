import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCustomerStore } from '../store/customerStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { FileSpreadsheet, Plus, Trash2, ChevronLeft, Save } from 'lucide-react';

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
      alert("Please select a customer");
      return;
    }
    const emptyDesc = items.some(item => !item.description.trim());
    if (emptyDesc) {
      alert("Please provide a description for all items");
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
      alert(err.message || "Failed to save invoice");
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              {id ? 'Edit Invoice' : 'Create Invoice'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {id ? 'Modify current draft billing parameters' : 'Generate a new invoice request'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2">Invoice Attributes</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Customer *</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors">
                  <option value="">-- Choose Customer --</option>
                  {customers.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Remarks / Memo</label>
                <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Project Phase 2 Billing"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors placeholder-slate-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Issue Date *</label>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Due Date *</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Line Items</h3>
              <button type="button" onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-900/55 transition-all text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60">
                  <div className="flex-1 w-full">
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1 sm:hidden">Description</label>
                    <input value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="Item description" className="w-full px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/40 transition-colors placeholder-slate-650" />
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1 sm:hidden">Qty</label>
                    <input type="number" min="1" step="any" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm text-center focus:outline-none focus:border-indigo-600/40 transition-colors" />
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1 sm:hidden">Unit Price</label>
                    <input type="number" min="0" step="any" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm text-right focus:outline-none focus:border-indigo-600/40 transition-colors" />
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1 sm:hidden">Amount</label>
                    <div className="px-3 py-2 rounded-lg bg-slate-800/10 border border-slate-800/60 text-slate-350 text-sm text-right font-semibold">
                      PKR {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(idx)}
                      className="p-2 rounded-lg bg-red-950/20 text-red-500 hover:bg-red-950/40 border border-red-900/30 transition-colors self-end sm:self-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar calculations & action */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2">Financial Computations</h3>
            
            <div className="space-y-3.5 text-sm text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Subtotal</span>
                <span className="font-semibold text-slate-250">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tax Rate (%)</label>
                <input type="number" min="0" max="100" value={taxRate} onChange={e => setTaxRate(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/40 transition-colors text-right" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Flat Discount (PKR)</label>
                <input type="number" min="0" step="any" value={discount} onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/40 transition-colors text-right" />
              </div>

              <div className="border-t border-slate-800/85 pt-3.5 flex justify-between items-baseline">
                <span className="text-slate-200 font-bold">Total Bill</span>
                <span className="text-xl font-extrabold text-indigo-400">
                  PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/invoices')}
              className="flex-1 px-4 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/40 transition-all disabled:opacity-50">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

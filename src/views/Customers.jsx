import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCustomerStore } from '../store/customerStore';
import { Users, Search, Plus, Edit2, Trash2, X, Building2, Mail, Phone, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';

// Replace null DB values with '' so controlled inputs stay controlled
const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_CUSTOMER = { name: '', email: '', phone: '', address: '', company: '', isActive: true };

function CustomerModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial ? nullsToEmpty(initial) : DEFAULT_CUSTOMER
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? nullsToEmpty(initial) : DEFAULT_CUSTOMER);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'warning');
      return;
    }
    if (!/^[a-zA-Z\s.-]{3,50}$/.test(form.name)) {
      showToast('Name should only contain letters, spaces, hyphens, and dots (3-50 chars)', 'warning');
      return;
    }
    if (form.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }
    if (form.phone && !/^[0-9+\s-]{10,15}$/.test(form.phone)) {
      showToast('Phone must contain only numbers, spaces, plus signs, or hyphens (10-15 chars)', 'warning');
      return;
    }
    if (form.company && !/^[a-zA-Z0-9\s.-]{3,50}$/.test(form.company)) {
      showToast('Company name should contain only letters, numbers, spaces, hyphens, and dots (3-50 chars)', 'warning');
      return;
    }
    onSave({ ...form });
    onClose();
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[92dvh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{initial ? 'Edit Customer' : 'New Customer'}</h3>
              <p className="text-[11px] text-slate-500">Manage client directory details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-0 sm:gap-5 p-5">

            {/* Left: Info Panel */}
            <div className="sm:col-span-4 mb-4 sm:mb-0">
              <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-amber-300">Client Directory</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Building2 className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Company & Contact Info</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Mail className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Linked to Invoices</span>
                  </div>
                </div>
                <div className="border-t border-amber-500/20 my-3" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
                </p>
              </div>
            </div>

            {/* Right: Form Cards */}
            <div className="sm:col-span-8 space-y-4">

              {/* Card 01: Basic Info */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                  <h4 className="text-sm font-semibold text-slate-200">Customer Details</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Customer Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. John Doe or Acme Corp" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Email Address</label>
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="client@example.com" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Phone Number</label>
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+92 300 1234567" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Company Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                        placeholder="e.g. Acme Corporation" className={`${inputClass} pl-10`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 02: Address & Status */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                  <h4 className="text-sm font-semibold text-slate-200">Address & Status</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Billing Address</label>
                    <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className={`${inputClass} h-20 resize-none`} placeholder="Billing / Shipping Address details" />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer" />
                    <label htmlFor="isActive" className="text-sm font-semibold text-slate-300 cursor-pointer">Active Client</label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
            {initial ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Customers = () => {
  const { customers, fetchCustomers, deleteCustomer, bulkDeleteCustomers } = useCustomerStore();
  const navigate = useNavigate();
  
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [customers, search]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await deleteCustomer(id);
      showToast("Customer deleted successfully", "success");
      setDeleteId(null);
    } catch (err) {
      showToast(err.message || "Failed to delete customer. Ensure they have no registered invoices.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(c => c.id));
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
      await bulkDeleteCustomers(selectedIds);
      showToast(`${selectedIds.length} customer(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete customers. Ensure they have no registered invoices.', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded-full">
              <Users className="h-3 w-3" /> Client Directory
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Customers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage details of commercial clients and invoice entities</p>
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
          <button onClick={() => navigate('/customers/new')}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> New Customer
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or company..."
            name="customer-search" autoComplete="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Name & Company</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Contact Details</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Address</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Created At</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={(e) => handleSelectOne(c.id, e)}
                        className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                      {c.company && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" /> {c.company}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      {c.email && (
                        <p className="text-xs text-slate-300 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-amber-400/80" /> {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="text-[11px] text-slate-450 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-amber-400/80" /> {c.phone}
                        </p>
                      )}
                      {!c.email && !c.phone && <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-400 truncate max-w-64" title={c.address}>{c.address || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {c.isActive ? (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Active</span>
                      ) : (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/customers/edit/${c.id}`)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200" title="Edit Customer"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400" title="Delete Customer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="rounded-lg border bg-slate-950/40 p-3 transition-colors border-slate-800/60">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{c.name}</h4>
                    {c.company && <p className="text-[11px] text-slate-500">{c.company}</p>}
                  </div>
                  {c.isActive ? (
                     <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Active</span>
                  ) : (
                     <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Inactive</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 space-y-1 mt-2">
                  {c.email && <div>Email: {c.email}</div>}
                  {c.phone && <div>Phone: {c.phone}</div>}
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-slate-800/50">
                   <button onClick={() => navigate(`/customers/edit/${c.id}`)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                   <button onClick={() => setDeleteId(c.id)} className="text-xs text-red-400">Delete</button>
                </div>
              </div>
            ))}
        </MobileOnly>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Confirm Delete</h4>
            <p className="text-xs text-slate-500 mb-4">Are you sure you want to delete this customer? Customers with registered invoices cannot be deleted.</p>
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
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected customer(s)? Customers with registered invoices will be skipped. This action cannot be undone.
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
                    Delete {selectedIds.length} Customer(s)
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

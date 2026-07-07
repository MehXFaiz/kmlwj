import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCustomerStore } from '../store/customerStore';
import { Users, Search, Plus, Edit2, Trash2, X, Building2, Mail, Phone, AlertTriangle, CheckCircle, MapPin, Briefcase } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';

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
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Customers</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">
                Client Directory
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Manage details of commercial clients and invoice entities</p>
          </div>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-xs font-bold flex-1 sm:flex-none shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          <button onClick={() => navigate('/customers/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all flex-1 sm:flex-none cursor-pointer active:scale-95">
            <Plus className="h-4 w-4 stroke-[2.5]" /> <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or company..."
            name="customer-search" autoComplete="off"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-slate-400 px-2">
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> {filtered.length === 1 ? 'customer' : 'customers'}</span>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? 'No customers found' : 'No customers yet'}
            description={search ? `We couldn't find any results matching "${search}". Try adjusting your search term or clearing the filter.` : 'Start by adding your first customer to generate invoices and manage billing entities.'}
            actionLabel={!search ? 'Add First Customer' : undefined}
            onAction={!search ? () => navigate('/customers/new') : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(c => (
              <div
                key={c.id}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(c.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Avatar, Name & Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={(e) => handleSelectOne(c.id, e)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                      />
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-inner shrink-0">
                        {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight">
                          {c.name || 'Unnamed Client'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                          {c.company ? (
                            <>
                              <Building2 className="w-3 h-3 text-amber-400 shrink-0" /> {c.company}
                            </>
                          ) : 'Individual Client'}
                        </p>
                      </div>
                    </div>

                    {c.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wide shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold uppercase tracking-wide shrink-0">
                        INACTIVE
                      </span>
                    )}
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" /> MOBILE / PH
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-xs">{c.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-amber-400" /> EMAIL
                      </span>
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[160px]">{c.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> ADDRESS / CITY
                      </span>
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                        {c.address || 'Karachi'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500">
                    DOI: {c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : '2026-07-04'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/customers/edit/${c.id}`)}
                      className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Edit Customer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(c.id)}
                      className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

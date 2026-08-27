import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { useAuthStore } from '../store/authStore';
import { Users, Search, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, Phone, MapPin, Briefcase } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { EmptyState } from '../components/ui/EmptyState';

// Replace null DB values with '' so controlled inputs stay controlled
const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_BENEFICIARY = { name: '', cnic: '', mobile: '', address: '', remarks: '', isActive: true };

function BeneficiaryModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial ? nullsToEmpty(initial) : DEFAULT_BENEFICIARY
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? nullsToEmpty(initial) : DEFAULT_BENEFICIARY);
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
    if (form.cnic && !/^\d{5}-\d{7}-\d{1}$/.test(form.cnic)) {
      showToast('CNIC must be in format: 00000-0000000-0', 'warning');
      return;
    }
    if (form.mobile && !/^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/.test(form.mobile)) {
      showToast('Invalid mobile number. E.g. 0300-1234567', 'warning');
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
      <div className="relative z-10 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{initial ? "Update Person's Details" : 'Add Person to Welfare List'}</h3>
              <p className="text-[11px] text-slate-500">{initial ? 'Update contact and status information' : 'Register a new beneficiary'}</p>
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
                  <h4 className="text-sm font-semibold text-amber-300">Welfare Registry</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Users className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Track Aid Recipients</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Search className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Searchable by CNIC & Mobile</span>
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

              {/* Card 01: Identity */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                  <h4 className="text-sm font-semibold text-slate-200">Personal Information</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Full Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Ahmed Khan" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>ID Card Number (CNIC)</label>
                      <input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))}
                        placeholder="42101-1234567-8" className={inputClass} />
                      <p className="text-[10px] text-slate-600 mt-1">Format: 00000-0000000-0</p>
                    </div>
                    <div>
                      <label className={labelClass}>Mobile Number</label>
                      <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                        placeholder="0300-0000000" className={inputClass} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 02: Additional Info */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                  <h4 className="text-sm font-semibold text-slate-200">Additional Details</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className={labelClass}>Home Address</label>
                    <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className={`${inputClass} h-20 resize-none`} />
                  </div>
                  <div>
                    <label className={labelClass}>Notes / Remarks</label>
                    <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                      className={inputClass} />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer" />
                    <label htmlFor="isActive" className="text-sm font-semibold text-slate-300 cursor-pointer">This person is currently receiving aid</label>
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
            {initial ? 'Save Changes' : 'Create Beneficiary'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Beneficiaries = () => {
  const { beneficiaries, fetchBeneficiaries, deleteBeneficiary } = useBeneficiaryStore();
  const { canEditOrDelete } = useAuthStore();
  const navigate = useNavigate();
  
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, label } | null

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return beneficiaries.filter(b => 
      (b.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (b.cnic && b.cnic.includes(search)) ||
      (b.mobile && b.mobile.includes(search))
    );
  }, [beneficiaries, search]);

  const allIds = filtered.map(b => b.id);
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleAll = () => isAllSelected ? setSelectedIds([]) : setSelectedIds(allIds);
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await deleteBeneficiary(id);
      showToast('Beneficiary deleted successfully', 'success');
      setSelectedIds(p => p.filter(i => i !== id));
      setDeleteId(null);
    } catch (err) {
      handleDeleteError(err, 'Error deleting beneficiary');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    
    const results = await Promise.allSettled(
      selectedIds.map(async (id) => {
        await deleteBeneficiary(id);
        return id;
      })
    );

    const successfulIds = [];
    const failedIds = [];
    let lastError = null;

    results.forEach((result, idx) => {
      const id = selectedIds[idx];
      if (result.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
        lastError = result.reason;
      }
    });

    setSelectedIds(failedIds);
    setShowBulkConfirm(false);

    if (successfulIds.length > 0 && failedIds.length === 0) {
      showToast(`${successfulIds.length} records removed successfully.`, 'success');
    } else if (successfulIds.length > 0 && failedIds.length > 0) {
      const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || 'associated records';
      showToast(`Removed ${successfulIds.length} record(s). ${failedIds.length} record(s) could not be removed: ${errorMsg}`, 'warning');
    } else if (failedIds.length > 0) {
      handleDeleteError(lastError, 'Some records could not be removed.');
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Beneficiaries</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400">
                Directory
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Manage welfare recipients, individuals, and organizations receiving donations</p>
          </div>
        </div>
        <div className={pageActionsClass}>
          {canEditOrDelete && selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all text-xs font-bold flex-1 sm:flex-none shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          <button onClick={() => navigate('/beneficiaries/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all flex-1 sm:flex-none cursor-pointer active:scale-95">
            <Plus className="h-4 w-4 stroke-[2.5]" /> <span>New Beneficiary</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, CNIC, or mobile..."
            name="beneficiary-search" autoComplete="off"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-slate-400 px-2">
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> {filtered.length === 1 ? 'beneficiary' : 'beneficiaries'}</span>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No beneficiaries found' : 'No beneficiaries yet'}
            description={search ? `We couldn't find any results matching "${search}". Try adjusting your search term or clearing the filter.` : 'Start by adding your first beneficiary to manage donation distribution and welfare assistance.'}
            actionLabel={!search ? 'Add First Beneficiary' : undefined}
            onAction={!search ? () => navigate('/beneficiaries/new') : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(b => (
              <div
                key={b.id}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(b.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Avatar, Name & Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                      />
                      <div
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-inner shrink-0 overflow-hidden"
                        onClick={(e) => { if (b.photoUrl) { e.stopPropagation(); setLightbox({ url: b.photoUrl, label: b.name || 'Profile Photo' }); } }}
                        role={b.photoUrl ? 'button' : undefined}
                        style={b.photoUrl ? { cursor: 'zoom-in' } : undefined}
                      >
                        {b.photoUrl
                          ? <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                          : (b.name ? b.name.charAt(0).toUpperCase() : 'B')}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight">
                          {b.name || 'Unnamed Beneficiary'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {b.remarks ? b.remarks.slice(0, 30) : 'Welfare Recipient'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wide shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" /> ACTIVE
                    </span>
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider">CNIC</span>
                      <span className="font-mono font-bold text-slate-100 text-xs">{b.cnic || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" /> MOBILE
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-xs">{b.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> GHAM / CITY
                      </span>
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                        {b.address || 'Karachi'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" /> CATEGORY
                      </span>
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                        {b.remarks || 'Financial Aid'}
                      </span>
                    </div>
                  </div>

                  {/* CNIC thumbnails (if any) */}
                  {(b.cnicFrontUrl || b.cnicBackUrl) && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CNIC:</span>
                      {b.cnicFrontUrl && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLightbox({ url: b.cnicFrontUrl, label: 'CNIC Front' }); }}
                          className="w-10 h-7 rounded border border-slate-700 overflow-hidden hover:border-amber-500/50 transition-colors"
                          title="View CNIC Front"
                        >
                          <img src={b.cnicFrontUrl} alt="CNIC Front" className="w-full h-full object-cover" />
                        </button>
                      )}
                      {b.cnicBackUrl && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLightbox({ url: b.cnicBackUrl, label: 'CNIC Back' }); }}
                          className="w-10 h-7 rounded border border-slate-700 overflow-hidden hover:border-amber-500/50 transition-colors"
                          title="View CNIC Back"
                        >
                          <img src={b.cnicBackUrl} alt="CNIC Back" className="w-full h-full object-cover" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500">
                    DOI: {b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '2026-07-04'}
                  </span>
                  {canEditOrDelete && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/beneficiaries/edit/${b.id}`)}
                        className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Edit Beneficiary"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(b.id)}
                        className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Delete Beneficiary"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Remove from Welfare List?</h4>
            <p className="text-xs text-slate-400 mb-4">This will remove the person from your records. Their donation history will not be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Go Back</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Bulk Delete Beneficiaries</h4>
            <p className="text-xs text-slate-500 mb-4">Delete {selectedIds.length} items? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Cancel</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
                {isDeleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative z-10 max-w-4xl max-h-[90vh] flex flex-col items-center gap-3">
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="max-w-full max-h-[80vh] rounded-xl border border-amber-500/30 shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-xs font-semibold text-amber-300 tracking-wide">{lightbox.label}</div>
            <button
              onClick={() => setLightbox(null)}
              className="px-4 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

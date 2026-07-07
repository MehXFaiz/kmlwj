import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDonorStore } from '../store/donorStore';
import { Users, Search, Plus, Edit2, Trash2, X, Mail, Phone, CreditCard, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';


export const Donors = () => {
  const navigate = useNavigate();
  const { donors, loading, fetchDonors, deleteDonor, bulkDeleteDonors } = useDonorStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return donors;
    const q = search.toLowerCase();
    return donors.filter(d =>
      d.fullName?.toLowerCase().includes(q) ||
      d.donorCode?.toLowerCase().includes(q) ||
      d.cnic?.toLowerCase().includes(q) ||
      d.mobile?.toLowerCase().includes(q)
    );
  }, [donors, search]);

  const handleDelete = async (donor) => {
    if (!window.confirm(`Are you sure you want to delete donor "${donor.fullName}" (${donor.donorCode})?`)) return;
    try {
      await deleteDonor(donor.id);
      showToast('Donor deleted successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete donor', 'error');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(d => d.id));
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
      await bulkDeleteDonors(selectedIds);
      showToast(`${selectedIds.length} donor(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete donors', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const activeCount = useMemo(() => donors.filter(d => d.isActive).length, [donors]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Donors Directory</h1>
          <p className="text-xs text-slate-400 mt-1">Manage charitable donors, Zakat contributors, and welfare sponsors</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold transition-all shadow-lg active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          <Link
            to="/donors/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Register Donor</span>
          </Link>
        </div>
      </div>

      {/* Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Total Donors</p>
            <p className="text-2xl font-black text-slate-200 mt-1">{donors.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Active Donors</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by donor name, code (DNR-0001), CNIC, or phone number..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {loading && donors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading donors directory...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium bg-slate-900/40 rounded-2xl border border-slate-800">No donors found matching your search criteria.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(d => (
              <div
                key={d.id}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(d.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Avatar, Name & Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={() => handleSelectOne(d.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                      />
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-inner shrink-0">
                        {d.fullName ? d.fullName.charAt(0).toUpperCase() : 'D'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight">
                          {d.fullName || 'Unnamed Donor'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {d.fatherName ? `s/o ${d.fatherName}` : (d.donorCode || 'Donor')}
                        </p>
                      </div>
                    </div>

                    {d.isActive ? (
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
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider">CNIC</span>
                      <span className="font-mono font-bold text-slate-100 text-xs">{d.cnic || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" /> MOBILE
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-xs">{d.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" /> GHAM / CITY
                      </span>
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                        {d.city || d.address || 'Karachi'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> DONOR CODE
                      </span>
                      <span className="font-bold text-amber-400 text-xs font-mono">
                        {d.donorCode || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500">
                    DOI: {d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '2026-07-04'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/donors/edit/${d.id}`)}
                      className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Edit Donor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                      title="Delete Donor"
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
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected donor(s)? This action cannot be undone.
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
                    Delete {selectedIds.length} Donor(s)
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

export default Donors;

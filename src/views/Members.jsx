import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMemberStore } from '../store/memberStore';
import {
  Users, UserPlus, Search, Edit2, Trash2, Phone, MapPin,
  Briefcase, CheckCircle, ArrowRight, Building, AlertTriangle, CreditCard, GitBranch
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { useAuthStore } from '../store/authStore';

export const Members = () => {
  const navigate = useNavigate();
  const { members, fetchMembers, deleteMember, bulkDeleteMembers, loading } = useMemberStore();
  const { canEditOrDelete } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      (m.fullName && m.fullName.toLowerCase().includes(term)) ||
      (m.cnic && m.cnic.toLowerCase().includes(term)) ||
      (m.mobile && m.mobile.toLowerCase().includes(term)) ||
      (m.ghamName && m.ghamName.toLowerCase().includes(term)) ||
      (m.profession && m.profession.toLowerCase().includes(term))
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMember(deleteId);
      showToast('Member deleted successfully', 'success');
      setDeleteId(null);
    } catch (err) {
      handleDeleteError(err, 'Failed to delete member');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredMembers.map(m => m.id));
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
      await bulkDeleteMembers(selectedIds);
      showToast(`${selectedIds.length} member(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      handleDeleteError(err, 'Failed to bulk delete members');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Users className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">Community Members Directory</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {members.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Kutchi Muslim Loharwada Jangadh • Jamia Community Census &amp; Records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canEditOrDelete && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}

          <Link
            to="/membership-fees"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-sm font-semibold transition-all"
          >
            <Building className="w-4 h-4 text-amber-400" />
            <span>Fee Ledger</span>
          </Link>

          <Link
            to="/membership-cards"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={{ background: 'rgba(13,78,43,0.2)', borderColor: 'rgba(201,162,39,0.35)', color: '#C9A227' }}
          >
            <CreditCard className="w-4 h-4" />
            <span>Print Cards</span>
          </Link>

          <Link
            to="/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Member</span>
          </Link>
        </div>
      </div>

      {/* Search + Select All */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name, CNIC, Mobile, Gham, Profession..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
        {filteredMembers.length > 0 && canEditOrDelete && (
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 cursor-pointer hover:border-slate-700 transition-colors select-none">
            <input
              type="checkbox"
              checked={selectedIds.length > 0 && selectedIds.length === filteredMembers.length}
              onChange={handleSelectAll}
              className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
            />
            <span>Select All ({filteredMembers.length})</span>
          </label>
        )}
      </div>

      {/* Members Grid */}
      <div>
        {filteredMembers.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <Users className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
              {searchTerm ? 'No Members Matched Your Search' : 'No Community Members Registered Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
              {searchTerm
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Begin building the community directory by enrolling members into the secure system.'}
            </p>
            {!searchTerm && (
              <Link
                to="/members/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25"
              >
                <span>Register First Member</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMembers.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`/members/${m.id}`)}
                className="bg-slate-900 rounded-2xl border border-slate-800 p-5 hover:border-slate-700 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  {/* Top: Avatar + Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {canEditOrDelete && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={(e) => handleSelectOne(m.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4 shrink-0 mt-1"
                        />
                      )}
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={m.fullName} className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-base text-amber-400 shrink-0">
                          {m.fullName?.charAt(0) || 'M'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors leading-tight">
                          {m.fullName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {m.fatherName ? `s/o ${m.fatherName}` : 'Member'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase shrink-0">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  </div>

                  {/* Details */}
                  <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider">CNIC</span>
                      <span className="font-mono font-semibold text-slate-200">{m.cnic || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
                        <Phone className="w-3 h-3 text-amber-400" /> Mobile
                      </span>
                      <span className="font-mono font-semibold text-slate-200">{m.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" /> Gham / City
                      </span>
                      <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                        {m.ghamName || m.city || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-amber-400" /> Profession
                      </span>
                      <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                        {m.profession || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    DOI: {m.doi || (m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/members/${m.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      title="Family Tree"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </Link>
                    {canEditOrDelete && (
                      <>
                        <Link
                          to={`/members/edit/${m.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                          title="Edit Member"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(m.id); }}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                          title="Delete Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-2">Confirm Deletion</h3>
            <p className="text-xs text-slate-400 mb-6">
              Are you sure you want to delete this community member? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-red-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Confirm Bulk Deletion</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected member(s)? Their records will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedIds.length} Member(s)
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

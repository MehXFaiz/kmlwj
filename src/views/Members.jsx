import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMemberStore } from '../store/memberStore';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Phone, MapPin, 
  Briefcase, GraduationCap, Calendar, CheckCircle, ShieldCheck, 
  ArrowRight, Building
} from 'lucide-react';

export const Members = () => {
  const navigate = useNavigate();
  const { members, fetchMembers, deleteMember, loading } = useMemberStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState(null);

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
    await deleteMember(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-[#11141c] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1e2330] p-6 rounded-3xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5c3624] to-[#3a2218] flex items-center justify-center border border-[#7a4831] shadow-lg shrink-0">
            <Users className="w-6 h-6 text-[#ebd0be]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-100">
                COMMUNITY MEMBERS DIRECTORY
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {members.length} REGISTERED
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Kutchi Muslim Loharwada Jangadh • Jamia Community Census & Records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/membership-fees"
            className="px-4 py-3 rounded-2xl bg-[#151922] hover:bg-slate-800 text-slate-300 font-extrabold text-xs uppercase tracking-wider border border-slate-800 transition-colors flex items-center gap-2"
          >
            <Building className="w-4 h-4 text-amber-500" />
            <span>Fee Ledger</span>
          </Link>

          <Link
            to="/members/new"
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#5c3624] to-[#4a2b1c] hover:from-[#6d402a] hover:to-[#583321] text-[#ebd0be] font-extrabold text-xs uppercase tracking-widest flex items-center gap-2.5 shadow-xl shadow-[#382318]/50 border border-[#7a4831]/60 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>REGISTER MEMBER</span>
          </Link>
        </div>
      </div>

      {/* Search Filter */}
      <div className="max-w-7xl mx-auto mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name, CNIC, Mobile, Gham, Profession..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#1e2330] border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors font-medium"
          />
        </div>
      </div>

      {/* Members Directory Grid / Table */}
      <div className="max-w-7xl mx-auto">
        {filteredMembers.length === 0 ? (
          <div className="bg-[#1e2330] rounded-3xl border border-slate-800/80 p-12 text-center shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4 border border-slate-700/60">
              <Users className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-300 uppercase tracking-wider mb-2">
              {searchTerm ? 'NO MEMBERS MATCHED YOUR SEARCH' : 'NO COMMUNITY MEMBERS REGISTERED YET'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 font-medium">
              {searchTerm ? 'Try adjusting your search terms or clearing the filter.' : 'Begin building the community directory by enrolling members into the secure system.'}
            </p>
            {!searchTerm && (
              <Link
                to="/members/new"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#5c3624] to-[#4a2b1c] text-[#ebd0be] font-extrabold text-xs uppercase tracking-widest border border-[#7a4831]/60 shadow-lg"
              >
                <span>REGISTER FIRST MEMBER</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((m) => (
              <div 
                key={m.id} 
                className="bg-[#1e2330] rounded-3xl border border-slate-800/80 p-6 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Bar: Photo & Status */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3.5">
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={m.fullName} className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/30 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#151922] border border-slate-800 flex items-center justify-center font-black text-lg text-amber-500 shrink-0">
                          {m.fullName?.charAt(0) || 'M'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide group-hover:text-amber-400 transition-colors leading-tight">
                          {m.fullName}
                        </h4>
                        <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5">
                          {m.fatherName ? `s/o ${m.fatherName}` : 'Member'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest shrink-0">
                      <CheckCircle className="w-3 h-3" /> ACTIVE
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="bg-[#151922] rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs font-medium text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">CNIC</span>
                      <span className="font-mono font-bold text-slate-200">{m.cnic || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1">
                        <Phone className="w-3 h-3 text-amber-500" /> Mobile
                      </span>
                      <span className="font-mono font-bold text-slate-200">{m.mobile || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> Gham / City
                      </span>
                      <span className="font-bold text-slate-200 uppercase truncate max-w-[150px]">
                        {m.ghamName || m.city || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-amber-500" /> Profession
                      </span>
                      <span className="font-bold text-slate-200 uppercase truncate max-w-[150px]">
                        {m.profession || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    DOI: {m.doi || (m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A')}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/members/edit/${m.id}`}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700/60"
                      title="Edit Member"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(m.id)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                      title="Delete Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e2330] rounded-3xl border border-slate-800 p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold uppercase text-slate-100 mb-2">Confirm Deletion</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">
              Are you sure you want to delete this community member? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 rounded-xl bg-[#151922] hover:bg-slate-800 text-slate-300 text-xs font-extrabold uppercase tracking-wider border border-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider transition-colors shadow-lg shadow-red-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-16 mb-6 text-center border-t border-slate-800/60 pt-8">
        <p className="text-xs font-semibold text-slate-500 tracking-wide">
          © 2026 Kutchi Muslim Loharwada Jangadh. Built with passion for the community.
        </p>
      </footer>
    </div>
  );
};

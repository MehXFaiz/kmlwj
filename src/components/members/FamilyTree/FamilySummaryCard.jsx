import React from 'react';
import { Users, ArrowRight, GitBranch } from 'lucide-react';
import { relationshipLabel } from '../../../utils/familyRelations';

export const FamilySummaryCard = ({ relations = [], loading, onViewTree }) => {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Family Summary</h3>
            <p className="text-[10px] text-slate-500">Total Family Members: {relations.length}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewTree}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-lg shadow-amber-600/25"
        >
          <GitBranch className="w-3.5 h-3.5" />
          View Full Family Tree
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading family members…</p>
      ) : relations.length === 0 ? (
        <p className="text-xs text-slate-500">No family members linked yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {relations.slice(0, 6).map((rel) => (
            <div key={rel.id} className="flex items-center gap-2.5 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2">
              {rel.relatedMember?.photoUrl ? (
                <img src={rel.relatedMember.photoUrl} alt={rel.relatedMember.fullName} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0">
                  {rel.relatedMember?.fullName?.charAt(0) || 'M'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 truncate">{rel.relatedMember?.fullName}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  {relationshipLabel(rel.relationshipType, rel.customLabel)}
                </p>
              </div>
            </div>
          ))}
          {relations.length > 6 && (
            <p className="text-[10px] text-slate-500 col-span-full text-center pt-1">+{relations.length - 6} more…</p>
          )}
        </div>
      )}
    </div>
  );
};

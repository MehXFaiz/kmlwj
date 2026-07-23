import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, IdCard, Trash2 } from 'lucide-react';
import { relationshipLabel } from '../../../utils/familyRelations';

export const FamilyMemberCard = ({ relation, highlight = false, onRemove, canRemove = false, compact = false }) => {
  const navigate = useNavigate();
  const m = relation.relatedMember;
  if (!m) return null;

  return (
    <div
      className={`relative group rounded-xl border p-3 transition-all cursor-pointer ${
        highlight
          ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-600/10'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      } ${compact ? 'w-40' : 'w-full'}`}
      onClick={() => navigate(`/members/${m.id}`)}
      title="View profile"
    >
      {canRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove link"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      <div className="flex items-center gap-2.5">
        {m.photoUrl ? (
          <img src={m.photoUrl} alt={m.fullName} className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
            {m.fullName?.charAt(0) || 'M'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-100 truncate">{m.fullName}</p>
          <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
            {relationshipLabel(relation.relationshipType, relation.customLabel)}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/70 space-y-1 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <IdCard className="w-3 h-3 text-slate-500" />
            <span className="font-mono">{m.memberNo || 'N/A'}</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono">{m.cnic || 'No CNIC'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-slate-500" />
            <span className="font-mono">{m.mobile || 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Search, UserPlus, Link2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { showToast } from '../../ui/Toast';
import { useMemberStore } from '../../../store/memberStore';
import { familyTreeService } from '../../../services/familyTreeService';
import { RELATIONSHIP_TYPES, RECIPROCAL_DEFAULTS } from '../../../utils/familyRelations';

// Links an existing member to `member` as a family relative. Deliberately
// search-only (no inline "create member" shortcut) so the family tree can
// never spawn a duplicate member record — every node it can point to already
// exists in the Members directory.
export const AddFamilyMemberModal = ({ isOpen, onClose, member, existingRelatedIds = [], onLinked }) => {
  const { members } = useMemberStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const [relationshipType, setRelationshipType] = useState('FATHER');
  const [reciprocalType, setReciprocalType] = useState(RECIPROCAL_DEFAULTS.FATHER);
  const [customLabel, setCustomLabel] = useState('');
  const [reciprocalCustomLabel, setReciprocalCustomLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const excludedIds = useMemo(() => new Set([member?.id, ...existingRelatedIds]), [member, existingRelatedIds]);

  const results = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return members
      .filter((m) => !excludedIds.has(m.id))
      .filter((m) =>
        (m.fullName && m.fullName.toLowerCase().includes(term)) ||
        (m.memberNo && m.memberNo.toLowerCase().includes(term)) ||
        (m.cnic && m.cnic.toLowerCase().includes(term)) ||
        (m.mobile && m.mobile.toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [members, searchTerm, excludedIds]);

  const reset = () => {
    setSearchTerm(''); setSelected(null); setRelationshipType('FATHER');
    setReciprocalType(RECIPROCAL_DEFAULTS.FATHER); setCustomLabel(''); setReciprocalCustomLabel('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleTypeChange = (value) => {
    setRelationshipType(value);
    setReciprocalType(RECIPROCAL_DEFAULTS[value] || 'OTHER');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) {
      showToast('Search and select a member to link first', 'warning');
      return;
    }
    if (relationshipType === 'OTHER' && !customLabel.trim()) {
      showToast('Please describe the custom relationship', 'warning');
      return;
    }
    setSaving(true);
    try {
      await familyTreeService.addRelation({
        memberId: member.id,
        relatedMemberId: selected.id,
        relationshipType,
        reciprocalType,
        customLabel: customLabel.trim() || undefined,
        reciprocalCustomLabel: reciprocalCustomLabel.trim() || undefined,
      });
      showToast(`Linked ${selected.fullName} as ${relationshipType === 'OTHER' ? customLabel : relationshipType.toLowerCase()}`, 'success');
      onLinked?.();
      handleClose();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to link family member', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Link Family Member" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: search existing members */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
            Search Members (Name, Membership ID, CNIC, or Contact)
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSelected(null); }}
              placeholder="Start typing to search…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {searchTerm.trim() && !selected && (
            <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/70 max-h-56 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-xs text-slate-500 px-4 py-3">No matching members found.</p>
              ) : (
                results.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => { setSelected(m); setSearchTerm(m.fullName); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-900 transition-colors"
                  >
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.fullName} className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                        {m.fullName?.charAt(0) || 'M'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{m.fullName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{m.memberNo || 'N/A'} • {m.cnic || 'No CNIC'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selected && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
              <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate">{selected.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate">{selected.memberNo || 'N/A'} • {selected.cnic || 'No CNIC'}</p>
              </div>
              <button type="button" onClick={() => { setSelected(null); setSearchTerm(''); }} className="text-[10px] font-semibold text-slate-400 hover:text-slate-200">
                Change
              </button>
            </div>
          )}
        </div>

        {/* Step 2: relationship type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
              {member?.fullName || 'This member'} is the relative's…
            </label>
            <select
              value={relationshipType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {relationshipType === 'OTHER' && (
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Describe relationship (e.g. Family Friend)"
                className="w-full mt-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
              {selected?.fullName || 'The relative'} is {member?.fullName ? `${member.fullName}'s` : "this member's"}…
            </label>
            <select
              value={reciprocalType}
              onChange={(e) => setReciprocalType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {reciprocalType === 'OTHER' && (
              <input
                type="text"
                value={reciprocalCustomLabel}
                onChange={(e) => setReciprocalCustomLabel(e.target.value)}
                placeholder="Describe relationship"
                className="w-full mt-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 -mt-2">
          The reciprocal relationship is filled in automatically — adjust it if needed (e.g. Brother vs Sister).
        </p>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !selected}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Linking…' : 'Link Family Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users, Phone, IdCard, Edit2, ArrowLeft, UserPlus, GitBranch, MapPin, Briefcase } from 'lucide-react';
import { memberService } from '../services/memberService';
import { familyTreeService } from '../services/familyTreeService';
import { useAuthStore } from '../store/authStore';
import { useMemberStore } from '../store/memberStore';
import { showToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmationModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { FamilySummaryCard } from '../components/members/FamilyTree/FamilySummaryCard';
import { FamilyMemberCard } from '../components/members/FamilyTree/FamilyMemberCard';
import { FamilyTreeDiagram } from '../components/members/FamilyTree/FamilyTreeDiagram';
import { AddFamilyMemberModal } from '../components/members/FamilyTree/AddFamilyMemberModal';

// Roles below Admin ("Data Entry") may add/edit family links; only Admin may
// delete them — mirrors the write rules enforced server-side in
// api/_v1/family-relationships.ts.
const canWriteFamilyLinks = (role) => {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return r === 'admin' || r === 'super admin' || r === 'administrator' || r.startsWith('data entry');
};

export const MemberDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, canEditOrDelete } = useAuthStore();
  const { members, fetchMembers } = useMemberStore();
  const confirm = useConfirm();

  const [member, setMember] = useState(null);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relLoading, setRelLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const canAddLinks = canWriteFamilyLinks(role);
  const canRemoveLinks = canEditOrDelete;

  const loadMember = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memberService.getById(id);
      setMember(res.data);
    } catch (err) {
      showToast('Failed to load member profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRelations = useCallback(async () => {
    setRelLoading(true);
    try {
      const data = await familyTreeService.getRelations(id);
      setRelations(data.direct || []);
    } catch (err) {
      showToast('Failed to load family tree', 'error');
    } finally {
      setRelLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMember(); loadRelations(); }, [loadMember, loadRelations]);

  // The search-and-link modal needs the full member directory; fetch it if
  // this page was opened directly (not via the Members list, which already
  // populates the store).
  useEffect(() => {
    if (members.length === 0) fetchMembers();
  }, [members.length, fetchMembers]);

  const handleRemove = (rel) => {
    confirm({
      title: 'Remove Family Link',
      description: `Remove the family link between ${member?.fullName} and ${rel.relatedMember?.fullName}? This also removes the reciprocal relationship.`,
      confirmLabel: 'Remove',
      type: 'warning',
      successMessage: 'Family link removed successfully.',
      action: async () => {
        await familyTreeService.removeRelation(id, rel.relatedMemberId);
        loadRelations();
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Member Not Found</h3>
        <Link to="/members" className="inline-flex items-center gap-2 mt-4 text-amber-400 text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Members
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/members')}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.fullName} className="w-14 h-14 rounded-xl object-cover border border-slate-700" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-lg text-amber-400">
              {member.fullName?.charAt(0) || 'M'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-100">{member.fullName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{member.memberNo || 'N/A'} • {member.fatherName ? `s/o ${member.fatherName}` : 'Member'}</p>
          </div>
        </div>

        {canEditOrDelete && (
          <Link
            to={`/members/edit/${member.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25"
          >
            <Edit2 className="w-4 h-4" />
            Edit Member
          </Link>
        )}
      </div>

      {/* Tabs — Overview / Family Tree (new module, existing theme preserved) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="family-tree">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Family Tree
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1 bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-100 mb-2">Member Details</h3>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1"><IdCard className="w-3 h-3 text-amber-400" />CNIC</span>
                <span className="font-mono font-semibold text-slate-200">{member.cnic || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1"><Phone className="w-3 h-3 text-amber-400" />Mobile</span>
                <span className="font-mono font-semibold text-slate-200">{member.mobile || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" />Gham / City</span>
                <span className="font-semibold text-slate-200 truncate max-w-[140px]">{member.ghamName || member.city || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1"><Briefcase className="w-3 h-3 text-amber-400" />Profession</span>
                <span className="font-semibold text-slate-200 truncate max-w-[140px]">{member.profession || 'N/A'}</span>
              </div>
            </div>

            <div className="lg:col-span-2">
              <FamilySummaryCard relations={relations} loading={relLoading} onViewTree={() => setActiveTab('family-tree')} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="family-tree">
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <GitBranch className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">Family Tree — {member.fullName}</h2>
                  <p className="text-[10px] text-slate-500">{relations.length} linked family member(s)</p>
                </div>
              </div>
              {canAddLinks && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25"
                >
                  <UserPlus className="w-4 h-4" />
                  Link Family Member
                </button>
              )}
            </div>

            <FamilyTreeDiagram member={member} relations={relations} />

            {/* Linked members list — cards with photo, ID, CNIC, contact & relationship */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Linked Family Members</h3>
              {relLoading ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : relations.length === 0 ? (
                <p className="text-xs text-slate-500">No family members linked yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {relations.map((rel) => (
                    <FamilyMemberCard
                      key={rel.id}
                      relation={rel}
                      canRemove={canRemoveLinks}
                      onRemove={() => handleRemove(rel)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {canAddLinks && (
        <AddFamilyMemberModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          member={member}
          existingRelatedIds={relations.map((r) => r.relatedMemberId)}
          onLinked={loadRelations}
        />
      )}
    </div>
  );
};

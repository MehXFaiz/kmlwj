import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users, Phone, IdCard, Edit2, ArrowLeft, UserPlus, GitBranch,
  MapPin, Briefcase, DollarSign, Building, Receipt, PlusCircle,
  Printer, Calendar, CheckCircle, AlertTriangle, Wallet, CreditCard,
  Hash, X, Loader2,
} from 'lucide-react';
import { memberService } from '../services/memberService';
import { familyTreeService } from '../services/familyTreeService';
import { useAuthStore } from '../store/authStore';
import { useMemberStore } from '../store/memberStore';
import { useCoaStore } from '../store/coaStore';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import { showToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmationModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { FamilySummaryCard } from '../components/members/FamilyTree/FamilySummaryCard';
import { FamilyMemberCard } from '../components/members/FamilyTree/FamilyMemberCard';
import { FamilyTreeDiagram } from '../components/members/FamilyTree/FamilyTreeDiagram';
import { AddFamilyMemberModal } from '../components/members/FamilyTree/AddFamilyMemberModal';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isGenuineBankAccount } from '../utils/accountFilters';

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
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addCollection, postCollection } = useRevenueCollectionStore();
  const confirm = useConfirm();

  const [member, setMember] = useState(null);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [relLoading, setRelLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [printItem, setPrintItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Pay modal state
  const [payAmount, setPayAmount] = useState('500');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payBankAccountId, setPayBankAccountId] = useState('');
  const [payChequeNo, setPayChequeNo] = useState('');
  const [payRemarks, setPayRemarks] = useState('');

  const canAddLinks = canWriteFamilyLinks(role);
  const canRemoveLinks = canEditOrDelete;

  const loadMember = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memberService.getById(id);
      setMember(res.data);
      if (res.data?.outstandingBalance !== undefined) {
        setPayAmount(res.data.outstandingBalance > 0 ? String(res.data.outstandingBalance) : '500');
      }
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

  useEffect(() => {
    loadMember();
    loadRelations();
    fetchAccountsList();
  }, [loadMember, loadRelations, fetchAccountsList]);

  useEffect(() => {
    if (members.length === 0) fetchMembers();
  }, [members.length, fetchMembers]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(isGenuineBankAccount);
  }, [flatAccounts]);

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

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('Please enter a valid positive payment amount', 'error');
      return;
    }
    if ((payMethod === 'BANK' || payMethod === 'CHEQUE') && !payBankAccountId) {
      showToast('Please select a bank account', 'error');
      return;
    }

    setPaying(true);
    try {
      const payload = {
        category: 'Membership Fee',
        memberId: member.id,
        title: member.fullName,
        subTitle: member.memberNo,
        mobile: member.mobile,
        destination: member.address,
        amount: amountNum,
        eventDate: payDate,
        paymentMethod: payMethod,
        bankAccountId: payBankAccountId || null,
        chequeNumber: payChequeNo || null,
        remarks: payRemarks || `Membership fee payment for ${member.fullName} (${member.memberNo})`,
        postImmediately: true,
      };

      const res = await addCollection(payload);
      const savedId = res?.data?.id || res?.id;
      if (savedId) {
        try {
          await postCollection(savedId);
        } catch (postErr) {
          console.error('Auto post failed:', postErr);
        }
      }

      showToast('Fee payment recorded and posted to ledger successfully!', 'success');
      setShowPayModal(false);
      setPayRemarks('');
      await loadMember();
    } catch (err) {
      showToast(err.message || 'Failed to record fee payment', 'error');
    } finally {
      setPaying(false);
    }
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

  const collections = member.revenueCollections || [];
  const statusColor = member.paymentStatus === 'Paid' ? 'emerald' : (member.paymentStatus === 'Partially Paid' ? 'amber' : 'red');

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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">{member.fullName}</h1>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {member.memberNo || 'KML'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                statusColor === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : statusColor === 'amber'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {member.paymentStatus || 'Unpaid'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{member.fatherName ? `s/o ${member.fatherName}` : 'Member'} • {member.membershipType || 'Regular Member'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPayModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

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
      </div>

      {/* Tabs — Overview / Membership & Fees / Family Tree */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="membership-fees">
            <span className="inline-flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Membership &amp; Fees
            </span>
          </TabsTrigger>
          <TabsTrigger value="family-tree">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Family Tree
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
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
                <span className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" />Address</span>
                <span className="font-semibold text-slate-200 truncate max-w-[140px]" title={member.address}>{member.address || 'N/A'}</span>
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

        {/* Tab 2: Membership & Fees (Unified Management View) */}
        <TabsContent value="membership-fees">
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-400" /> Membership Type
                </span>
                <p className="text-lg font-bold text-slate-100 mt-1">{member.membershipType || 'Regular'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  DOI: {member.doi ? formatDateDDMMYYYY(member.doi) : 'N/A'}
                </p>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Standard Fee Rate
                </span>
                <p className="text-lg font-bold text-amber-400 mt-1">
                  Rs. {(member.feeAmount != null ? member.feeAmount : 500).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Annual / Period Fee</p>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Total Fees Paid
                </span>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  Rs. {(member.totalPaid || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{collections.length} Receipt(s)</p>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Outstanding Balance
                </span>
                <p className={`text-lg font-bold mt-1 ${member.outstandingBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  Rs. {(member.outstandingBalance || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Status: <strong className={statusColor === 'emerald' ? 'text-emerald-400' : (statusColor === 'amber' ? 'text-amber-400' : 'text-red-400')}>{member.paymentStatus}</strong></p>
              </div>
            </div>

            {/* Payment History Section */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-800/30">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Receipt className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Membership Fee Payment History</h3>
                    <p className="text-[11px] text-slate-400">All registered ledger receipts linked to {member.fullName}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPayModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Record Fee Payment</span>
                </button>
              </div>

              {collections.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  <p>No fee payments recorded for this member yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowPayModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium border border-slate-700 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Record First Payment
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase text-[10px] font-bold">
                        <th className="py-3 px-4">Receipt #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Remarks / Bank</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {collections.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-200">
                            #{item.receiptNo || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {item.eventDate ? formatDateDDMMYYYY(item.eventDate) : '—'}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-emerald-400">
                            Rs. {(Number(item.amount) || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-semibold">
                              {item.paymentMethod || 'CASH'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                              <CheckCircle className="w-3 h-3" /> {item.status || 'POSTED'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={item.remarks || item.bankAccount?.accountName}>
                            {item.remarks || (item.bankAccount ? `${item.bankAccount.accountName} (${item.bankAccount.glCode})` : '—')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setPrintItem(item)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                              title="Print Voucher Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Family Tree */}
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Link Family Member
                </button>
              )}
            </div>

            <FamilyTreeDiagram member={member} relations={relations} />

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

      {/* Record Fee Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Record Fee Payment</h3>
                  <p className="text-[11px] text-slate-400">{member.fullName} ({member.memberNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Payment Amount (PKR) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Payment Method *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                  >
                    <option value="CASH">Cash in Hand</option>
                    <option value="BANK">Bank Transfer / Online</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {payMethod !== 'CASH' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Bank Account *</label>
                  <select
                    required
                    value={payBankAccountId}
                    onChange={(e) => setPayBankAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                  >
                    <option value="">Select Bank Account</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.glCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {payMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cheque Number</label>
                  <input
                    value={payChequeNo}
                    onChange={(e) => setPayChequeNo(e.target.value)}
                    placeholder="e.g. CHQ-981240"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Remarks / Note</label>
                <input
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  placeholder="e.g. Annual membership fee 2026-2027"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {paying ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Posting...</span></>
                  ) : (
                    <><CheckCircle className="w-3.5 h-3.5" /><span>Post to Ledger</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Tree Modal */}
      {canAddLinks && (
        <AddFamilyMemberModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          member={member}
          existingRelatedIds={relations.map((r) => r.relatedMemberId)}
          onLinked={loadRelations}
        />
      )}

      {/* Voucher Slip Modal */}
      {printItem && (
        <VoucherSlipModal
          isOpen={!!printItem}
          onClose={() => setPrintItem(null)}
          voucher={printItem}
          type="BR"
          title="Membership Fee Receipt"
        />
      )}
    </div>
  );
};

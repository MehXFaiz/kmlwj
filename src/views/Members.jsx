import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMemberStore } from '../store/memberStore';
import { useCoaStore } from '../store/coaStore';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import {
  Users, UserPlus, Search, Edit2, Trash2, Phone, MapPin,
  Briefcase, CheckCircle, ArrowRight, Building, AlertTriangle, CreditCard,
  GitBranch, DollarSign, Wallet, PlusCircle, X, Loader2
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { useAuthStore } from '../store/authStore';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { isGenuineBankAccount } from '../utils/accountFilters';

export const Members = () => {
  const navigate = useNavigate();
  const { members, fetchMembers, deleteMember, bulkDeleteMembers, loading } = useMemberStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addCollection, postCollection } = useRevenueCollectionStore();
  const { canEditOrDelete } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick Pay Modal State
  const [payMember, setPayMember] = useState(null);
  const [payAmount, setPayAmount] = useState('500');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payBankAccountId, setPayBankAccountId] = useState('');
  const [payChequeNo, setPayChequeNo] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchAccountsList();
  }, [fetchMembers, fetchAccountsList]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(isGenuineBankAccount);
  }, [flatAccounts]);

  const metrics = useMemo(() => {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    for (const m of members) {
      totalCollected += (Number(m.totalPaid) || 0);
      totalOutstanding += (Number(m.outstandingBalance) || 0);
      if (m.paymentStatus === 'Paid') paidCount++;
      else if (m.paymentStatus === 'Partially Paid') partialCount++;
      else unpaidCount++;
    }

    return {
      totalCollected,
      totalOutstanding,
      paidCount,
      partialCount,
      unpaidCount,
    };
  }, [members]);

  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      (m.fullName && m.fullName.toLowerCase().includes(term)) ||
      (m.memberNo && m.memberNo.toLowerCase().includes(term)) ||
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

  const openQuickPay = (m, e) => {
    e.stopPropagation();
    setPayMember(m);
    setPayAmount(m.outstandingBalance > 0 ? String(m.outstandingBalance) : '500');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('CASH');
    setPayBankAccountId('');
    setPayChequeNo('');
    setPayRemarks(`Membership fee payment for ${m.fullName} (${m.memberNo})`);
  };

  const handleRecordQuickPayment = async (e) => {
    e.preventDefault();
    if (!payMember) return;
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
        memberId: payMember.id,
        title: payMember.fullName,
        subTitle: payMember.memberNo,
        mobile: payMember.mobile,
        destination: payMember.address,
        amount: amountNum,
        eventDate: payDate,
        paymentMethod: payMethod,
        bankAccountId: payBankAccountId || null,
        chequeNumber: payChequeNo || null,
        remarks: payRemarks || `Membership fee payment for ${payMember.fullName} (${payMember.memberNo})`,
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
      setPayMember(null);
      await fetchMembers();
    } catch (err) {
      showToast(err.message || 'Failed to record fee payment', 'error');
    } finally {
      setPaying(false);
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
              <h1 className="text-xl font-bold text-slate-100">Membership Management</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                {members.length} Registered Members
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Kutchi Muslim Loharwada Jangadh • Unified Member Directory &amp; Fee Ledger
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Total Members
          </span>
          <p className="text-xl font-bold text-slate-100 mt-1">{members.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Active Census Records</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Fees Collected
          </span>
          <p className="text-xl font-bold text-emerald-400 mt-1">Rs. {metrics.totalCollected.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{metrics.paidCount} Paid in full</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Outstanding Balance
          </span>
          <p className={`text-xl font-bold mt-1 ${metrics.totalOutstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            Rs. {metrics.totalOutstanding.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{metrics.unpaidCount} Unpaid, {metrics.partialCount} Partial</p>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Payment Compliance
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-slate-100">
              {members.length > 0 ? Math.round((metrics.paidCount / members.length) * 100) : 0}%
            </span>
            <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${members.length > 0 ? Math.round((metrics.paidCount / members.length) * 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Compliant Community Share</p>
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
            placeholder="Search by Name, Member ID, CNIC, Mobile, Gham..."
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
                : 'Begin building the unified community directory by registering members into the system.'}
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
            {filteredMembers.map((m) => {
              const statusColor = m.paymentStatus === 'Paid' ? 'emerald' : (m.paymentStatus === 'Partially Paid' ? 'amber' : 'red');
              return (
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
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors leading-tight truncate">
                              {m.fullName}
                            </h4>
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              {m.memberNo || 'KML'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {m.fatherName ? `s/o ${m.fatherName}` : 'Member'} • {m.membershipType || 'Regular'}
                          </p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase shrink-0 ${
                        statusColor === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : statusColor === 'amber'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {m.paymentStatus || 'Unpaid'}
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
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Fees Paid / Due
                        </span>
                        <span className="font-semibold text-slate-200">
                          Rs. {(m.totalPaid || 0).toLocaleString()} / <span className="text-amber-400">Rs. {(m.feeAmount != null ? m.feeAmount : 500).toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400" /> Gham / City
                        </span>
                        <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                          {m.ghamName || m.city || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      DOI: {m.doi ? formatDateDDMMYYYY(m.doi) : (m.createdAt ? formatDateDDMMYYYY(m.createdAt) : 'N/A')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => openQuickPay(m, e)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
                        title="Record Fee Payment"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        to={`/members/${m.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Member Profile &amp; Fees"
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
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Delete Member Record</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this member? All linked relationships will be detached. Financial receipts remain preserved in the ledger.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-md shadow-red-600/20"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Bulk Delete Members</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-200">{selectedIds.length}</strong> selected members?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete {selectedIds.length} Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Pay Modal */}
      {payMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Record Fee Payment</h3>
                  <p className="text-[11px] text-slate-400">{payMember.fullName} ({payMember.memberNo})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayMember(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordQuickPayment} className="p-5 space-y-4">
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
                  placeholder="e.g. Annual membership fee"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayMember(null)}
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

    </div>
  );
};

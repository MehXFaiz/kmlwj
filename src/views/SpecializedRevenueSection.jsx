import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, AlertTriangle, CheckCircle, Trash2, X, DollarSign, Calendar, Users, Building, Edit2, CheckCircle2, ChevronDown, LayoutGrid, Table as TableIcon, MapPin, Tag, Phone, Bus, Heart, User, Hash, RotateCcw } from 'lucide-react';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import { useAuthStore } from '../store/authStore';
import { useConfirmStore } from '../store/confirmStore';
import { useCoaStore } from '../store/coaStore';
import { useMemberStore } from '../store/memberStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { paymentMethodLabel } from '../constants/paymentMethods';

export const SpecializedRevenueSection = ({
  category = 'Zakat',
  title = 'Zakat Collection',
  desc = 'Manage Zakat contributions, donor records, and automatic general ledger postings',
  titleLabel = 'Donor Name',
  subTitleLabel = 'CNIC / ID',
  dateLabel = 'Collection Date',
  showQty = false,
  qtyLabel = 'Head Count',
  showRate = false,
  rateLabel = 'Rate per Head',
  showDest = false,
  destLabel = 'Destination'
}) => {
  const { t } = useTranslation();
  const { collections, loading, fetchCollections, addCollection, updateCollection, postCollection, revertCollection, deleteCollection, bulkDeleteCollections } = useRevenueCollectionStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { members, fetchMembers } = useMemberStore();

  const isMembershipFee = category === 'Membership Fee';

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const [printItem, setPrintItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getBasePath = () => {
    if (category === 'Bus Booking') return '/bus-bookings';
    if (category === 'Zakat') return '/zakat';
    if (category === 'Fitra') return '/fitra';
    return '/membership-fees';
  };

  useEffect(() => {
    fetchCollections(category);
    fetchAccountsList();
    if (isMembershipFee) fetchMembers();
  }, [category]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => (a.name || '').toLowerCase().includes('bank') || (a.type || '').toLowerCase().includes('bank'));
  }, [flatAccounts]);

  const handlePost = async (id) => {
    try {
      await postCollection(id);
      showToast(`${category} posted to ledger successfully!`, 'success');
    } catch (err) {
      showToast(err.message || `Failed to post ${category}`, 'error');
    }
  };

  const handleRevert = async (id) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      type: 'warning',
      title: `Revert ${category} Record?`,
      description: `Are you sure you want to revert this ${category} record? Its journal entries will be deleted and status reset to Pending Post.`,
      details: [
        'Journal entries will be deleted.',
        'Record status will reset to Pending Post.',
      ],
      confirmLabel: 'Revert Record',
      cancelLabel: 'Cancel',
      loadingLabel: 'Reverting...',
      successMessage: `${category} reverted from ledger successfully!`,
      action: async () => {
        await revertCollection(id);
      },
    });

    if (confirmed) {
      showToast(`${category} reverted from ledger successfully!`, 'success');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      type: 'danger',
      isDangerous: true,
      title: `Delete ${category} Record?`,
      description: `Are you sure you want to delete this ${category} record? If posted, its journal entries will be automatically reversed.`,
      details: [
        `${category} record will be permanently deleted.`,
        'If posted, accounting journal entries will be reversed.',
        'This action cannot be undone.',
      ],
      confirmLabel: 'Delete Record',
      cancelLabel: 'Cancel',
      loadingLabel: 'Deleting...',
      successMessage: 'Record deleted successfully.',
      action: async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        await deleteCollection(id);
        setSelectedIds(prev => prev.filter(item => item !== id));
      },
    });

    if (confirmed) {
      showToast('Record deleted successfully', 'success');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(b => b.id));
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
    const res = await bulkDeleteCollections(selectedIds);
    setIsDeleting(false);
    setShowBulkConfirm(false);
    if (res.success) {
      showToast(`${selectedIds.length} record(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } else {
      showToast(res.error || 'Failed to bulk delete records', 'error');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return collections.filter(c => 
      c.title?.toLowerCase().includes(q) ||
      c.subTitle?.toLowerCase().includes(q) ||
      c.mobile?.includes(search) ||
      c.receiptNo?.toString().includes(search)
    );
  }, [collections, search]);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filtered]);

  return (
    <DashboardLayout breadcrumbs={['Revenue & Collections', title]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{title}</h1>
            <p className="text-sm text-slate-400 mt-1">{desc}</p>
          </div>
          <div className="flex items-center gap-3">
            {canEditOrDelete && selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-bold transition-all"
              >
                <Trash2 className="h-4 w-4" />
                Bulk Delete ({selectedIds.length})
              </button>
            )}
            <Link
              to={`${getBasePath()}/new`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-900/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New {category} Entry
            </Link>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-md w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
              <div className="text-xs sm:text-sm font-bold text-slate-300">
                Total Amount: <span className="text-emerald-400 font-extrabold">Rs. {totalAmount.toLocaleString()}</span> ({filtered.length} records)
              </div>
              <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" /> Table
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading {title.toLowerCase()}...</span>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="p-5 bg-slate-950/20">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No {title.toLowerCase()} found. Click 'New {category} Entry' to add one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map((item) => {
                    const isConfirmed = item.status === 'Confirmed';
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/95 to-slate-900/60 p-5 shadow-xl hover:shadow-2xl hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        <div>
                          <div className="flex items-start justify-between gap-2 relative z-10">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {canEditOrDelete && (
                                <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={(e) => handleSelectOne(item.id, e)}
                                    className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                                  />
                                </div>
                              )}
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base shadow-inner shrink-0 group-hover:scale-105 transition-transform">
                                {item.title ? item.title.charAt(0).toUpperCase() : <User className="w-4 h-4 text-amber-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors leading-tight tracking-tight truncate">
                                  {item.title || 'Unknown'}
                                </h4>
                                <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1.5 truncate">
                                  {item.mobile ? (
                                    <>
                                      <Phone className="w-3 h-3 text-amber-400/80 shrink-0" /> <span className="truncate">{item.mobile}</span>
                                    </>
                                  ) : (
                                    <>
                                      <User className="w-3 h-3 text-amber-400/80 shrink-0" /> <span className="truncate">{category} Record</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide shrink-0 whitespace-nowrap ${
                              isConfirmed
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isConfirmed ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 shrink-0" /> PENDING POST
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 shrink-0" /> POSTED
                                </>
                              )}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 px-4 divide-y divide-slate-800/60 my-4 shadow-inner relative z-10">
                            <div className="flex items-center justify-between py-2.5">
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> TOTAL AMOUNT
                              </span>
                              <span className="font-extrabold text-emerald-400 text-base">
                                Rs. {(Number(item.amount) || 0).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2.5">
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-amber-400" /> RECEIPT #
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-200">
                                #{item.receiptNo || '—'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-2.5">
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-400" /> {dateLabel}
                              </span>
                              <span className="font-medium text-slate-200 text-xs">
                                {item.eventDate ? new Date(item.eventDate).toLocaleDateString() : '—'}
                              </span>
                            </div>

                            {subTitleLabel && (
                              <div className="flex items-center justify-between py-2.5">
                                <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5 truncate pr-2">
                                  <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {subTitleLabel}
                                </span>
                                <span className="font-mono text-xs text-slate-300 font-medium truncate max-w-[150px]" title={item.subTitle}>
                                  {item.subTitle || '—'}
                                </span>
                              </div>
                            )}

                            {showQty && (
                              <div className="flex items-center justify-between py-2.5">
                                <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-amber-400" /> {qtyLabel}
                                </span>
                                <span className="font-bold text-slate-300 text-xs">
                                  {item.quantity || 1}
                                </span>
                              </div>
                            )}

                            {showRate && (
                              <div className="flex items-center justify-between py-2.5">
                                <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> {rateLabel}
                                </span>
                                <span className="text-slate-300 text-xs font-medium">
                                  Rs. {item.rate?.toLocaleString() || '—'}
                                </span>
                              </div>
                            )}

                            {showDest && (
                              <div className="flex items-center justify-between py-2.5">
                                <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                                  <Building className="w-3.5 h-3.5 text-amber-400" /> {destLabel}
                                </span>
                                <span className="font-medium text-slate-300 text-xs truncate max-w-[150px]" title={item.destination}>
                                  {item.destination || '—'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2 relative z-10">
                          <span className="text-xs text-slate-500 font-medium truncate max-w-[140px]" title={item.remarks || paymentMethodLabel(item.paymentMethod)}>
                            {paymentMethodLabel(item.paymentMethod)}{item.remarks ? ` • ${item.remarks}` : ''}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isConfirmed && canPostToLedger && (
                              <button
                                onClick={() => handlePost(item.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
                                title="Post to Ledger"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Post
                              </button>
                            )}
                            {!isConfirmed && canPostToLedger && (
                              <button
                                onClick={() => handleRevert(item.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                                title="Revert from Ledger"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Revert
                              </button>
                            )}
                            <button
                              onClick={() => setPrintItem(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors inline-flex border border-slate-800 hover:border-slate-700"
                              title="Print Receipt"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {canEditOrDelete && (
                              <button
                                onClick={() => navigate(`${getBasePath()}/edit/${item.id}`)}
                                className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors inline-flex border border-slate-800 hover:border-amber-500/30"
                                title="Edit Record"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {canEditOrDelete && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors inline-flex border border-slate-800 hover:border-red-500/30"
                                title="Delete Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {canEditOrDelete && (
                      <th className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">Receipt #</th>
                    <th className="px-6 py-4">{titleLabel}</th>
                    {subTitleLabel && <th className="px-6 py-4">{subTitleLabel}</th>}
                    <th className="px-6 py-4">{dateLabel}</th>
                    {showQty && <th className="px-6 py-4">{qtyLabel}</th>}
                    {showRate && <th className="px-6 py-4">{rateLabel}</th>}
                    {showDest && <th className="px-6 py-4">{destLabel}</th>}
                    <th className="px-6 py-4">Total Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                      {canEditOrDelete && (
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => handleSelectOne(item.id, e)}
                            className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">#{item.receiptNo}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">{item.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">{item.mobile || 'N/A'}</div>
                      </td>
                      {subTitleLabel && (
                        <td className="px-6 py-4 font-mono text-xs text-slate-300">{item.subTitle || '—'}</td>
                      )}
                      <td className="px-6 py-4">
                        <div className="font-medium">{item.eventDate ? new Date(item.eventDate).toLocaleDateString() : '—'}</div>
                      </td>
                      {showQty && <td className="px-6 py-4 font-bold text-slate-300">{item.quantity || 1}</td>}
                      {showRate && <td className="px-6 py-4 text-slate-400">Rs. {item.rate?.toLocaleString() || '—'}</td>}
                      {showDest && <td className="px-6 py-4 font-medium text-slate-300">{item.destination || '—'}</td>}
                      <td className="px-6 py-4 font-bold text-emerald-400">Rs. {item.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {item.status === 'Confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Pending Post
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="h-3 w-3" /> Posted
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {item.status === 'Confirmed' && canPostToLedger && (
                          <button onClick={() => handlePost(item.id)}
                            className="p-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/40 rounded transition-colors inline-flex"
                            title="Post to Ledger">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {item.status !== 'Confirmed' && canPostToLedger && (
                          <button onClick={() => handleRevert(item.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors inline-flex"
                            title="Revert from Ledger">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setPrintItem(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors inline-flex"
                          title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </button>
                        {canEditOrDelete && (
                          <button onClick={() => navigate(`${getBasePath()}/edit/${item.id}`)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors inline-flex ml-1"
                            title="Edit Record">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canEditOrDelete && (
                          <button onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors inline-flex ml-1"
                            title="Delete Record">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-slate-500 text-sm">
                        No {title.toLowerCase()} found. Click 'New {category} Entry' to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Delete Confirm Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Bulk Deletion</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected records? 
              If any of these records are posted, their associated journal entries will be automatically reversed in the General Ledger.
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
                    Delete {selectedIds.length} Records
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal using classic slip design */}
      {printItem && (
        <VoucherSlipModal
          isOpen={true}
          onClose={() => setPrintItem(null)}
          title={`${printItem.category} VOUCHER`}
          voucherNo={printItem.receiptNo || printItem.id?.slice(0, 8)?.toUpperCase()}
          fileNo={printItem.subTitle || ''}
          date={printItem.eventDate || printItem.createdAt}
          name={printItem.title}
          fatherName={printItem.fatherName || printItem.member?.fatherName || ''}
          gham={printItem.gham || printItem.member?.gham || ''}
          address={printItem.destination || printItem.remarks || ''}
          paymentMethod={printItem.paymentMethod}
          accountName={`${printItem.category} Collection`}
          particulars={showQty ? `${printItem.category} — ${printItem.quantity} ${qtyLabel} @ Rs. ${printItem.rate?.toLocaleString()}` : `${printItem.category} Collection${printItem.remarks ? ` - ${printItem.remarks}` : ''}`}
          amount={printItem.amount}
          preparedBy={printItem.createdBy?.fullName || 'Operator'}
          payeeLabel="Donor / Payer Sign"
          partyLabel="Paid By"
        />
      )}
    </DashboardLayout>
  );
};

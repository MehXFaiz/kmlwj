import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, AlertTriangle, CheckCircle, Trash2, X, DollarSign, Calendar, Users, Building, Edit2, CheckCircle2, ChevronDown } from 'lucide-react';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import { useAuthStore } from '../store/authStore';
import { useCoaStore } from '../store/coaStore';
import { useMemberStore } from '../store/memberStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';

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
  const { collections, loading, fetchCollections, addCollection, updateCollection, postCollection, deleteCollection, bulkDeleteCollections } = useRevenueCollectionStore();
  const { canEditOrDelete } = useAuthStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { members, fetchMembers } = useMemberStore();

  const isMembershipFee = category === 'Membership Fee';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [printItem, setPrintItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Member dropdown state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredMembersList = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 30);
    const q = memberSearch.toLowerCase();
    return members.filter(m =>
      (m.fullName && m.fullName.toLowerCase().includes(q)) ||
      (m.cnic && m.cnic.includes(q)) ||
      (m.mobile && m.mobile.includes(q))
    ).slice(0, 20);
  }, [members, memberSearch]);

  const handleSelectMember = (member) => {
    setForm(prev => ({
      ...prev,
      title: member.fullName || '',
      subTitle: member.cnic || '',
      mobile: member.mobile || ''
    }));
    setMemberSearch(member.fullName || '');
    setMemberDropdownOpen(false);
  };

  // Form State
  const [form, setForm] = useState({
    title: '',
    subTitle: '',
    mobile: '',
    eventDate: new Date().toISOString().split('T')[0],
    quantity: showQty ? 1 : '',
    rate: showRate ? 300 : '',
    destination: '',
    amount: '',
    paymentMethod: 'CASH',
    bankAccountId: '',
    chequeNumber: '',
    remarks: ''
  });

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

  const handleDelete = async (id) => {
    if (window.confirm(`Are you sure you want to delete this ${category} record? If posted, its journal entries will be automatically reversed.`)) {
      try {
        await new Promise(resolve => setTimeout(resolve, 15));
        await deleteCollection(id);
        setSelectedIds(prev => prev.filter(item => item !== id));
        showToast('Record deleted successfully', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to delete record', 'error');
      }
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

  const handleEditClick = (item) => {
    setEditingItem(item);
    setMemberSearch(item.title || '');
    setForm({
      title: item.title || '',
      subTitle: item.subTitle || '',
      mobile: item.mobile || '',
      eventDate: item.eventDate ? new Date(item.eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      quantity: item.quantity !== null && item.quantity !== undefined ? item.quantity : (showQty ? 1 : ''),
      rate: item.rate !== null && item.rate !== undefined ? item.rate : (showRate ? 300 : ''),
      destination: item.destination || '',
      amount: item.amount !== null && item.amount !== undefined ? item.amount.toString() : '',
      paymentMethod: item.paymentMethod || 'CASH',
      bankAccountId: item.bankAccountId || '',
      chequeNumber: item.chequeNumber || '',
      remarks: item.remarks || ''
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setMemberSearch('');
    setMemberDropdownOpen(false);
    setForm({
      title: '',
      subTitle: '',
      mobile: '',
      eventDate: new Date().toISOString().split('T')[0],
      quantity: showQty ? 1 : '',
      rate: showRate ? 300 : '',
      destination: '',
      amount: '',
      paymentMethod: 'CASH',
      bankAccountId: '',
      chequeNumber: '',
      remarks: ''
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }
    if (form.title && !/^[a-zA-Z0-9\s.-]{3,50}$/.test(form.title)) {
      showToast('Title must contain only letters, numbers, spaces, hyphens, and dots (3-50 chars).', 'warning');
      return;
    }
    if (form.subTitle && !/^[a-zA-Z0-9\s.-]{3,50}$/.test(form.subTitle)) {
      showToast('Sub-title must contain only letters, numbers, spaces, hyphens, and dots (3-50 chars).', 'warning');
      return;
    }
    if (form.mobile && !/^((\+92|92|0)?3[0-9]{2}-?[0-9]{7})$/.test(form.mobile)) {
      showToast('Invalid mobile number. E.g. 0300-1234567', 'warning');
      return;
    }
    if (form.destination && !/^[a-zA-Z0-9\s.,#\/-]{3,50}$/.test(form.destination)) {
      showToast('Destination contains invalid characters.', 'warning');
      return;
    }
    if (form.chequeNumber && !/^[0-9]{6,20}$/.test(form.chequeNumber)) {
      showToast('Cheque number must be between 6 and 20 digits.', 'warning');
      return;
    }
    if (form.amount && !/^[1-9]\d*(\.\d{1,2})?$/.test(form.amount)) {
      showToast('Amount must be a positive number with up to 2 decimal places.', 'warning');
      return;
    }
    try {
      if (editingItem) {
        await updateCollection(editingItem.id, {
          ...form,
          category,
          amount: parseFloat(form.amount) || 0,
          quantity: form.quantity ? parseInt(form.quantity, 10) : null,
          rate: form.rate ? parseFloat(form.rate) : null,
        });
        showToast(`${category} record updated successfully`, 'success');
      } else {
        await addCollection({
          ...form,
          category,
          amount: parseFloat(form.amount) || 0,
          quantity: form.quantity ? parseInt(form.quantity, 10) : null,
          rate: form.rate ? parseFloat(form.rate) : null,
        });
        showToast(`${category} record created successfully`, 'success');
      }
      handleCloseModal();
    } catch (err) {
      showToast(err.message || `Failed to save ${category}`, 'error');
    }
  };

  const handleQtyOrRateChange = (qty, rate) => {
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    if (showQty && showRate && q > 0 && r > 0) {
      setForm(prev => ({ ...prev, quantity: qty, rate: rate, amount: (q * r).toString() }));
    } else {
      setForm(prev => ({ ...prev, quantity: qty, rate: rate }));
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
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New {category} Entry
            </button>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800/80">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading {title.toLowerCase()}...</span>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {canEditOrDelete && (
                      <th className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
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
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
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
                        {item.status === 'Confirmed' && (
                          <button onClick={() => handlePost(item.id)}
                            className="p-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/40 rounded transition-colors inline-flex"
                            title="Post to Ledger">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setPrintItem(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors inline-flex"
                          title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </button>
                        {canEditOrDelete && (
                          <button onClick={() => handleEditClick(item)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition-colors inline-flex ml-1"
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
            )}
          </div>
        </div>
      </div>

      {/* New Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-100">{editingItem ? `Edit ${category} Record` : `Add New ${category} Record`}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{titleLabel} *</label>
                {isMembershipFee ? (
                  <div className="relative" ref={memberDropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      <input
                        value={memberSearch}
                        onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true); setForm(prev => ({ ...prev, title: e.target.value })); }}
                        onFocus={() => setMemberDropdownOpen(true)}
                        placeholder="Search and select a member..."
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                    </div>
                    {memberDropdownOpen && filteredMembersList.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                        {filteredMembersList.map(member => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleSelectMember(member)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-500/10 flex items-center gap-3 transition-colors border-b border-slate-800/60 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                              {member.fullName?.charAt(0) || 'M'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-200 truncate">{member.fullName}</p>
                              <p className="text-xs text-slate-500 truncate">{member.cnic || member.mobile || 'No ID'}</p>
                            </div>
                          </button>
                        ))}
                        {members.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-500 text-center">No members registered yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder={`Enter ${titleLabel.toLowerCase()}...`}
                    pattern="^[a-zA-Z0-9\s.-]{3,50}$" title="Letters, numbers, spaces, hyphens, and dots (3-50 characters)"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                )}
              </div>

              {subTitleLabel && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{subTitleLabel}</label>
                  <input value={form.subTitle} onChange={e => setForm({ ...form, subTitle: e.target.value })}
                    placeholder={`Enter ${subTitleLabel.toLowerCase()}...`}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Mobile Phone</label>
                  <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{dateLabel}</label>
                  <input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              {(showQty || showRate) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {showQty && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{qtyLabel}</label>
                      <input type="number" min="1" value={form.quantity} onChange={e => handleQtyOrRateChange(e.target.value, form.rate)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                  )}
                  {showRate && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{rateLabel} (PKR)</label>
                      <input type="number" min="0" value={form.rate} onChange={e => handleQtyOrRateChange(form.quantity, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                  )}
                </div>
              )}

              {showDest && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{destLabel}</label>
                  <input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })}
                    placeholder="e.g. Jamia Mosque to Airport"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Total Amount (PKR) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">PKR</span>
                  <input required type="text" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    pattern="^[1-9]\d*(\.\d{1,2})?$" title="Positive number with up to 2 decimal places"
                    className="w-full pl-11 pr-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-emerald-400 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Payment Method *</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Bank Account *</label>
                    <select required value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                      <option value="">Select Bank</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.accountName} ({b.glCode})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {form.paymentMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Cheque Number</label>
                  <input value={form.chequeNumber} onChange={e => setForm({ ...form, chequeNumber: e.target.value })}
                    placeholder="CHQ-00123"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Remarks / Memo</label>
                <textarea rows="2" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Optional notes or details..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all">
                  Cancel
                </button>
                <button type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
                  {editingItem ? 'Update Entry' : `Save ${category}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Print Modal */}
      {printItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div id="print-receipt" className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 print:p-0 print:shadow-none print:border-none">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-receipt, #print-receipt * {
                  visibility: visible !important;
                }
                #print-receipt {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
              }
            `}</style>
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <h3 className="font-bold text-base">Official Receipt Preview</h3>
              <button onClick={() => setPrintItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="text-center space-y-1">
              <h2 className="font-extrabold text-lg uppercase tracking-wider">{printItem.category} RECEIPT</h2>
              <p className="text-xs text-slate-500">Kutchi Muslim Loharwada Welfare Jamaat</p>
              <div className="font-mono text-xs font-bold pt-1">Receipt No: #{printItem.receiptNo}</div>
            </div>

            <div className="border-t border-b py-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{titleLabel}:</span><span className="font-bold">{printItem.title}</span></div>
              {subTitleLabel && <div className="flex justify-between"><span className="text-slate-500">{subTitleLabel}:</span><span className="font-mono">{printItem.subTitle || '—'}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Date:</span><span>{new Date(printItem.eventDate || printItem.createdAt).toLocaleDateString()}</span></div>
              {showQty && <div className="flex justify-between"><span className="text-slate-500">{qtyLabel}:</span><span className="font-bold">{printItem.quantity}</span></div>}
              {showRate && <div className="flex justify-between"><span className="text-slate-500">{rateLabel}:</span><span>Rs. {printItem.rate?.toLocaleString()}</span></div>}
              {showDest && <div className="flex justify-between"><span className="text-slate-500">{destLabel}:</span><span>{printItem.destination}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Payment Method:</span><span className="font-bold">{printItem.paymentMethod}</span></div>
              <div className="flex justify-between pt-2 border-t font-extrabold text-base"><span className="text-slate-700">Total Amount:</span><span className="text-emerald-600">Rs. {printItem.amount.toLocaleString()}</span></div>
            </div>

            {printItem.remarks && (
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border">
                <strong>Remarks:</strong> {printItem.remarks}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
              <button onClick={() => setPrintItem(null)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
                Close
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md">
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

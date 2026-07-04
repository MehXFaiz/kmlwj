import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import { useCoaStore } from '../store/coaStore';
import { useMemberStore } from '../store/memberStore';
import {
  DollarSign, Building, Bus, Users, ChevronLeft, CheckCircle, AlertCircle, Save, Search, ChevronDown
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const SpecializedRevenueForm = ({
  category = 'Membership Fee',
  title = 'Membership Fee Collection',
  desc = 'Manage member fee contributions and annual renewals',
  titleLabel = 'Member Name',
  subTitleLabel = 'Membership ID / CNIC',
  dateLabel = 'Fee Date',
  showQty = false,
  qtyLabel = 'Head Count',
  showRate = false,
  rateLabel = 'Fee Rate',
  showDest = false,
  destLabel = 'Destination',
  backPath = '/membership-fees'
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine category config based on pathname if not explicitly passed
  const isBusBooking = location.pathname.includes('bus-booking');
  const activeCategory = isBusBooking ? 'Bus Booking' : category;
  const activeTitle = isBusBooking ? 'Bus Booking Receipt' : title;
  const activeDesc = isBusBooking ? 'Manage Jamia bus reservations, trip schedules, and ledger receipts' : desc;
  const activeTitleLabel = isBusBooking ? 'Booker Name' : titleLabel;
  const activeSubTitleLabel = isBusBooking ? 'Bus / Vehicle Number' : subTitleLabel;
  const activeDateLabel = isBusBooking ? 'Trip Date' : dateLabel;
  const activeShowDest = isBusBooking ? true : showDest;
  const activeDestLabel = isBusBooking ? 'Trip Destination' : destLabel;
  const activeShowQty = isBusBooking ? false : showQty;
  const activeQtyLabel = isBusBooking ? '' : qtyLabel;
  const activeShowRate = isBusBooking ? false : showRate;
  const activeRateLabel = isBusBooking ? '' : rateLabel;
  const activeBackPath = isBusBooking ? '/bus-bookings' : backPath;

  const { collections, fetchCollections, addCollection, updateCollection, postCollection } = useRevenueCollectionStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { members, fetchMembers } = useMemberStore();

  const isMembershipFee = activeCategory === 'Membership Fee';

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Member dropdown state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberDropdownRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    subTitle: '',
    mobile: '',
    eventDate: new Date().toISOString().split('T')[0],
    quantity: activeShowQty ? 1 : '',
    rate: activeShowRate ? (isMembershipFee ? 500 : 300) : '',
    destination: '',
    amount: '',
    paymentMethod: 'CASH',
    bankAccountId: '',
    chequeNumber: '',
    remarks: '',
    postImmediately: true
  });

  useEffect(() => {
    fetchCollections(activeCategory);
    fetchAccountsList();
    if (isMembershipFee) fetchMembers();
  }, [activeCategory, fetchCollections, fetchAccountsList, fetchMembers, isMembershipFee]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (id && collections.length > 0) {
      const existing = collections.find(c => c.id === id);
      if (existing) {
        setForm({
          title: existing.title || '',
          subTitle: existing.subTitle || '',
          mobile: existing.mobile || '',
          eventDate: existing.eventDate ? new Date(existing.eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          quantity: existing.quantity || '',
          rate: existing.rate || '',
          destination: existing.destination || '',
          amount: existing.amount || '',
          paymentMethod: existing.paymentMethod || 'CASH',
          bankAccountId: existing.bankAccountId || '',
          chequeNumber: existing.chequeNumber || '',
          remarks: existing.remarks || '',
          postImmediately: existing.status === 'POSTED'
        });
        if (isMembershipFee && existing.title) {
          setMemberSearch(existing.title);
        }
      }
    }
  }, [id, collections, isMembershipFee]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a =>
      (a.name || a.accountName || '').toLowerCase().includes('bank') ||
      (a.type || '').toLowerCase().includes('bank') ||
      (a.name || a.accountName || '').toLowerCase().includes('cheque')
    );
  }, [flatAccounts]);

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

  // Auto-calculate amount if quantity & rate are shown
  const handleQtyRateChange = (field, val) => {
    const updated = { ...form, [field]: val };
    if (activeShowQty && activeShowRate) {
      const q = parseFloat(field === 'quantity' ? val : updated.quantity) || 0;
      const r = parseFloat(field === 'rate' ? val : updated.rate) || 0;
      if (q > 0 && r > 0) {
        updated.amount = q * r;
      }
    }
    setForm(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setToast({ type: 'error', message: `${activeTitleLabel} is required` });
      return;
    }
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) {
      setToast({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        category: activeCategory,
        amount: Number(form.amount),
        quantity: form.quantity ? Number(form.quantity) : null,
        rate: form.rate ? Number(form.rate) : null
      };

      let res;
      if (id) {
        res = await updateCollection(id, payload);
        setToast({ type: 'success', message: `${activeCategory} record updated successfully!` });
      } else {
        res = await addCollection(payload);
        setToast({ type: 'success', message: `${activeCategory} record created successfully!` });
      }

      const savedId = id || (res?.data?.id || res?.id);
      if (savedId && form.postImmediately && (!id || form.postImmediately)) {
        try {
          await postCollection(savedId);
        } catch (postErr) {
          console.error('Auto post failed:', postErr);
        }
      }

      setTimeout(() => navigate(activeBackPath), 1500);
    } catch (err) {
      setToast({ type: 'error', message: err.message || `Failed to save ${activeCategory} record` });
      setLoading(false);
    }
  };

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';
  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all font-medium';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all ${
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to={activeBackPath} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? `Edit ${activeCategory} Record` : `New ${activeTitle}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{activeDesc}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
          {id ? 'Editing Record' : 'New Entry'}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Info */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-indigo-500/5 rounded-2xl border border-indigo-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                {isBusBooking ? <Bus className="w-4 h-4 text-indigo-400" /> : <Building className="w-4 h-4 text-indigo-400" />}
                <h3 className="text-sm font-semibold text-indigo-300">{activeCategory} Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Dedicated Revenue Ledger</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Tracks Contributor History</span>
                </div>
              </div>
              <div className="border-t border-indigo-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory.
              </p>
            </div>
          </div>

          {/* RIGHT: Form Cards */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Card 01: Core Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">{activeCategory} Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Member search dropdown if Membership Fee */}
                {isMembershipFee ? (
                  <div className="sm:col-span-2 relative" ref={memberDropdownRef}>
                    <label className={labelClass}>{activeTitleLabel} *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={memberSearch}
                        onChange={e => {
                          setMemberSearch(e.target.value);
                          setForm({ ...form, title: e.target.value });
                          setMemberDropdownOpen(true);
                        }}
                        onFocus={() => setMemberDropdownOpen(true)}
                        placeholder="Search & select member by name, CNIC or phone..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all font-medium"
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                    </div>

                    {memberDropdownOpen && (
                      <div className="absolute z-[70] left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                        {filteredMembersList.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">No members matched</div>
                        ) : (
                          filteredMembersList.map(m => (
                            <div
                              key={m.id}
                              onClick={() => handleSelectMember(m)}
                              className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm font-bold text-slate-200">{m.fullName}</div>
                                <div className="text-xs text-slate-500">{m.cnic ? `CNIC: ${m.cnic}` : ''} {m.mobile ? `| Ph: ${m.mobile}` : ''}</div>
                              </div>
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">Select</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{activeTitleLabel} *</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Muhammad Ali / Donor Name"
                      className={inputClass}
                    />
                  </div>
                )}

                {activeSubTitleLabel && (
                  <div>
                    <label className={labelClass}>{activeSubTitleLabel}</label>
                    <input
                      type="text"
                      value={form.subTitle}
                      onChange={e => setForm({ ...form, subTitle: e.target.value })}
                      placeholder={isBusBooking ? 'e.g. Bus # 5 / Toyota Coaster' : 'e.g. 42101-1234567-1'}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Mobile Phone</label>
                  <input
                    type="text"
                    value={form.mobile}
                    onChange={e => setForm({ ...form, mobile: e.target.value })}
                    placeholder="0300-1234567"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{activeDateLabel} *</label>
                  <input
                    type="date"
                    required
                    value={form.eventDate}
                    onChange={e => setForm({ ...form, eventDate: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {activeShowDest && (
                  <div>
                    <label className={labelClass}>{activeDestLabel}</label>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={e => setForm({ ...form, destination: e.target.value })}
                      placeholder="e.g. Makli / Thatta / Hyderabad"
                      className={inputClass}
                    />
                  </div>
                )}

                {activeShowQty && (
                  <div>
                    <label className={labelClass}>{activeQtyLabel}</label>
                    <input
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={e => handleQtyRateChange('quantity', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                {activeShowRate && (
                  <div>
                    <label className={labelClass}>{activeRateLabel} (PKR)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.rate}
                      onChange={e => handleQtyRateChange('rate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Amount (PKR) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">PKR</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-indigo-400 focus:outline-none focus:border-indigo-500/60 transition-all font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 02: Payment & Settlement */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Payment & Settlement</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Payment Method *</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className={inputClass}
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK / ONLINE</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>

                {form.paymentMethod !== 'CASH' && (
                  <div>
                    <label className={labelClass}>Select Bank Account *</label>
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={e => setForm({ ...form, bankAccountId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.accountName || a.name} ({a.glCode || a.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.paymentMethod === 'CHEQUE' && (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Cheque Number / Reference</label>
                    <input
                      type="text"
                      value={form.chequeNumber}
                      onChange={e => setForm({ ...form, chequeNumber: e.target.value })}
                      placeholder="e.g. CHQ-123456"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Card 03: Remarks & Posting */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">03</span>
                <h3 className="text-sm font-semibold text-slate-200">Remarks & Posting</h3>
              </div>
              <div className="p-5 grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClass}>Remarks / Narration</label>
                  <textarea
                    rows={2}
                    value={form.remarks}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Optional notes, receipt number or payment details..."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {!id && (
                  <div className="flex items-center pt-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-300 font-semibold">
                      <input
                        type="checkbox"
                        checked={form.postImmediately}
                        onChange={e => setForm({ ...form, postImmediately: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-800 bg-slate-950/60 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-slate-900 cursor-pointer"
                      />
                      Post immediately to General Ledger
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to={activeBackPath} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (id ? 'Update Record' : 'Save Record')}</span>
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
};

export default SpecializedRevenueForm;

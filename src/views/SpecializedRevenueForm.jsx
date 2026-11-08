import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DateInput } from '../components/ui/DateInput';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useRevenueCollectionStore } from '../store/revenueCollectionStore';
import { useCoaStore } from '../store/coaStore';
import { useMemberStore } from '../store/memberStore';
import { PhoneInput } from '../components/ui/PhoneInput';
import {
  DollarSign, Building, Bus, Users, ChevronLeft, CheckCircle, AlertCircle,
  Save, Search, ChevronDown, Check, User, IdCard, MapPin, Phone,
  Calendar, CreditCard, Wallet, AlertTriangle
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { isGenuineBankAccount } from '../utils/accountFilters';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

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
  const [selectedMember, setSelectedMember] = useState(null);

  // Member dropdown state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberDropdownRef = useRef(null);

  const [form, setForm] = useState({
    memberId: '',
    slipNo: '',
    title: '',
    fatherName: '',
    husbandName: '',
    subTitle: '',
    mobile: '',
    gham: '',
    destination: '',
    eventDate: new Date().toISOString().split('T')[0],
    quantity: activeShowQty ? 1 : '',
    rate: activeShowRate ? (isMembershipFee ? 500 : 300) : '',
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

  // Preselect member from URL query param if present e.g. /membership-fees/new?memberId=123
  useEffect(() => {
    if (isMembershipFee && !id && members.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const mId = searchParams.get('memberId');
      if (mId) {
        const found = members.find(m => m.id === mId || m.memberNo === mId);
        if (found) {
          handleSelectMember(found);
        }
      }
    }
  }, [isMembershipFee, id, members, location.search]);

  useEffect(() => {
    if (id && collections.length > 0) {
      const existing = collections.find(c => c.id === id);
      if (existing) {
        let extFather = existing.fatherName || '';
        let extHusband = existing.husbandName || '';
        let extGham = existing.gham || '';
        let extSlip = existing.slipNo || '';
        let extRemarks = existing.remarks || '';
        if (existing.remarks) {
          const sMatch = existing.remarks.match(/(?:SLIP\s*#\s*:?|Slip\s*No\s*:?)\s*([^|]+)/i);
          if (sMatch) extSlip = sMatch[1].trim();
          const fMatch = existing.remarks.match(/Father:\s*([^|]+)/i);
          if (fMatch) extFather = fMatch[1].trim();
          const hMatch = existing.remarks.match(/Husband:\s*([^|]+)/i);
          if (hMatch) extHusband = hMatch[1].trim();
          const gMatch = existing.remarks.match(/Gham:\s*([^|]+)/i);
          if (gMatch) extGham = gMatch[1].trim();
          extRemarks = existing.remarks
            .replace(/(?:SLIP\s*#\s*:?|Slip\s*No\s*:?)\s*[^|]+\s*\|?/gi, '')
            .replace(/Father:\s*[^|]+\s*\|?/gi, '')
            .replace(/Husband:\s*[^|]+\s*\|?/gi, '')
            .replace(/Gham:\s*[^|]+\s*\|?/gi, '')
            .trim();
        }

        setForm({
          memberId: existing.memberId || '',
          slipNo: extSlip,
          title: existing.title || '',
          fatherName: extFather,
          husbandName: extHusband,
          subTitle: existing.subTitle || '',
          mobile: existing.mobile || '',
          gham: extGham,
          destination: existing.destination || '',
          eventDate: existing.eventDate ? new Date(existing.eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          quantity: existing.quantity || '',
          rate: existing.rate || '',
          amount: existing.amount || '',
          paymentMethod: existing.paymentMethod || 'CASH',
          bankAccountId: existing.bankAccountId || '',
          chequeNumber: existing.chequeNumber || '',
          remarks: extRemarks,
          postImmediately: existing.status === 'POSTED'
        });

        if (existing.member) {
          setSelectedMember(existing.member);
        } else if (existing.memberId && members.length > 0) {
          const m = members.find(item => item.id === existing.memberId);
          if (m) setSelectedMember(m);
        }

        if (isMembershipFee && existing.title) {
          setMemberSearch(existing.title);
        }
      }
    }
  }, [id, collections, isMembershipFee, members]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(isGenuineBankAccount);
  }, [flatAccounts]);

  const filteredMembersList = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 30);
    const q = memberSearch.toLowerCase();
    return members.filter(m =>
      (m.fullName && m.fullName.toLowerCase().includes(q)) ||
      (m.memberNo && m.memberNo.toLowerCase().includes(q)) ||
      (m.fatherName && m.fatherName.toLowerCase().includes(q)) ||
      (m.cnic && m.cnic.includes(q)) ||
      (m.mobile && m.mobile.includes(q))
    ).slice(0, 20);
  }, [members, memberSearch]);

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setForm(prev => ({
      ...prev,
      memberId: member.id,
      title: member.fullName || '',
      fatherName: member.fatherName || '',
      husbandName: member.husbandName || '',
      subTitle: member.memberNo || member.cnic || '',
      mobile: member.mobile || '',
      gham: member.ghamName || member.gham || member.fatherGham || '',
      destination: member.address || [member.area, member.city].filter(Boolean).join(', ') || '',
      rate: prev.rate || member.feeAmount || 500,
      amount: prev.amount || (member.outstandingBalance > 0 ? member.outstandingBalance : (member.feeAmount || 500))
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
    if (Number(form.amount) > 100000000) {
      setToast({ type: 'error', message: 'Amount cannot exceed 100,000,000' });
      return;
    }

    setLoading(true);
    try {
      const metaParts = [
        (form.slipNo || '').trim() && `SLIP #: ${(form.slipNo || '').trim()}`,
        form.fatherName && `Father: ${form.fatherName}`,
        form.husbandName && `Husband: ${form.husbandName}`,
        form.gham && `Gham: ${form.gham}`,
        form.remarks
      ].filter(Boolean);

      const payload = {
        ...form,
        category: activeCategory,
        memberId: form.memberId || undefined,
        amount: Number(form.amount),
        quantity: form.quantity ? Number(form.quantity) : null,
        rate: form.rate ? Number(form.rate) : null,
        remarks: metaParts.join(' | ')
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
  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';

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
          <Link
            to={activeBackPath}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {id ? `Edit ${activeCategory} Record` : `New ${activeCategory} Entry`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{activeDesc}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          {id ? 'Editing Receipt' : 'General Ledger Connected'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT: Core Details */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">01</span>
                <h3 className="text-sm font-semibold text-slate-200">
                  {isMembershipFee ? 'Member Registration & Fee Link' : 'Payer Information'}
                </h3>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Member search dropdown if Membership Fee */}
                {isMembershipFee ? (
                  <div className="sm:col-span-2 relative" ref={memberDropdownRef}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-400">Search Registered Member *</label>
                      <Link to="/members/new" className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1">
                        + Register New Member
                      </Link>
                    </div>
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
                        placeholder="Type member name, KML number, CNIC, or mobile..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium"
                      />
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                    </div>

                    {memberDropdownOpen && (
                      <div className="absolute z-[70] left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                        {filteredMembersList.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">No registered members matched your search</div>
                        ) : (
                          filteredMembersList.map(m => (
                            <div
                              key={m.id}
                              onClick={() => handleSelectMember(m)}
                              className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                  <span>{m.fullName}</span>
                                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                    {m.memberNo || 'KML'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {m.fatherName ? `s/o ${m.fatherName} ` : ''}
                                  {m.cnic ? `| CNIC: ${m.cnic} ` : ''}
                                  {m.mobile ? `| Ph: ${m.mobile}` : ''}
                                </div>
                                {(m.address || m.ghamName) && (
                                  <div className="text-[11px] text-slate-500">
                                    {m.ghamName ? `Gham: ${m.ghamName} ` : ''}
                                    {m.address ? `| Addr: ${m.address}` : ''}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                                  Select Member
                                </span>
                                {m.paymentStatus && (
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    Status: <strong className={m.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}>{m.paymentStatus}</strong>
                                  </div>
                                )}
                              </div>
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

                {/* Selected Member Details Card */}
                {isMembershipFee && selectedMember && (
                  <div className="sm:col-span-2 bg-slate-950/60 rounded-xl border border-amber-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300">Registered Member Details</span>
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {selectedMember.memberNo || 'KML'}
                        </span>
                      </div>
                      <Link
                        to={`/members/${selectedMember.id}`}
                        target="_blank"
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline"
                      >
                        View Full Profile
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Full Name</span>
                        <span className="font-semibold text-slate-200">{selectedMember.fullName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Contact Number</span>
                        <span className="font-mono text-slate-200">{selectedMember.mobile || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">CNIC / ID</span>
                        <span className="font-mono text-slate-200">{selectedMember.cnic || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Membership Type</span>
                        <span className="font-semibold text-amber-400">{selectedMember.membershipType || 'Regular'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Residential Address</span>
                        <span className="text-slate-300 truncate block">{selectedMember.address || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Registration Date</span>
                        <span className="text-slate-300">{selectedMember.doi ? formatDateDDMMYYYY(selectedMember.doi) : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Current Fee Status</span>
                        <span className={`font-bold ${selectedMember.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {selectedMember.paymentStatus || 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Father Name */}
                <div>
                  <label className={labelClass}>Father Name</label>
                  <input
                    type="text"
                    value={form.fatherName}
                    onChange={e => setForm({ ...form, fatherName: e.target.value })}
                    placeholder="e.g. Abdul Rehman"
                    className={inputClass}
                  />
                </div>

                {/* Husband Name */}
                <div>
                  <label className={labelClass}>Husband Name (If Applicable)</label>
                  <input
                    type="text"
                    value={form.husbandName}
                    onChange={e => setForm({ ...form, husbandName: e.target.value })}
                    placeholder="e.g. Muhammad Farooq"
                    className={inputClass}
                  />
                </div>

                {activeSubTitleLabel && (
                  <div>
                    <label className={labelClass}>{activeSubTitleLabel}</label>
                    <input
                      type="text"
                      value={form.subTitle}
                      onChange={e => setForm({ ...form, subTitle: e.target.value })}
                      placeholder={isBusBooking ? 'e.g. Bus # 5 / Toyota Coaster' : 'e.g. KML-0004 or 42101-1234567-1'}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Mobile Phone</label>
                  <PhoneInput
                    value={form.mobile}
                    onChange={e => setForm({ ...form, mobile: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {/* Gham Details */}
                <div>
                  <label className={labelClass}>Gham Details</label>
                  <input
                    type="text"
                    value={form.gham}
                    onChange={e => setForm({ ...form, gham: e.target.value })}
                    placeholder="e.g. Kukma / Nagalpur / Mandvi"
                    className={inputClass}
                  />
                </div>

                {/* Address / Location */}
                <div>
                  <label className={labelClass}>Address / Location</label>
                  <input
                    type="text"
                    value={form.destination}
                    onChange={e => setForm({ ...form, destination: e.target.value })}
                    placeholder="e.g. Karachi / Saddar"
                    className={inputClass}
                  />
                </div>

              </div>
            </div>

            {/* Payment & Ledger Card */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">02</span>
                <h3 className="text-sm font-semibold text-slate-200">Financial &amp; General Ledger Details</h3>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>SLIP #</label>
                  <input
                    type="text"
                    value={form.slipNo}
                    onChange={e => setForm({ ...form, slipNo: e.target.value })}
                    placeholder="Enter SLIP # (e.g. SLIP-001)"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{activeDateLabel} *</label>
                  <DateInput
                    type="date"
                    required
                    value={form.eventDate}
                    onChange={e => setForm({ ...form, eventDate: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Amount Paid (PKR) *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="500"
                    className={inputClass}
                  />
                </div>

                {activeShowQty && (
                  <div>
                    <label className={labelClass}>{activeQtyLabel}</label>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={e => handleQtyRateChange('quantity', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                {activeShowRate && (
                  <div>
                    <label className={labelClass}>{activeRateLabel}</label>
                    <input
                      type="number"
                      value={form.rate}
                      onChange={e => handleQtyRateChange('rate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Payment Method *</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className={inputClass}
                  >
                    <option value="CASH">Cash in Hand</option>
                    <option value="BANK">Bank Transfer / Online</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {form.paymentMethod !== 'CASH' && (
                  <div>
                    <label className={labelClass}>Bank Account *</label>
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={e => setForm({ ...form, bankAccountId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select Deposit Bank Account</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName} ({acc.glCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.paymentMethod === 'CHEQUE' && (
                  <div>
                    <label className={labelClass}>Cheque Number</label>
                    <input
                      type="text"
                      value={form.chequeNumber}
                      onChange={e => setForm({ ...form, chequeNumber: e.target.value })}
                      placeholder="e.g. CHQ-981240"
                      className={inputClass}
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className={labelClass}>Remarks / Description</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    placeholder="e.g. Annual membership fee 2026-2027"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Actions + Info */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Posting Confirmation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Saving this entry will automatically record the fee against the member's account and post a receipt to the General Ledger.
              </p>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : (id ? 'Update Record' : 'Save & Post Receipt')}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
};

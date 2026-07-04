import { useState, useEffect, useMemo } from 'react';
import { useDonorStore } from '../store/donorStore';
import { Users, Search, Plus, Edit2, Trash2, X, Mail, Phone, CreditCard, MapPin } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';

const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_DONOR = {
  fullName: '',
  fatherName: '',
  mobile: '',
  cnic: '',
  email: '',
  address: '',
  city: '',
  isActive: true
};

function DonorModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial ? nullsToEmpty(initial) : DEFAULT_DONOR);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ? nullsToEmpty(initial) : DEFAULT_DONOR);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.fullName.trim()) {
      showToast('Donor Full Name is required', 'warning');
      return;
    }
    if (form.cnic && !/^[0-9+-\s]{5,20}$/.test(form.cnic)) {
      showToast('Please enter a valid CNIC / Identity Number', 'warning');
      return;
    }
    onSave({ ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {initial ? `Edit Donor (${initial.donorCode})` : 'Register New Donor'}
            </h3>
            <p className="text-xs text-slate-400">Enter donor contact and identity information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Muhammad Ali"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Father / Husband Name</label>
            <input
              type="text"
              value={form.fatherName}
              onChange={e => setForm({ ...form, fatherName: e.target.value })}
              placeholder="e.g. Abdul Rahman"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">CNIC / ID No</label>
            <input
              type="text"
              value={form.cnic}
              onChange={e => setForm({ ...form, cnic: e.target.value })}
              placeholder="e.g. 42101-1234567-1"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Phone</label>
            <input
              type="text"
              value={form.mobile}
              onChange={e => setForm({ ...form, mobile: e.target.value })}
              placeholder="e.g. 0300-1234567"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. donor@example.com"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Street address, house number, etc."
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
              placeholder="e.g. Karachi"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0"
              />
              Active Donor Account
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20"
          >
            {initial ? 'Update Donor' : 'Register Donor'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Donors() {
  const { donors, loading, fetchDonors, addDonor, updateDonor, deleteDonor } = useDonorStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return donors;
    const q = search.toLowerCase();
    return donors.filter(d =>
      d.fullName?.toLowerCase().includes(q) ||
      d.donorCode?.toLowerCase().includes(q) ||
      d.cnic?.toLowerCase().includes(q) ||
      d.mobile?.toLowerCase().includes(q)
    );
  }, [donors, search]);

  const handleCreate = async (data) => {
    try {
      await addDonor(data);
      showToast('Donor registered successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to register donor', 'error');
    }
  };

  const handleUpdate = async (data) => {
    try {
      await updateDonor(selectedDonor.id, data);
      showToast('Donor updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update donor', 'error');
    }
  };

  const handleDelete = async (donor) => {
    if (!window.confirm(`Are you sure you want to delete donor "${donor.fullName}" (${donor.donorCode})?`)) return;
    try {
      await deleteDonor(donor.id);
      showToast('Donor deleted successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete donor', 'error');
    }
  };

  const activeCount = useMemo(() => donors.filter(d => d.isActive).length, [donors]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Donors Directory</h1>
          <p className="text-xs text-slate-400 mt-1">Manage charitable donors, Zakat contributors, and welfare sponsors</p>
        </div>
        <div className={pageActionsClass}>
          <button
            onClick={() => { setSelectedDonor(null); setModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Register Donor</span>
          </button>
        </div>
      </div>

      {/* Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Total Donors</p>
            <p className="text-2xl font-black text-slate-200 mt-1">{donors.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Active Donors</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by donor name, code (DNR-0001), CNIC, or phone number..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden shadow-xl">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Donor Code</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Donor Name</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">CNIC / ID</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Contact Details</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">City / Address</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && donors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 text-sm">
                      Loading donors directory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 text-sm">
                      No donors found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {d.donorCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-200">{d.fullName}</p>
                        {d.fatherName && (
                          <p className="text-[11px] text-slate-500 mt-0.5">s/o {d.fatherName}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {d.cnic ? (
                          <p className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-slate-500" /> {d.cnic}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-0.5">
                        {d.mobile && (
                          <p className="text-xs text-slate-300 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-indigo-400/80" /> {d.mobile}
                          </p>
                        )}
                        {d.email && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-indigo-400/80" /> {d.email}
                          </p>
                        )}
                        {!d.mobile && !d.email && <span className="text-xs text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-300 flex items-center gap-1">
                          {d.city && <span className="font-medium text-slate-300">{d.city}</span>}
                          {d.address && <span className="text-slate-500 truncate max-w-48">({d.address})</span>}
                          {!d.city && !d.address && <span className="text-slate-600">—</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {d.isActive ? (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Active</span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setSelectedDonor(d); setModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Edit Donor"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(d)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                            title="Delete Donor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DesktopOnly>

        <MobileOnly>
          <div className="divide-y divide-slate-800/50">
            {loading && donors.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading donors...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No donors found matching criteria.</div>
            ) : (
              filtered.map(d => (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
                        {d.donorCode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200">{d.fullName}</h4>
                      {d.fatherName && <p className="text-xs text-slate-500">s/o {d.fatherName}</p>}
                    </div>
                    {d.isActive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Active</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Inactive</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Mobile</span>
                      {d.mobile || '—'}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">CNIC</span>
                      {d.cnic || '—'}
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">City / Address</span>
                      {d.city ? `${d.city} ` : ''}{d.address ? `(${d.address})` : (d.city ? '' : '—')}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setSelectedDonor(d); setModalOpen(true); }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </MobileOnly>
      </div>

      <DonorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={selectedDonor ? handleUpdate : handleCreate}
        initial={selectedDonor}
      />
    </div>
  );
}

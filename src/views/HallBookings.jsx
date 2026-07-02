import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, AlertTriangle, CheckCircle, X, Trash2, Edit2 } from 'lucide-react';
import { useHallBookingStore } from '../store/hallBookingStore';
import { useAuthStore } from '../store/authStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';
import { HallBookingReceiptModal } from '../components/receipts/HallBookingReceiptModal';

export const HallBookings = () => {
  const { t, i18n } = useTranslation();
  const { bookings, loading, fetchBookings, postBooking, deleteBooking, bulkDeleteBookings } = useHallBookingStore();
  const { canEditOrDelete } = useAuthStore();
  const [search, setSearch] = useState('');
  const [printItem, setPrintItem] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const handlePost = async (id) => {
    try {
      await postBooking(id);
      showToast('Booking posted to ledger successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to post booking', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking? If posted, its journal entries will be automatically reversed.')) {
      try {
        await new Promise(resolve => setTimeout(resolve, 15));
        await deleteBooking(id);
        setSelectedIds(prev => prev.filter(item => item !== id));
        showToast('Booking deleted successfully', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to delete booking', 'error');
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
    const res = await bulkDeleteBookings(selectedIds);
    setIsDeleting(false);
    setShowBulkConfirm(false);
    if (res.success) {
      showToast(`${selectedIds.length} hall booking(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } else {
      showToast(res.error || 'Failed to bulk delete hall bookings', 'error');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter(b => 
      b.bookerName?.toLowerCase().includes(q) ||
      b.mobile?.includes(search) ||
      b.receiptNo?.toString().includes(search)
    );
  }, [bookings, search]);

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title')]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.hallBookings.title')}</h1>
            <p className="text-sm text-slate-400 mt-1">{t('tables.hallBookings.desc')}</p>
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
            <Link to="/hall-bookings/new"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all">
              <Plus className="h-4 w-4" /> {t('tables.hallBookings.newBooking')}
            </Link>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800/80">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tables.hallBookings.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading bookings...</span>
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
                    <th className="px-6 py-4">{t('receipt.receiptNo')}</th>
                    <th className="px-6 py-4">{t('receipt.bookerName')}</th>
                    <th className="px-6 py-4">{t('receipt.programDate')}</th>
                    <th className="px-6 py-4">{t('receipt.hall')}</th>
                    <th className="px-6 py-4">{t('receipt.totalAmount')}</th>
                    <th className="px-6 py-4">{t('tables.status', 'STATUS')}</th>
                    <th className="px-6 py-4 text-right">{t('tables.actions', 'ACTIONS')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {filtered.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-800/20 transition-colors">
                      {canEditOrDelete && (
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(booking.id)}
                            onChange={(e) => handleSelectOne(booking.id, e)}
                            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">#{booking.receiptNo}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">{booking.bookerName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">{booking.mobile || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{new Date(booking.programDate).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{booking.timings || 'Any time'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                          {booking.hallAccount?.accountName}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">Rs. {booking.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {booking.status === 'Confirmed' ? (
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
                        {booking.status === 'Confirmed' && (
                          <button onClick={() => handlePost(booking.id)}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
                            Post to Ledger
                          </button>
                        )}
                        <button onClick={() => setPrintItem(booking)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors inline-flex"
                          title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </button>
                        {booking.status === 'Confirmed' && canEditOrDelete && (
                          <Link to={`/hall-bookings/edit/${booking.id}`}
                            className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition-colors inline-flex ml-1"
                            title="Edit Booking">
                            <Edit2 className="h-4 w-4" />
                          </Link>
                        )}
                        {canEditOrDelete && (
                          <button onClick={() => handleDelete(booking.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors inline-flex ml-1"
                            title="Delete Booking">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canEditOrDelete ? "8" : "7"} className="px-6 py-12 text-center text-slate-500 text-sm">
                        {t('tables.hallBookings.noBookingsFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      {printItem && (
        <HallBookingReceiptModal booking={printItem} onClose={() => setPrintItem(null)} />
      )}

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
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected hall bookings? 
              If any of these bookings are posted, their associated journal entries will be automatically reversed in the General Ledger. This action cannot be undone.
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
                    Delete {selectedIds.length} Bookings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, AlertTriangle, CheckCircle, X, Trash2, Edit2, CheckCircle2, Calendar, Table as TableIcon, LayoutGrid, Building2, Phone, DollarSign, FileText, Clock, RotateCcw } from 'lucide-react';
import { useHallBookingStore } from '../store/hallBookingStore';
import { useAuthStore } from '../store/authStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';
import { HallBookingReceiptModal } from '../components/receipts/HallBookingReceiptModal';
import { HallBookingGLModal } from '../components/receipts/HallBookingGLModal';
import HallBookingCalendar from '../components/common/HallBookingCalendar';

const formatHallName = (booking) => {
  if (!booking) return 'N/A';
  let raw = typeof booking === 'string' ? booking : (booking.hallName || booking.hallAccount?.accountName || booking.hallAccount?.name || '');
  if (!raw) return 'N/A';
  const parenMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*\((.+?)\)/i);
  if (parenMatch && parenMatch[1]) raw = parenMatch[1].trim();
  const dashMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*[-:]\s*(.+)/i);
  if (dashMatch && dashMatch[1]) raw = dashMatch[1].trim();
  if (/bagh/i.test(raw) || /hajiani/i.test(raw) || /hajiyani/i.test(raw)) return 'Bagh-e-Hajiani Kareema';
  return raw;
};

export const HallBookings = () => {
  const { t, i18n } = useTranslation();
  const { bookings, loading, fetchBookings, postBooking, revertBooking, deleteBooking, bulkDeleteBookings } = useHallBookingStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const [search, setSearch] = useState('');
  const [printItem, setPrintItem] = useState(null);
  const [glItem, setGlItem] = useState(null);
  const [viewMode, setViewMode] = useState('cards');

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

  const handleRevert = async (id) => {
    if (window.confirm('Are you sure you want to revert this booking? Its journal entries will be deleted and status reset to Pending.')) {
      try {
        await revertBooking(id);
        showToast('Booking reverted from ledger successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to revert booking', 'error');
      }
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
    return bookings.filter(b => {
      const cleanHall = formatHallName(b).toLowerCase();
      const rawHall = (b.hallAccount?.accountName || b.hallName || '').toLowerCase();
      return (
        b.bookerName?.toLowerCase().includes(q) ||
        b.mobile?.includes(search) ||
        b.receiptNo?.toString().includes(search) ||
        cleanHall.includes(q) ||
        rawHall.includes(q)
      );
    });
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
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-900/20 transition-all">
              <Plus className="h-4 w-4" /> {t('tables.hallBookings.newBooking')}
            </Link>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative max-w-md flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tables.hallBookings.searchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors" />
              </div>
              <div className="flex items-center bg-slate-950/80 rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'cards' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Card View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'table' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <TableIcon className="h-3.5 w-3.5" /> Table View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Calendar className="h-3.5 w-3.5" /> Calendar View
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <div className="p-5">
              <HallBookingCalendar bookings={bookings} />
            </div>
          ) : viewMode === 'cards' ? (
            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading bookings...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
                  <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-semibold text-sm">{t('tables.hallBookings.noBookingsFound', 'No hall bookings found')}</p>
                  <p className="text-slate-500 text-xs mt-1">Try adjusting your search term or create a new booking.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map((booking) => (
                    <div
                      key={booking.id}
                      className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                        selectedIds.includes(booking.id) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                      }`}
                    >
                      {/* Card Top: Checkbox, Avatar/Icon, Name & Status Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {canEditOrDelete && (
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(booking.id)}
                                onChange={(e) => handleSelectOne(booking.id, e)}
                                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                              />
                            )}
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base shadow-inner shrink-0">
                              {booking.bookerName ? booking.bookerName.charAt(0).toUpperCase() : <Building2 className="w-4 h-4 text-amber-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm sm:text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight truncate">
                                {booking.bookerName || 'Unnamed Booker'}
                              </h4>
                              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                                {booking.mobile ? (
                                  <>
                                    <Phone className="w-3 h-3 text-amber-400/80 shrink-0" /> <span className="truncate">{booking.mobile}</span>
                                  </>
                                ) : 'No Phone Provided'}
                              </p>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide shrink-0 whitespace-nowrap ${
                            booking.status === 'POSTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {booking.status === 'POSTED' ? (
                              <>
                                <CheckCircle className="w-3 h-3 shrink-0" /> POSTED
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3 shrink-0" /> PENDING POST
                              </>
                            )}
                          </span>
                        </div>

                        {/* Inner Details Well */}
                        <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> TOTAL AMOUNT
                            </span>
                            <span className="font-bold text-emerald-400 text-sm">
                              Rs. {Math.round(Number(booking.amount || 0)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-amber-400" /> RECEIPT NO
                            </span>
                            <span className="font-mono font-bold text-slate-100 text-xs">
                              #{booking.receiptNo}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-amber-400" /> HALL
                            </span>
                            <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60">
                              {formatHallName(booking)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" /> PROGRAM DATE
                            </span>
                            <span className="font-semibold text-slate-100 text-xs">
                              {new Date(booking.programDate).toLocaleDateString()}
                              {booking.timings && <span className="text-slate-400 font-normal ml-1.5">({booking.timings})</span>}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Date & Action Icons */}
                      <div className="flex flex-col gap-3 pt-3.5 border-t border-slate-800/80">
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {booking.programDate ? new Date(booking.programDate).toLocaleDateString() : 'N/A'}
                        </span>
                        <div className="flex items-center justify-end gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => setPrintItem(booking)}
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                            title="Print Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {(booking.status === 'Confirmed' || booking.status === 'Pending') && canPostToLedger && (
                            <button
                              type="button"
                              onClick={() => handlePost(booking.id)}
                              className="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                              title="Post to Ledger"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Post
                            </button>
                          )}
                          {booking.status === 'POSTED' && canPostToLedger && (
                            <button
                              type="button"
                              onClick={() => handleRevert(booking.id)}
                              className="px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm"
                              title="Revert from Ledger"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Revert
                            </button>
                          )}
                          {canEditOrDelete && (
                            <>
                              <Link
                                to={`/hall-bookings/edit/${booking.id}`}
                                className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                title="Edit Booking"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(booking.id)}
                                className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                title="Delete Booking"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
                          className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
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
                            className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
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
                          {formatHallName(booking)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">Rs. {Math.round(booking.amount).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {booking.status === 'POSTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="h-3 w-3" /> Posted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Pending Post
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {(booking.status === 'Confirmed' || booking.status === 'Pending') && canPostToLedger && (
                          <button onClick={() => handlePost(booking.id)}
                            className="p-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/40 rounded transition-colors inline-flex"
                            title="Post to Ledger">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {booking.status === 'POSTED' && canPostToLedger && (
                          <button onClick={() => handleRevert(booking.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors inline-flex"
                            title="Revert from Ledger">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setPrintItem(booking)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors inline-flex"
                          title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </button>
                        {booking.status === 'POSTED' && (
                          <button onClick={() => setGlItem(booking)}
                            className="p-1.5 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded transition-colors inline-flex"
                            title="Print GL Voucher">
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        {canEditOrDelete && (
                          <Link to={`/hall-bookings/edit/${booking.id}`}
                            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors inline-flex ml-1"
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
          )}
        </div>
      </div>
      
      {printItem && (
        <HallBookingReceiptModal booking={printItem} onClose={() => setPrintItem(null)} />
      )}

      {glItem && (
        <HallBookingGLModal booking={glItem} onClose={() => setGlItem(null)} />
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

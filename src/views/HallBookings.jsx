import React, { useRef, useState, useEffect, useMemo } from 'react';
import { DateInput } from '../components/ui/DateInput';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Printer, Download, Upload, AlertTriangle, CheckCircle, X, Trash2, Edit2, CheckCircle2, Calendar, Table as TableIcon, LayoutGrid, Building2, Phone, DollarSign, FileText, Clock, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useHallBookingStore } from '../store/hallBookingStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { useConfirmStore } from '../store/confirmStore';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { HallBookingReceiptModal } from '../components/receipts/HallBookingReceiptModal';
import { HallBookingGLModal } from '../components/receipts/HallBookingGLModal';
import HallBookingCalendar from '../components/common/HallBookingCalendar';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const cleanSingleHallName = (rawInput) => {
  if (!rawInput) return '';
  let raw = String(rawInput).trim();
  const parenMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*\((.+?)\)/i);
  if (parenMatch && parenMatch[1]) raw = parenMatch[1].trim();
  const dashMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*[-:]\s*(.+)/i);
  if (dashMatch && dashMatch[1]) raw = dashMatch[1].trim();
  if (/bagh/i.test(raw) || /hajiani/i.test(raw) || /hajiyani/i.test(raw)) return 'Bagh-e-Hajiani Kareema';
  if (/sadaya/i.test(raw) || /sada/i.test(raw)) return 'Sadaya Hall';
  if (/zikarya/i.test(raw) || /zikriya/i.test(raw) || /zakaria/i.test(raw) || /zakriya/i.test(raw)) return 'Zikarya Hall';
  if (/annexy/i.test(raw) || /anexy/i.test(raw) || /gosha/i.test(raw) || /anxy/i.test(raw)) return 'Annexy Hall';
  return raw;
};

const getBookingHallNamesList = (booking) => {
  if (!booking) return [];
  if (typeof booking === 'string') {
    const cleaned = cleanSingleHallName(booking);
    return cleaned ? [cleaned] : [];
  }
  if (Array.isArray(booking.hallNames) && booking.hallNames.length > 0) {
    return Array.from(new Set(booking.hallNames.map(cleanSingleHallName).filter(Boolean)));
  }
  if (Array.isArray(booking.hallDetails) && booking.hallDetails.length > 0) {
    const fromDetails = booking.hallDetails.map(d => cleanSingleHallName(d?.hallName)).filter(Boolean);
    if (fromDetails.length > 0) return Array.from(new Set(fromDetails));
  }
  const single = cleanSingleHallName(booking.hallName || booking.hallAccount?.accountName || booking.hallAccount?.name || '');
  return single ? [single] : [];
};

const formatHallName = (booking) => {
  const list = getBookingHallNamesList(booking);
  return list.length > 0 ? list.join(', ') : 'N/A';
};

const parseImportedDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const rounded = new Date(Math.round(value.getTime() / 60000) * 60000);
    return `${rounded.getFullYear()}-${String(rounded.getMonth() + 1).padStart(2, '0')}-${String(rounded.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return '';
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  if (!str) return '';

  const isoMatch = str.match(/^(\d{4})[\/\-.\s](\d{1,2})[\/\-.\s](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})$/);
  if (dmyMatch) {
    let d = Number(dmyMatch[1]);
    let m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getRowValue = (row, keys) => {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  const normalizedEntries = Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]);
  for (const key of keys) {
    const target = key.trim().toLowerCase();
    const found = normalizedEntries.find(([k]) => k === target);
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
      return found[1];
    }
  }
  return '';
};

const parseImportedAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const normalizeImportedMobile = (raw) => {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `0${digits}`;
  if (digits.length === 12 && digits.startsWith('92')) digits = `0${digits.slice(2)}`;
  return /^\d{11}$/.test(digits) ? digits : '';
};

const sanitizeImportedBookerName = (raw) => {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9\s.,'()&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (cleaned.length >= 2) return cleaned;
  return String(raw || '').trim() ? 'Guest Booker' : '';
};

export const HallBookings = () => {
  const { t, i18n } = useTranslation();
  const { bookings, loading, fetchBookings, addBooking, updateBooking, postBooking, revertBooking, deleteBooking, bulkDeleteBookings } = useHallBookingStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const [search, setSearch] = useState('');
  const [printItem, setPrintItem] = useState(null);
  const [glItem, setGlItem] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [period, setPeriod] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedHallId, setSelectedHallId] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  const dateRange = useMemo(() => {
    if (period === 'day' && selectedDay) {
      const nextDay = new Date(`${selectedDay}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      return { startDate: selectedDay, endDate: nextDay.toISOString().slice(0, 10) };
    }
    if (period === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const nextMonth = new Date(Date.UTC(year, month, 1));
      return { startDate: `${selectedMonth}-01`, endDate: nextMonth.toISOString().slice(0, 10) };
    }
    if (period === '3months' || period === '6months') {
      const monthCount = period === '3months' ? 3 : 6;
      const currentMonth = new Date();
      const start = new Date(Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() - monthCount + 1, 1));
      const end = new Date(Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    }
    return {};
  }, [period, selectedMonth, selectedDay]);

  useEffect(() => {
    fetchBookings({ ...dateRange, ...(selectedHallId ? { hallId: selectedHallId } : {}) });
    setSelectedIds([]);
  }, [dateRange, selectedHallId, fetchBookings]);

  const hallOptions = useMemo(() => {
    const seen = new Set();
    return (flatAccounts || [])
      .filter(account => account.type === 'Revenue' || account.accountTypeName === 'REVENUE' || account.accountTypeName === 'Revenue')
      .map(account => ({ id: account.id, name: formatHallName(account.name || account.accountName) }))
      .filter(account => account.name !== 'N/A' && !seen.has(account.name) && seen.add(account.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flatAccounts]);

  const handlePost = async (idOrBooking) => {
    const booking = typeof idOrBooking === 'object' 
      ? idOrBooking 
      : bookings.find(b => b.id === idOrBooking);

    if (booking) {
      const remaining = Number(booking.remainingAmount || 0);
      if (remaining > 0) {
        showToast(`Cannot post booking to ledger: Remaining amount must be Rs. 0 (Current remaining: Rs. ${Math.round(remaining).toLocaleString()}). Please collect full payment first.`, 'error');
        return;
      }
    }

    const id = typeof idOrBooking === 'object' ? idOrBooking.id : idOrBooking;
    try {
      await postBooking(id);
      showToast('Booking posted to ledger successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to post booking', 'error');
    }
  };

  const handleRevert = async (id) => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      type: 'warning',
      title: 'Revert Hall Booking?',
      description: 'Are you sure you want to revert this booking? Its journal entries will be deleted and status reset to Pending.',
      details: [
        'Journal entries will be deleted.',
        'Booking status will reset to Pending Post.',
      ],
      confirmLabel: 'Revert Booking',
      cancelLabel: 'Cancel',
      loadingLabel: 'Reverting...',
      successMessage: 'Booking reverted from ledger successfully!',
      action: async () => {
        await revertBooking(id);
      },
    });

    if (confirmed) {
      showToast('Booking reverted from ledger successfully!', 'success');
    }
  };

  const handleDelete = async (id) => {
    await useConfirmStore.getState().showConfirm({
      type: 'danger',
      isDangerous: true,
      title: 'Delete Hall Booking?',
      description: 'Are you sure you want to delete this booking? If posted, its journal entries will be automatically reversed.',
      details: [
        'Hall booking record will be permanently deleted.',
        'If posted, accounting journal entries will be reversed.',
        'This action cannot be undone.',
      ],
      confirmLabel: 'Delete Booking',
      cancelLabel: 'Cancel',
      loadingLabel: 'Deleting...',
      successMessage: 'Booking deleted successfully!',
      action: async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        await deleteBooking(id);
        setSelectedIds(prev => prev.filter(item => item !== id));
      },
    });
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
    try {
      const res = await bulkDeleteBookings(selectedIds);
      if (res?.success) {
        showToast(`${selectedIds.length} hall booking(s) deleted successfully`, 'success');
        setSelectedIds([]);
      } else {
        const isForbidden = res?.error?.includes('403') || res?.error?.includes('Restricted') || res?.error?.includes('permission');
        showToast(isForbidden ? 'You do not have permission to delete this record.' : (res?.error || 'Failed to bulk delete hall bookings'), 'error');
      }
    } catch (err) {
      handleDeleteError(err, 'Failed to bulk delete hall bookings');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bookings.filter(b => {
      if (!q) return true;
      const cleanHall = formatHallName(b).toLowerCase();
      const rawHall = (b.hallAccount?.accountName || b.hallName || '').toLowerCase();
      return (
        b.bookerName?.toLowerCase().includes(q) ||
        b.fatherHusbandName?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.mobile?.includes(q) ||
        b.receiptNo?.toString().includes(q) ||
        b.status?.toLowerCase().includes(q) ||
        b.timings?.toLowerCase().includes(q) ||
        b.functionType?.toLowerCase().includes(q) ||
        b.paymentMethod?.toLowerCase().includes(q) ||
        cleanHall.includes(q) ||
        rawHall.includes(q)
      );
    });
  }, [bookings, search]);

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('No hall bookings available to export', 'info');
      return;
    }

    const exportData = filtered.map((booking, index) => ({
      'S.No': index + 1,
      'Receipt No': booking.receiptNo || '',
      'Booker Name': booking.bookerName || '',
      'Mobile': booking.mobile || '',
      'Booking Date': booking.bookingDate || booking.createdAt ? formatDateDDMMYYYY(booking.bookingDate || booking.createdAt) : '',
      'Program Date': booking.programDate ? formatDateDDMMYYYY(booking.programDate) : '',
      'Hall': formatHallName(booking),
      'Timings': booking.timings || '',
      'Hall Charges': Number(booking.hallCharges ?? booking.amount ?? 0),
      'Discount': Number(booking.discount || 0),
      'Net Amount': Number(booking.netAmount ?? ((booking.hallCharges ?? booking.amount ?? 0) - (booking.discount || 0))),
      'Received': Number(booking.receivedAmount || 0),
      'Remaining': Number(booking.remainingAmount || 0),
      'Status': booking.status || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hall Bookings');
    XLSX.writeFile(workbook, `Hall_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported hall bookings to Excel', 'success');
  };

  const handlePrint = () => {
    if (filtered.length === 0) {
      showToast('No hall bookings available to print', 'info');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      showToast('Please allow pop-ups to print hall bookings', 'warning');
      return;
    }

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const money = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`;
    const rows = filtered.map((booking, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(booking.receiptNo)}</td>
        <td>${escapeHtml(booking.bookerName)}</td>
        <td>${escapeHtml(booking.mobile)}</td>
        <td>${escapeHtml(booking.bookingDate || booking.createdAt ? formatDateDDMMYYYY(booking.bookingDate || booking.createdAt) : '')}</td>
        <td>${escapeHtml(formatHallName(booking))}</td>
        <td>${money(booking.netAmount ?? ((booking.hallCharges ?? booking.amount ?? 0) - (booking.discount || 0)))}</td>
        <td>${money(booking.receivedAmount)}</td>
        <td>${money(booking.remainingAmount)}</td>
        <td>${escapeHtml(booking.status)}</td>
      </tr>`).join('');

    printWindow.document.write(`<!doctype html><html><head><title>Hall Bookings</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        p { color: #555; margin: 0 0 16px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #bbb; padding: 7px 6px; text-align: left; }
        th { background: #eee; font-weight: 700; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h1>Hall Bookings</h1>
      <p>Printed on ${escapeHtml(new Date().toLocaleString('en-GB'))} | Total bookings: ${filtered.length}</p>
      <table><thead><tr><th>#</th><th>Receipt No</th><th>Booker Name</th><th>Mobile</th><th>Booking Date</th><th>Hall</th><th>Net Amount</th><th>Received</th><th>Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImporting(true);
    try {
      let currentAccounts = flatAccounts || [];
      if (currentAccounts.length === 0) {
        await fetchAccountsList();
        currentAccounts = useCoaStore.getState().flatAccounts || [];
      }

      const availableHalls = [];
      const hallByName = new Map();
      for (const account of currentAccounts) {
        if (account.type === 'Revenue' || account.accountTypeName === 'REVENUE' || account.accountTypeName === 'Revenue') {
          const formatted = formatHallName(account.name || account.accountName);
          if (formatted && formatted !== 'N/A') {
            if (!hallByName.has(formatted.toLowerCase())) {
              hallByName.set(formatted.toLowerCase(), { id: account.id, name: formatted });
              availableHalls.push({ id: account.id, name: formatted });
            }
          }
          const rawName = String(account.name || account.accountName || '').trim();
          if (rawName && !hallByName.has(rawName.toLowerCase())) {
            hallByName.set(rawName.toLowerCase(), { id: account.id, name: formatted !== 'N/A' ? formatted : rawName });
          }
        }
      }

      const resolveHallsFromRow = (rawHallStr) => {
        const parts = String(rawHallStr || '')
          .split(/[,+]/)
          .map(s => s.trim())
          .filter(Boolean);
        const matched = [];
        const seenIds = new Set();

        for (const part of parts) {
          const cleaned = cleanSingleHallName(part);
          const candidate =
            hallByName.get(cleaned.toLowerCase()) ||
            hallByName.get(part.toLowerCase()) ||
            availableHalls.find(h =>
              h.name.toLowerCase().includes(cleaned.toLowerCase()) ||
              cleaned.toLowerCase().includes(h.name.toLowerCase())
            );
          if (candidate && !seenIds.has(candidate.id)) {
            seenIds.add(candidate.id);
            matched.push(candidate);
          }
        }

        if (matched.length === 0 && availableHalls.length > 0) {
          matched.push(availableHalls[0]);
        }
        return matched;
      };

      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let imported = 0;
      let failed = 0;

      const currentBookings = Array.isArray(bookings) ? [...bookings] : [];

      for (const row of rows) {
        const rawBooker = getRowValue(row, ['Booker Name', 'Booker', 'Customer Name', 'Client Name', 'Party Name', 'Name']);
        const bookerName = sanitizeImportedBookerName(rawBooker);

        const rawHall = getRowValue(row, ['Hall', 'Hall Name', 'Halls']);
        const matchedHalls = resolveHallsFromRow(rawHall);
        const hallId = matchedHalls[0]?.id || '';
        const hallIds = matchedHalls.map(h => h.id);
        const hallNames = matchedHalls.map(h => h.name);

        const discount = Math.max(0, parseImportedAmount(getRowValue(row, ['Discount'])));
        const rawCharges = parseImportedAmount(getRowValue(row, ['Hall Charges', 'Charges', 'Amount', 'Gross Amount']));
        const rawNet = parseImportedAmount(getRowValue(row, ['Net Amount', 'Net', 'Total Amount', 'Total']));
        const rawReceived = parseImportedAmount(getRowValue(row, ['Received', 'Received Amount', 'Paid']));
        const amount = rawCharges > 0 ? rawCharges : (rawNet > 0 ? rawNet + discount : (rawReceived > 0 ? rawReceived + discount : 0));

        const rawProgramDate = getRowValue(row, ['Program Date', 'Event Date', 'Function Date', 'Date']);
        const rawBookingDate = getRowValue(row, ['Booking Date', 'Receipt Date', 'Created Date']);
        const programDate = parseImportedDate(rawProgramDate) || parseImportedDate(rawBookingDate);
        const bookingDate = parseImportedDate(rawBookingDate) || programDate || new Date().toISOString().slice(0, 10);

        if (!bookerName || !programDate || !hallId || amount <= 0) {
          failed += 1;
          continue;
        }

        const netAmount = Math.max(0, amount - discount);
        const receivedAmount = Math.min(netAmount, Math.max(0, rawReceived));
        const timings = String(getRowValue(row, ['Timings', 'Timing', 'Time Slot']) || 'Evening').trim() || 'Evening';
        const mobile = normalizeImportedMobile(getRowValue(row, ['Mobile', 'Mobile No', 'Phone', 'Contact']));
        const rawReceiptNo = parseInt(String(getRowValue(row, ['Receipt No', 'Receipt #', 'Slip No']) || '').replace(/\D/g, ''), 10);
        const receiptNo = Number.isFinite(rawReceiptNo) && rawReceiptNo > 0 ? rawReceiptNo : undefined;

        const payload = {
          ...(receiptNo ? { receiptNo } : {}),
          bookingDate,
          bookerName,
          mobile,
          programDate,
          hallId,
          hallIds,
          hallNames,
          timings,
          amount,
          hallCharges: amount,
          discount,
          netAmount,
          receivedAmount,
          remainingAmount: Math.max(0, netAmount - receivedAmount),
          paymentMethod: 'CASH',
          status: 'Confirmed',
        };

        try {
          const existingMatch = currentBookings.find(b => {
            if (b.isDeleted) return false;
            if (receiptNo && Number(b.receiptNo) === receiptNo) return true;
            const bProgDate = b.programDate ? new Date(b.programDate).toISOString().slice(0, 10) : '';
            const bHallId = b.hallId || b.hallAccount?.id || (Array.isArray(b.hallIds) ? b.hallIds[0] : '');
            const bTimings = String(b.timings || 'Evening').trim().toLowerCase();
            return bProgDate === programDate && bHallId === hallId && bTimings === timings.toLowerCase();
          });

          if (existingMatch) {
            if (existingMatch.status === 'POSTED') {
              imported += 1;
            } else {
              await updateBooking(existingMatch.id, payload);
              imported += 1;
            }
          } else {
            const created = await addBooking(payload);
            if (created) currentBookings.push(created);
            imported += 1;
          }
        } catch (err) {
          if (err?.response?.status === 409) {
            const fallbackTimings = ['Morning', 'Afternoon', 'Evening', 'Night'].filter(
              slot => slot.toLowerCase() !== timings.toLowerCase()
            );
            let recovered = false;
            for (const altTiming of fallbackTimings) {
              try {
                const created = await addBooking({ ...payload, timings: altTiming });
                if (created) currentBookings.push(created);
                imported += 1;
                recovered = true;
                break;
              } catch {
                // try next slot
              }
            }
            if (!recovered) failed += 1;
          } else {
            failed += 1;
          }
        }
      }

      if (imported > 0) await fetchBookings({ ...dateRange, ...(selectedHallId ? { hallId: selectedHallId } : {}) });
      showToast(`Imported ${imported} booking(s)${failed ? `, skipped ${failed} row(s)` : ''}`, failed ? 'warning' : 'success');
    } catch (error) {
      showToast(error.message || 'Failed to import hall bookings', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DashboardLayout breadcrumbs={['Revenue', t('tables.hallBookings.title')]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.hallBookings.title')}</h1>
                <p className="text-sm text-slate-400 mt-1">{t('tables.hallBookings.desc')}</p>
              </div>
              <div className="ml-3 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700">
                <p className="text-[11px] text-slate-400">Filtered Hall Income</p>
                <p className="text-lg font-bold text-emerald-300">Rs {((bookings || []).reduce((s, b) => s + (Number(b.netAmount || 0)), 0)).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold border border-slate-700 transition-all disabled:opacity-50"
              title="Import hall bookings from Excel"
            >
              <Upload className="h-4 w-4" /> {isImporting ? 'Importing...' : 'Import Excel'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold border border-slate-700 transition-all"
              title="Export filtered hall bookings to Excel"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-900/20 transition-all"
              title="Print filtered hall bookings"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
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
              <div className="flex flex-wrap items-center gap-2 w-full">
                <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50">
                  <option value="all">All dates</option>
                  <option value="month">Monthly income</option>
                  <option value="3months">Last 3 months income</option>
                  <option value="6months">Last 6 months income</option>
                  <option value="day">Daily income</option>
                </select>
                {period === 'month' && <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />}
                {period === 'day' && <DateInput type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50" />}
                <select value={selectedHallId} onChange={e => setSelectedHallId(e.target.value)} className="min-w-[180px] rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50">
                  <option value="">All halls</option>
                  {hallOptions.map(hall => <option key={hall.id} value={hall.id}>{hall.name}</option>)}
                </select>
                {canEditOrDelete && filtered.length > 0 && (
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-semibold text-slate-300 cursor-pointer hover:border-slate-700 transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                    <span>Select All ({filtered.length})</span>
                  </label>
                )}
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
                            booking.status === 'POSTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            booking.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            booking.status === 'Refunded' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {booking.status === 'POSTED' ? (
                              <>
                                <CheckCircle className="w-3 h-3 shrink-0" /> POSTED
                              </>
                            ) : booking.status === 'Cancelled' ? (
                              <>
                                <AlertTriangle className="w-3 h-3 shrink-0" /> CANCELLED
                              </>
                            ) : booking.status === 'Refunded' ? (
                              <>
                                <RotateCcw className="w-3 h-3 shrink-0" /> REFUNDED
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
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-800/60 pb-2.5">
                            <div>
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider block">Hall Charges</span>
                              <span className="font-bold text-slate-200 text-sm">
                                Rs. {Math.round(Number(booking.hallCharges ?? booking.amount ?? 0)).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider block">Discount</span>
                              <span className="font-bold text-orange-400 text-sm">
                                Rs. {Math.round(Number(booking.discount || 0)).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider block">Received</span>
                              <span className="font-bold text-sky-400 text-sm">
                                Rs. {Math.round(Number(booking.receivedAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider block">Remaining</span>
                              <span className={`font-bold text-sm ${Number(booking.remainingAmount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                Rs. {Math.round(Number(booking.remainingAmount || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-amber-400" /> NET AMOUNT
                            </span>
                            <span className="font-bold text-emerald-400 text-sm">
                              Rs. {Math.round(Number(booking.netAmount ?? ((booking.hallCharges ?? booking.amount ?? 0) - (booking.discount || 0)))).toLocaleString()}
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
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5 shrink-0 mt-0.5">
                              <Building2 className="w-3.5 h-3.5 text-amber-400" /> HALL{getBookingHallNamesList(booking).length > 1 ? `S (${getBookingHallNamesList(booking).length})` : ''}
                            </span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {getBookingHallNamesList(booking).length > 0 ? (
                                getBookingHallNamesList(booking).map((hName, idx) => (
                                  <span key={idx} className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60">
                                    {hName}
                                  </span>
                                ))
                              ) : (
                                <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 border border-slate-700/60">
                                  N/A
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" /> BOOKING DATE
                            </span>
                            <span className="font-semibold text-slate-100 text-xs">
                              {formatDateDDMMYYYY(booking.bookingDate || booking.programDate || booking.createdAt)}
                              {booking.timings && <span className="text-slate-400 font-normal ml-1.5">({booking.timings})</span>}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Date & Action Icons */}
                      <div className="flex flex-col gap-3 pt-3.5 border-t border-slate-800/80">
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDateDDMMYYYY(booking.bookingDate || booking.programDate || booking.createdAt)}
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
                              onClick={() => handlePost(booking)}
                              className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-sm ${
                                Number(booking.remainingAmount || 0) > 0
                                  ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 hover:bg-slate-800'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                              }`}
                              title={Number(booking.remainingAmount || 0) > 0 ? "Remaining amount must be 0 to post to ledger" : "Post to Ledger"}
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
                    <th className="px-6 py-4">Booking Date</th>
                    <th className="px-6 py-4">{t('receipt.hall')}</th>
                    <th className="px-6 py-4">Hall Charges</th>
                    <th className="px-6 py-4">Discount</th>
                    <th className="px-6 py-4">Received</th>
                    <th className="px-6 py-4">Remaining</th>
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
                        <div className="font-medium">{formatDateDDMMYYYY(booking.bookingDate || booking.programDate || booking.createdAt)}</div>
                        <div className="text-xs text-slate-500">{booking.timings || 'Any time'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {getBookingHallNamesList(booking).length > 0 ? (
                            getBookingHallNamesList(booking).map((hName, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                                {hName}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                              N/A
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-200">Rs. {Math.round(Number(booking.hallCharges ?? booking.amount ?? 0)).toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-orange-400">Rs. {Math.round(Number(booking.discount || 0)).toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-sky-400">Rs. {Math.round(Number(booking.receivedAmount || 0)).toLocaleString()}</td>
                      <td className={`px-6 py-4 font-bold ${Number(booking.remainingAmount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Rs. {Math.round(Number(booking.remainingAmount || 0)).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {booking.status === 'POSTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="h-3 w-3" /> Posted
                          </span>
                        ) : booking.status === 'Cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Cancelled
                          </span>
                        ) : booking.status === 'Refunded' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <RotateCcw className="h-3 w-3" /> Refunded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Pending Post
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {(booking.status === 'Confirmed' || booking.status === 'Pending') && canPostToLedger && (
                          <button onClick={() => handlePost(booking)}
                            className={`p-1.5 rounded transition-colors inline-flex ${
                              Number(booking.remainingAmount || 0) > 0
                                ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/50'
                                : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/40'
                            }`}
                            title={Number(booking.remainingAmount || 0) > 0 ? "Remaining amount must be 0 to post to ledger" : "Post to Ledger"}>
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
                      <td colSpan={canEditOrDelete ? "11" : "10"} className="px-6 py-12 text-center text-slate-500 text-sm">
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

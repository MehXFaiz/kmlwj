import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Download,
  Upload,
  LayoutGrid,
  Table as TableIcon,
  Heart,
  Calendar,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  User,
  Phone,
  FileSpreadsheet,
  X,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Users,
  ChevronRight,
  ArrowUpRight,
  Building,
  DollarSign,
  ShieldCheck,
  Eye,
  Printer,
  Wallet,
  Receipt,
  Hash
} from 'lucide-react';
import { useDonationStore } from '../store/donationStore';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useDonorStore } from '../store/donorStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { VoucherSlipModal } from '../components/common/VoucherSlipModal';
import { resolveVoucherRecipientDetails } from '../utils/voucherRecipientResolver';
import { DONATION_TYPES, donationTypeDisplay } from '../constants/donationTypes';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { showToast } from '../components/ui/Toast';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const INFLOW_DONATION_TYPES = [
  { value: 'ALL', label: 'All Donation Types' },
  { value: 'GENERAL_DONATION', label: 'General Donation' },
  { value: 'MONTHLY', label: 'Monthly Donation' },
  { value: 'MARRIAGE', label: 'Marriage Donation' },
  { value: 'MEDICAL', label: 'Medical Donation' },
  { value: 'EDUCATION', label: 'Education Donation' },
  { value: 'CUSTOM', label: 'Other / Custom Donation' },
];

const PAYMENT_METHODS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const STATUSES = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// ── Main DonationReports Component ──────────────────────────────────────────
export const DonationReports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Inflow store (Donations Received from Donors)
  const {
    donations: receivedDonations,
    stats: receivedStats,
    loading: loadingReceived,
    fetchDonations: fetchReceivedDonations,
  } = useDonationReceivedStore();

  // Outflow store (Welfare Distributed to Beneficiaries)
  const {
    donations: distributedDonations,
    loading: loadingDistributed,
    fetchDonations: fetchDistributedDonations,
  } = useDonationStore();

  const { donors, fetchDonors } = useDonorStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  // Active Tab: 'received' (Default: Inflows/Receipts as requested), 'donor_summary', 'distributed', 'beneficiary_summary'
  const [activeTab, setActiveTab] = useState('received');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDonor, setSelectedDonor] = useState('ALL');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // Default to clean table

  // Slip Modal & History Drawers State
  const [selectedReceiptForSlip, setSelectedReceiptForSlip] = useState(null);
  const [selectedDonorHistory, setSelectedDonorHistory] = useState(null);
  const [selectedBeneficiaryHistory, setSelectedBeneficiaryHistory] = useState(null);

  // Initial Data Load
  useEffect(() => {
    fetchReceivedDonations({ limit: 1000 });
    fetchDistributedDonations({ limit: 1000 });
    fetchDonors();
    fetchBeneficiaries();
  }, [fetchReceivedDonations, fetchDistributedDonations, fetchDonors, fetchBeneficiaries]);

  // Handle Date Presets
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      setDateRange({ start: todayStr, end: todayStr });
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setDateRange({ start, end });
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setDateRange({ start, end });
    } else if (preset === 'THIS_YEAR') {
      const start = `${now.getFullYear()}-01-01`;
      const end = `${now.getFullYear()}-12-31`;
      setDateRange({ start, end });
    } else if (preset === 'ALL') {
      setDateRange({ start: '', end: '' });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedDonor('ALL');
    setSelectedBeneficiary('ALL');
    setSelectedType('ALL');
    setSelectedMethod('ALL');
    setSelectedStatus('ALL');
    setDateRange({ start: '', end: '' });
    setDatePreset('ALL');
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    selectedDonor !== 'ALL' ||
    selectedBeneficiary !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedMethod !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    Boolean(dateRange.start) ||
    Boolean(dateRange.end);

  // ── Filtered Donations Received (Inflows) ──────────────────────────────────
  const filteredReceivedDonations = useMemo(() => {
    return receivedDonations.filter((d) => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const receiptNo = (d.receiptNo || '').toLowerCase();
        const donorName = (d.donor?.fullName || 'walk-in donor').toLowerCase();
        const donorCode = (d.donor?.donorCode || '').toLowerCase();
        const mobile = (d.donor?.mobile || '').toLowerCase();
        const cnic = (d.donor?.cnic || '').toLowerCase();
        const type = (d.donationType || '').toLowerCase();
        const customType = (d.customDonationType || '').toLowerCase();
        const method = (d.paymentMethod || '').toLowerCase();
        const refNo = (d.referenceNo || '').toLowerCase();
        const chequeNo = (d.chequeNo || '').toLowerCase();
        const narration = (d.narration || '').toLowerCase();
        const createdBy = (d.createdBy?.fullName || '').toLowerCase();
        const amt = String(d.amount || '');

        const matches =
          receiptNo.includes(q) ||
          donorName.includes(q) ||
          donorCode.includes(q) ||
          mobile.includes(q) ||
          cnic.includes(q) ||
          type.includes(q) ||
          customType.includes(q) ||
          method.includes(q) ||
          refNo.includes(q) ||
          chequeNo.includes(q) ||
          narration.includes(q) ||
          createdBy.includes(q) ||
          amt.includes(q);

        if (!matches) return false;
      }

      if (selectedDonor !== 'ALL' && d.donorId !== selectedDonor) return false;

      if (selectedType !== 'ALL') {
        if (d.donationType !== selectedType) return false;
      }

      if (selectedMethod !== 'ALL') {
        const m = (d.paymentMethod || 'CASH').toUpperCase();
        if (selectedMethod === 'BANK' && m !== 'BANK' && m !== 'ONLINE') return false;
        if (selectedMethod !== 'BANK' && m !== selectedMethod) return false;
      }

      if (selectedStatus !== 'ALL') {
        const s = (d.status || 'POSTED').toUpperCase();
        if (s !== selectedStatus) return false;
      }

      // Date Range
      const dDate = new Date(d.receiptDate || d.createdAt).getTime();
      if (dateRange.start && dDate < new Date(dateRange.start).getTime()) return false;
      if (dateRange.end && dDate > new Date(dateRange.end).getTime() + 86400000) return false;

      return true;
    });
  }, [receivedDonations, searchTerm, selectedDonor, selectedType, selectedMethod, selectedStatus, dateRange]);

  // ── Donor-wise Cumulative Summary ──────────────────────────────────────────
  const donorSummaryList = useMemo(() => {
    const map = new Map();

    receivedDonations.forEach((d) => {
      const donorKey = d.donorId || d.donor?.fullName || 'Walk-in Donor';
      const donorName = d.donor?.fullName || 'Walk-in Donor';
      const donorCode = d.donor?.donorCode || '-';
      const mobile = d.donor?.mobile || '-';
      const cnic = d.donor?.cnic || '-';

      if (!map.has(donorKey)) {
        map.set(donorKey, {
          id: donorKey,
          name: donorName,
          code: donorCode,
          mobile,
          cnic,
          totalAmount: 0,
          receiptsCount: 0,
          types: new Set(),
          lastDonationDate: d.receiptDate || d.createdAt,
          receipts: [],
        });
      }

      const item = map.get(donorKey);
      const amt = Number(d.amount) || 0;
      item.totalAmount += amt;
      item.receiptsCount += 1;
      const typeLabel = d.donationType === 'CUSTOM' ? d.customDonationType || 'Custom' : d.donationType?.replace('_', ' ') || 'General';
      item.types.add(typeLabel);

      if (new Date(d.receiptDate || d.createdAt) > new Date(item.lastDonationDate)) {
        item.lastDonationDate = d.receiptDate || d.createdAt;
      }

      item.receipts.push(d);
    });

    let list = Array.from(map.values());

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (dn) =>
          dn.name.toLowerCase().includes(q) ||
          dn.code.toLowerCase().includes(q) ||
          dn.mobile.toLowerCase().includes(q) ||
          dn.cnic.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [receivedDonations, searchTerm]);

  // ── Calculated Inflow Metrics ──────────────────────────────────────────────
  const totalReceivedAmount = filteredReceivedDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalReceivedCount = filteredReceivedDonations.length;

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentMonthReceived = receivedDonations
    .filter((d) => new Date(d.receiptDate || d.createdAt) >= currentMonthStart)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const totalCashReceived = receivedDonations
    .filter((d) => d.paymentMethod === 'CASH')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const totalBankAndChequeReceived = receivedDonations
    .filter((d) => d.paymentMethod === 'BANK' || d.paymentMethod === 'CHEQUE' || d.paymentMethod === 'ONLINE')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Format Helper for Donation Type
  const formatDonationType = (type, customType) => {
    if (type === 'CUSTOM') return customType || 'Custom';
    const found = INFLOW_DONATION_TYPES.find((t) => t.value === type);
    return found ? found.label.replace(' Donation', '') : type || 'General';
  };

  // ── Export to Excel (CSV) ──────────────────────────────────────────────────
  const csvCell = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportExcel = () => {
    if (activeTab === 'donor_summary') {
      const header = 'Donor Name,Donor Code,Mobile,CNIC,Total Donated (PKR),Total Receipts,Donation Types,Last Donation Date\n';
      const csv = donorSummaryList
        .map((dn) =>
          [
            csvCell(dn.name),
            csvCell(dn.code),
            csvCell(dn.mobile),
            csvCell(dn.cnic),
            dn.totalAmount || 0,
            dn.receiptsCount || 0,
            csvCell(Array.from(dn.types).join('; ')),
            csvCell(formatDateDDMMYYYY(dn.lastDonationDate)),
          ].join(',')
        )
        .join('\n');

      const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Donors_Summary_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported Donors Summary to CSV successfully.', 'success');
      return;
    }

    // Default: Inflows / Receipts Export
    const header = 'Receipt #,Donor Name,Donor Code,Mobile,CNIC,Donation Type,Amount (PKR),Payment Method,Bank Account,Date,Status,Reference #,Created By\n';
    const csv = filteredReceivedDonations
      .map((d) => [
        csvCell(d.receiptNo || `REC-${d.id?.slice(0, 6)}`),
        csvCell(d.donor?.fullName || 'Walk-in Donor'),
        csvCell(d.donor?.donorCode || '-'),
        csvCell(d.donor?.mobile || '-'),
        csvCell(d.donor?.cnic || '-'),
        csvCell(formatDonationType(d.donationType, d.customDonationType)),
        Number(d.amount) || 0,
        csvCell(d.paymentMethod || 'CASH'),
        csvCell(d.bankAccount?.accountName || '-'),
        csvCell(formatDateDDMMYYYY(d.receiptDate || d.createdAt)),
        csvCell(d.status || 'POSTED'),
        csvCell(d.referenceNo || d.chequeNo || '-'),
        csvCell(d.createdBy?.fullName || 'System User'),
      ].join(','))
      .join('\n');

    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Donations_Received_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Donation Receipts to CSV successfully.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16 print:bg-white print:text-black">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-0.5 rounded-full">
              <Heart className="w-3 h-3" /> Charitable Inflows
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Donation Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record donation receipts, dynamic donor contributions & automated General Ledger postings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchReceivedDonations({ limit: 1000 })}
            disabled={loadingReceived}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReceived ? 'animate-spin text-emerald-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" /> Excel (CSV)
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>

          <button
            onClick={() => navigate('/donations/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Donation</span>
          </button>
        </div>
      </div>

      {/* ── Top Summary KPI Cards (Exact data and styling as in screenshot) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Total Donations */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Donations</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(receivedStats?.totalAmount ?? totalReceivedAmount).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {receivedStats?.totalReceipts ?? totalReceivedCount}
              </span> receipts recorded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80" />
        </div>

        {/* Monthly Donations */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Monthly Donations (Inflow)</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(receivedStats?.currentMonthAmount ?? currentMonthReceived).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Collected this month
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 opacity-80" />
        </div>

        {/* Cash in Hand */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cash In Hand</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(receivedStats?.cashAmount ?? totalCashReceived).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Cash receipts deposited
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 opacity-80" />
        </div>

        {/* Bank & Cheques */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Bank & Cheques</span>
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {(((receivedStats?.bankAmount ?? 0) + (receivedStats?.chequeAmount ?? 0)) || totalBankAndChequeReceived).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Bank: Rs {(receivedStats?.bankAmount || 0).toLocaleString()} &middot; Cheque: Rs {(receivedStats?.chequeAmount || 0).toLocaleString()}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400 opacity-80" />
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'received'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Donation Receipts ({filteredReceivedDonations.length})
          </button>
          <button
            onClick={() => setActiveTab('donor_summary')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'donor_summary'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Donor-wise Summary ({donorSummaryList.length})
          </button>
        </div>

        {activeTab === 'received' && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-400'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-400'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Bar (Matches the layout shown in screenshot) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by receipt #, donor, phone, cheque #..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Donor Filter */}
          <div>
            <select
              value={selectedDonor}
              onChange={(e) => setSelectedDonor(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Donors</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.donorCode || d.mobile || 'Donor'})
                </option>
              ))}
            </select>
          </div>

          {/* Donation Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {INFLOW_DONATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Period Presets, Date Pickers & Status Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Period:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePreset(p.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, start: e.target.value }));
                  setDatePreset('CUSTOM');
                }}
                className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, end: e.target.value }));
                  setDatePreset('CUSTOM');
                }}
                className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TAB 1: DONATIONS RECEIVED (Exact Table from Screenshot) ── */}
      {activeTab === 'received' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
          {loadingReceived && receivedDonations.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading donation receipts...</p>
            </div>
          ) : filteredReceivedDonations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-500 mx-auto mb-3">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No donation records found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Try adjusting your search criteria or date filters to find matching records.'
                  : 'Get started by recording your first charitable donation receipt.'}
              </p>
              {!hasActiveFilters && (
                <button
                  onClick={() => navigate('/donations/new')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Record First Donation
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Donor Details</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredReceivedDonations.map((d) => {
                    const isPosted = d.status === 'POSTED';
                    const isCash = d.paymentMethod === 'CASH';
                    const isBank = d.paymentMethod === 'BANK' || d.paymentMethod === 'ONLINE';
                    const isCheque = d.paymentMethod === 'CHEQUE';

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Receipt No */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {d.receiptNo || `REC-${d.id.slice(0, 6).toUpperCase()}`}
                          </span>
                          {d.referenceNo && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Ref: {d.referenceNo}
                            </div>
                          )}
                        </td>

                        {/* Donor Details */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {d.donor?.fullName || 'Walk-in Donor'}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {d.donor?.donorCode && (
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px]">
                                {d.donor.donorCode}
                              </span>
                            )}
                            {d.donor?.mobile && (
                              <span className="flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {d.donor.mobile}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Donation Type */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {formatDonationType(d.donationType, d.customDonationType)}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4">
                          <div className="font-bold font-mono text-slate-900 dark:text-slate-50 text-sm">
                            Rs {Number(d.amount || 0).toLocaleString()}
                          </div>
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {isCash && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <Wallet className="w-3 h-3" /> Cash in Hand
                              </span>
                            )}
                            {isBank && (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                  <Building className="w-3 h-3" /> Bank Account
                                </span>
                                {d.bankAccount && (
                                  <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                    {d.bankAccount.accountName}
                                  </div>
                                )}
                              </div>
                            )}
                            {isCheque && (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                                  <CreditCard className="w-3 h-3" /> Cheque
                                </span>
                                {d.chequeNo && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    #{d.chequeNo}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {d.receiptDate ? new Date(d.receiptDate).toLocaleDateString() : '-'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPosted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : d.status === 'CANCELLED'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {isPosted && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {d.status || 'POSTED'}
                          </span>
                        </td>

                        {/* Created By */}
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          <div>{d.createdBy?.fullName || 'System User'}</div>
                          <div className="text-[9px] text-slate-400">
                            {d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedReceiptForSlip(d)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                              title="Print Donation Receipt Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReceivedDonations.map((d) => {
                const isPosted = d.status === 'POSTED';
                return (
                  <div
                    key={d.id}
                    className="p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {d.receiptNo || `REC-${d.id.slice(0, 6)}`}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {d.donor?.fullName || 'Walk-in Donor'}
                        </h4>
                        <div className="text-[11px] text-slate-400">
                          {d.donor?.mobile || d.donor?.donorCode || 'Donor'}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPosted
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200'
                        }`}
                      >
                        {d.status || 'POSTED'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Amount</span>
                        <div className="text-base font-black font-mono text-slate-900 dark:text-slate-50">
                          Rs {Number(d.amount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Type</span>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {formatDonationType(d.donationType, d.customDonationType)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {d.receiptDate ? new Date(d.receiptDate).toLocaleDateString() : '-'}
                      </span>
                      <button
                        onClick={() => setSelectedReceiptForSlip(d)}
                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" /> Slip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DONOR-WISE CUMULATIVE CONTRIBUTIONS ── */}
      {activeTab === 'donor_summary' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
          {donorSummaryList.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No donor summary records</h3>
              <p className="text-xs text-slate-500 mt-1">Donor cumulative summary appears here as donations are recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Donor Name</th>
                    <th className="py-3 px-4">Donor Code / Contact</th>
                    <th className="py-3 px-4">Total Donated (Lifetime)</th>
                    <th className="py-3 px-4">Total Receipts</th>
                    <th className="py-3 px-4">Donation Types</th>
                    <th className="py-3 px-4">Last Donation Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {donorSummaryList.map((dn) => (
                    <tr key={dn.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{dn.name}</td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{dn.code}</div>
                        {dn.mobile && <div className="text-[11px] text-slate-400">{dn.mobile}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        Rs {dn.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {dn.receiptsCount} receipt{dn.receiptsCount > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {Array.from(dn.types).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDateDDMMYYYY(dn.lastDonationDate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedDonorHistory(dn)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Receipts</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Print Voucher / Receipt Slip Modal ── */}
      {selectedReceiptForSlip && (
        <DonationSlipWrapper
          donation={selectedReceiptForSlip}
          onClose={() => setSelectedReceiptForSlip(null)}
        />
      )}

      {/* ── Donor History Modal ── */}
      {selectedDonorHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedDonorHistory.name} — Donation History
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Code: {selectedDonorHistory.code} &middot; Contact: {selectedDonorHistory.mobile}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDonorHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Lifetime Contributions</div>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    Rs {selectedDonorHistory.totalAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Receipts</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedDonorHistory.receiptsCount} donation{selectedDonorHistory.receiptsCount > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-2.5">Receipt #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                    {selectedDonorHistory.receipts.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.receiptNo || `REC-${r.id.slice(0, 6)}`}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {formatDateDDMMYYYY(r.receiptDate || r.createdAt)}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                          {formatDonationType(r.donationType, r.customDonationType)}
                        </td>
                        <td className="p-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          Rs {Number(r.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-2.5">{r.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setSelectedDonorHistory(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Slip Wrapper Helper Component
function DonationSlipWrapper({ donation, onClose }) {
  const rec = resolveVoucherRecipientDetails(donation);
  const typeLabel = donation.donationType === 'CUSTOM'
    ? donation.customDonationType || 'General Donation'
    : donation.donationType?.replace('_', ' ') || 'General Donation';

  return (
    <VoucherSlipModal
      isOpen={true}
      onClose={onClose}
      title={`${typeLabel.toUpperCase()} RECEIPT`}
      voucherNo={donation.receiptNo || donation.id?.slice(0, 8)?.toUpperCase()}
      fileNo={donation.donor?.donorCode || donation.donor?.cnic || ''}
      date={donation.receiptDate || donation.createdAt}
      name={donation.donor?.fullName || rec.name || 'Donor'}
      cnic={donation.donor?.cnic || rec.cnic || ''}
      mobile={donation.donor?.mobile || rec.mobile || ''}
      address={donation.donor?.address || rec.address || ''}
      paymentMethod={donation.paymentMethod}
      accountName="Donation Income A/c"
      particulars={`Charitable Donation Received - ${typeLabel}${donation.narration ? ` (${donation.narration})` : ''}${donation.chequeNo ? ` [Cheque #${donation.chequeNo}]` : ''}`}
      amount={donation.amount}
      preparedBy={donation.createdBy?.fullName || 'Operator'}
      payeeLabel="Receiver's Sign"
      partyLabel="Donor's Sign"
      type="CREDIT"
    />
  );
}

export default DonationReports;

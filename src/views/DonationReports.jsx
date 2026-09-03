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
  Eye
} from 'lucide-react';
import { useDonationStore } from '../store/donationStore';
import { useDonationReceivedStore } from '../store/donationReceivedStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { DONATION_TYPES, donationTypeDisplay } from '../constants/donationTypes';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { showToast } from '../components/ui/Toast';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

// ── Import CSV Modal ────────────────────────────────────────────────────────
function ImportModal({ isOpen, onClose, onImportSuccess }) {
  const { addDonation } = useDonationStore();
  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const downloadSampleCSV = () => {
    const csvContent =
      "Beneficiary Name,Donation Type,Amount,Payment Method,Beneficiary Mobile,CNIC,Remarks\n" +
      "Muhammad Ali,MONTHLY,5000,CASH,03001234567,42101-1234567-1,Monthly Family Aid\n" +
      "Fatima Zahra,MEDICAL,7500,BANK,03219876543,42101-9876543-2,Hospital Treatment Support\n" +
      "Usman Ghani,RATION,10000,CASH,03335554433,42101-5554433-3,Ramadan Ration Package";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Sample_Welfare_Donations_Import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result || '';
        const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
        if (lines.length <= 1) {
          showToast('CSV file is empty or has no data rows.', 'warning');
          return;
        }

        const parseLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const rawHeaders = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, '').trim());

        const findValue = (rowValues, possibleKeys) => {
          for (const key of possibleKeys) {
            const idx = rawHeaders.findIndex((h) => h.includes(key));
            if (idx !== -1 && rowValues[idx] !== undefined) {
              return rowValues[idx].replace(/^["']|["']$/g, '').trim();
            }
          }
          return '';
        };

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseLine(lines[i]);
          if (vals.length === 0 || vals.every((v) => !v)) continue;

          const name = findValue(vals, ['beneficiary', 'recipient', 'name', 'payee', 'donor']);
          const typeRaw = findValue(vals, ['type', 'category', 'head', 'aid']).toUpperCase();
          const amountRaw = findValue(vals, ['amount', 'pkr', 'rs', 'val']);
          const methodRaw = findValue(vals, ['method', 'payment', 'mode']).toUpperCase();
          const mobile = findValue(vals, ['mobile', 'phone', 'contact']);
          const cnic = findValue(vals, ['cnic', 'nic', 'id']);
          const remarks = findValue(vals, ['remark', 'note', 'desc', 'narration']);

          const amountNum = parseFloat(amountRaw.replace(/[^0-9.]/g, '')) || 0;
          const method = ['BANK', 'CHEQUE', 'ONLINE'].includes(methodRaw) ? methodRaw : 'CASH';

          let donationType = 'MONTHLY';
          if (typeRaw.includes('ZAKAT')) donationType = 'ZAKAT';
          else if (typeRaw.includes('MEDICAL')) donationType = 'MEDICAL';
          else if (typeRaw.includes('MARRIAGE')) donationType = 'MARRIAGE';
          else if (typeRaw.includes('RATION')) donationType = 'RATION';
          else if (typeRaw.includes('EDUCATION')) donationType = 'EDUCATION';
          else if (typeRaw.includes('GENERAL')) donationType = 'GENERAL_DONATION';

          const isValid = Boolean(name && amountNum > 0);

          rows.push({
            id: i,
            donorName: name || 'Welfare Aid Recipient',
            donationType,
            amount: amountNum,
            paymentMethod: method,
            donorMobile: mobile,
            donorCnic: cnic,
            remarks: remarks || 'Imported via CSV',
            isValid,
            error: !name ? 'Missing Name' : amountNum <= 0 ? 'Invalid Amount' : ''
          });
        }

        setParsedRows(rows);
        if (rows.length === 0) {
          showToast('No valid data rows found in CSV file.', 'warning');
        }
      } catch (err) {
        showToast('Error parsing CSV file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast('No valid records to import.', 'warning');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    try {
      for (const row of validRows) {
        await addDonation({
          donorName: row.donorName,
          donationType: row.donationType,
          amount: String(row.amount),
          paymentMethod: row.paymentMethod,
          donorMobile: row.donorMobile,
          donorCnic: row.donorCnic,
          remarks: row.remarks
        });
        successCount++;
      }
      showToast(`Successfully imported ${successCount} donation records!`, 'success');
      onImportSuccess();
      onClose();
    } catch (e) {
      showToast(`Imported ${successCount} records before encountering an error: ${e.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-900 text-cyan-600 dark:text-cyan-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import Welfare Records (CSV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload CSV spreadsheet to import welfare donation entries in bulk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Need standard CSV format?</span> Download template file to see column structure.
            </div>
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Sample CSV
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
              Select CSV File
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/50 dark:hover:bg-slate-950/70 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 cursor-pointer group"
            >
              <FileSpreadsheet className="h-8 w-8 text-slate-400 dark:text-slate-500 group-hover:text-cyan-500 transition-all" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {fileName ? fileName : 'Click to select CSV file'}
              </span>
              <span className="text-[11px] text-slate-400">
                Supports .CSV files exported from Excel, Google Sheets, or Bank Disbursal Records
              </span>
            </button>
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">File Preview</span>
                <span className="text-slate-500 dark:text-slate-400">
                  Total: <strong className="text-slate-900 dark:text-white">{parsedRows.length}</strong> | Ready: <strong className="text-emerald-600 dark:text-emerald-400">{validCount}</strong>
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2.5">Beneficiary</th>
                      <th className="p-2.5">Aid Type</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={row.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30' : 'bg-rose-50/40 dark:bg-rose-950/20'}
                      >
                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-200">{row.donorName}</td>
                        <td className="p-2.5">{row.donationType}</td>
                        <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                          Rs {row.amount.toLocaleString()}
                        </td>
                        <td className="p-2.5">{row.paymentMethod}</td>
                        <td className="p-2.5 text-right font-bold">
                          {row.isValid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded-full">
                              Valid
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 text-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded-full">
                              {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleImportSubmit}
            disabled={isImporting || validCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Upload className="h-4 w-4" /> {isImporting ? 'Importing Records...' : `Import ${validCount} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main DonationReports Component ──────────────────────────────────────────
export const DonationReports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { donations, fetchDonations, loading: loadingDonations } = useDonationStore();
  const { donations: receivedDonations, fetchDonations: fetchReceivedDonations } = useDonationReceivedStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  // Active Tab: 'disbursements' (Welfare Outflow), 'beneficiary_summary' (Person-wise aid history), 'received' (Inflow)
  const [activeTab, setActiveTab] = useState('disbursements');

  // Filters State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [datePreset, setDatePreset] = useState('ALL');
  const [filterType, setFilterType] = useState('All');
  const [filterBeneficiary, setFilterBeneficiary] = useState('All');
  const [filterMethod, setFilterMethod] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // Default to clean table
  const [showImportModal, setShowImportModal] = useState(false);

  // Selected Beneficiary History Drawer
  const [historyBeneficiary, setHistoryBeneficiary] = useState(null);

  useEffect(() => {
    fetchDonations({ limit: 1000 });
    fetchReceivedDonations({ limit: 1000 });
    fetchBeneficiaries();
  }, [fetchDonations, fetchReceivedDonations, fetchBeneficiaries]);

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
    setFilterType('All');
    setFilterBeneficiary('All');
    setFilterMethod('All');
    setFilterStatus('All');
    setDateRange({ start: '', end: '' });
    setDatePreset('ALL');
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    filterType !== 'All' ||
    filterBeneficiary !== 'All' ||
    filterMethod !== 'All' ||
    filterStatus !== 'All' ||
    Boolean(dateRange.start) ||
    Boolean(dateRange.end);

  // Helper: Get Beneficiary Info from Record
  const getBeneficiaryDetails = (d) => {
    let name = d.beneficiary?.name || d.donorName;
    let mobile = d.beneficiary?.mobile || d.donorMobile || '';
    let cnic = d.beneficiary?.cnic || d.donorCnic || '';
    let fatherName = d.beneficiary?.fatherName || '';
    let address = d.beneficiary?.address || '';

    if (!name && d.beneficiaryId) {
      const found = beneficiaries.find((b) => String(b.id) === String(d.beneficiaryId));
      if (found) {
        name = found.name;
        mobile = found.mobile || mobile;
        cnic = found.cnic || cnic;
        fatherName = found.fatherName || fatherName;
        address = found.address || address;
      }
    }

    return {
      name: name || 'Welfare Aid Recipient',
      mobile,
      cnic,
      fatherName,
      address,
      beneficiaryId: d.beneficiaryId || null,
    };
  };

  // Filtered Welfare Disbursements (Outflow)
  const filteredDisbursements = useMemo(() => {
    return donations.filter((d) => {
      const ben = getBeneficiaryDetails(d);

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          ben.name.toLowerCase().includes(q) ||
          ben.fatherName.toLowerCase().includes(q) ||
          ben.mobile.toLowerCase().includes(q) ||
          ben.cnic.toLowerCase().includes(q) ||
          (d.donationType || '').toLowerCase().includes(q) ||
          (d.customDonationType || '').toLowerCase().includes(q) ||
          (d.paymentMethod || '').toLowerCase().includes(q) ||
          (d.voucherNo || d.id || '').toLowerCase().includes(q) ||
          (d.remarks || '').toLowerCase().includes(q) ||
          (d.month || '').toLowerCase().includes(q) ||
          String(d.amount || '').includes(q);

        if (!matches) return false;
      }

      if (filterType !== 'All' && d.donationType !== filterType) return false;
      if (filterBeneficiary !== 'All') {
        const targetId = String(filterBeneficiary);
        if (String(d.beneficiaryId) !== targetId && ben.name !== beneficiaries.find((b) => String(b.id) === targetId)?.name) {
          return false;
        }
      }
      if (filterMethod !== 'All' && d.paymentMethod !== filterMethod) return false;
      if (filterStatus !== 'All') {
        const s = (d.status || 'PENDING').toUpperCase();
        if (filterStatus === 'APPROVED' && s !== 'APPROVED' && s !== 'DISBURSED' && s !== 'POSTED') return false;
        if (filterStatus === 'PENDING' && s !== 'PENDING') return false;
      }

      // Date Range Filter
      const dDate = new Date(d.createdAt).getTime();
      if (dateRange.start && dDate < new Date(dateRange.start).getTime()) return false;
      if (dateRange.end && dDate > new Date(dateRange.end).getTime() + 86400000) return false;

      return true;
    });
  }, [donations, searchTerm, filterType, filterBeneficiary, filterMethod, filterStatus, dateRange, beneficiaries]);

  // Aggregated Beneficiary Summary ("Kis ko kb or kitni donation di gayi hai")
  const beneficiarySummaryList = useMemo(() => {
    const map = new Map();

    donations.forEach((d) => {
      const ben = getBeneficiaryDetails(d);
      const key = ben.beneficiaryId || ben.cnic || ben.name;

      if (!map.has(key)) {
        map.set(key, {
          id: ben.beneficiaryId || key,
          name: ben.name,
          fatherName: ben.fatherName,
          cnic: ben.cnic,
          mobile: ben.mobile,
          address: ben.address,
          totalAmount: 0,
          disbursementsCount: 0,
          aidTypes: new Set(),
          lastDisbursementDate: d.createdAt,
          transactions: [],
        });
      }

      const item = map.get(key);
      const amt = Number(d.amount) || 0;
      item.totalAmount += amt;
      item.disbursementsCount += 1;
      item.aidTypes.add(donationTypeDisplay(d.donationType, d.customDonationType) || 'Monthly Aid');

      if (new Date(d.createdAt) > new Date(item.lastDisbursementDate)) {
        item.lastDisbursementDate = d.createdAt;
      }

      item.transactions.push({
        id: d.id,
        amount: amt,
        date: d.createdAt,
        month: d.month || d.disbursementMonth,
        type: donationTypeDisplay(d.donationType, d.customDonationType) || 'Monthly Aid',
        paymentMethod: d.paymentMethod,
        voucherNo: d.voucherNo,
        status: d.status,
        remarks: d.remarks,
      });
    });

    let list = Array.from(map.values());

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.fatherName.toLowerCase().includes(q) ||
          b.cnic.toLowerCase().includes(q) ||
          b.mobile.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [donations, beneficiaries, searchTerm]);

  // Overall Totals & Statistics
  const totalDisbursedAmount = filteredDisbursements.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalBeneficiariesCount = beneficiarySummaryList.length;

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentMonthDisbursed = donations
    .filter((d) => new Date(d.createdAt) >= currentMonthStart)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Export Excel / CSV
  const csvCell = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportExcel = () => {
    if (activeTab === 'beneficiary_summary') {
      const header = 'Beneficiary Name,Father Name,CNIC,Mobile,Total Aid Received (PKR),Times Helped,Aid Categories,Last Aid Date\n';
      const csv = beneficiarySummaryList
        .map((b) =>
          [
            csvCell(b.name),
            csvCell(b.fatherName || '-'),
            csvCell(b.cnic || '-'),
            csvCell(b.mobile || '-'),
            b.totalAmount || 0,
            b.disbursementsCount || 0,
            csvCell(Array.from(b.aidTypes).join('; ')),
            csvCell(formatDateDDMMYYYY(b.lastDisbursementDate)),
          ].join(',')
        )
        .join('\n');

      const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Beneficiary_Welfare_Summary_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported Beneficiary Summary to CSV successfully.', 'success');
      return;
    }

    const header = 'Voucher #,Beneficiary Name,Father Name,CNIC,Mobile,Aid Type,Amount (PKR),Payment Method,Disbursement Date,Status,Remarks\n';
    const csv = filteredDisbursements
      .map((d) => {
        const ben = getBeneficiaryDetails(d);
        return [
          csvCell(d.voucherNo || `DON-${d.id?.slice(0, 6)}`),
          csvCell(ben.name),
          csvCell(ben.fatherName || '-'),
          csvCell(ben.cnic || '-'),
          csvCell(ben.mobile || '-'),
          csvCell(donationTypeDisplay(d.donationType, d.customDonationType) || 'MONTHLY'),
          Number(d.amount) || 0,
          csvCell(d.paymentMethod ? paymentMethodLabel(d.paymentMethod) : 'CASH'),
          csvCell(formatDateDDMMYYYY(d.createdAt)),
          csvCell(d.status || 'APPROVED'),
          csvCell(d.remarks || '-'),
        ].join(',');
      })
      .join('\n');

    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Donation_Disbursements_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Donation Report to CSV successfully.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16 print:bg-white print:text-black">
      {/* ── Import CSV Modal ── */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => fetchDonations({ limit: 1000 })}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 px-2.5 py-0.5 rounded-full">
              <FileText className="h-3 w-3" /> Welfare & Donation Analytics
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Donation Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track who received welfare aid, disbursement history, amounts, dates & donor receipts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-cyan-500" /> Import CSV
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
            <FileText className="h-3.5 w-3.5" /> Print / PDF
          </button>

          <button
            onClick={() => navigate('/donation-distribution/new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Record Welfare Aid
          </button>
        </div>
      </div>

      {/* ── Top Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        {/* Total Welfare Distributed */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Welfare Given</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/50">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {totalDisbursedAmount.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <strong className="text-cyan-600 dark:text-cyan-400">{filteredDisbursements.length}</strong> welfare aid vouchers
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-80" />
        </div>

        {/* Unique Beneficiaries Supported */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Beneficiaries Helped</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              {totalBeneficiariesCount}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Unique individuals supported
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80" />
        </div>

        {/* Current Month Aid */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Current Month Aid</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {currentMonthDisbursed.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Disbursed this month
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 opacity-80" />
        </div>

        {/* Average Aid per Beneficiary */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Average Aid / Person</span>
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Rs {totalBeneficiariesCount > 0 ? Math.round(totalDisbursedAmount / totalBeneficiariesCount).toLocaleString() : '0'}
            </div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Lifetime average per recipient
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400 opacity-80" />
        </div>
      </div>

      {/* ── Report Perspective Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('disbursements')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'disbursements'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Welfare Disbursements ({filteredDisbursements.length})
          </button>
          <button
            onClick={() => setActiveTab('beneficiary_summary')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'beneficiary_summary'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Person-wise Aid Summary ({beneficiarySummaryList.length})
          </button>
        </div>

        {activeTab === 'disbursements' && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs' : 'text-slate-400'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs' : 'text-slate-400'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 shadow-xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Beneficiary Name, CNIC, Phone, Voucher #..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
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

          {/* Beneficiary Filter */}
          <div>
            <select
              value={filterBeneficiary}
              onChange={(e) => setFilterBeneficiary(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all cursor-pointer"
            >
              <option value="All">All Beneficiaries</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.cnic || b.mobile || 'Beneficiary'})
                </option>
              ))}
            </select>
          </div>

          {/* Aid Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all cursor-pointer"
            >
              <option value="All">All Aid Types</option>
              {DONATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all cursor-pointer"
            >
              <option value="All">All Payment Methods</option>
              {['CASH', 'BANK', 'CHEQUE'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Presets and Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Period:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'LAST_MONTH', label: 'Last Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePreset(p.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-cyan-600 text-white shadow-xs'
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="APPROVED">Disbursed / Approved</option>
              <option value="PENDING">Pending</option>
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

      {/* ── TAB 1: ALL WELFARE DISBURSEMENTS ── */}
      {activeTab === 'disbursements' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
          {loadingDonations && donations.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading donation reports...</p>
            </div>
          ) : filteredDisbursements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-center text-cyan-500 mx-auto mb-3">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No welfare donation records found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Try adjusting your search criteria or date filters to find matching records.'
                  : 'Start recording welfare aid disbursements given to beneficiaries.'}
              </p>
              {!hasActiveFilters && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => navigate('/donation-distribution/new')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Record First Aid
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Import CSV
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Voucher #</th>
                    <th className="py-3 px-4">Beneficiary / Recipient (Kis Ko)</th>
                    <th className="py-3 px-4">Aid Type</th>
                    <th className="py-3 px-4">Amount (Kitni)</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Date (Kb)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredDisbursements.map((d) => {
                    const ben = getBeneficiaryDetails(d);
                    const isApproved = d.status === 'APPROVED' || d.status === 'DISBURSED' || d.status === 'POSTED';
                    const isCash = d.paymentMethod === 'CASH';

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {d.voucherNo || `DON-${d.id.slice(0, 6).toUpperCase()}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{ben.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {ben.fatherName && <span>S/o {ben.fatherName}</span>}
                            {ben.cnic && (
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[10px]">
                                {ben.cnic}
                              </span>
                            )}
                            {ben.mobile && (
                              <span className="flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {ben.mobile}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            {donationTypeDisplay(d.donationType, d.customDonationType) || 'MONTHLY'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            Rs {Number(d.amount || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {isCash ? <Banknote className="w-3.5 h-3.5 text-emerald-500" /> : <Building className="w-3.5 h-3.5 text-blue-500" />}
                            {paymentMethodLabel(d.paymentMethod)}
                          </span>
                          {d.bankAccount && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              {d.bankAccount.accountName}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatDateDDMMYYYY(d.createdAt)}
                          {d.month && <div className="text-[10px] text-slate-400">{d.month}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isApproved
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {isApproved ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                            {d.status || 'APPROVED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-[180px] truncate">
                          {d.remarks || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDisbursements.map((d) => {
                const ben = getBeneficiaryDetails(d);
                const isApproved = d.status === 'APPROVED' || d.status === 'DISBURSED' || d.status === 'POSTED';

                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-cyan-500/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{ben.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {ben.mobile || ben.cnic || 'Welfare Aid Recipient'}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isApproved
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200'
                        }`}
                      >
                        {d.status || 'APPROVED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Amount</span>
                        <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                          Rs {Number(d.amount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Aid Category</span>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {donationTypeDisplay(d.donationType, d.customDonationType)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDateDDMMYYYY(d.createdAt)}
                      </span>
                      <span className="font-mono text-slate-400">{d.voucherNo || d.id.slice(0, 8)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: BENEFICIARY-WISE AID SUMMARY (KIS KO KUL KITNI AID DI) ── */}
      {activeTab === 'beneficiary_summary' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
          {beneficiarySummaryList.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No beneficiary summary records</h3>
              <p className="text-xs text-slate-500 mt-1">Beneficiary summary appears here as welfare aid is recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Beneficiary Name (Kis Ko)</th>
                    <th className="py-3 px-4">CNIC / Mobile</th>
                    <th className="py-3 px-4">Total Aid Received (Kul Rakam)</th>
                    <th className="py-3 px-4">Times Helped</th>
                    <th className="py-3 px-4">Aid Categories</th>
                    <th className="py-3 px-4">Last Aid Date (Aakhri Bar)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {beneficiarySummaryList.map((ben) => (
                    <tr key={ben.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{ben.name}</div>
                        {ben.fatherName && <div className="text-[11px] text-slate-400">S/o {ben.fatherName}</div>}
                      </td>
                      <td className="py-3 px-4">
                        {ben.cnic && (
                          <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{ben.cnic}</div>
                        )}
                        {ben.mobile && <div className="text-[11px] text-slate-400">{ben.mobile}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          Rs {ben.totalAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {ben.disbursementsCount} time{ben.disbursementsCount > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {Array.from(ben.aidTypes).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDateDDMMYYYY(ben.lastDisbursementDate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setHistoryBeneficiary(ben)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View History</span>
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

      {/* ── Beneficiary Aid History Modal ── */}
      {historyBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {historyBeneficiary.name} — Aid History
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    CNIC: {historyBeneficiary.cnic || 'N/A'} &middot; Mobile: {historyBeneficiary.mobile || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryBeneficiary(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Lifetime Aid</div>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    Rs {historyBeneficiary.totalAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Disbursals</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {historyBeneficiary.disbursementsCount} record{historyBeneficiary.disbursementsCount > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Voucher #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                    {historyBeneficiary.transactions.map((tx, idx) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 whitespace-nowrap">{formatDateDDMMYYYY(tx.date)}</td>
                        <td className="p-2.5 font-semibold text-cyan-600 dark:text-cyan-400">{tx.type}</td>
                        <td className="p-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          Rs {tx.amount.toLocaleString()}
                        </td>
                        <td className="p-2.5">{tx.paymentMethod}</td>
                        <td className="p-2.5 font-mono text-slate-400">{tx.voucherNo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setHistoryBeneficiary(null)}
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

export default DonationReports;

import { useState, useEffect, useMemo, useRef } from 'react';
import { useDonationStore } from '../store/donationStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { FileText, Download, Upload, LayoutGrid, Table as TableIcon, Heart, Calendar, CreditCard, Banknote, CheckCircle2, Clock, User, Phone, FileSpreadsheet, X, AlertTriangle } from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import { DONATION_TYPES, donationTypeDisplay } from '../constants/donationTypes';
import { paymentMethodLabel } from '../constants/paymentMethods';
import { showToast } from '../components/ui/Toast';

function ImportModal({ isOpen, onClose, onImportSuccess }) {
  const { addDonation } = useDonationStore();
  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const downloadSampleCSV = () => {
    const csvContent = "Donor Name,Donation Type,Amount,Payment Method,Donor Mobile,Remarks\n" +
      "Muhammad Ali,ZAKAT,5000,CASH,03001234567,Zakat Aid\n" +
      "Fatima Zahra,SADQAH,2500,CASH,03219876543,Sadqah Inflow\n" +
      "Usman Ghani,GENERAL,10000,BANK,03335554433,General Aid Support";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Sample_Donation_Import.csv");
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
        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
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

        const rawHeaders = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());

        const findValue = (rowValues, possibleKeys) => {
          for (const key of possibleKeys) {
            const idx = rawHeaders.findIndex(h => h.includes(key));
            if (idx !== -1 && rowValues[idx] !== undefined) {
              return rowValues[idx].replace(/^["']|["']$/g, '').trim();
            }
          }
          return '';
        };

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseLine(lines[i]);
          if (vals.length === 0 || vals.every(v => !v)) continue;

          const name = findValue(vals, ['donor', 'name', 'beneficiary', 'payee']);
          const typeRaw = findValue(vals, ['type', 'category', 'head']).toUpperCase();
          const amountRaw = findValue(vals, ['amount', 'pkr', 'rs', 'val']);
          const methodRaw = findValue(vals, ['method', 'payment', 'mode']).toUpperCase();
          const mobile = findValue(vals, ['mobile', 'phone', 'contact', 'cnic']);
          const remarks = findValue(vals, ['remark', 'note', 'desc', 'narration']);

          const amountNum = parseFloat(amountRaw.replace(/[^0-9.]/g, '')) || 0;
          const method = ['BANK', 'CHEQUE', 'ONLINE'].includes(methodRaw) ? methodRaw : 'CASH';

          let donationType = 'GENERAL';
          if (typeRaw.includes('ZAKAT')) donationType = 'ZAKAT';
          else if (typeRaw.includes('SADQAH')) donationType = 'SADQAH';
          else if (typeRaw.includes('FITRA')) donationType = 'FITRA';
          else if (typeRaw.includes('RATION')) donationType = 'RATION';
          else if (typeRaw.includes('MEDICAL')) donationType = 'MEDICAL';
          else if (typeRaw.includes('EDUCATION')) donationType = 'EDUCATION';

          const isValid = Boolean(name && amountNum > 0);

          rows.push({
            id: i,
            donorName: name || 'Anonymous Donor',
            donationType,
            amount: amountNum,
            paymentMethod: method,
            donorMobile: mobile,
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
    const validRows = parsedRows.filter(r => r.isValid);
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

  const validCount = parsedRows.filter(r => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Import Donation Records (CSV)</h3>
              <p className="text-xs text-slate-400">Upload CSV spreadsheet to import donation entries in bulk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-300">
              <span className="font-semibold text-slate-200">Need standard CSV format?</span> Download template file to see column structure.
            </div>
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Sample CSV
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Select CSV File</label>
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
              className="w-full py-6 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-950/40 hover:bg-slate-950/70 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-cyan-300 cursor-pointer group"
            >
              <FileSpreadsheet className="h-8 w-8 text-slate-500 group-hover:text-cyan-400 group-hover:scale-110 transition-all" />
              <span className="text-xs font-bold text-slate-300">{fileName ? fileName : 'Click to select CSV file'}</span>
              <span className="text-[11px] text-slate-500">Supports .CSV files exported from Excel, Sheets or system</span>
            </button>
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">File Preview</span>
                <span className="text-slate-400">
                  Total: <strong className="text-white">{parsedRows.length}</strong> | Ready: <strong className="text-emerald-400">{validCount}</strong>
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2.5">Donor / Beneficiary</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                    {parsedRows.map(row => (
                      <tr key={row.id} className={row.isValid ? 'hover:bg-slate-800/30' : 'bg-red-500/5 hover:bg-red-500/10'}>
                        <td className="p-2.5 font-bold text-slate-200">{row.donorName}</td>
                        <td className="p-2.5">{row.donationType}</td>
                        <td className="p-2.5 font-bold text-emerald-400">Rs {row.amount.toLocaleString()}</td>
                        <td className="p-2.5">{row.paymentMethod}</td>
                        <td className="p-2.5 text-right font-bold">
                          {row.isValid ? (
                            <span className="text-emerald-400 text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Valid</span>
                          ) : (
                            <span className="text-red-400 text-[10px] bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">{row.error}</span>
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

        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={isImporting} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImportSubmit}
            disabled={isImporting || validCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/40 cursor-pointer"
          >
            <Upload className="h-4 w-4" /> {isImporting ? 'Importing Records...' : `Import ${validCount} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DonationReports = () => {
  const { donations, fetchDonations } = useDonationStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterType, setFilterType] = useState('All');
  const [filterBeneficiary, setFilterBeneficiary] = useState('All');
  const [filterMethod, setFilterMethod] = useState('All');
  const [viewMode, setViewMode] = useState('cards');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchDonations();
    fetchBeneficiaries();
  }, [fetchDonations, fetchBeneficiaries]);

  const getBeneficiaryName = (d) => {
    if (d.beneficiary?.name) return d.beneficiary.name;
    if (d.beneficiaryId) {
      const found = beneficiaries.find(b => String(b.id) === String(d.beneficiaryId));
      if (found?.name) return found.name;
    }
    if (d.donorName) return d.donorName;
    if (d.donor?.fullName) return d.donor.fullName;
    return 'Welfare Aid Recipient';
  };

  const filtered = useMemo(() => {
    return donations.filter(d => {
      // Basic filters
      if (filterType !== 'All' && d.donationType !== filterType) return false;
      if (filterBeneficiary !== 'All') {
        const selectedBen = beneficiaries.find(b => String(b.id) === String(filterBeneficiary));
        const bName = selectedBen?.name;
        const currentBenName = getBeneficiaryName(d);
        if (String(d.beneficiaryId) !== String(filterBeneficiary) && currentBenName !== bName) {
          return false;
        }
      }
      if (filterMethod !== 'All' && d.paymentMethod !== filterMethod) return false;

      // Date Range Filter
      const dDate = new Date(d.createdAt).getTime();
      if (dateRange.start && dDate < new Date(dateRange.start).getTime()) return false;
      if (dateRange.end && dDate > new Date(dateRange.end).getTime() + 86400000) return false; // add 1 day

      return true;
    });
  }, [donations, filterType, filterBeneficiary, filterMethod, dateRange, beneficiaries]);

  const totalAmount = filtered.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handleExportPDF = () => {
    window.print(); // Simple fallback for PDF generation via browser print
  };

  // SQA fix: field values were interpolated into the CSV with no escaping —
  // a value containing a literal double-quote broke the row, and a value
  // starting with =, +, -, or @ (e.g. a beneficiary/donor name) is treated as
  // a formula by Excel/Sheets when a staff member opens the export (CSV
  // formula injection). csvCell() escapes quotes and neutralizes leading
  // formula-trigger characters.
  const csvCell = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportExcel = () => {
    const header = "Beneficiary,Type,Amount,Method,Status,Date\n";
    const csv = filtered.map(d =>
      [
        csvCell(getBeneficiaryName(d)),
        csvCell(donationTypeDisplay(d.donationType, d.customDonationType)),
        Number(d.amount) || 0,
        csvCell(d.paymentMethod ? paymentMethodLabel(d.paymentMethod) : ''),
        csvCell(d.status || 'PENDING'),
        csvCell(new Date(d.createdAt).toLocaleDateString()),
      ].join(',')
    ).join("\n");
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Donation_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-10 print:bg-white print:text-black">
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => fetchDonations()}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400 bg-cyan-950/50 border border-cyan-900/60 px-2.5 py-0.5 rounded-full">
              <FileText className="h-3 w-3" /> Reporting
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Donation Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Filter, import and export donation records</p>
        </div>
        <div className={pageActionsClass}>
          <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-700/50 text-xs font-bold transition-all cursor-pointer shadow-md">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md">
            <Download className="h-4 w-4" /> Excel (CSV)
          </button>
          <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition-all cursor-pointer">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 print:hidden">
        {/* From date */}
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50 [color-scheme:dark]"
          />
        </div>
        {/* To date */}
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Donation Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50 cursor-pointer">
            <option value="All">All Types</option>
            {DONATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Beneficiary</label>
          <select value={filterBeneficiary} onChange={e => setFilterBeneficiary(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50 cursor-pointer">
            <option value="All">All Beneficiaries</option>
            {beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Payment Method</label>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50 cursor-pointer">
            <option value="All">All Methods</option>
            {['CASH', 'BANK', 'CHEQUE'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl print:border-none print:bg-transparent print:p-0 shadow-lg">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-200 print:text-black">Donation Activity</h3>
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 print:hidden">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        </div>
        <div className="text-sm font-bold text-slate-300 print:text-black">
          Total Donations: <span className="text-emerald-400 print:text-black font-extrabold">{totalAmount.toLocaleString()}</span> ({filtered.length} records)
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2">
          {filtered.map((d, idx) => {
            const benName = getBeneficiaryName(d);
            const benMobile = d.beneficiary?.mobile || (d.beneficiaryId ? beneficiaries.find(b => String(b.id) === String(d.beneficiaryId))?.mobile : '') || d.donorMobile || '';
            const isApproved = d.status === 'APPROVED' || d.status === 'POSTED' || d.status === 'COMPLETED';
            const isPending = d.status === 'PENDING' || !d.status;

            return (
              <div
                key={d.id || idx}
                className="group relative rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/95 to-slate-900/60 p-5 shadow-xl hover:shadow-2xl hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between print:border-black print:bg-white print:shadow-none print:text-black"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div>
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-transparent border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-extrabold text-lg shadow-inner shrink-0 group-hover:scale-105 transition-transform print:border-black print:text-black">
                        {benName && benName !== 'Welfare Aid Recipient' ? benName.charAt(0).toUpperCase() : <Heart className="w-5 h-5 text-cyan-400 print:text-black" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-100 group-hover:text-cyan-400 transition-colors leading-tight tracking-tight print:text-black">
                          {benName}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1 print:text-gray-600">
                          {benMobile ? (
                            <>
                              <Phone className="w-3 h-3 text-cyan-400/80 shrink-0 print:text-black" /> {benMobile}
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-cyan-400/80 shrink-0 print:text-black" /> Beneficiary Aid
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      isApproved
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : isPending
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    } print:border-black print:bg-transparent print:text-black`}>
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> {d.status || 'APPROVED'}
                        </>
                      ) : isPending ? (
                        <>
                          <Clock className="w-3.5 h-3.5" /> {d.status || 'PENDING'}
                        </>
                      ) : (
                        d.status || 'RECORDED'
                      )}
                    </span>
                  </div>

                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-3 shadow-inner relative z-10 print:bg-gray-50 print:border-gray-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5 print:border-gray-300">
                      <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5 print:text-black">
                        <Banknote className="w-3.5 h-3.5 text-emerald-400 print:text-black" /> AMOUNT
                      </span>
                      <span className="font-extrabold text-emerald-400 text-base print:text-black">
                        PKR {(Number(d.amount) || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5 print:border-gray-300">
                      <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5 print:text-black">
                        <Heart className="w-3.5 h-3.5 text-cyan-400 print:text-black" /> AID TYPE
                      </span>
                      <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800/90 text-cyan-300 border border-slate-700/60 font-mono uppercase print:bg-transparent print:border-black print:text-black">
                        {donationTypeDisplay(d.donationType, d.customDonationType) || 'GENERAL'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5 print:text-black">
                        <CreditCard className="w-3.5 h-3.5 text-cyan-400 print:text-black" /> METHOD
                      </span>
                      <span className="font-semibold text-slate-200 text-xs uppercase print:text-black">
                        {paymentMethodLabel(d.paymentMethod)}
                        {d.chequeNumber && <span className="text-slate-400 font-normal ml-1">#{d.chequeNumber}</span>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-500 relative z-10 print:border-gray-300 print:text-black">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 print:text-black" />
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                  {d.remarks && (
                    <span className="truncate max-w-[160px] text-slate-400 italic font-normal" title={d.remarks}>
                      {d.remarks}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-900/50 border border-slate-800/70 rounded-2xl">
              <Heart className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold text-sm">No donations match your filters.</p>
              <p className="text-slate-500 text-xs mt-1">Try adjusting the date range or filter criteria.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden print:border-black print:bg-white shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px] print:min-w-0 print:text-black">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 print:bg-gray-100 print:border-black">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Beneficiary</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Method</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 print:text-black">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-black">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-200 print:text-black">{getBeneficiaryName(d)}</p></td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{donationTypeDisplay(d.donationType, d.customDonationType)}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-emerald-400 print:text-black">PKR {(Number(d.amount) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{paymentMethodLabel(d.paymentMethod)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{d.status || 'PENDING'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No donations match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


import { useState, useEffect, useMemo } from 'react';
import { useDonationStore } from '../store/donationStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { FileText, Search, Download, Filter } from 'lucide-react';
import { DesktopOnly, MobileOnly, pageActionsClass } from '../components/common/responsive';

export const DonationReports = () => {
  const { donations, fetchDonations } = useDonationStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterType, setFilterType] = useState('All');
  const [filterBeneficiary, setFilterBeneficiary] = useState('All');
  const [filterMethod, setFilterMethod] = useState('All');

  useEffect(() => {
    fetchDonations();
    fetchBeneficiaries();
  }, [fetchDonations, fetchBeneficiaries]);

  const filtered = useMemo(() => {
    return donations.filter(d => {
      // Basic filters
      if (filterType !== 'All' && d.donationType !== filterType) return false;
      if (filterBeneficiary !== 'All' && d.beneficiaryId !== filterBeneficiary) return false;
      if (filterMethod !== 'All' && d.paymentMethod !== filterMethod) return false;

      // Date Range Filter
      const dDate = new Date(d.createdAt).getTime();
      if (dateRange.start && dDate < new Date(dateRange.start).getTime()) return false;
      if (dateRange.end && dDate > new Date(dateRange.end).getTime() + 86400000) return false; // add 1 day

      return true;
    });
  }, [donations, filterType, filterBeneficiary, filterMethod, dateRange]);

  const totalAmount = filtered.reduce((sum, d) => sum + d.amount, 0);

  const handleExportPDF = () => {
    window.print(); // Simple fallback for PDF generation via browser print
  };

  const handleExportExcel = () => {
    const header = "Beneficiary,Type,Amount,Method,Status,Date\n";
    const csv = filtered.map(d => 
      `"${d.beneficiary?.name}","${d.donationType}",${d.amount},"${d.paymentMethod}","${d.status}","${new Date(d.createdAt).toLocaleDateString()}"`
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400 bg-cyan-950/50 border border-cyan-900/60 px-2.5 py-0.5 rounded-full">
              <FileText className="h-3 w-3" /> Reporting
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Donation Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Filter and export donation records</p>
        </div>
        <div className={pageActionsClass}>
          <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all">
            <Download className="h-4 w-4" /> Excel (CSV)
          </button>
          <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition-all">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Date Range</label>
          <div className="flex gap-2">
            <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full px-2 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50" />
            <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full px-2 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Donation Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50">
            <option value="All">All Types</option>
            {['MONTHLY', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION', 'CUSTOM'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Beneficiary</label>
          <select value={filterBeneficiary} onChange={e => setFilterBeneficiary(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50">
            <option value="All">All Beneficiaries</option>
            {beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Payment Method</label>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-cyan-600/50">
            <option value="All">All Methods</option>
            {['CASH', 'BANK', 'CHEQUE'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl print:border-none print:bg-transparent print:p-0">
        <h3 className="text-lg font-bold text-slate-200 print:text-black">Donation Activity</h3>
        <div className="text-sm font-bold text-slate-300 print:text-black">
          Total Donations: <span className="text-emerald-400 print:text-black">{totalAmount.toLocaleString()}</span> ({filtered.length} records)
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden print:border-black print:bg-white">
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
                  <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-200 print:text-black">{d.beneficiary?.name}</p></td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{d.donationType}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-emerald-400 print:text-black">{d.amount.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{d.paymentMethod}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 print:text-black">{d.status}</td>
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
    </div>
  );
};

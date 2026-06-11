import { useState, useMemo, Fragment } from 'react';
import { useJournalStore } from '../store/journalStore';
import { useCoaStore } from '../store/coaStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JournalEntryModal } from '../components/ledger/JournalEntryModal';
import { Plus, Calendar, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';

export const JournalEntries = () => {
  const { journals } = useJournalStore();
  const { selectedSubsidiary } = useCoaStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedJeId, setExpandedJeId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedJeId(expandedJeId === id ? null : id);
  };

  // Filter journals by subsidiary
  const filteredJournals = useMemo(() => {
    return journals.filter((je) => {
      if (selectedSubsidiary === 'Global') return true;
      return je.subsidiary === selectedSubsidiary;
    });
  }, [journals, selectedSubsidiary]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">Journal Entries Ledger</h2>
          <p className="text-xs text-slate-400">Post manual adjustments, corrections, payroll, and asset depreciation logs.</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" />
          <span>New Journal Entry</span>
        </Button>
      </div>

      {/* Main Grid Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <CardTitle>Posted Transaction Books</CardTitle>
              <CardDescription>Double-entry balancing ledger vouchers.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <Calendar className="h-4 w-4" />
              <span>Current Term</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
        <MobileOnly className="p-3 space-y-2">
          {filteredJournals.length === 0 ? (
            <p className="py-8 text-center text-slate-500 italic text-sm">No posted journals found.</p>
          ) : filteredJournals.map((je) => {
            const debitTotal = je.lines.reduce((s, r) => s + r.debit, 0);
            const creditTotal = je.lines.reduce((s, r) => s + r.credit, 0);
            const isExpanded = expandedJeId === je.id;
            return (
              <div key={je.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 overflow-hidden">
                <button type="button" onClick={() => toggleExpand(je.id)} className="w-full text-left p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-brand-400 text-xs">{je.id}</span>
                    <Badge variant="success" className="text-[9px]">Posted</Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mb-1">{je.reference}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-2">
                    <span>{je.date}</span>
                    <Badge variant="brand">{je.subsidiary}</Badge>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-emerald-400">DR ${debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">CR ${creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-800/60 p-3 space-y-2 bg-slate-950/60">
                    {je.lines.map((line, idx) => (
                      <div key={idx} className="text-[11px] grid grid-cols-2 gap-1">
                        <span className="font-mono text-slate-300">{line.accountCode}</span>
                        <span className="text-right font-mono text-emerald-400">{line.debit > 0 ? `$${line.debit.toFixed(2)}` : line.credit > 0 ? `($${line.credit.toFixed(2)})` : '—'}</span>
                        {line.description && <span className="col-span-2 text-slate-500 truncate">{line.description}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                <th className="py-3 px-4 w-12 text-center"></th>
                <th className="py-3 px-4 w-28">Doc ID</th>
                <th className="py-3 px-4 w-32">Post Date</th>
                <th className="py-3 px-4 w-40">Entity/Subsidiary</th>
                <th className="py-3 px-4">Reference/Memo</th>
                <th className="py-3 px-4 w-32 text-right">Debit Total</th>
                <th className="py-3 px-4 w-32 text-right">Credit Total</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-800/40">
              {filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 italic">
                    No posted journals found for the selected entity.
                  </td>
                </tr>
              ) : (
                filteredJournals.map((je) => {
                  const isExpanded = expandedJeId === je.id;
                  
                  // Total values
                  const debitTotal = je.lines.reduce((s, r) => s + r.debit, 0);
                  const creditTotal = je.lines.reduce((s, r) => s + r.credit, 0);

                  return (
                    <Fragment key={je.id}>
                      {/* Main Journal Row */}
                      <tr 
                        className={`hover:bg-slate-900/20 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900/15' : ''}`}
                        onClick={() => toggleExpand(je.id)}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button className="text-slate-500 cursor-pointer">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-brand-400">{je.id}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">{je.date}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant="brand">{je.subsidiary}</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-200 font-semibold">{je.reference}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                          ${debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-300">
                          ${creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant="success" className="text-[9px]">Posted</Badge>
                        </td>
                      </tr>

                      {/* Expanded Line Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" className="bg-slate-950/50 p-4 border-l-2 border-brand-500">
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                  <FileSpreadsheet className="h-3.5 w-3.5 text-brand-400" />
                                  <span>Voucher Double-Entry Balancing Sheet ({je.id})</span>
                                </span>
                                <span className="text-[10px] text-slate-500">Posted by: <span className="font-semibold text-slate-400">{je.postedBy}</span></span>
                              </div>

                              <div className="border border-slate-800/80 rounded-lg overflow-hidden overflow-x-auto bg-slate-950">
                                <table className="w-full text-left border-collapse min-w-[500px]">
                                  <thead>
                                    <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase bg-slate-900/25">
                                      <th className="py-2 px-3 w-40">GL Account</th>
                                      <th className="py-2 px-3">Description / Memo</th>
                                      <th className="py-2 px-3 w-28 text-right">Debit ($)</th>
                                      <th className="py-2 px-3 w-28 text-right">Credit ($)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {je.lines.map((line, idx) => (
                                      <tr key={idx} className="hover:bg-slate-900/10 text-xs">
                                        <td className="py-2 px-3 font-mono font-bold text-slate-300">
                                          {line.accountCode}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400">
                                          {line.description || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                          {line.debit > 0 ? `$${line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-red-400">
                                          {line.credit > 0 ? `$${line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                    {/* Balancing Row summary */}
                                    <tr className="bg-slate-900/10 font-bold border-t border-slate-800">
                                      <td className="py-2 px-3">Total Voucher</td>
                                      <td className="py-2 px-3"></td>
                                      <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                        ${debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                                        ${creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </DesktopOnly>
        </CardContent>
      </Card>

      {/* Creation Modal */}
      <JournalEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

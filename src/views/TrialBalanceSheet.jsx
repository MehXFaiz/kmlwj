import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Download, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';

// Mock data matching the structure from the uploaded image
const initialData = [
  { id: '1', code: '1000000', nature: 'ASSETS', mainCategory: '', glName: '', remarks: 'MAIN', type: 'main' },
  { id: '2', code: '1010000', nature: 'CURRENT ASSETS', mainCategory: '', glName: '', remarks: 'PARENT', type: 'parent' },
  { id: '3', code: '1010100', nature: 'CURRENT ASSETS', mainCategory: 'CASH AND BANK BALANCES', glName: '', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '4', code: '1010101', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'PETTY CASH', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '5', code: '1010102', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'BANK -1', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '6', code: '1010200', nature: 'CURRENT ASSETS', mainCategory: 'ACCOUNT RECEIVABLE', glName: '', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '7', code: '1010201', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'RECEIVABLE FROM DECORATION COMMISSION', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '8', code: '1010202', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'RECEIVABLE FROM ________', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '9', code: '1010203', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'RECEIVABLE FROM ________', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '10', code: '1010300', nature: 'CURRENT ASSETS', mainCategory: 'TAXATION', glName: '', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '11', code: '1010301', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'ADVANCE INCOME TAX', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '12', code: '1010400', nature: 'CURRENT ASSETS', mainCategory: 'LOANS AND ADVANCES', glName: '', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '13', code: '1010401', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'STAFF LOAN ________', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '14', code: '1010402', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'ADVANCE AGAINST EXPENSE', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '15', code: '1010403', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'ADVANCE AGAINST CAPEX', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '16', code: '1010500', nature: 'CURRENT ASSETS', mainCategory: 'OTHER RECEIVABLE', glName: '', remarks: 'SUBSIDIARY', type: 'subsidiary' },
  { id: '17', code: '1010501', nature: 'CURRENT ASSETS', mainCategory: '', glName: 'RECEIVABLE FROM ________', remarks: 'SUBSIDIARY', type: 'subsidiary' },
];

export const TrialBalanceSheet = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = initialData.filter(item => 
    item.code.includes(searchQuery) || 
    item.nature.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.mainCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.glName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function to get row styling based on type
  const getRowStyle = (type) => {
    switch (type) {
      case 'main':
        // Adapted for dark theme: subtle yellow/gold background with prominent text
        return 'bg-amber-500/20 hover:bg-amber-500/30 border-y border-amber-500/50 font-bold text-amber-200';
      case 'parent':
        // Adapted for dark theme: subtle green background with prominent text
        return 'bg-emerald-500/20 hover:bg-emerald-500/30 border-y border-emerald-500/40 font-semibold text-emerald-200';
      case 'subsidiary':
        return 'bg-transparent hover:bg-slate-800/50 border-b border-slate-800/50 text-slate-300';
      default:
        return 'border-b border-slate-800/50 text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Trial Balance Matrix</h2>
          <p className="text-xs text-slate-400">Hierarchical view of Main, Parent, and Subsidiary Accounts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button variant="primary" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search GL Code, Nature, or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg text-sm py-2 pl-9 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            
            <div className="flex items-center gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-500/40 border border-amber-500/50"></div>
                <span className="text-slate-400">Main</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/40 border border-emerald-500/50"></div>
                <span className="text-slate-400">Parent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></div>
                <span className="text-slate-400">Subsidiary</span>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b-2 border-slate-700 text-slate-300 font-bold tracking-wider text-xs uppercase">
                  <th className="py-3 px-4 w-32">GL Code</th>
                  <th className="py-3 px-4 w-48">Nature</th>
                  <th className="py-3 px-4 w-64">Main Category Name <span className="text-slate-500 text-[10px] ml-1">(Locked)</span></th>
                  <th className="py-3 px-4 min-w-[200px]">GL Name <span className="text-slate-500 text-[10px] ml-1">(Open)</span></th>
                  <th className="py-3 px-4 w-32 text-center">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row) => (
                    <tr 
                      key={row.id} 
                      className={`transition-colors duration-150 ${getRowStyle(row.type)}`}
                    >
                      <td className="py-2.5 px-4 font-mono">{row.code}</td>
                      <td className="py-2.5 px-4">{row.nature}</td>
                      <td className={`py-2.5 px-4 ${row.type === 'subsidiary' && row.mainCategory ? 'font-semibold text-brand-300' : ''}`}>
                        {row.mainCategory}
                      </td>
                      <td className="py-2.5 px-4">{row.glName}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`
                          inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${row.type === 'main' ? 'bg-amber-500/20 text-amber-300' : ''}
                          ${row.type === 'parent' ? 'bg-emerald-500/20 text-emerald-300' : ''}
                          ${row.type === 'subsidiary' ? 'bg-slate-800 text-slate-400' : ''}
                        `}>
                          {row.remarks}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import { useState } from 'react';
import { accountService } from '../../services/apiServices';
import { Download, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';

export const CoaExportImport = () => {
  const { accounts, importAccounts } = useCoaStore();
  const { logActivity } = useJournalStore();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [importStatus, setImportStatus] = useState(null); // null, 'success', 'error'
  const [importedCount, setImportedCount] = useState(0);

  // Export COA to CSV
  const handleExport = async () => {
    try {
      const response = await accountService.getAll({ limit: 100000 });
      const accountsToExport = response.data || [];
      const headers = ['code', 'name', 'type', 'detailType', 'parentCode', 'currency', 'status', 'initialBalance', 'description', 'subsidiary'];
      
      const rows = accountsToExport.map((acc) => [
        acc.code,
        `"${acc.name.replace(/"/g, '""')}"`,
        acc.type,
        acc.detailType,
        acc.parentCode || '',
        acc.currency,
        acc.status,
        acc.initialBalance || 0,
        `"${(acc.description || '').replace(/"/g, '""')}"`,
        (acc.subsidiary || []).join(';'),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((e) => e.join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `chart_of_accounts_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logActivity('Export Accounts', `Exported ${accountsToExport.length} accounts to CSV.`);
    } catch (err) {
      alert('Failed to export accounts: ' + err.message);
    }
  };

  // Import COA from CSV
  const handleImport = async () => {
    try {
      if (!csvInput.trim()) {
        alert('Please paste CSV content first.');
        return;
      }

      const lines = csvInput.split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      
      // Expected headers: code, name, type, detailType, parentCode, currency, status, initialBalance, description, subsidiary
      const requiredHeaders = ['code', 'name', 'type', 'detailType'];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required CSV headers: ${missingHeaders.join(', ')}`);
      }

      const importedAccounts = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line respecting quotes
        const values = [];
        let currentVal = '';
        let insideQuotes = false;
        
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
            currentVal = '';
          } else {
            currentVal += char;
          }
        }
        values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

        const accObj = {};

        headers.forEach((header, index) => {
          if (header === 'subsidiary') {
            accObj[header] = values[index] ? values[index].split(';') : ['Global'];
          } else if (header === 'initialbalance') {
            accObj.initialBalance = parseFloat(values[index]) || 0;
          } else if (header === 'status') {
            accObj.isLocked = values[index]?.toLowerCase() === 'inactive';
          } else if (header === 'parentcode') {
            accObj.parentCode = values[index] || 'none';
          } else {
            accObj[header] = values[index] || '';
          }
        });

        // Basic validation of fields
        if (!accObj.code || !accObj.name || !accObj.type || !accObj.detailType) {
          throw new Error(`Row ${i} is missing required data fields.`);
        }

        importedAccounts.push(accObj);
      }

      await importAccounts(importedAccounts);
      setImportedCount(importedAccounts.length);
      setImportStatus('success');
      setCsvInput('');
      logActivity('Import Accounts', `Successfully imported ${importedAccounts.length} accounts via CSV tool.`);
    } catch (err) {
      setImportStatus('error');
      alert(`Import failed: ${err.message}`);
    }
  };

  const sampleCsvTemplate = `code,name,type,detailType,parentCode,currency,status,initialBalance,description,subsidiary
1115,US Savings Account,Asset,Cash,1100,PKR,Active,75000,Corporate interest savings,Acme US
2115,Taxes Payable - State,Liability,Payable,2100,PKR,Active,0,State payroll tax withholdings,Acme US;Acme Europe
6700,Software SaaS Tools,Expense,Expense,6000,PKR,Active,4500,General software licenses,Global`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 cursor-pointer flex-1 sm:flex-none justify-center">
        <Download className="h-4 w-4 text-slate-400" />
        <span className="hidden xs:inline">Export CSV</span>
        <span className="xs:hidden">Export</span>
      </Button>

      <Button variant="outline" size="sm" onClick={() => { setIsImportModalOpen(true); setImportStatus(null); }} className="gap-2 cursor-pointer flex-1 sm:flex-none justify-center">
        <Upload className="h-4 w-4 text-slate-400" />
        <span className="hidden xs:inline">Import CSV</span>
        <span className="xs:hidden">Import</span>
      </Button>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Accounts from CSV"
        size="lg"
      >
        <div className="space-y-4">
          {importStatus === 'success' ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <h4 className="text-base font-bold text-slate-100">Import Successful</h4>
              <p className="text-sm text-slate-400">
                Successfully processed and imported <span className="font-semibold text-emerald-400">{importedCount}</span> accounts into your General Ledger.
              </p>
              <Button variant="primary" onClick={() => setIsImportModalOpen(false)}>
                Back to Chart of Accounts
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste your CSV data directly below or load pre-formatted records. The CSV file must include headers matching:
                <code className="text-brand-400 bg-slate-950 px-1.5 py-0.5 rounded ml-1 font-mono">code, name, type, detailType</code>.
              </p>
              
              {/* Sample template box */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <FileText className="h-4 w-4 text-brand-400" />
                    <span>CSV Template (Copy to Test)</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] cursor-pointer"
                    onClick={() => {
                      setCsvInput(sampleCsvTemplate);
                    }}
                  >
                    Load Sample Template
                  </Button>
                </div>
                <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto leading-normal select-all">
                  {sampleCsvTemplate}
                </pre>
              </div>

              {/* Paste box */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    CSV Raw Data
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setCsvInput(event.target.result);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </div>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  rows="8"
                  placeholder="Paste comma-separated rows here..."
                  className="w-full font-mono text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
                />
              </div>

              {/* Buttons */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
                <Button variant="outline" onClick={() => setIsImportModalOpen(false)} className="w-full sm:w-auto justify-center">
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleImport} className="w-full sm:w-auto justify-center">
                  Verify & Import
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

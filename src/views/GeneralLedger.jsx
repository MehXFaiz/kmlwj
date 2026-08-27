import { useState, useEffect, useMemo, startTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLedgerStore } from '../store/ledgerStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { Search, Calendar, Filter, Trash2, AlertCircle, Printer, Download } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';
import logoImg from '../assets/logo.png';

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d)) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getBalanceSuffix = (balance, isDebitNormal) => {
  if (!balance) return '';
  if (isDebitNormal) {
    return balance < 0 ? '(Cr)' : '(Dr)';
  }
  return balance < 0 ? '(Dr)' : '(Cr)';
};

export const GeneralLedger = () => {
  const { ledgerData, fetchLedger, isLoading } = useLedgerStore();
  const { accounts, fetchAccounts } = useCoaStore();
  const { canEditOrDelete } = useAuthStore();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: ''
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const { accountInfo, entries, summary, accountMeta } = useMemo(() => {
    if (!ledgerData) return { accountInfo: null, entries: [], summary: { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 }, accountMeta: {} };
    return {
      accountInfo: ledgerData.account || null,
      entries: ledgerData.entries || [],
      summary: ledgerData.summary || { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 },
      accountMeta: ledgerData.accountMeta || {}
    };
  }, [ledgerData]);

  const groupedLedgers = useMemo(() => {
    if (accountInfo) {
      const code = accountInfo.glCode || '000';
      const meta = accountMeta[code] || null;
      const accType = accountInfo.type || meta?.type || 'ASSET';
      const opBal = summary.openingBalance !== undefined && summary.openingBalance !== null ? summary.openingBalance : (meta?.openingBalance || 0);
      
      return [{
        glCode: code,
        accountName: accountInfo.name || meta?.name || 'Unknown Account',
        type: accType,
        openingBalance: opBal,
        entries: entries || []
      }];
    }

    if (!entries || entries.length === 0) return [];
    
    const map = new Map();
    entries.forEach(entry => {
      const code = entry.glCode || '000';
      if (!map.has(code)) {
        const meta = accountMeta[code] || null;
        const accType = meta?.type || (accountInfo && accountInfo.glCode === code ? accountInfo.type : 'ASSET');
        const opBal = meta?.openingBalance !== undefined ? meta.openingBalance : (accountInfo && accountInfo.glCode === code ? summary.openingBalance : 0);
        
        map.set(code, {
          glCode: code,
          accountName: entry.accountName || meta?.name || (accountInfo && accountInfo.glCode === code ? accountInfo.name : 'Unknown Account'),
          type: accType,
          openingBalance: opBal,
          entries: []
        });
      }
      map.get(code).entries.push(entry);
    });
    
    return Array.from(map.values()).sort((a, b) => a.glCode.localeCompare(b.glCode));
  }, [entries, accountInfo, accountMeta, summary]);

  useEffect(() => {
    fetchAccounts();
    fetchLedger();
  }, [fetchAccounts, fetchLedger]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    if (name === 'accountId') {
      fetchLedger(newFilters);
      setSelectedIds([]);
    }
  };

  const applyFilters = () => {
    fetchLedger(filters);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    const cleared = { startDate: '', endDate: '', accountId: '' };
    setFilters(cleared);
    fetchLedger(cleared);
    setSelectedIds([]);
  };

  const handleDeleteEntry = (entry, e) => {
    e.stopPropagation();
    setConfirmDelete(entry);
  };

  const executeDelete = async (id) => {
    setIsDeleting(true);
    try {
      const res = await useLedgerStore.getState().deleteLedgerEntry(id, filters);
      startTransition(() => {
        setIsDeleting(false);
        setConfirmDelete(null);
        if (res?.success) {
          showToast('General Ledger entry deleted successfully', 'success');
          setSelectedIds(prev => prev.filter(item => item !== id));
        } else {
          const isForbidden = res?.error?.includes('403') || res?.error?.includes('Restricted') || res?.error?.includes('permission');
          showToast(isForbidden ? 'You do not have permission to delete this record.' : (res?.error || 'Failed to delete GL entry'), 'error');
        }
      });
    } catch (err) {
      startTransition(() => {
        setIsDeleting(false);
        setConfirmDelete(null);
        handleDeleteError(err, 'Failed to delete GL entry');
      });
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(entries.map(ent => ent.id));
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
    try {
      const res = await useLedgerStore.getState().bulkDeleteLedgerEntries(selectedIds, filters);
      startTransition(() => {
        setIsDeleting(false);
        setShowBulkConfirm(false);
        if (res?.success) {
          showToast(`${selectedIds.length} GL entries deleted successfully`, 'success');
          setSelectedIds([]);
        } else {
          const isForbidden = res?.error?.includes('403') || res?.error?.includes('Restricted') || res?.error?.includes('permission');
          showToast(isForbidden ? 'You do not have permission to delete this record.' : (res?.error || 'Failed to bulk delete GL entries'), 'error');
        }
      });
    } catch (err) {
      startTransition(() => {
        setIsDeleting(false);
        setShowBulkConfirm(false);
        handleDeleteError(err, 'Failed to bulk delete GL entries');
      });
    }
  };

  const isDebitNormal = accountInfo && ['ASSET', 'EXPENSE'].includes(accountInfo.type.toUpperCase());
  const debitLabel = isDebitNormal ? "Period Debits (In)" : (accountInfo ? "Period Debits (Out)" : "Period Debits");
  const creditLabel = isDebitNormal ? "Period Credits (Out)" : (accountInfo ? "Period Credits (In)" : "Period Credits");

  // ── Print GL ──────────────────────────────────────────────────────────────
  // Opens a clean, isolated print window — bypasses all SPA chrome & dark CSS.
  const handlePrintGL = () => {
    const user = useAuthStore.getState().user;
    const userName = user?.fullName || user?.email || 'System';

    const fmtAmt = (v) =>
      v == null ? '—' : `PKR ${Math.abs(Number(v)).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
    const fmtAmtRaw = (v) =>
      v > 0 ? `PKR ${Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : '—';
    const fmtDate = (v) => {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d)) return v;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };
    const balSuffix = (bal, isDebitNorm) => {
      if (!bal) return '';
      return isDebitNorm ? (bal < 0 ? ' Cr' : ' Dr') : (bal < 0 ? ' Dr' : ' Cr');
    };

    const now = new Date();
    const printedOn = now.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) +
      ' ' + now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

    const periodFrom = filters.startDate ? fmtDate(filters.startDate) : 'Beginning';
    const periodTo   = filters.endDate   ? fmtDate(filters.endDate)   : 'Present';
    const accountLabel = accountInfo
      ? `${accountInfo.name} (${accountInfo.glCode})`
      : 'All Accounts';

    // Build account table rows
    const buildAccountHTML = (group) => {
      const isDebitNorm = ['ASSET','EXPENSE'].includes((group.type||'').toUpperCase());
      let running = group.openingBalance;
      let totDr = 0, totCr = 0;

      const rows = group.entries.map((e) => {
        const deb = e.debit || 0;
        const crd = e.credit || 0;
        totDr += deb; totCr += crd;
        running = isDebitNorm ? running + deb - crd : running + crd - deb;
        const bal = running;
        return `
          <tr>
            <td>${fmtDate(e.date)}</td>
            <td class="ref">${e.reference || '—'}</td>
            <td>${e.description || '—'}</td>
            <td class="num">${deb > 0 ? fmtAmtRaw(deb) : '—'}</td>
            <td class="num">${crd > 0 ? fmtAmtRaw(crd) : '—'}</td>
            <td class="num bal">${fmtAmt(bal)}${balSuffix(bal, isDebitNorm)}</td>
          </tr>`;
      }).join('');

      const emptyRow = group.entries.length === 0
        ? `<tr><td colspan="6" class="empty">No transaction entries found for this account in the selected period.</td></tr>`
        : '';

      const closingBal = running;

      return `
        <div class="account-block">
          <div class="account-header">
            <div>
              <div class="account-name">${group.accountName}</div>
              <div class="account-num">Account No: ${group.glCode}</div>
            </div>
            <div class="closing-badge">
              Closing Balance: ${fmtAmt(closingBal)}${balSuffix(closingBal, isDebitNorm)}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference No.</th>
                <th>Description</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
                <th class="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr class="opening-row">
                <td>${periodFrom !== 'Beginning' ? periodFrom : '—'}</td>
                <td class="ref">—</td>
                <td>Beginning Balance</td>
                <td class="num">—</td>
                <td class="num">—</td>
                <td class="num bal">${group.openingBalance !== 0 ? fmtAmt(group.openingBalance) + balSuffix(group.openingBalance, isDebitNorm) : '—'}</td>
              </tr>
              ${rows}${emptyRow}
              <tr class="totals-row">
                <td colspan="3" class="totals-label">Account Totals</td>
                <td class="num">${fmtAmtRaw(totDr)}</td>
                <td class="num">${fmtAmtRaw(totCr)}</td>
                <td class="num bal">${fmtAmt(closingBal)}${balSuffix(closingBal, isDebitNorm)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    };

    const accountsHTML = groupedLedgers.length === 0
      ? `<div class="no-data">No General Ledger records found for the selected filters.</div>`
      : groupedLedgers.map(buildAccountHTML).join('');

    // Use the Vite-resolved logo URL (absolute path works in a new window same origin)
    const logoUrl = window.location.origin + logoImg;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>General Ledger — ${accountLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, 'Alvi Nastaleeq Regular', 'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', sans-serif; font-size: 9pt; color: #1a1a1a; background: #fff; }
    .org-urdu, .org-sub { font-family: 'Alvi Nastaleeq Regular', 'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif; direction: rtl; }

    /* ── Report Header ── */
    .report-header { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid #1a1a1a; margin-bottom: 8px; }
    .report-header img { width: 52px; height: 52px; object-fit: contain; }
    .org-block { flex: 1; text-align: center; }
    .org-urdu { font-size: 13pt; font-weight: 900; line-height: 1.3; }
    .org-sub { font-size: 7.5pt; color: #444; margin-top: 2px; }
    .org-reg { font-size: 7pt; color: #666; }
    .report-badge { text-align: right; min-width: 130px; }
    .report-badge .title { background: #1a1a1a; color: #fff; font-size: 8pt; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-block; letter-spacing: 0.05em; text-transform: uppercase; }
    .report-badge .printed { font-size: 7pt; color: #555; margin-top: 4px; }

    /* ── Meta strip ── */
    .meta-strip { display: flex; justify-content: space-between; font-size: 7.5pt; color: #333; padding: 4px 0 8px; border-bottom: 1px solid #ccc; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
    .meta-strip span { white-space: nowrap; }
    .meta-strip strong { color: #1a1a1a; }

    /* ── Account block ── */
    .account-block { margin-bottom: 16px; page-break-inside: avoid; }
    .account-header { display: flex; justify-content: space-between; align-items: flex-end; background: #f0f0f0; border: 1px solid #bbb; border-bottom: none; padding: 5px 8px; border-radius: 4px 4px 0 0; }
    .account-name { font-size: 10pt; font-weight: 800; color: #1a1a1a; }
    .account-num { font-size: 7.5pt; color: #555; margin-top: 1px; font-family: monospace; }
    .closing-badge { font-size: 8pt; font-weight: 700; color: #1a1a1a; white-space: nowrap; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    thead { display: table-header-group; }
    th { background: #2c2c2c; color: #fff; font-weight: 700; padding: 4px 6px; text-align: left; font-size: 7.5pt; letter-spacing: 0.03em; border: 1px solid #1a1a1a; }
    th.num { text-align: right; }
    td { padding: 3.5px 6px; border: 1px solid #d8d8d8; vertical-align: top; }
    td.num { text-align: right; font-family: monospace; white-space: nowrap; }
    td.ref { font-family: monospace; font-size: 7.5pt; color: #444; white-space: nowrap; }
    td.bal { font-weight: 700; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    .opening-row td { background: #f5f5f0; font-style: italic; font-weight: 600; color: #444; }
    .totals-row td { background: #e8e8e8; font-weight: 800; border-top: 2px solid #888; font-size: 8pt; }
    .totals-label { text-align: right; text-transform: uppercase; letter-spacing: 0.05em; color: #333; font-size: 7.5pt; }
    .empty td, td.empty { text-align: center; color: #888; font-style: italic; padding: 10px; }
    .no-data { text-align: center; color: #888; font-style: italic; padding: 24px; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0; }

    @media print {
      .account-block { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <img src="${logoUrl}" alt="KMLWJ Logo" onerror="this.style.display='none'" />
    <div class="org-block">
      <div class="org-urdu">کچھی مسلم لوہارواڈھا ویلفیئر جماعت</div>
      <div class="org-sub">جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی</div>
      <div class="org-reg">REGISTERED NO: 1319 &nbsp;|&nbsp; info@kmlwj.org &nbsp;|&nbsp; www.kmlwj.org</div>
    </div>
    <div class="report-badge">
      <div class="title">General Ledger</div>
      <div class="printed">Printed: ${printedOn}</div>
    </div>
  </div>

  <div class="meta-strip">
    <span><strong>Period:</strong> ${periodFrom} to ${periodTo}</span>
    <span><strong>Account:</strong> ${accountLabel}</span>
    <span><strong>Prepared By:</strong> ${userName}</span>
  </div>

  ${accountsHTML}
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site to print the GL.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
      win.onafterprint = () => win.close();
    };
  };

  // ── Download GL as PDF ────────────────────────────────────────────────────
  // Real PDF (jsPDF + autoTable) — auto page-splitting, repeating table
  // header, no row cutoffs, PKR formatting. Uses live filtered data.
  const handleDownloadGL = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableMod = await import('jspdf-autotable');
      const autoTable = autoTableMod.default || autoTableMod.autoTable || autoTableMod;

      const user = useAuthStore.getState().user;
      const userName = user?.fullName || user?.email || 'System';

      const fmtAmtRaw = (v) =>
        v > 0 ? Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
      const fmtAmtSigned = (v) => {
        if (v === 0 || v == null) return '—';
        return Math.abs(Number(v)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      const fmtDate = (v) => {
        if (!v) return '—';
        const d = new Date(v);
        if (isNaN(d)) return String(v);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      };
      const balSuffix = (bal, isDebitNorm) => {
        if (!bal) return '';
        return isDebitNorm ? (bal < 0 ? ' Cr' : ' Dr') : (bal < 0 ? ' Dr' : ' Cr');
      };

      const now = new Date();
      const generatedOn =
        now.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) +
        ' ' + now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const stamp = `${yyyy}-${mm}-${dd}`;

      const periodFrom = filters.startDate ? fmtDate(filters.startDate) : 'Beginning';
      const periodTo   = filters.endDate   ? fmtDate(filters.endDate)   : 'Present';

      const safeName = (accountInfo?.name || 'All_Accounts')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `GL_${safeName}_${stamp}.pdf`;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 10;
      const contentWidth = pageWidth - marginX * 2;

      // ── Header block (drawn once at document start) ──
      const drawReportHeader = () => {
        // Brand bar
        doc.setFillColor(26, 26, 26);
        doc.rect(marginX, 8, contentWidth, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('KUTCHI MUSLIM LOHARWADHA WELFARE JAMAT', pageWidth / 2, 15.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Jumma Baloch Road, Near K.E Grid Station, New Kalri, Lyari, Karachi', pageWidth / 2, 20, { align: 'center' });

        // Report title strip
        const titleY = 26;
        doc.setFillColor(210, 180, 140); // Mocha Brown accent
        doc.rect(marginX, titleY, contentWidth, 8, 'F');
        doc.setTextColor(30, 20, 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('GENERAL LEDGER', pageWidth / 2, titleY + 5.5, { align: 'center' });

        // Meta strip: Period | Account | Prepared By | Generated
        const metaY = titleY + 12;
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Period:', marginX, metaY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${periodFrom}  to  ${periodTo}`, marginX + 13, metaY);

        doc.setFont('helvetica', 'bold');
        doc.text('Account:', marginX, metaY + 4.5);
        doc.setFont('helvetica', 'normal');
        const accountText = accountInfo
          ? `${accountInfo.name} (${accountInfo.glCode || '—'})`
          : 'All Accounts';
        doc.text(accountText, marginX + 15, metaY + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.text('Prepared By:', pageWidth - marginX, metaY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(userName, pageWidth - marginX - 22, metaY, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Generated:', pageWidth - marginX, metaY + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(generatedOn, pageWidth - marginX - 20, metaY + 4.5, { align: 'right' });

        // Separator
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(marginX, metaY + 8, pageWidth - marginX, metaY + 8);
      };

      // ── Footer (added per-page via autoTable didDrawPage hook) ──
      const drawFooter = () => {
        const total = doc.internal.getNumberOfPages();
        const current = doc.getCurrentPageInfo().pageNumber;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Generated on ${generatedOn}  |  By ${userName}`,
          marginX,
          pageHeight - 6
        );
        doc.text(
          `Page ${current} of ${total}`,
          pageWidth - marginX,
          pageHeight - 6,
          { align: 'right' }
        );
      };

      drawReportHeader();

      // If no data — write a "No Records Found" panel and save.
      if (!groupedLedgers || groupedLedgers.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text('No Records Found for the selected filters.', pageWidth / 2, 70, { align: 'center' });
        drawFooter();
        doc.save(filename);
        showToast(`Downloaded ${filename}`, 'success');
        return;
      }

      // Cursor Y tracking the position where the next block should start
      let cursorY = 52;

      groupedLedgers.forEach((group, groupIdx) => {
        const isDebitNorm = ['ASSET','EXPENSE'].includes((group.type || '').toUpperCase());

        // If less than ~50mm room left on the page for the account block, start a new page.
        if (cursorY > pageHeight - 60) {
          doc.addPage();
          drawReportHeader();
          cursorY = 52;
        }

        // Account block header
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(180, 180, 180);
        doc.rect(marginX, cursorY, contentWidth, 9, 'FD');
        doc.setTextColor(20, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(group.accountName || '—', marginX + 2, cursorY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(90, 90, 90);
        doc.text(`Account No: ${group.glCode || '—'}`, marginX + 2, cursorY + 7.5);

        // Build rows: opening → transactions → totals
        let running = group.openingBalance || 0;
        let totDr = 0;
        let totCr = 0;

        const bodyRows = [];

        // Opening balance row
        bodyRows.push([
          periodFrom !== 'Beginning' ? periodFrom : '—',
          '—',
          'Beginning Balance',
          '—',
          '—',
          group.openingBalance !== 0
            ? `${fmtAmtSigned(group.openingBalance)}${balSuffix(group.openingBalance, isDebitNorm)}`
            : '—',
        ]);

        (group.entries || []).forEach((e) => {
          const deb = Number(e.debit) || 0;
          const crd = Number(e.credit) || 0;
          totDr += deb;
          totCr += crd;
          running = isDebitNorm ? running + deb - crd : running + crd - deb;
          bodyRows.push([
            fmtDate(e.date),
            e.reference || '—',
            e.description || '—',
            deb > 0 ? fmtAmtRaw(deb) : '—',
            crd > 0 ? fmtAmtRaw(crd) : '—',
            `${fmtAmtSigned(running)}${balSuffix(running, isDebitNorm)}`,
          ]);
        });

        if ((group.entries || []).length === 0) {
          bodyRows.push([{ content: 'No transaction entries found for this account in the selected period.', colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [130, 130, 130] } }]);
        }

        const closingBal = running;

        // Totals row (styled by autoTable via willDrawCell)
        bodyRows.push([
          { content: 'Account Totals', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 232, 232] } },
          { content: fmtAmtRaw(totDr), styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 232, 232] } },
          { content: fmtAmtRaw(totCr), styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 232, 232] } },
          { content: `${fmtAmtSigned(closingBal)}${balSuffix(closingBal, isDebitNorm)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 232, 232] } },
        ]);

        autoTable(doc, {
          startY: cursorY + 9,
          margin: { left: marginX, right: marginX, top: 40 },
          head: [['Date', 'Reference', 'Description', 'Debit (PKR)', 'Credit (PKR)', 'Running Balance']],
          body: bodyRows,
          styles: { fontSize: 7.8, cellPadding: 1.6, overflow: 'linebreak', valign: 'top', lineColor: [210, 210, 210], lineWidth: 0.1 },
          headStyles: { fillColor: [44, 44, 44], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'left' },
          bodyStyles: { textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [249, 249, 249] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 24, font: 'courier', fontSize: 7 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 24, halign: 'right', font: 'courier' },
            4: { cellWidth: 24, halign: 'right', font: 'courier' },
            5: { cellWidth: 30, halign: 'right', font: 'courier', fontStyle: 'bold' },
          },
          rowPageBreak: 'avoid',
          showHead: 'everyPage',
          didDrawPage: () => { drawFooter(); },
        });

        // Closing balance strip immediately under the table
        const finalY = doc.lastAutoTable.finalY || cursorY + 20;
        if (finalY > pageHeight - 20) {
          doc.addPage();
          drawReportHeader();
          cursorY = 52;
        } else {
          doc.setFillColor(250, 240, 220);
          doc.setDrawColor(200, 170, 130);
          doc.rect(marginX, finalY + 1, contentWidth, 7, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(60, 40, 10);
          doc.text('Closing Balance:', marginX + 2, finalY + 5.5);
          doc.text(
            `PKR ${fmtAmtSigned(closingBal)}${balSuffix(closingBal, isDebitNorm)}`,
            pageWidth - marginX - 2,
            finalY + 5.5,
            { align: 'right' }
          );
          cursorY = finalY + 12;
        }
      });

      drawFooter();
      doc.save(filename);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      console.error('GL PDF generation failed:', err);
      showToast(`Failed to generate PDF: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const debitColor = isDebitNormal ? "text-emerald-400" : (accountInfo ? "text-red-400" : "text-emerald-400");
  const creditColor = isDebitNormal ? "text-red-400" : (accountInfo ? "text-emerald-400" : "text-red-400");
  const tableDebitColor = isDebitNormal ? "text-emerald-400" : (accountInfo ? "text-red-400" : "text-emerald-400");
  const tableCreditColor = isDebitNormal ? "text-red-400" : (accountInfo ? "text-emerald-400" : "text-red-400");

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">General Ledger</h2>
          <p className="text-xs text-slate-400">View detailed transaction history and balances for specific accounts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditOrDelete && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-900/50 transition-all text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5 pointer-events-none" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadGL}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-500 border border-amber-700/40 transition-all text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrintGL}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-all text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print GL
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 print:hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">Account</label>
            <select
              name="accountId"
              value={filters.accountId}
              onChange={handleFilterChange}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2"
            >
              <option value="">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2"
              />
            </div>
          </div>
          
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2"
              />
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={clearFilters} className="w-full sm:w-auto">Clear</Button>
            <Button variant="primary" size="sm" onClick={applyFilters} className="w-full sm:w-auto gap-2">
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {accountInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2 print:mb-6">
          <Card className="bg-slate-900/50 print:bg-white print:border-slate-300 print:shadow-none">
            <CardContent className="p-4 flex flex-col items-center justify-center print:p-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1 print:text-slate-500">Opening Balance</span>
              <span className="text-xl font-mono font-semibold text-slate-200 print:text-black print:text-sm">PKR {summary.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 print:bg-white print:border-slate-300 print:shadow-none">
            <CardContent className="p-4 flex flex-col items-center justify-center print:p-2">
              <span className={`text-xs uppercase tracking-wider mb-1 ${debitColor} print:text-slate-500`}>{debitLabel}</span>
              <span className={`text-xl font-mono font-semibold ${debitColor} print:text-emerald-600 print:text-sm`}>PKR {summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 print:bg-white print:border-slate-300 print:shadow-none">
            <CardContent className="p-4 flex flex-col items-center justify-center print:p-2">
              <span className={`text-xs uppercase tracking-wider mb-1 ${creditColor} print:text-slate-500`}>{creditLabel}</span>
              <span className={`text-xl font-mono font-semibold ${creditColor} print:text-rose-600 print:text-sm`}>PKR {summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-brand-500/30 print:bg-white print:border-slate-300 print:shadow-none">
            <CardContent className="p-4 flex flex-col items-center justify-center print:p-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1 text-brand-400 print:text-slate-500">Closing Balance</span>
              <span className="text-xl font-mono font-bold text-brand-400 print:text-black print:text-sm">PKR {summary.closingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grouped Ledger Tables - One Separate Table per GL Account */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-400 font-medium">Loading ledger data...</CardContent>
        </Card>
      ) : groupedLedgers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500 italic">No ledger entries found for the selected criteria.</CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedLedgers.map((group) => {
            const isDebitNorm = ['ASSET', 'EXPENSE'].includes((group.type || '').toUpperCase());
            let runningBal = group.openingBalance;
            let totalGroupDebit = 0;
            let totalGroupCredit = 0;

            const rowsWithBal = group.entries.map((entry) => {
              const deb = entry.debit || 0;
              const cred = entry.credit || 0;
              totalGroupDebit += deb;
              totalGroupCredit += cred;
              if (isDebitNorm) {
                runningBal = runningBal + deb - cred;
              } else {
                runningBal = runningBal + cred - deb;
              }
              return { ...entry, runningBalance: runningBal };
            });
            const closingBal = runningBal;

            return (
              <div
                key={group.glCode}
                className="bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/80 print:bg-white print:border-slate-300 print:shadow-none print:rounded-none print:break-inside-avoid"
              >
                {/* Textbook-inspired Modern Ledger Header */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:bg-none print:border-slate-300 print:px-0 print:py-2">
                  <div>
                    <div className="text-[11px] font-extrabold tracking-widest uppercase text-amber-500 mb-1 flex items-center gap-1.5 print:hidden">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      GENERAL LEDGER
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-100 flex flex-wrap items-center gap-2 print:text-black">
                      Account Name: <span className="text-amber-400 underline decoration-amber-500/40 underline-offset-4 font-black print:text-black print:no-underline">{group.accountName}</span>
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 flex flex-col items-start sm:items-end min-w-[140px] print:bg-transparent print:border-none print:p-0 print:min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider print:text-slate-500">Account Number</span>
                      <span className="text-base font-mono font-black text-slate-200 print:text-black">{group.glCode}</span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 flex flex-col items-start sm:items-end min-w-[160px] print:bg-transparent print:border-none print:p-0 print:min-w-0">
                      <span className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wider print:text-slate-500">Closing Balance</span>
                      <span className="text-base font-mono font-bold text-amber-400 print:text-black">
                        PKR {Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs ml-1 opacity-80 print:text-slate-600">{getBalanceSuffix(closingBal, isDebitNorm)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table for this Account */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[750px] print:min-w-full">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-950/60 print:bg-slate-100 print:border-slate-300">
                        {canEditOrDelete && (
                          <th className="py-3 px-4 w-10 text-center print:hidden">
                            <input
                              type="checkbox"
                              checked={group.entries.length > 0 && group.entries.every(ent => selectedIds.includes(ent.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const idsToAdd = group.entries.map(ent => ent.id).filter(id => !selectedIds.includes(id));
                                  setSelectedIds(prev => [...prev, ...idsToAdd]);
                                } else {
                                  const grpIds = group.entries.map(ent => ent.id);
                                  setSelectedIds(prev => prev.filter(id => !grpIds.includes(id)));
                                }
                              }}
                              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                            />
                          </th>
                        )}
                        <th className="py-3 px-4 w-28 print:text-slate-700">Date</th>
                        <th className="py-3 px-4 print:text-slate-700">Explanation / Description</th>
                        <th className="py-3 px-4 w-24 print:text-slate-700">Ref</th>
                        <th className="py-3 px-4 w-32 text-right text-emerald-400/90 print:text-slate-700">Debit</th>
                        <th className="py-3 px-4 w-32 text-right text-rose-400/90 print:text-slate-700">Credit</th>
                        <th className="py-3 px-4 w-36 text-right font-black text-amber-400 print:text-slate-700">Balance</th>
                        {canEditOrDelete && <th className="py-3 px-4 w-16 text-center print:hidden">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-800/40 print:divide-slate-200">
                      {/* Beginning Balance Row */}
                      <tr className="bg-slate-800/20 text-slate-400 font-medium italic print:bg-transparent print:text-slate-600 print:border-b print:border-slate-200">
                        {canEditOrDelete && <td className="py-3 px-4 print:hidden" />}
                        <td className="py-3 px-4 text-slate-300 font-semibold print:text-slate-800">{filters.startDate || 'Beg. Balance'}</td>
                        <td className="py-3 px-4 text-slate-300 font-semibold print:text-slate-800">Beg. Balance</td>
                        <td className="py-3 px-4 font-mono text-slate-500 print:text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 print:text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 print:text-slate-400">—</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-300 print:text-slate-800">
                          {group.openingBalance === 0 ? '—' : `PKR ${group.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </td>
                        {canEditOrDelete && <td className="py-3 px-4 print:hidden" />}
                      </tr>

                      {/* Transaction Rows */}
                      {rowsWithBal.length === 0 ? (
                        <tr>
                          <td
                            colSpan={canEditOrDelete ? 8 : 7}
                            className="py-6 px-4 text-center text-slate-500 italic bg-slate-900/10 print:hidden"
                          >
                            No transaction entries found for this account in the selected period.
                          </td>
                          <td
                            colSpan={6}
                            className="hidden print:table-cell py-6 px-4 text-center text-slate-500 italic"
                          >
                            No transaction entries found for this account in the selected period.
                          </td>
                        </tr>
                      ) : (
                        rowsWithBal.map((entry) => (
                          <tr
                            key={entry.id}
                            className={`hover:bg-slate-900/40 transition-colors ${selectedIds.includes(entry.id) ? 'bg-amber-500/10' : ''} print:bg-transparent print:border-b print:border-slate-100`}
                          >
                            {canEditOrDelete && (
                              <td className="py-3 px-4 text-center print:hidden">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(entry.id)}
                                  onChange={(e) => handleSelectOne(entry.id, e)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap print:text-slate-800">{entry.date}</td>
                            <td className="py-3 px-4 text-slate-200 print:text-slate-800">{entry.description || '—'}</td>
                            <td className="py-3 px-4 font-mono text-amber-400/90 whitespace-nowrap print:text-slate-800">{entry.reference}</td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-400 print:text-slate-800">
                              {entry.debit > 0 ? `PKR ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-400 print:text-slate-800">
                              {entry.credit > 0 ? `PKR ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-100 bg-slate-900/40 print:bg-transparent print:text-slate-900">
                              PKR {Math.abs(entry.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <span className="text-[10px] ml-1 opacity-70 font-normal print:text-slate-600">{getBalanceSuffix(entry.runningBalance, isDebitNorm)}</span>
                            </td>
                            {canEditOrDelete && (
                              <td className="py-3 px-4 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteEntry(entry, e)}
                                  title="Delete GL Entry"
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 pointer-events-none" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}

                      {/* Account Period Totals Row */}
                      <tr className="bg-slate-950/80 font-extrabold border-t-2 border-slate-800 text-xs print:bg-slate-50 print:border-t-2 print:border-slate-300">
                        <td
                          colSpan={canEditOrDelete ? 4 : 3}
                          className="py-3.5 px-4 text-right text-slate-400 uppercase tracking-wider print:hidden"
                        >
                          Account Totals
                        </td>
                        <td
                          colSpan={3}
                          className="hidden print:table-cell py-3.5 px-4 text-right text-slate-700 uppercase tracking-wider font-extrabold"
                        >
                          Account Totals
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400 print:text-slate-800">
                          PKR {totalGroupDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-400 print:text-slate-800">
                          PKR {totalGroupCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-400 print:text-slate-900">
                          PKR {Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {canEditOrDelete && <td className="py-3.5 px-4 print:hidden" />}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" /> Confirm Deletion
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete General Ledger entry <span className="font-mono text-brand-400">{confirmDelete.reference}</span>?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              This will automatically reverse its effect on the account balance. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={isDeleting} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary" size="sm"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-1.5 cursor-pointer"
                disabled={isDeleting}
                onClick={() => executeDelete(confirmDelete.id)}
              >
                {isDeleting ? 'Deleting...' : 'Delete Entry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" /> Confirm Bulk Deletion
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete <span className="font-bold text-red-400">{selectedIds.length}</span> selected General Ledger entries?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              This will automatically reverse the financial effects of all selected entries on their respective account balances. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowBulkConfirm(false)} disabled={isDeleting} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary" size="sm"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-1.5 cursor-pointer"
                disabled={isDeleting}
                onClick={executeBulkDelete}
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.length} Entries`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastPlaceholder />
    </div>
  );
};

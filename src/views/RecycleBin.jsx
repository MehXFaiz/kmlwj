import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  ShieldAlert,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Database,
  History,
  RefreshCw,
  FileSpreadsheet,
  Users,
  Layers,
  UserCheck,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { recycleBinService } from '../services/apiServices';
import { useAuthStore } from '../store/authStore';
import { useConfirmStore } from '../store/confirmStore';
import { showToast } from '../components/ui/Toast';

const formatDateTime = (dateVal) => {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const RecycleBin = () => {
  const user = useAuthStore((state) => state.user);
  const superAdmin = user?.role === 'Super Admin' || user?.role?.name === 'Super Admin';
  const showConfirm = useConfirmStore((state) => state.showConfirm);
  const toast = showToast;
  const confirm = (opts) =>
    showConfirm({
      title: opts.title,
      description: opts.message || opts.description,
      confirmLabel: opts.confirmText || 'Confirm',
      cancelLabel: opts.cancelText || 'Cancel',
      type: opts.variant || 'warning',
      isDangerous: opts.variant === 'danger',
    });

  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'history'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [modules, setModules] = useState([]);
  const [summary, setSummary] = useState({
    totalDeleted: 0,
    filteredCount: 0,
    financialRecordsCount: 0,
    masterDataCount: 0,
    byModule: {},
  });
  const [historyLogs, setHistoryLogs] = useState([]);
  const [permissions, setPermissions] = useState({
    canRestore: true,
    canPermanentDelete: false,
  });

  // Filters
  const [selectedModule, setSelectedModule] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deletedByFilter, setDeletedByFilter] = useState('');

  // Selection for bulk operations
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Inspect Modal
  const [inspectItem, setInspectItem] = useState(null);
  const [inspectHistoryLog, setInspectHistoryLog] = useState(null);

  const fetchRecycleBin = useCallback(async () => {
    setLoading(true);
    try {
      const response = await recycleBinService.getAll({
        module: selectedModule !== 'all' ? selectedModule : undefined,
        search: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        deletedBy: deletedByFilter.trim() || undefined,
      });
      const payload = response?.data || {};
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setModules(Array.isArray(payload.modules) ? payload.modules : []);
      setSummary(
        payload.summary || {
          totalDeleted: 0,
          filteredCount: 0,
          financialRecordsCount: 0,
          masterDataCount: 0,
          byModule: {},
        }
      );
      setHistoryLogs(Array.isArray(payload.history) ? payload.history : []);
      if (payload.permissions) {
        setPermissions(payload.permissions);
      }
      setSelectedKeys(new Set());
    } catch (err) {
      toast(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to load Recycle Bin records',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedModule, searchQuery, startDate, endDate, deletedByFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecycleBin();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchRecycleBin]);

  const makeKey = (item) => `${item.moduleKey}::${item.id}`;

  const toggleSelectItem = (item) => {
    const key = makeKey(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === items.length && items.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(items.map(makeKey)));
    }
  };

  const selectedItemObjects = useMemo(() => {
    return items.filter((item) => selectedKeys.has(makeKey(item)));
  }, [items, selectedKeys]);

  const handleRestoreSingle = async (item) => {
    const ok = await confirm({
      title: `Restore ${item.moduleLabel} Record?`,
      message: `Are you sure you want to restore "${item.title}" (${item.reference})? The record will immediately become active and visible in ${item.moduleLabel}.${
        item.hasLinkedJournal
          ? ' Its linked General Ledger voucher and account balances will also be restored automatically.'
          : ''
      }`,
      confirmText: 'Restore Record',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await recycleBinService.restore({
        moduleKey: item.moduleKey,
        id: item.id,
        reason: `Restored "${item.title}" from Recycle Bin`,
      });
      toast(res?.message || 'Record restored successfully', 'success');
      if (inspectItem && inspectItem.id === item.id) {
        setInspectItem(null);
      }
      await fetchRecycleBin();
    } catch (err) {
      toast(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to restore record',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedItemObjects.length === 0) return;
    const ok = await confirm({
      title: `Restore ${selectedItemObjects.length} Selected Record(s)?`,
      message: `Are you sure you want to restore ${selectedItemObjects.length} soft-deleted record(s)? All original fields, relationships, and linked accounting balances will be restored.`,
      confirmText: `Restore ${selectedItemObjects.length} Record(s)`,
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await recycleBinService.restore({
        items: selectedItemObjects.map((i) => ({ moduleKey: i.moduleKey, id: i.id })),
        reason: `Bulk restored ${selectedItemObjects.length} record(s) from Recycle Bin`,
      });
      toast(res?.message || 'Selected records restored successfully', 'success');
      if (res?.data?.errors?.length > 0) {
        toast(`Note: ${res.data.errors.length} item(s) could not be restored: ${res.data.errors[0].message}`, 'warning');
      }
      await fetchRecycleBin();
    } catch (err) {
      toast(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to restore selected records',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteSingle = async (item) => {
    if (!superAdmin && !permissions.canPermanentDelete) {
      toast('Only a Super Admin can permanently delete records.', 'error');
      return;
    }

    const ok = await confirm({
      title: `PERMANENTLY DELETE "${item.title}"?`,
      message: `WARNING: This action will permanently remove "${item.title}" (${item.reference}) from MongoDB Atlas and CANNOT be undone. If you may need this record or its history later, keep it in the Recycle Bin or click Cancel.`,
      confirmText: 'Permanently Delete Forever',
      cancelText: 'Keep in Recycle Bin',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await recycleBinService.permanentDelete({
        moduleKey: item.moduleKey,
        id: item.id,
        confirmPermanent: true,
        reason: `Authorized permanent deletion of "${item.title}" (${item.reference}) by Super Admin`,
      });
      toast(res?.message || 'Record permanently deleted', 'success');
      if (inspectItem && inspectItem.id === item.id) {
        setInspectItem(null);
      }
      await fetchRecycleBin();
    } catch (err) {
      toast(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Permanent deletion blocked by integrity protection',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedItemObjects.length === 0) return;
    if (!superAdmin && !permissions.canPermanentDelete) {
      toast('Only a Super Admin can permanently delete records.', 'error');
      return;
    }

    const ok = await confirm({
      title: `PERMANENTLY DELETE ${selectedItemObjects.length} Selected Record(s)?`,
      message: `CRITICAL WARNING: You are about to permanently erase ${selectedItemObjects.length} record(s) from MongoDB Atlas. Records with active accounting dependencies will be protected. This operation is logged and CANNOT be undone.`,
      confirmText: `Permanently Delete ${selectedItemObjects.length} Record(s)`,
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await recycleBinService.permanentDelete({
        items: selectedItemObjects.map((i) => ({ moduleKey: i.moduleKey, id: i.id })),
        confirmPermanent: true,
        reason: `Authorized bulk permanent deletion of ${selectedItemObjects.length} record(s) by Super Admin`,
      });
      toast(res?.message || 'Selected records permanently deleted', 'success');
      if (res?.data?.errors?.length > 0) {
        toast(`Protected ${res.data.errors.length} record(s): ${res.data.errors[0].message}`, 'warning');
      }
      await fetchRecycleBin();
    } catch (err) {
      toast(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Permanent deletion blocked',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedModule('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setDeletedByFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Recycle Bin &amp; Data Recovery
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Centralized soft-deleted records manager, one-click restoration, and deletion audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchRecycleBin}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/90 border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Deleted Records
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {summary.totalDeleted.toLocaleString()}
              </p>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Preserved in MongoDB &amp; Restorable
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Database className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Financial &amp; Ledger Vouchers
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {summary.financialRecordsCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Excluded from live GL &amp; Trial Balance
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Master Data &amp; Profiles
              </p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {summary.masterDataCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                COA, Donors, Beneficiaries, Members, Users
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/90 border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Deletion Audit Events
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {historyLogs.length.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Tracked soft-deletes, restores &amp; blocks
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <History className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'records'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Soft-Deleted Records ({summary.totalDeleted})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Deletion &amp; Recovery History ({historyLogs.length})
          </button>
        </div>

        {activeTab === 'records' && selectedItemObjects.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 font-medium mr-1">
              {selectedItemObjects.length} selected
            </span>
            <Button
              onClick={handleBulkRestore}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Selected ({selectedItemObjects.length})
            </Button>
            {(superAdmin || permissions.canPermanentDelete) && (
              <Button
                variant="danger"
                onClick={handleBulkPermanentDelete}
                disabled={actionLoading}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Permanently Delete ({selectedItemObjects.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'records' ? (
        <>
          {/* Module Quick-Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedModule('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                selectedModule === 'all'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Modules ({summary.totalDeleted})
            </button>
            {modules
              .filter((m) => m.count > 0 || selectedModule === m.moduleKey)
              .map((m) => (
                <button
                  key={m.moduleKey}
                  onClick={() => setSelectedModule(m.moduleKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                    selectedModule === m.moduleKey
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label} ({m.count})
                </button>
              ))}
          </div>

          {/* Filter Bar */}
          <Card className="p-4 bg-slate-900/90 border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, voucher/code, CNIC, booker, ID..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Modules ({summary.totalDeleted})</option>
                  {modules.map((m) => (
                    <option key={m.moduleKey} value={m.moduleKey}>
                      {m.label} ({m.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Deleted From Date"
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="Deleted To Date"
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deletedByFilter}
                  onChange={(e) => setDeletedByFilter(e.target.value)}
                  placeholder="Deleted by user..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {(selectedModule !== 'all' ||
                  searchQuery ||
                  startDate ||
                  endDate ||
                  deletedByFilter) && (
                  <button
                    onClick={clearFilters}
                    title="Clear Filters"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Deleted Records Table */}
          <Card className="overflow-hidden border-slate-800 bg-slate-900/90">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedKeys.size === items.length}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">Module</th>
                      <th className="py-3 px-4">Record &amp; Reference</th>
                      <th className="py-3 px-4">Details &amp; Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Deleted By</th>
                      <th className="py-3 px-4">Deleted At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Scanning soft-deleted records across all ERP collections...</span>
                          </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <CheckCircle2 className="h-8 w-8 text-emerald-400/70" />
                            <p className="text-sm font-semibold text-slate-200">
                              No soft-deleted records match your filters
                            </p>
                            <p className="text-xs text-slate-500">
                              Deleted records are safely stored here and can be restored at any time.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => {
                        const key = makeKey(item);
                        const isSelected = selectedKeys.has(key);
                        return (
                          <tr
                            key={key}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isSelected ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectItem(item)}
                                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <Badge variant="warning">{item.moduleLabel}</Badge>
                              <div className="text-[10px] text-slate-500 mt-1">
                                {item.modelName}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-100">{item.title}</div>
                              <div className="text-[11px] font-mono text-amber-400/90 mt-0.5">
                                {item.reference}
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <div className="text-slate-300 truncate" title={item.details}>
                                {item.details}
                              </div>
                              {item.amount !== null && item.amount !== undefined && (
                                <div className="text-xs font-bold text-emerald-400 mt-0.5">
                                  Rs. {Number(item.amount).toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 w-fit">
                                  Soft-Deleted
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Orig: {item.status}
                                </span>
                                {item.hasLinkedJournal && (
                                  <span className="text-[10px] text-blue-400">
                                    Linked GL Voucher
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="text-slate-200 font-medium">
                                {item.deletedByUser?.fullName || 'Administrator'}
                              </div>
                              {item.deletedByUser?.role && (
                                <div className="text-[10px] text-slate-500">
                                  {item.deletedByUser.role}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                              {item.deletedAt ? formatDateTime(item.deletedAt) : '-'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setInspectItem(item)}
                                  title="Inspect Original Record"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRestoreSingle(item)}
                                  disabled={actionLoading}
                                  title="Restore Record"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Restore
                                </button>
                                {(superAdmin || permissions.canPermanentDelete) && (
                                  <button
                                    onClick={() => handlePermanentDeleteSingle(item)}
                                    disabled={actionLoading}
                                    title="Permanently Delete (Super Admin Only)"
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Deletion & Recovery Audit History Tab */
        <Card className="overflow-hidden border-slate-800 bg-slate-900/90">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">User &amp; Role</th>
                    <th className="py-3 px-4">Record ID / Reason</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {historyLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No deletion or restoration events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    historyLogs.map((log) => {
                      const act = String(log.action || '');
                      const isRestore = /restore/i.test(act);
                      const isPermanent = /permanent/i.test(act);
                      const isUnauth = /unauthorized|failed/i.test(act);
                      const badgeVariant = isRestore
                        ? 'success'
                        : isPermanent || isUnauth
                        ? 'danger'
                        : 'warning';
                      const recordId =
                        log.oldValues?.recordId ||
                        log.newValues?.recordId ||
                        log.oldValues?.id ||
                        log.newValues?.id ||
                        '-';
                      const reason =
                        log.newValues?.reason ||
                        log.oldValues?.reason ||
                        '-';
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant={badgeVariant}>{log.action}</Badge>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                            {log.module}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-slate-200 font-medium">
                              {log.user?.fullName || 'System / Admin'}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {log.user?.role?.name || log.oldValues?.userRole || ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <div className="font-mono text-[11px] text-amber-400 truncate">
                              ID: {Array.isArray(recordId) ? recordId.join(', ') : String(recordId)}
                            </div>
                            {reason && reason !== '-' && (
                              <div className="text-[11px] text-slate-400 truncate">
                                Reason: {reason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setInspectHistoryLog(log)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                            >
                              Inspect State
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inspect Soft-Deleted Record Modal */}
      <Modal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title={
          inspectItem
            ? `Deleted Record Details — ${inspectItem.moduleLabel}`
            : 'Record Details'
        }
        size="lg"
      >
        {inspectItem && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">{inspectItem.title}</div>
                <div className="text-xs text-amber-400 font-mono mt-0.5">
                  Reference: {inspectItem.reference} | ID: {inspectItem.id}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleRestoreSingle(inspectItem)}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore This Record
                </Button>
                {(superAdmin || permissions.canPermanentDelete) && (
                  <Button
                    variant="danger"
                    onClick={() => handlePermanentDeleteSingle(inspectItem)}
                    disabled={actionLoading}
                    className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanent Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Deleted At</span>
                <span className="text-slate-100 font-semibold mt-0.5 block">
                  {inspectItem.deletedAt ? formatDateTime(inspectItem.deletedAt) : '-'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Deleted By</span>
                <span className="text-slate-100 font-semibold mt-0.5 block">
                  {inspectItem.deletedByUser?.fullName || inspectItem.deletedBy || 'Admin'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Original Status / GL Link</span>
                <span className="text-slate-100 font-semibold mt-0.5 block">
                  {inspectItem.status}{' '}
                  {inspectItem.hasLinkedJournal ? '(Has Linked Journal Entry)' : ''}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Complete Original Record Snapshot (Preserved in MongoDB)
              </h4>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono overflow-auto max-h-96">
                {JSON.stringify(inspectItem.originalRecord, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Inspect Audit History Modal */}
      <Modal
        isOpen={Boolean(inspectHistoryLog)}
        onClose={() => setInspectHistoryLog(null)}
        title={
          inspectHistoryLog
            ? `Audit Event: ${inspectHistoryLog.action}`
            : 'Audit Event'
        }
        size="lg"
      >
        {inspectHistoryLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Timestamp</span>
                <span className="text-slate-100 font-semibold">
                  {formatDateTime(inspectHistoryLog.createdAt)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">User &amp; Source IP</span>
                <span className="text-slate-100 font-semibold">
                  {inspectHistoryLog.user?.fullName || 'System'} ({inspectHistoryLog.ipAddress || 'local'})
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Previous State (oldValues)
                </h4>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-auto max-h-80">
                  {JSON.stringify(inspectHistoryLog.oldValues, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  New State (newValues)
                </h4>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-auto max-h-80">
                  {JSON.stringify(inspectHistoryLog.newValues, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RecycleBin;

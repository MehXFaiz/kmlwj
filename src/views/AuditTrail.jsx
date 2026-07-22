import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuditStore } from '../store/auditStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Globe,
  Copy,
  Check,
  Calendar,
  User,
  FileText,
  ArrowUpDown,
  Tag,
  Key,
  Zap,
  DollarSign,
  Clock,
  Layers,
  X,
  ExternalLink,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Heart,
  UserCheck,
  BookOpen
} from 'lucide-react';

export const AuditTrail = () => {
  const { logs: auditLogs, fetchLogs, loading } = useAuditStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopy = useCallback((text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // Parse & structure log details intelligently
  const parseComplianceLog = useCallback((log) => {
    const rawAction = log.action || 'Unknown Action';
    const rawDetails = log.details || '';

    // 1. Extract reference code (like BR-260708-609221 or parentheses content)
    let refCode = null;
    let cleanAction = rawAction;
    const bracketMatch = rawAction.match(/\(([^)]+)\)/);
    if (bracketMatch) {
      refCode = bracketMatch[1];
      cleanAction = rawAction.replace(/\s*\([^)]+\)\s*/, '').trim();
    } else {
      const refMatch = rawDetails.match(/\b(BR-[\d-]+|[A-Z]{2,}-\d+)\b/);
      if (refMatch) refCode = refMatch[1];
    }

    // 2. Extract IP address
    let ip = log.ipAddress || null;
    if (!ip) {
      const ipMatch = rawDetails.match(/IP:\s*([\d.]+)/i);
      if (ipMatch) ip = ipMatch[1];
    }

    // 3. Determine Module Name & clean details
    let moduleLabel = log.module && log.module !== 'SYSTEM' ? log.module : 'System Audit';
    let cleanDescription = rawDetails;

    // Check module prefixes in details string like "AUTH: " or "DONATION_RECEIVED: "
    const prefixMatch = rawDetails.match(/^([A-Za-z0-9_ ]+):\s*(.*)$/);
    if (prefixMatch) {
      const rawModule = prefixMatch[1].trim();
      const rest = prefixMatch[2].trim();
      cleanDescription = rest;

      switch (rawModule.toUpperCase()) {
        case 'AUTH':
          moduleLabel = 'Security & Auth';
          break;
        case 'DONATION_RECEIVED':
          moduleLabel = 'Donations';
          break;
        case 'DONOR':
          moduleLabel = 'Donor Management';
          break;
        case 'REVENUE':
          moduleLabel = 'Revenue & Bookings';
          break;
        case 'MEMBERSHIP FEE':
          moduleLabel = 'Membership';
          break;
        default:
          moduleLabel = rawModule.replace(/_/g, ' ');
      }
    }

    // Remove trailing IP address clause from description for clean reading
    cleanDescription = cleanDescription.replace(/\.?\s*IP:\s*[\d.]+\.?$/i, '').trim();
    if (!cleanDescription) cleanDescription = cleanAction;

    // Detect category for filtering
    let category = 'system';
    const actUpper = cleanAction.toUpperCase();
    if (actUpper.includes('LOGIN') || actUpper.includes('AUTH') || moduleLabel.includes('Security')) {
      category = 'auth';
    } else if (
      actUpper.includes('DONATION') ||
      actUpper.includes('DONOR') ||
      actUpper.includes('REVENUE') ||
      actUpper.includes('BOOKING') ||
      actUpper.includes('MEMBERSHIP')
    ) {
      category = 'revenue';
    } else if (actUpper.includes('JOURNAL') || actUpper.includes('POST') || moduleLabel.includes('Ledger')) {
      category = 'journal';
    }

    return {
      id: log.id,
      timestamp: log.timestamp || log.createdAt,
      rawAction,
      cleanAction,
      refCode,
      moduleLabel,
      cleanDescription,
      user: log.user || 'System',
      email: log.email || null,
      ipAddress: ip || 'System Internal',
      userAgent: log.userAgent || null,
      oldValues: log.oldValues || null,
      newValues: log.newValues || null,
      category,
    };
  }, []);

  const getActionBadgeConfig = useCallback((action) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return { variant: 'info', icon: Key, label: action };
    }
    if (act.includes('DONATION') || act.includes('DONOR')) {
      return { variant: 'success', icon: Heart, label: action };
    }
    if (act.includes('HALL BOOKING') || act.includes('REVENUE')) {
      return { variant: 'brand', icon: Calendar, label: action };
    }
    if (act.includes('MEMBERSHIP')) {
      return { variant: 'info', icon: UserCheck, label: action };
    }
    if (act.includes('AUTO POST') || act.includes('JOURNAL')) {
      return { variant: 'purple', icon: Zap, label: action };
    }
    if (act.includes('CREATE') || act.includes('ADD')) {
      return { variant: 'success', icon: CheckCircle2, label: action };
    }
    if (act.includes('UPDATE') || act.includes('MODIFY')) {
      return { variant: 'warning', icon: AlertCircle, label: action };
    }
    if (act.includes('DELETE') || act.includes('REMOVE')) {
      return { variant: 'danger', icon: X, label: action };
    }
    return { variant: 'default', icon: FileText, label: action };
  }, []);

  // Parse all logs
  const parsedLogs = useMemo(() => {
    return (auditLogs || []).map((l) => parseComplianceLog(l));
  }, [auditLogs, parseComplianceLog]);

  // Extract unique users for filtering
  const availableUsers = useMemo(() => {
    const set = new Set(parsedLogs.map((l) => l.user).filter(Boolean));
    return Array.from(set);
  }, [parsedLogs]);

  // Filter & sort logs
  const filteredLogs = useMemo(() => {
    return parsedLogs
      .filter((log) => {
        // Search Query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match =
            log.cleanAction.toLowerCase().includes(q) ||
            log.cleanDescription.toLowerCase().includes(q) ||
            log.user.toLowerCase().includes(q) ||
            log.moduleLabel.toLowerCase().includes(q) ||
            (log.refCode && log.refCode.toLowerCase().includes(q)) ||
            (log.ipAddress && log.ipAddress.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Category Filter
        if (activeCategory !== 'all' && log.category !== activeCategory) {
          return false;
        }

        // User Filter
        if (userFilter !== 'all' && log.user !== userFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [parsedLogs, searchQuery, activeCategory, userFilter, sortOrder]);

  // Summary KPI calculation
  const stats = useMemo(() => {
    const total = parsedLogs.length;
    const authCount = parsedLogs.filter((l) => l.category === 'auth').length;
    const financialCount = parsedLogs.filter((l) => l.category === 'revenue' || l.category === 'journal').length;
    const autoCount = parsedLogs.filter((l) => l.cleanAction.toUpperCase().includes('AUTO')).length;
    return { total, authCount, financialCount, autoCount };
  }, [parsedLogs]);

  // SQA fix: neutralize CSV formula injection — a value starting with =, +,
  // -, or @ would otherwise be interpreted as a formula by Excel/Sheets when
  // this export is opened, and unescaped quotes would break the row.
  const csvCell = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Export CSV
  const exportToCSV = useCallback(() => {
    if (!filteredLogs.length) return;
    const headers = [
      'Timestamp (UTC)',
      'Module',
      'Action',
      'Reference Code',
      'Compliance Details',
      'Authorized User',
      'IP Address'
    ];
    const rows = filteredLogs.map((log) => [
      new Date(log.timestamp).toUTCString(),
      log.moduleLabel,
      log.cleanAction,
      log.refCode || 'N/A',
      csvCell(log.cleanDescription),
      log.user,
      log.ipAddress
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SOX_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredLogs]);

  const categories = [
    { id: 'all', label: 'All Events', count: parsedLogs.length },
    { id: 'auth', label: 'Security & Auth', count: stats.authCount },
    { id: 'revenue', label: 'Revenue & Donations', count: parsedLogs.filter((l) => l.category === 'revenue').length },
    { id: 'journal', label: 'Accounting & Journals', count: parsedLogs.filter((l) => l.category === 'journal').length },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 uppercase tracking-wider font-sans">
              Compliance & Audit Trail Logs
            </h2>
            <Badge variant="brand" className="text-[10px]">SOX-404 VERIFIED</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Chronological read-only audit log tracking every user action, financial event, and system posting.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-all cursor-pointer disabled:opacity-50"
            title="Export filtered audit logs to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Regulatory Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 sm:p-4 bg-blue-950/25 border border-blue-900/40 rounded-xl">
        <ShieldCheck className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold text-brand-300">Sarbanes-Oxley (SOX) Immutable Trail Protection</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            All user operations, voucher postings, and chart of account modifications are recorded with verifiable UTC timestamps and network IP traces to guarantee internal control accountability and prevent unauthorized alterations.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-slate-800/80 bg-slate-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Total Audit Events</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{stats.total}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Immutable logged traces</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 text-slate-300">
              <History className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Security & Auth</p>
              <h3 className="text-xl sm:text-2xl font-bold text-cyan-300 mt-1">{stats.authCount}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Logins & authentication</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
              <Key className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Financial Events</p>
              <h3 className="text-xl sm:text-2xl font-bold text-emerald-300 mt-1">{stats.financialCount}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Donations, bookings & postings</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Automated Postings</p>
              <h3 className="text-xl sm:text-2xl font-bold text-violet-300 mt-1">{stats.autoCount}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">System auto-posted journals</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-violet-400">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-800/90">
        <CardContent className="p-4 space-y-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 pb-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search, User & Sort controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by action, module, reference ID, user, or IP address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-lg text-xs sm:text-sm py-2 pl-9 pr-8 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2">
              {/* User Selector */}
              <div className="relative">
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="bg-slate-900/80 border border-slate-800 rounded-lg text-xs py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 pr-8 cursor-pointer"
                >
                  <option value="all">All Authorized Users</option>
                  {availableUsers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order Selector */}
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                title="Toggle chronological order"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-brand-400" />
                <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Compliance Logs Card */}
      <Card className="overflow-hidden border-slate-800/90">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-900/20 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">Compliance Audit Logs</CardTitle>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {filteredLogs.length} {filteredLogs.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <CardDescription className="text-xs">
              Chronological immutable trial trace with network IP and action inspection.
            </CardDescription>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Timezone: <span className="text-slate-200">Local / UTC</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Mobile Card Layout */}
          <MobileOnly className="p-3 space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400 font-medium">No compliance events found</p>
                <p className="text-xs text-slate-500">Try adjusting your search keywords or filter criteria.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const badgeConfig = getActionBadgeConfig(log.cleanAction);
                const ActionIcon = badgeConfig.icon;
                const formattedDate = new Date(log.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = new Date(log.timestamp).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="rounded-xl border border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/70 p-3.5 space-y-2.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={badgeConfig.variant} className="flex items-center gap-1.5 text-[10px]">
                        <ActionIcon className="h-3 w-3" />
                        <span>{badgeConfig.label}</span>
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {formattedDate} • {formattedTime}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider">
                          {log.moduleLabel}
                        </span>
                        {log.refCode && (
                          <span className="px-2 py-0.5 rounded bg-brand-950/60 border border-brand-800/60 text-brand-300 text-[11px] font-mono font-bold">
                            {log.refCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {log.cleanDescription}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                        <User className="h-3.5 w-3.5 text-amber-400" />
                        <span>{log.user}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                        <Globe className="h-3 w-3 text-slate-500" />
                        <span>{log.ipAddress}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </MobileOnly>

          {/* Desktop Responsive Table Layout */}
          <DesktopOnly>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4 w-48">Timestamp</th>
                    <th className="py-3 px-4 w-52">Action & Module</th>
                    <th className="py-3 px-4">Compliance Details & Reference</th>
                    <th className="py-3 px-4 w-36">Authorized User</th>
                    <th className="py-3 px-4 w-36">Network IP</th>
                    <th className="py-3 px-4 w-20 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">
                        <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-400">No compliance events match your search</p>
                        <p className="text-xs text-slate-500 mt-1">Try resetting your filter or searching for a different action.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const badgeConfig = getActionBadgeConfig(log.cleanAction);
                      const ActionIcon = badgeConfig.icon;

                      const dateObj = new Date(log.timestamp);
                      const formattedDate = dateObj.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const formattedTime = dateObj.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const utcTime = dateObj.toUTCString().split(' ')[4];

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                        >
                          {/* Timestamp column */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-0.5">
                              <div className="text-slate-200 font-mono text-xs font-medium">
                                {formattedDate}
                              </div>
                              <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-slate-500" />
                                <span>{formattedTime}</span>
                                <span className="text-[10px] text-slate-500">({utcTime} UTC)</span>
                              </div>
                            </div>
                          </td>

                          {/* Action & Module column */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1.5">
                              <Badge variant={badgeConfig.variant} className="flex items-center gap-1.5 w-fit">
                                <ActionIcon className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{badgeConfig.label}</span>
                              </Badge>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                <Tag className="h-3 w-3 text-brand-400" />
                                <span>{log.moduleLabel}</span>
                              </div>
                            </div>
                          </td>

                          {/* Compliance Details & Reference column */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-medium text-slate-100 font-sans leading-relaxed">
                                  {log.cleanDescription}
                                </p>
                                {log.refCode && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(log.refCode, `ref-${log.id}`);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-950/60 hover:bg-brand-900/80 border border-brand-800/60 text-brand-300 font-mono text-[11px] font-bold transition-colors cursor-pointer group/btn"
                                    title="Click to copy Reference ID"
                                  >
                                    <span>{log.refCode}</span>
                                    {copiedKey === `ref-${log.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3 opacity-60 group-hover/btn:opacity-100" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Authorized User column */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 font-semibold text-xs">
                              <User className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span>{log.user}</span>
                            </div>
                          </td>

                          {/* Network IP column */}
                          <td className="py-3.5 px-4 align-top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(log.ipAddress, `ip-${log.id}`);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs transition-colors cursor-pointer group/ip"
                              title="Click to copy IP Address"
                            >
                              <Globe className="h-3 w-3 text-slate-500 group-hover/ip:text-brand-400 transition-colors" />
                              <span>{log.ipAddress}</span>
                              {copiedKey === `ip-${log.id}` ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-500 opacity-0 group-hover/ip:opacity-100 transition-opacity" />
                              )}
                            </button>
                          </td>

                          {/* Inspect action column */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-brand-950/40 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Inspect full audit record"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DesktopOnly>
        </CardContent>
      </Card>

      {/* Audit Log Full Detail Inspector Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="SOX Compliance Log Record"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            {/* Top overview bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-950/60 border border-brand-800/60 text-brand-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getActionBadgeConfig(selectedLog.cleanAction).variant}>
                      {selectedLog.cleanAction}
                    </Badge>
                    <span className="text-xs text-slate-400">• {selectedLog.moduleLabel}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Event ID: <span className="font-mono text-slate-400">{selectedLog.id}</span>
                  </p>
                </div>
              </div>

              {selectedLog.refCode && (
                <div className="flex items-center gap-2 bg-brand-950/40 border border-brand-800/40 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-slate-400">Ref Code:</span>
                  <span className="text-xs font-mono font-bold text-brand-300">{selectedLog.refCode}</span>
                </div>
              )}
            </div>

            {/* Detailed metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Execution Timestamp
                </span>
                <div className="text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Local Time:</span>
                    <span className="text-slate-200">
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">UTC Time:</span>
                    <span className="text-slate-200">
                      {new Date(selectedLog.timestamp).toUTCString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Authorized Identity & Origin
                </span>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Authorized User:</span>
                    <span className="font-bold text-amber-300">{selectedLog.user}</span>
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-400">Network IP:</span>
                    <span className="text-slate-200">{selectedLog.ipAddress}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete description box */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Full Compliance Details
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-sans leading-relaxed">
                {selectedLog.cleanDescription}
              </div>
            </div>

            {/* Raw JSON inspection / verification */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Regulatory Trace Payload
              </span>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 font-mono overflow-x-auto">
{JSON.stringify(
  {
    auditEventId: selectedLog.id,
    module: selectedLog.moduleLabel,
    action: selectedLog.rawAction,
    referenceCode: selectedLog.refCode || null,
    authorizedUser: selectedLog.user,
    ipAddress: selectedLog.ipAddress,
    timestampUTC: new Date(selectedLog.timestamp).toISOString(),
    soxVerified: true,
  },
  null,
  2
)}
              </pre>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), 'json')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                {copiedKey === 'json' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Raw JSON</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};


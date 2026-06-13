import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useCoaStore } from '../store/coaStore';
import { useDashboardStore } from '../store/dashboardStore';
import { useJournalStore, calculateAccountBalances } from '../store/journalStore';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid,
  RadialBarChart, RadialBar, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, ShieldAlert,
  Lock, Unlock, Layers, BookOpen, Zap, Plus, FileText,
  RefreshCw, Download, Bell, ChevronRight, CheckCircle2,
  AlertTriangle, Clock, Users, PieChart as PieIcon,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Animated Counter Hook
───────────────────────────────────────────── */
function useAnimatedCounter(target, duration = 1200, prefix = '', suffix = '', decimals = 0) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const startValRef = useRef(0);

  useEffect(() => {
    const startVal = startValRef.current;
    const diff = target - startVal;
    if (diff === 0) return;

    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const current = startVal + diff * eased;
      setValue(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startValRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  const formatted = decimals > 0
    ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(value).toLocaleString();
  return `${prefix}${formatted}${suffix}`;
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({ title, value, prefix = '', suffix = '', decimals = 0, icon: Icon, iconBg, iconColor, trend, trendLabel, accent, badge, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const animated = useAnimatedCounter(visible ? value : 0, 1100, prefix, suffix, decimals);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
      className={`relative overflow-hidden rounded-xl p-4 sm:p-5 border ${accent || 'border-slate-800/70 bg-slate-900/50'} backdrop-blur-sm group hover:border-slate-700/80 hover:shadow-slate-200/50 hover:shadow-black/30 transition-all duration-300 shadow-none`}
    >
      {/* Background glow */}
      <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl ${iconBg}`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">{title}</p>
          <p className={`text-xl sm:text-2xl font-extrabold font-mono leading-none ${iconColor || 'text-slate-100'}`}>
            {animated}
          </p>
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-2.5 text-[10px] font-bold uppercase tracking-wider ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
              {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
              {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
              {trend === 'neutral' && <Activity className="h-3 w-3" />}
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} border border-white/5`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>

      {badge && (
        <div className="absolute top-3 right-14">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section Header
───────────────────────────────────────────── */
function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Custom Chart Tooltip
───────────────────────────────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2.5 text-xs shadow-2xl border border-slate-700/60">
      {label && <p className="text-slate-400 mb-1.5 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-mono font-bold text-slate-200">
            {typeof p.value === 'number' ? `$${p.value.toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Quick Action Button
───────────────────────────────────────────── */
function QuickAction({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/50 hover:border-slate-700 transition-all duration-200 text-left"
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color} transition-transform duration-200 group-hover:scale-110`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 ml-auto transition-all duration-200 group-hover:translate-x-0.5" />
    </button>
  );
}

/* ─────────────────────────────────────────────
   Recent Activity Row
───────────────────────────────────────────── */
function ActivityRow({ log, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const isPost = log.action === 'Post Journal';
  const isInit = log.action === 'System Init';
  const time = new Date(log.timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-12px)',
        transition: `opacity 0.4s ease, transform 0.4s ease`,
      }}
      className="flex items-start gap-3 py-3 border-b border-slate-800/50 last:border-0 group"
    >
      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isPost ? 'bg-indigo-950/60 border border-indigo-800/40' :
        isInit ? 'bg-emerald-950/60 border border-emerald-800/40' :
        'bg-slate-800/60 border border-slate-700/40'
      }`}>
        {isPost ? <FileText className="h-3.5 w-3.5 text-indigo-400" /> :
         isInit ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> :
         <Activity className="h-3.5 w-3.5 text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-300 truncate">{log.details}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-500">{time}</span>
          <span className="text-slate-700">·</span>
          <span className="text-[10px] text-slate-500 font-medium">{log.user}</span>
        </div>
      </div>
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
        isPost ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50' :
        'bg-slate-800/60 text-slate-400 border border-slate-700/50'
      }`}>{log.action}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Account Type Distribution Card
───────────────────────────────────────────── */
function AccountTypeStat({ label, count, pct, color, dotColor }) {
  const [bar, setBar] = useState(0);
  useEffect(() => { const t = setTimeout(() => setBar(pct), 300); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-xs text-slate-400 flex-1 truncate">{label}</span>
      <div className="w-16 sm:w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${bar}%` }}
        />
      </div>
      <span className="text-xs font-mono font-bold text-slate-300 w-8 text-right">{count}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────────── */
export const Dashboard = () => {
  const { accounts, fetchAccounts, selectedSubsidiary } = useCoaStore();
  const { journals, auditLogs } = useJournalStore();
  const { stats: dbStats, fetchStats } = useDashboardStore();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchAccounts();
    fetchStats();
  }, [fetchAccounts, fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchAccounts();
    fetchStats();
    setRefreshKey(k => k + 1);
  }, [fetchAccounts, fetchStats]);

  // Live balances
  const { rollupBalances } = useMemo(
    () => calculateAccountBalances(accounts, journals, selectedSubsidiary),
    [accounts, journals, selectedSubsidiary, refreshKey]
  );

  // Financial stats
  const stats = useMemo(() => {
    let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
    accounts.forEach((acc) => {
      if (acc.parentCode === null) {
        const bal = rollupBalances[acc.code] || 0;
        if (acc.type === 'Asset') assets += bal;
        else if (acc.type === 'Liability') liabilities += bal;
        else if (acc.type === 'Equity') equity += bal;
        else if (acc.type === 'Revenue') revenue += bal;
        else if (acc.type === 'Expense') expenses += bal;
      }
    });
    return {
      assets, liabilities, equity, revenue, expenses,
      netIncome: revenue - expenses,
      grossMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100) : 0,
      isEquationBalanced: Math.abs(assets - (liabilities + equity)) < 0.01,
    };
  }, [accounts, rollupBalances]);

  // Account counts
  const acctStats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.status === 'Active').length;
    const locked = accounts.filter(a => a.status === 'Inactive').length;
    const byType = {
      Asset: accounts.filter(a => a.type === 'Asset').length,
      Liability: accounts.filter(a => a.type === 'Liability').length,
      Equity: accounts.filter(a => a.type === 'Equity').length,
      Revenue: accounts.filter(a => a.type === 'Revenue').length,
      Expense: accounts.filter(a => a.type === 'Expense').length,
    };
    return { total, active, locked, byType };
  }, [accounts]);

  // Pie chart — account type distribution
  const typeDistData = useMemo(() => [
    { name: 'Assets', value: acctStats.byType.Asset, fill: 'var(--chart-asset)' },
    { name: 'Liabilities', value: acctStats.byType.Liability, fill: 'var(--chart-liability)' },
    { name: 'Equity', value: acctStats.byType.Equity, fill: 'var(--chart-equity)' },
    { name: 'Revenue', value: acctStats.byType.Revenue, fill: 'var(--chart-revenue)' },
    { name: 'Expenses', value: acctStats.byType.Expense, fill: 'var(--chart-expense)' },
  ], [acctStats]);

  // Balance sheet bar data
  const balSheetData = useMemo(() => [
    { name: 'Assets', value: Math.round(stats.assets), fill: 'var(--chart-asset)' },
    { name: 'Liabilities', value: Math.round(stats.liabilities), fill: 'var(--chart-liability)' },
    { name: 'Equity', value: Math.round(stats.equity), fill: 'var(--chart-equity)' },
  ], [stats]);

  // Recent transactions from journals
  const recentJournals = useMemo(() => (journals || []).slice(0, 6), [journals]);

  const recentActivity = useMemo(() => {
    if (dbStats && dbStats.recentActivities) return dbStats.recentActivities;
    return (auditLogs || []).slice(0, 8);
  }, [dbStats, auditLogs]);

  const typeColors = {
    Asset: { bg: 'bg-blue-500', dot: 'bg-blue-500', bar: 'bg-blue-500' },
    Liability: { bg: 'bg-amber-500', dot: 'bg-amber-400', bar: 'bg-amber-500' },
    Equity: { bg: 'bg-violet-500', dot: 'bg-violet-400', bar: 'bg-violet-500' },
    Revenue: { bg: 'bg-emerald-500', dot: 'bg-emerald-400', bar: 'bg-emerald-500' },
    Expense: { bg: 'bg-red-500', dot: 'bg-red-400', bar: 'bg-red-500' },
  };

  return (
    <div className="space-y-7 pb-10">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-400 bg-indigo-950/50 border border-indigo-900/60 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Live Data
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Financial Command Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">Consolidated real-time analytics · {selectedSubsidiary} · FY 2026</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Export</span>
          </button>
          <button className="relative p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 border border-slate-900" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards Row ── */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard title="Total Accounts" value={dbStats?.totalAccounts || 0} icon={Layers}
          iconBg="bg-indigo-950/60" iconColor="text-indigo-400"
          trend="neutral" trendLabel={`${acctStats.byType.Asset} asset types`} delay={0} />
        <KpiCard title="Active Users" value={dbStats?.activeUsers || 0} icon={Users}
          iconBg="bg-emerald-950/60" iconColor="text-emerald-400"
          trend="up" trendLabel="Operational" delay={80} />
        <KpiCard title="Locked Accounts" value={dbStats?.lockedAccounts || 0} icon={Lock}
          iconBg="bg-red-950/60" iconColor="text-red-400"
          trend="neutral" trendLabel="Restricted" delay={160} />
        <KpiCard title="Revenue Heads" value={dbStats?.revenueHeads || 0} icon={TrendingUp}
          iconBg="bg-green-950/60" iconColor="text-green-400"
          trend="up" trendLabel="Income streams" delay={240} />
        <KpiCard title="Expense Heads" value={dbStats?.expenseHeads || 0} icon={TrendingDown}
          iconBg="bg-orange-950/60" iconColor="text-orange-400"
          trend="neutral" trendLabel="Cost centers" delay={320} />
        <KpiCard title="Journal Entries" value={dbStats?.totalJournalEntries || 0} icon={BookOpen}
          iconBg="bg-violet-950/60" iconColor="text-violet-400"
          trend="up" trendLabel="Total records" delay={400} />
      </div>

      {/* ── Financial KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Assets" value={stats.assets} prefix="$" decimals={2}
          icon={DollarSign} iconBg="bg-blue-950/60" iconColor="text-blue-400"
          trend="up" trendLabel="Liquid + Fixed"
          accent="border-blue-900/40 bg-gradient-to-br from-blue-950/30 to-slate-900/60"
          delay={100} />
        <KpiCard title="Total Liabilities" value={stats.liabilities} prefix="$" decimals={2}
          icon={Activity} iconBg="bg-amber-950/60" iconColor="text-amber-400"
          trend="neutral" trendLabel="Payables + Debt"
          accent="border-amber-900/30 bg-gradient-to-br from-amber-950/20 to-slate-900/60"
          delay={180} />
        <KpiCard title="Total Equity" value={stats.equity} prefix="$" decimals={2}
          icon={Scale} iconBg="bg-violet-950/60" iconColor="text-violet-400"
          trend="up" trendLabel="Shareholder value"
          accent="border-violet-900/30 bg-gradient-to-br from-violet-950/20 to-slate-900/60"
          delay={260} />
        <KpiCard title="Net Income" value={stats.netIncome} prefix="$" decimals={2}
          icon={stats.netIncome >= 0 ? TrendingUp : TrendingDown}
          iconBg={stats.netIncome >= 0 ? "bg-emerald-950/60" : "bg-red-950/60"}
          iconColor={stats.netIncome >= 0 ? "text-emerald-400" : "text-red-400"}
          trend={stats.netIncome >= 0 ? "up" : "down"}
          trendLabel={stats.netIncome >= 0 ? `${stats.grossMargin.toFixed(1)}% margin` : "Operating deficit"}
          accent={stats.netIncome >= 0
            ? "border-emerald-900/30 bg-gradient-to-br from-emerald-950/20 to-slate-900/60"
            : "border-red-900/30 bg-gradient-to-br from-red-950/20 to-slate-900/60"}
          delay={340} />
      </div>

      {/* ── Balance Equation Banner ── */}
      <div className={`rounded-xl border-l-4 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        stats.isEquationBalanced
          ? 'border-l-emerald-500 border-t border-r border-b border-emerald-900/30 bg-emerald-950/10 shadow-none'
          : 'border-l-red-500 border-t border-r border-b border-red-900/40 bg-red-950/10 shadow-none'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
            stats.isEquationBalanced
              ? 'bg-emerald-100 border-emerald-200 bg-emerald-950 border-emerald-800/50'
              : 'bg-red-100 border-red-200 bg-red-950 border-red-800/50 animate-pulse'
          }`}>
            {stats.isEquationBalanced
              ? <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
              : <ShieldAlert className="h-4.5 w-4.5 text-red-400" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              {stats.isEquationBalanced ? 'Balance Sheet Equation Verified' : 'Balance Sheet Out of Balance'}
            </p>
            <p className="text-[11px] text-slate-500">
              Fundamental accounting equation: <span className="font-semibold text-slate-400 font-mono">Assets = Liabilities + Equity</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm font-bold overflow-x-auto pb-1">
          <span className="text-blue-400">${stats.assets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="text-slate-600">=</span>
          <span className="text-amber-400">${stats.liabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="text-slate-600">+</span>
          <span className="text-violet-400">${stats.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            stats.isEquationBalanced
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50'
              : 'bg-red-950/60 text-red-400 border border-red-900/50'
          }`}>{stats.isEquationBalanced ? '✓ Balanced' : '✗ Unbalanced'}</span>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area Chart: Revenue vs Expenses Trend */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader
            title="Revenue vs Expenses Trend"
            subtitle="Monthly operating performance (YTD FY 2026)"
            action={
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-full">
                YTD 2026
              </span>
            }
          />
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dbStats?.monthlyData || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-revenue)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-revenue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-expense)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--chart-expense)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="var(--chart-revenue)" strokeWidth={2}
                  fill="url(#gRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-revenue)' }} />
                <Area type="monotone" dataKey="Expenses" stroke="var(--chart-expense)" strokeWidth={2}
                  fill="url(#gExpenses)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-expense)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '12px' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Account type distribution */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader title="Account Distribution" subtitle="By account type" />
          <div className="h-36 sm:h-40 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeDistData} cx="50%" cy="50%" innerRadius={40} outerRadius={68}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {typeDistData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-0.5">
            {Object.entries(acctStats.byType).map(([type, count]) => {
              const pct = acctStats.total > 0 ? (count / acctStats.total) * 100 : 0;
              const c = typeColors[type] || { dot: 'bg-slate-500', bar: 'bg-slate-500' };
              return (
                <AccountTypeStat key={type} label={type} count={count} pct={pct}
                  color={c.bar} dotColor={c.dot} />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Balance Sheet + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Balance Sheet Bar */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader
            title="Balance Sheet Overview"
            subtitle="Assets vs Liabilities vs Equity"
            action={
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                stats.isEquationBalanced
                  ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50'
                  : 'text-red-400 bg-red-950/50 border-red-900/50'
              }`}>
                {stats.isEquationBalanced ? '✓ Balanced' : '✗ Check'}
              </span>
            }
          />
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balSheetData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<DarkTooltip />} />
                <Bar dataKey="value" name="Balance" radius={[6, 6, 0, 0]}>
                  {balSheetData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader title="Quick Actions" subtitle="Common ERP operations" />
          <div className="space-y-2">
            <QuickAction icon={Plus} label="New Journal Entry"
              color="bg-indigo-950/60 border border-indigo-800/40 text-indigo-400" />
            <QuickAction icon={Layers} label="Manage Chart of Accounts"
              color="bg-blue-950/60 border border-blue-800/40 text-blue-400" />
            <QuickAction icon={BookOpen} label="View General Ledger"
              color="bg-violet-950/60 border border-violet-800/40 text-violet-400" />
            <QuickAction icon={BarChart3} label="Run Financial Reports"
              color="bg-emerald-950/60 border border-emerald-800/40 text-emerald-400" />
            <QuickAction icon={Users} label="User Permissions"
              color="bg-amber-950/60 border border-amber-800/40 text-amber-400" />
            <QuickAction icon={ShieldCheck} label="View Audit Trail"
              color="bg-slate-800/60 border border-slate-700/40 text-slate-400" />
          </div>

          {/* System status */}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">System Status</p>
            {[
              { label: 'GAAP Compliance', ok: true },
              { label: 'Double-Entry Valid', ok: true },
              { label: 'Balance Sheet', ok: stats.isEquationBalanced },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {ok ? 'OK' : 'Alert'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Transactions + Activity Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Transactions */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader
            title="Recent Transactions"
            subtitle="Latest posted journal entries"
            action={
              <button className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                View All <ChevronRight className="h-3 w-3" />
              </button>
            }
          />
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {recentJournals.map((je, i) => {
              const total = je.lines.reduce((s, l) => s + l.debit, 0);
              return (
                <div
                  key={je.id}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3"
                  style={{ opacity: 0, animation: `fadeSlideIn 0.4s ease ${i * 70}ms forwards` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-400">{je.id}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 shrink-0">
                      Posted
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-1.5 break-words">{je.reference}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500">{je.date}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-1 px-1">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['ID', 'Date', 'Reference', 'Amount', 'Status'].map(h => (
                    <th key={h} className="pb-2.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 last:pr-0 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {recentJournals.map((je, i) => {
                  const total = je.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <tr key={je.id} className="group hover:bg-slate-800/20 transition-colors"
                      style={{ opacity: 0, animation: `fadeSlideIn 0.4s ease ${i * 70}ms forwards` }}>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-[11px] font-bold text-indigo-400">{je.id}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[11px] text-slate-400">{je.date}</span>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[140px]">
                        <span className="text-[11px] text-slate-300 truncate block">{je.reference}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-[11px] font-bold text-emerald-400">
                          ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                          Posted
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader
            title="Recent Activity"
            subtitle="System audit trail"
            action={
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                Live
              </div>
            }
          />
          <div className="space-y-0 max-h-72 overflow-y-auto pr-1">
            {recentActivity.map((log, i) => (
              <ActivityRow key={log.id} log={log} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Fade-in keyframe */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

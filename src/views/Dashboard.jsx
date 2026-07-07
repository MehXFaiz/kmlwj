import { useMemo, useEffect, useRef, useState, useCallback, startTransition, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useDashboardStore } from '../store/dashboardStore';
import { useJournalStore, calculateAccountBalances } from '../store/journalStore';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid,
  RadialBarChart, RadialBar, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Banknote, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, ShieldAlert,
  Lock, Unlock, Layers, BookOpen, Zap, Plus, FileText,
  RefreshCw, Download, Bell, ChevronRight, CheckCircle2,
  AlertTriangle, Clock, Users, PieChart as PieIcon,
  Calendar, PlusCircle, MinusCircle, CheckSquare, Heart,
  ArrowRight, Wallet, RepeatIcon, Receipt,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
      className={`relative overflow-hidden rounded-xl p-4 sm:p-5 border ${accent || 'border-slate-800/60 bg-slate-900/50'} backdrop-blur-sm group hover:border-slate-700/70 hover:bg-slate-800/30 transition-all duration-200 shadow-none`}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 mb-2">{title}</p>
          <p className="text-xl sm:text-2xl font-extrabold font-mono leading-none text-slate-50 tabular-nums">
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
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} border border-white/5`}>
          <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
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
   Stat Card — premium redesign
───────────────────────────────────────────── */
function StatCard({ title, value, icon: Icon, iconBg, iconColor, trend, trendLabel, trendColor, accentBar, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const animated = useAnimatedCounter(visible ? value : 0, 1100, 'Rs ', '', 2);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
      className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/70 hover:bg-slate-800/40 transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-gradient-to-b ${accentBar} opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/[0.02] group-hover:bg-white/[0.04] transition-all duration-500 blur-xl" />
      <div className="relative px-5 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">
          {animated}
        </p>
        {trendLabel && (
          <div className={`flex items-center gap-1 mt-2.5 text-[10px] font-bold uppercase tracking-wider ${trendColor}`}>
            {trend === 'up'      && <ArrowUpRight   className="h-3 w-3" />}
            {trend === 'down'    && <ArrowDownRight  className="h-3 w-3" />}
            {trend === 'neutral' && <Activity         className="h-3 w-3" />}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section Header
───────────────────────────────────────────── */
function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Custom Chart Tooltip
───────────────────────────────────────────── */
const DarkTooltip = memo(function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2.5 text-xs shadow-2xl border border-slate-700/60">
      {label && <p className="text-slate-400 mb-1.5 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-mono font-bold text-slate-200">
            {typeof p.value === 'number' ? `Rs ${p.value.toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

const MemoizedAreaChart = memo(function MemoizedAreaChart({ data, tRevenue, tExpense }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
      <AreaChart data={data || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
        <ChartTooltip content={DarkTooltip} />
        <Area type="monotone" name={tRevenue} dataKey="Revenue" stroke="var(--chart-revenue)" strokeWidth={2}
          fill="url(#gRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-revenue)' }} isAnimationActive={false} />
        <Area type="monotone" name={tExpense} dataKey="Expenses" stroke="var(--chart-expense)" strokeWidth={2}
          fill="url(#gExpenses)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-expense)' }} isAnimationActive={false} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '12px' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

const MemoizedPieChart = memo(function MemoizedPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={68}
          paddingAngle={3} dataKey="value" strokeWidth={0} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <ChartTooltip content={DarkTooltip} />
      </PieChart>
    </ResponsiveContainer>
  );
});

const MemoizedBarChart = memo(function MemoizedBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false}
          tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
        <ChartTooltip content={DarkTooltip} />
        <Bar dataKey="value" name="Balance" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

/* ─────────────────────────────────────────────
   Quick Action Button
───────────────────────────────────────────── */
function QuickAction({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl border border-slate-800/70 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-700 transition-all duration-150 text-left"
    >
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${color} transition-transform duration-150 group-hover:scale-110 flex-shrink-0`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-[12px] font-semibold text-slate-400 group-hover:text-slate-100 transition-colors flex-1">{label}</span>
      <ChevronRight className="h-3 w-3 text-slate-700 group-hover:text-slate-400 transition-all duration-150 group-hover:translate-x-0.5 flex-shrink-0" />
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
        isPost ? 'bg-amber-950/60 border border-amber-800/40' :
        isInit ? 'bg-emerald-950/60 border border-emerald-800/40' :
        'bg-slate-800/60 border border-slate-700/40'
      }`}>
        {isPost ? <FileText className="h-3.5 w-3.5 text-amber-400" /> :
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
        isPost ? 'bg-amber-950/60 text-amber-400 border border-amber-900/50' :
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
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const { rollupBalances, localBalances } = useMemo(
    () => calculateAccountBalances(accounts, journals, selectedSubsidiary),
    [accounts, journals, selectedSubsidiary, refreshKey]
  );

  // Financial stats
  const stats = useMemo(() => {
    let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
    let cashBalance = 0;
    let bankBalance = 0;
    accounts.forEach((acc) => {
      const isSub = acc.detailType === 'Subsidiary' || acc.level === 'SUBSIDIARY';
      const localBal = localBalances?.[acc.code] || 0;

      if (acc.type === 'Asset' && isSub) {
        const nameLower = (acc.name || '').toLowerCase();
        if (nameLower.includes('cash')) {
          cashBalance += localBal;
        } else if (nameLower.includes('bank')) {
          bankBalance += localBal;
        }
      }

      if (acc.parentCode === null) {
        const bal = rollupBalances[acc.code] || 0;
        if (acc.type === 'Asset') assets += bal;
        else if (acc.type === 'Liability') liabilities += bal;
        else if (acc.type === 'Equity') equity += bal;
        else if (acc.type === 'Revenue') revenue += bal;
        else if (acc.type === 'Expense') expenses += bal;
      }
      // Calculate Cash and Bank
      const isLeaf = !accounts.some(a => a.parentCode === acc.code);
      if (acc.type === 'Asset' && isLeaf) {
        const bal = rollupBalances[acc.code] || 0;
        const name = acc.name.toLowerCase();
        if (name.includes('cash') && !name.includes('bank')) cashBalance += bal;
        if (name.includes('bank')) bankBalance += bal;
      }
    });
    return {
      assets, liabilities, equity, revenue, expenses,
      cashBalance, bankBalance,
      netIncome: revenue - expenses,
      grossMargin: revenue > 0 ? ((revenue - expenses) / revenue * 100) : 0,
      isEquationBalanced: Math.abs(assets - (liabilities + equity)) < 0.01,
    };
  }, [accounts, rollupBalances, localBalances]);

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
    Liability: { bg: 'bg-orange-500', dot: 'bg-orange-400', bar: 'bg-orange-500' },
    Equity: { bg: 'bg-violet-500', dot: 'bg-violet-400', bar: 'bg-violet-500' },
    Revenue: { bg: 'bg-emerald-500', dot: 'bg-emerald-400', bar: 'bg-emerald-500' },
    Expense: { bg: 'bg-red-500', dot: 'bg-red-400', bar: 'bg-red-500' },
  };

  return (
    <div className="space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Data
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-50 tracking-tight">{t('dashboard.title')}</h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">{selectedSubsidiary} &middot; FY 2026</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-200 transition-all text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Quick Actions ── horizontal pill-style row ── */}
      <div>
        <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          {t('dashboard.quickActions')}
        </h3>
        <div className="flex items-stretch gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
          {[
            { label: t('dashboard.addIncome'),    desc: t('dashboard.addIncomeDesc'),    icon: TrendingUp,  color: 'text-emerald-400', ring: 'ring-emerald-500/20', glow: 'shadow-emerald-950/40', iconBg: 'bg-emerald-500/10 border-emerald-500/20', line: 'bg-emerald-500', path: '/bank-vouchers/revenue/new' },
            { label: t('dashboard.addExpense'),   desc: t('dashboard.addExpenseDesc'),   icon: TrendingDown, color: 'text-red-400',    ring: 'ring-red-500/20',     glow: 'shadow-red-950/40',     iconBg: 'bg-red-500/10 border-red-500/20',         line: 'bg-red-500',     path: '/bank-vouchers/expense/new' },
            { label: t('dashboard.journalEntry'), desc: t('dashboard.journalEntryDesc'), icon: FileText,     color: 'text-amber-400', ring: 'ring-amber-500/20',  glow: 'shadow-amber-950/40',  iconBg: 'bg-amber-500/10 border-amber-500/20',   line: 'bg-amber-500', path: '/journals' },
            { label: 'General Ledger',            desc: 'View account ledgers & history',icon: BookOpen,     color: 'text-cyan-400',   ring: 'ring-cyan-500/20',    glow: 'shadow-cyan-950/40',    iconBg: 'bg-cyan-500/10 border-cyan-500/20',       line: 'bg-cyan-500',   path: '/ledger' },
            { label: t('dashboard.transferMoney'),desc: t('dashboard.transferMoneyDesc'),icon: RefreshCw,    color: 'text-violet-400', ring: 'ring-violet-500/20',  glow: 'shadow-violet-950/40',  iconBg: 'bg-violet-500/10 border-violet-500/20',   line: 'bg-violet-500', path: '/bank-vouchers/transfer/new' },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => startTransition(() => navigate(action.path))}
              className={`group relative flex-shrink-0 flex flex-col items-start gap-3 w-44 sm:w-48 p-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:bg-slate-800/60 hover:border-slate-700/80 hover:shadow-xl ${action.glow} hover:ring-1 ${action.ring} transition-all duration-300 cursor-pointer text-left overflow-hidden`}
            >
              {/* Accent line top */}
              <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-b-full ${action.line} opacity-60 group-hover:opacity-100 transition-opacity`} />
              {/* Icon */}
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${action.iconBg} group-hover:scale-105 transition-transform duration-200`}>
                <action.icon className={`h-4 w-4 ${action.color}`} />
              </div>
              {/* Text */}
              <div className="space-y-0.5">
                <p className={`text-sm font-bold ${action.color} leading-tight`}>{action.label}</p>
                <p className="text-[10px] text-slate-500 leading-snug">{action.desc}</p>
              </div>
              {/* Arrow */}
              <ChevronRight className={`absolute bottom-3.5 right-3.5 h-3.5 w-3.5 ${action.color} opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-0 group-hover:translate-x-0.5`} />
            </button>
          ))}
        </div>
      </div>


      {/* ── Financial KPI Cards ── premium redesign ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            title: t('dashboard.totalIncome'),
            value: stats.revenue,
            icon: TrendingUp,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/10 border-emerald-500/20',
            trend: 'up',
            trendLabel: t('dashboard.moneyReceived'),
            trendColor: 'text-emerald-400',
            accentBar: 'from-emerald-500 to-emerald-400',
            delay: 0,
          },
          {
            title: t('dashboard.totalSpent'),
            value: stats.expenses,
            icon: TrendingDown,
            iconColor: 'text-red-400',
            iconBg: 'bg-red-500/10 border-red-500/20',
            trend: 'down',
            trendLabel: t('dashboard.moneyPaidOut'),
            trendColor: 'text-red-400',
            accentBar: 'from-red-500 to-red-400',
            delay: 80,
          },
          {
            title: t('dashboard.cashInHand'),
            value: stats.cashBalance,
            icon: Banknote,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/10 border-blue-500/20',
            trend: 'neutral',
            trendLabel: t('dashboard.availableCash'),
            trendColor: 'text-slate-400',
            accentBar: 'from-blue-500 to-blue-400',
            delay: 160,
          },
          {
            title: t('dashboard.bankBalance'),
            value: stats.bankBalance,
            icon: Layers,
            iconColor: 'text-violet-400',
            iconBg: 'bg-violet-500/10 border-violet-500/20',
            trend: 'neutral',
            trendLabel: t('dashboard.inBankAccounts'),
            trendColor: 'text-slate-400',
            accentBar: 'from-violet-500 to-violet-400',
            delay: 240,
          },
        ].map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ── Account Health Banner ── */}
      <div className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 ${
        stats.isEquationBalanced
          ? 'border-slate-800/60 bg-slate-900/40'
          : 'border-red-900/50 bg-red-950/20'
      }`}>
        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
          stats.isEquationBalanced ? 'bg-slate-800/50 border-slate-700/50' : 'bg-red-950 border-red-800/50 animate-pulse'
        }`}>
          {stats.isEquationBalanced
            ? <CheckCircle2 className="h-4.5 w-4.5 text-slate-400" />
            : <AlertTriangle className="h-4.5 w-4.5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${stats.isEquationBalanced ? 'text-slate-200' : 'text-red-300'}`}>
            {stats.isEquationBalanced ? t('dashboard.accountsBalanced') : t('dashboard.accountsError')}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t('dashboard.assets')}: Rs {stats.assets.toLocaleString(undefined, { maximumFractionDigits: 0 })} &nbsp;·&nbsp;
            {t('dashboard.liabilities')}: Rs {stats.liabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })} &nbsp;·&nbsp;
            {t('dashboard.equity')}: Rs {stats.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Area Chart: Revenue vs Expenses Trend */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader
            title={t('dashboard.revenueVsExpensesTrend')}
            subtitle={t('dashboard.monthlyOperatingPerformance')}
            action={
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-full">
                YTD 2026
              </span>
            }
          />
          <div className="h-48 sm:h-56">
            <MemoizedAreaChart data={dbStats?.monthlyData || []} tRevenue={t('dashboard.revenue')} tExpense={t('dashboard.expense')} />
          </div>
        </div>

        {/* Pie Chart: Donation Breakdown */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader title={t('dashboard.accountDistribution')} subtitle={t('dashboard.breakdownByAccountType')} />
          <div className="h-36 sm:h-40 mb-3">
            <MemoizedPieChart data={typeDistData} />
          </div>
          <div className="space-y-0.5">
            {(dbStats?.donationBreakdown || []).map((entry, i) => {
              const total = dbStats.donationsAmountThisMonth || 1; // avoid / 0
              const pct = (entry._sum.amount / total) * 100;
              const colors = [
                { dot: 'bg-rose-500', bar: 'bg-rose-500' },
                { dot: 'bg-pink-500', bar: 'bg-pink-500' },
                { dot: 'bg-fuchsia-500', bar: 'bg-fuchsia-500' },
                { dot: 'bg-purple-500', bar: 'bg-purple-500' },
                { dot: 'bg-violet-500', bar: 'bg-violet-500' },
                { dot: 'bg-amber-500', bar: 'bg-amber-500' },
              ];
              const c = colors[i % colors.length];
              return (
                <AccountTypeStat key={entry.donationType} label={entry.donationType} count={`Rs ${entry._sum.amount.toLocaleString()}`} pct={pct}
                  color={c.bar} dotColor={c.dot} />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Pending Approvals + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pending Approvals Widget */}
        <div className="lg:col-span-2 rounded-xl border border-orange-800/40 bg-orange-950/10 p-4 sm:p-5 shadow-none flex flex-col">
          <SectionHeader
            title={t('dashboard.balanceSheetOverview')}
            subtitle={t('dashboard.assetsVsLiabilitiesVsEquity')}
            action={
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                stats.isEquationBalanced
                  ? 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50'
                  : 'text-red-400 bg-red-950/50 border-red-900/50'
              }`}>
                {stats.isEquationBalanced ? `✓ ${t('dashboard.balanced')}` : `✗ ${t('dashboard.check')}`}
              </span>
            }
          />
          <div className="h-48 sm:h-56">
            <MemoizedBarChart data={balSheetData} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader title={t('dashboard.quickActions')} subtitle={t('dashboard.commonERPOperations')} />
          <div className="space-y-2">
            <QuickAction icon={FileText} label={t('dashboard.journalEntry')}
              color="bg-amber-950/60 border border-amber-800/40 text-amber-400"
              onClick={() => startTransition(() => navigate('/journals'))} />
            <QuickAction icon={Layers} label={t('dashboard.chartOfAccounts')}
              color="bg-blue-950/60 border border-blue-800/40 text-blue-400"
              onClick={() => startTransition(() => navigate('/coa'))} />
            <QuickAction icon={BookOpen} label={t('dashboard.viewLedger')}
              color="bg-violet-950/60 border border-violet-800/40 text-violet-400"
              onClick={() => startTransition(() => navigate('/ledger'))} />
            <QuickAction icon={BarChart3} label={t('dashboard.financialReports')}
              color="bg-emerald-950/60 border border-emerald-800/40 text-emerald-400"
              onClick={() => startTransition(() => navigate('/reports'))} />
            <QuickAction icon={Users} label={t('dashboard.usersAndRoles')}
              color="bg-amber-950/60 border border-amber-800/40 text-amber-400"
              onClick={() => startTransition(() => navigate('/users-roles'))} />
            <QuickAction icon={ShieldCheck} label={t('dashboard.auditTrail')}
              color="bg-slate-800/60 border border-slate-700/40 text-slate-400"
              onClick={() => startTransition(() => navigate('/audit'))} />
          </div>

          {/* Account health */}
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">{t('dashboard.accountHealth')}</p>
            {[
              { label: t('dashboard.recordsAreValid'), ok: true },
              { label: t('dashboard.allEntriesBalanced'), ok: true },
              { label: t('dashboard.balanceSheetCorrect'), ok: stats.isEquationBalanced },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between py-1.5">
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? 'text-emerald-400 bg-emerald-950/40' : 'text-red-400 bg-red-950/40'}`}>
                  {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {ok ? t('dashboard.good') : t('dashboard.check')}
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
              <button className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
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
                    <span className="font-mono text-[11px] font-bold text-amber-400">{je.id}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 shrink-0">
                      Posted
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-1.5 break-words">{je.reference}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500">{je.date}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                        <span className="font-mono text-[11px] font-bold text-amber-400">{je.id}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[11px] text-slate-400">{je.date}</span>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[140px]">
                        <span className="text-[11px] text-slate-300 truncate block">{je.reference}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-[11px] font-bold text-emerald-400">
                          PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

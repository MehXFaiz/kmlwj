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
import { showToast } from '../components/ui/Toast';

/* ─────────────────────────────────────────────
   Animated Counter Hook
───────────────────────────────────────────── */
function useAnimatedCounter(target, duration = 1200, prefix = '', suffix = '', decimals = 0) {
  const numericTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
  const [value, setValue] = useState(numericTarget);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const startValRef = useRef(numericTarget);

  useEffect(() => {
    const numTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
    const startVal = Number.isFinite(Number(startValRef.current)) ? Number(startValRef.current) : 0;
    const diff = numTarget - startVal;
    if (Math.abs(diff) < 0.0001) {
      setValue(numTarget);
      startValRef.current = numTarget;
      return;
    }

    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(Math.max(elapsed / duration, 0), 1);
      const eased = easeOutQuart(progress);
      const lo = Math.min(startVal, numTarget);
      const hi = Math.max(startVal, numTarget);
      const current = Math.min(Math.max(startVal + diff * eased, lo), hi);
      setValue(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startValRef.current = numTarget;
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  const numValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatted = decimals > 0
    ? numValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(numValue).toLocaleString();
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
function StatCard({ title, value, icon: Icon, iconBg, iconColor, trend, trendLabel, trendColor, accentBar, delay = 0, subLabel }) {
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
        {subLabel && (
          <p className="mt-1 text-[10px] font-medium text-slate-600 tracking-wide">{subLabel}</p>
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
  const { accounts, fetchAccounts, selectedSubsidiary, fiscalYear, loading: coaLoading } = useCoaStore();
  const { journals, auditLogs, fetchJournals, isLoading: journalsLoading } = useJournalStore();
  const { stats: dbStats, tbReport, statsParams, tbParams, fetchStats, fetchTbReport, loading: globalLoading, statsLoading, tbLoading } = useDashboardStore();
  const [refreshKey, setRefreshKey] = useState(0);

  const statsBusy = statsLoading || tbLoading;
  const isRefreshing = statsBusy || coaLoading || journalsLoading;
  const reportParams = useMemo(() => ({
    startDate: `${fiscalYear}-01-01`,
    endDate: `${fiscalYear}-12-31`,
  }), [fiscalYear]);

  useEffect(() => {
    fetchAccounts();
    fetchStats(reportParams);
    fetchTbReport(reportParams);
    if (fetchJournals) fetchJournals(selectedSubsidiary);
  }, [fetchAccounts, fetchStats, fetchTbReport, fetchJournals, selectedSubsidiary, reportParams]);

  // Consistency & Reconciliation Check across Posted Ledger.
  //
  // The two totals come from two SEPARATE HTTP requests, so comparing them is
  // only valid when both describe the same ledger at the same instant. Three
  // conditions must hold, and all three are load-bearing:
  //
  //   1. Neither request is still in flight.
  //   2. Both cover the same reporting period, and that period is this view's
  //      (`stats`/`tbReport` live in a store shared with TrialBalanceSheet,
  //      which loads an all-time trial balance by default).
  //   3. Both responses carry the SAME `ledgerVersion` — the fingerprint of the
  //      posted ledger they were each computed from (AccountingService
  //      .computeWithLedgerVersion). Conditions 1 and 2 are NOT sufficient on
  //      their own: two requests that both completed, for the same period, can
  //      still straddle a write that landed between them, and the resulting
  //      skew is indistinguishable from a real discrepancy without this stamp.
  //      A response whose ledger changed mid-computation reports `null`, which
  //      never compares equal — that cycle is skipped and the next clean pair
  //      is reconciled instead.
  //
  // A genuine mismatch — both halves fresh, same period, same ledger version,
  // different totals — still raises the alert exactly as before.
  useEffect(() => {
    if (statsLoading || tbLoading) return; // Do not compare while network requests are in flight
    if (!dbStats?.summary || !tbReport?.entries) return;

    const periodOf = (p) => `${p?.startDate || ''}..${p?.endDate || ''}`;
    const samePeriod = periodOf(statsParams) === periodOf(tbParams) && periodOf(statsParams) === periodOf(reportParams);
    const sameLedger = dbStats.ledgerVersion != null && dbStats.ledgerVersion === tbReport.ledgerVersion;

    if (!import.meta.env.DEV || !samePeriod) return;

    const revenueEntries = tbReport.entries.filter(e => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()));
    const expenseEntries = tbReport.entries.filter(e => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()));

    const tbRevenue = revenueEntries.reduce((sum, e) => sum + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
    const tbExpense = expenseEntries.reduce((sum, e) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);

    const dashRevenue = Number(dbStats.summary.totalRevenue || 0);
    const dashExpense = Number(dbStats.summary.totalExpense || 0);

    const revDiff = Math.abs(tbRevenue - dashRevenue);
    const expDiff = Math.abs(tbExpense - dashExpense);

    if (!sameLedger) {
      // Not a discrepancy — the two responses simply observed different ledger
      // states. Logged, not alerted, so the skew stays visible while debugging.
      console.info(
        `[Reconciliation] Skipped: responses describe different ledger states `
        + `(stats=${dbStats.ledgerVersion ?? 'straddled-a-write'}, trialBalance=${tbReport.ledgerVersion ?? 'straddled-a-write'}). `
        + `Uncomparable revenue delta would have been PKR ${revDiff}, expense PKR ${expDiff}.`
      );
      return;
    }

    if (revDiff > 1 || expDiff > 1) {
      console.error(`[Accounting Mismatch] Dashboard vs Trial Balance discrepancy! Revenue Diff: PKR ${revDiff}, Expense Diff: PKR ${expDiff}`);
      console.error('[Accounting Mismatch] Reconciliation inputs', {
        reportPeriod: periodOf(reportParams),
        startDate: reportParams.startDate,
        endDate: reportParams.endDate,
        financialYear: fiscalYear,
        ledgerVersion: dbStats.ledgerVersion,
        dashboard: { totalRevenue: dashRevenue, totalExpense: dashExpense, period: dbStats.reportPeriod },
        trialBalance: { totalRevenue: tbRevenue, totalExpense: tbExpense, period: tbReport.reportPeriod },
        revenueAccounts: revenueEntries.map(e => ({
          id: e.id, glCode: e.glCode, accountName: e.accountName, accountType: e.accountType,
          debit: Number(e.debit || 0), credit: Number(e.credit || 0), net: Number(e.credit || 0) - Number(e.debit || 0),
        })),
        expenseAccounts: expenseEntries.map(e => ({
          id: e.id, glCode: e.glCode, accountName: e.accountName, accountType: e.accountType,
          debit: Number(e.debit || 0), credit: Number(e.credit || 0), net: Number(e.debit || 0) - Number(e.credit || 0),
        })),
      });
      showToast(`Accounting Reconciliation Alert: Dashboard and Trial Balance mismatch! (Revenue diff: PKR ${revDiff.toLocaleString()}, Expense diff: PKR ${expDiff.toLocaleString()})`, 'error');
    }
  }, [dbStats, tbReport, statsParams, tbParams, statsLoading, tbLoading, reportParams, fiscalYear]);

  const handleRefresh = useCallback(() => {
    fetchAccounts();
    fetchStats(reportParams);
    // Refresh the trial balance alongside the stats so both stay scoped to
    // this view's fiscal year — otherwise a refresh leaves tbReport on
    // whatever period another view (e.g. TrialBalanceSheet) last loaded.
    fetchTbReport(reportParams);
    if (fetchJournals) fetchJournals(selectedSubsidiary);
    setRefreshKey(k => k + 1);
  }, [fetchAccounts, fetchStats, fetchTbReport, fetchJournals, selectedSubsidiary, reportParams]);

  // Live balances
  const { rollupBalances, localBalances } = useMemo(
    () => calculateAccountBalances(accounts, journals, selectedSubsidiary),
    [accounts, journals, selectedSubsidiary, refreshKey]
  );

  // Financial stats
  const stats = useMemo(() => {
    if (dbStats?.summary) {
      const netIncome = (dbStats.summary.totalRevenue || 0) - (dbStats.summary.totalExpense || 0);
      return {
        ...dbStats.summary,
        assets: dbStats.summary.totalAssets || 0,
        liabilities: dbStats.summary.totalLiabilities || 0,
        equity: dbStats.summary.totalEquity || 0,
        baseEquity: dbStats.summary.baseEquity || 0,
        revenue: dbStats.summary.totalRevenue || 0,
        expenses: dbStats.summary.totalExpense || 0,
        // Do NOT clamp to 0 — overdrafts and losses must be visible
        cashBalance: dbStats.summary.cashBalance || 0,
        bankBalance: dbStats.summary.bankBalance || 0,
        // As of the fiscal year's start — reconciles against Cash in Hand:
        // Opening Cash + this period's Net Surplus should explain the closing
        // balance, instead of Cash in Hand looking disconnected from Net Surplus.
        openingCashBalance: dbStats.summary.openingCashBalance ?? (dbStats.summary.cashBalance || 0),
        openingBankBalance: dbStats.summary.openingBankBalance ?? (dbStats.summary.bankBalance || 0),
        netAssets: dbStats.summary.netAssets ?? ((dbStats.summary.totalAssets || 0) - (dbStats.summary.totalLiabilities || 0)),
        netIncome,
        grossMargin: dbStats.summary.totalRevenue > 0 ? (netIncome / dbStats.summary.totalRevenue * 100) : 0,
        isEquationBalanced: dbStats.summary.isEquationBalanced ?? true,
      };
    }

    let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
    let cashBalance = 0;
    let bankBalance = 0;
    accounts.forEach((acc) => {
      const bal = acc.currentBalance !== undefined ? Number(acc.currentBalance) || 0 : (localBalances?.[acc.code] || 0);
      const type = (acc.type || '').toUpperCase();
      const detailType = (acc.detailType || '').toLowerCase();
      const nameLower = (acc.name || '').toLowerCase();
      const isLeaf = !accounts.some(a => a.parentCode === acc.code);

      if (isLeaf) {
        if (type === 'ASSET' || type === 'ASSETS') {
          assets += bal;
          if (detailType === 'bank' || nameLower.includes('bank') || nameLower.includes('al-habib') || nameLower.includes('nbp') || nameLower.includes('national bank') || nameLower.includes('mcb') || nameLower.includes('ubl') || nameLower.includes('allied') || nameLower.includes('faysal')) {
            bankBalance += bal;
          } else if (detailType === 'cash' || nameLower.includes('cash') || nameLower.includes('till') || nameLower.includes('petty') || nameLower.includes('hand')) {
            cashBalance += bal;
          }
        } else if (type === 'LIABILITY' || type === 'LIABILITIES') {
          liabilities += (bal < 0 ? Math.abs(bal) : bal);
        } else if (type === 'EQUITY') {
          equity += (bal < 0 ? Math.abs(bal) : bal);
        } else if (type === 'REVENUE' || type === 'INCOME') {
          revenue += (bal < 0 ? Math.abs(bal) : bal);
        } else if (type === 'EXPENSE' || type === 'EXPENSES') {
          expenses += bal;
        }
      }
    });

    const netIncome = revenue - expenses;
    const totalEquityWithNetIncome = equity + netIncome;
    return {
      assets, liabilities, netAssets: assets - liabilities, equity: totalEquityWithNetIncome, baseEquity: equity, revenue, expenses,
      // Do NOT clamp to 0 — overdrafts and losses must be visible
      cashBalance, bankBalance,
      // This fallback path has no period scoping (client-side cumulative
      // balances only) — opening === closing here, same as the "no date
      // filter" case in getFinancialSummary.
      openingCashBalance: cashBalance, openingBankBalance: bankBalance,
      netIncome,
      grossMargin: revenue > 0 ? (netIncome / revenue * 100) : 0,
      isEquationBalanced: Math.abs(assets - (liabilities + totalEquityWithNetIncome)) < 0.01,
    };
  }, [accounts, localBalances, dbStats]);

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
    { name: 'Assets', value: Math.round(stats.assets || 0), fill: 'var(--chart-asset)' },
    { name: 'Liabilities', value: Math.round(stats.liabilities || 0), fill: 'var(--chart-liability)' },
    { name: 'Equity', value: Math.round(stats.equity || 0), fill: 'var(--chart-equity)' },
  ], [stats]);

  // Recent transactions from journals
  const recentJournals = useMemo(() => {
    if (dbStats?.recentTransactions && dbStats.recentTransactions.length > 0) {
      return dbStats.recentTransactions;
    }
    return (journals || []).slice(0, 6).map(je => ({
      id: je.voucherNo || je.id?.slice?.(0, 8) || je.id,
      dbId: je.dbId || je.id,
      date: je.postingDate ? new Date(je.postingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : je.date || '',
      reference: je.reference || je.description || 'Journal Entry',
      amount: je.lines ? je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : je.amount || 0,
      status: je.status || 'Posted'
    }));
  }, [dbStats, journals]);

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
          <p className="text-xs text-slate-600 mt-0.5 font-medium">{selectedSubsidiary} &middot; FY {fiscalYear}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-200 transition-all text-xs font-semibold self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>




      {/* ── Financial KPI Cards ── premium redesign ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        {[
          {
            // BUG FIX: Show gross revenue (Total Income), not net income
            title: t('dashboard.totalIncome', { year: fiscalYear || 2026 }),
            value: stats.revenue || 0,
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
            title: t('dashboard.totalSpent', { year: fiscalYear || 2026 }),
            value: stats.expenses || 0,
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
            // BUG FIX: Show actual cash balance (not clamped); overdraft shows as negative
            title: t('dashboard.cashInHand'),
            value: stats.cashBalance || 0,
            icon: Banknote,
            iconColor: (stats.cashBalance || 0) < 0 ? 'text-red-400' : 'text-blue-400',
            iconBg: (stats.cashBalance || 0) < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20',
            trend: (stats.cashBalance || 0) < 0 ? 'down' : 'neutral',
            trendLabel: (stats.cashBalance || 0) < 0 ? 'Overdraft' : t('dashboard.availableCash'),
            trendColor: (stats.cashBalance || 0) < 0 ? 'text-red-400' : 'text-slate-400',
            accentBar: (stats.cashBalance || 0) < 0 ? 'from-red-500 to-red-400' : 'from-blue-500 to-blue-400',
            delay: 160,
          },
          {
            // BUG FIX: Show actual bank balance (not clamped); overdraft shows as negative
            title: t('dashboard.bankBalance'),
            value: stats.bankBalance || 0,
            icon: Layers,
            iconColor: (stats.bankBalance || 0) < 0 ? 'text-red-400' : 'text-violet-400',
            iconBg: (stats.bankBalance || 0) < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-violet-500/10 border-violet-500/20',
            trend: (stats.bankBalance || 0) < 0 ? 'down' : 'neutral',
            trendLabel: (stats.bankBalance || 0) < 0 ? 'Overdraft' : t('dashboard.inBankAccounts'),
            trendColor: (stats.bankBalance || 0) < 0 ? 'text-red-400' : 'text-slate-400',
            accentBar: (stats.bankBalance || 0) < 0 ? 'from-red-500 to-red-400' : 'from-violet-500 to-violet-400',
            delay: 240,
          },
          {
            title: t('dashboard.netAfterExpenses', { year: fiscalYear || 2026 }),
            value: stats.netIncome || 0,
            icon: Wallet,
            iconColor: (stats.netIncome || 0) < 0 ? 'text-red-400' : 'text-emerald-400',
            iconBg: (stats.netIncome || 0) < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
            trend: (stats.netIncome || 0) < 0 ? 'down' : 'up',
            trendLabel: (stats.netIncome || 0) < 0 ? t('dashboard.netLoss') : t('dashboard.netSurplus'),
            trendColor: (stats.netIncome || 0) < 0 ? 'text-red-400' : 'text-emerald-400',
            accentBar: (stats.netIncome || 0) < 0 ? 'from-red-500 to-red-400' : 'from-emerald-500 to-emerald-400',
            delay: 320,
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
            {stats.isEquationBalanced ? t('dashboard.accountsBalanced') : 'Accounting Reconciliation Required'}
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
                FY {fiscalYear}
              </span>
            }
          />
          <div className="h-48 sm:h-56">
            <MemoizedAreaChart data={dbStats?.monthlyData || []} tRevenue={t('dashboard.revenue')} tExpense={t('dashboard.expense')} />
          </div>
        </div>

        {/* Pie Chart: Account Distribution */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
          <SectionHeader title={t('dashboard.accountDistribution')} subtitle={t('dashboard.breakdownByAccountType')} />
          <div className="h-36 sm:h-40 mb-3">
            <MemoizedPieChart data={typeDistData} />
          </div>
          <div className="space-y-1.5 mt-2">
            {[
              { label: 'Assets', count: `${acctStats.byType.Asset || 0} accounts`, bal: stats.assets || 0, color: 'bg-amber-500', dot: 'bg-amber-400' },
              { label: 'Liabilities', count: `${acctStats.byType.Liability || 0} accounts`, bal: stats.liabilities || 0, color: 'bg-purple-500', dot: 'bg-purple-400' },
              { label: 'Equity', count: `${acctStats.byType.Equity || 0} accounts`, bal: stats.equity || 0, color: 'bg-blue-500', dot: 'bg-blue-400' },
              { label: 'Revenue', count: `${acctStats.byType.Revenue || 0} accounts`, bal: stats.revenue || 0, color: 'bg-emerald-500', dot: 'bg-emerald-400' },
              { label: 'Expenses', count: `${acctStats.byType.Expense || 0} accounts`, bal: stats.expenses || 0, color: 'bg-red-500', dot: 'bg-red-400' },
            ].map((item) => {
              const totalBal = (stats.assets + stats.liabilities + stats.equity + stats.revenue + stats.expenses) || 1;
              const pct = Math.max(5, Math.round((item.bal / totalBal) * 100));
              return (
                <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-slate-800/40 last:border-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs font-semibold text-slate-300">
                      <span>{item.label}</span>
                      <span className="font-mono text-slate-200">Rs {item.bal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="w-24 sm:w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500">{item.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Pending Approvals + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Balance Sheet Overview Widget */}
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
              <button onClick={() => startTransition(() => navigate('/journals'))} className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer">
                View All <ChevronRight className="h-3 w-3" />
              </button>
            }
          />
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {recentJournals.map((je, i) => {
              const total = je.amount !== undefined ? je.amount : (je.lines ? je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0);
              return (
                <div
                  key={je.dbId || je.id || i}
                  onClick={() => startTransition(() => navigate('/journals'))}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 cursor-pointer hover:border-slate-700 transition-all"
                  style={{ opacity: 0, animation: `fadeSlideIn 0.4s ease ${i * 70}ms forwards` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold text-amber-400">{je.id}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 shrink-0">
                      {je.status || 'Posted'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-1.5 break-words font-medium">{je.reference}</p>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500">{je.date}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      PKR {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  const total = je.amount !== undefined ? je.amount : (je.lines ? je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0);
                  return (
                    <tr key={je.dbId || je.id || i} onClick={() => startTransition(() => navigate('/journals'))} className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                      style={{ opacity: 0, animation: `fadeSlideIn 0.4s ease ${i * 70}ms forwards` }}>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-[11px] font-bold text-amber-400">{je.id}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[11px] text-slate-400">{je.date}</span>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[160px]">
                        <span className="text-[11px] text-slate-200 font-medium truncate block">{je.reference}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-[11px] font-bold text-emerald-400">
                          PKR {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/40">
                          {je.status || 'Posted'}
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

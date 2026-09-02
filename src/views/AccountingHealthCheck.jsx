import { useEffect, useState, useCallback, useMemo } from 'react';
import { aiAccountingService } from '../services/apiServices';
import { useAuthStore } from '../store/authStore';
import { useConfirm } from '../components/ui/ConfirmationModal';
import { showToast } from '../components/ui/Toast';
import { Badge } from '../components/ui/Badge';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AiRepairPreviewModal } from '../components/common/AiRepairPreviewModal';
import { AiRepairHistoryModal } from '../components/common/AiRepairHistoryModal';
import { ResetErpDataModal } from '../components/admin/ResetErpDataModal';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Info, RefreshCw, CheckCircle2, XCircle,
  Sparkles, Wrench, History, Lock, Loader2, RotateCcw,
} from 'lucide-react';

const severityStyles = {
  critical: { bg: 'bg-red-950/20', border: 'border-red-900/50', text: 'text-red-400', icon: <XCircle className="h-3.5 w-3.5" /> },
  warning: { bg: 'bg-amber-950/20', border: 'border-amber-900/50', text: 'text-amber-400', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  info: { bg: 'bg-blue-950/20', border: 'border-blue-900/50', text: 'text-blue-400', icon: <Info className="h-3.5 w-3.5" /> },
};

const statusVariant = {
  OPEN: 'default',
  ANALYZED: 'info',
  PENDING_APPROVAL: 'warning',
  REJECTED: 'danger',
  RESOLVED: 'success',
  REPAIR_FAILED: 'danger',
};

const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtConfidence = (v) => (v === null || v === undefined ? '—' : `${Math.round(Number(v) * 100)}%`);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">{title}</h3>
    {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
  </div>
);

export const AccountingHealthCheck = () => {
  const user = useAuthStore((state) => state.user);
  const isAdminOrSuperAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
  const isSuperAdmin = user?.role === 'Super Admin' || user?.role === 'SUPER ADMIN';
  const confirm = useConfirm();

  const [issues, setIssues] = useState([]);
  const [meta, setMeta] = useState({ totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0, timestamp: null });
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoRepairing, setAutoRepairing] = useState(false);
  const [error, setError] = useState(null);
  const [previewIssue, setPreviewIssue] = useState(null);
  const [applyingRepair, setApplyingRepair] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const summarize = useCallback((list) => {
    setMeta({
      totalIssues: list.length,
      criticalCount: list.filter((i) => i.severity === 'critical').length,
      warningCount: list.filter((i) => i.severity === 'warning').length,
      infoCount: list.filter((i) => i.severity === 'info').length,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiAccountingService.getIssues({ limit: '500' });
      const list = res?.data || [];
      setIssues(list);
      summarize(list);
    } catch (err) {
      console.error('Failed to load AI accounting issues:', err);
      setError(err?.response?.data?.error?.message || 'Failed to load accounting issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [summarize]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const runFullAudit = useCallback(async () => {
    setAuditing(true);
    setError(null);
    try {
      const res = await aiAccountingService.runAudit();
      const list = res?.data?.issues || [];
      setIssues(list);
      setMeta({
        totalIssues: res?.data?.totalIssues ?? list.length,
        criticalCount: res?.data?.criticalCount ?? 0,
        warningCount: res?.data?.warningCount ?? 0,
        infoCount: res?.data?.infoCount ?? 0,
        timestamp: res?.data?.timestamp,
      });
      showToast(`Full audit complete — ${res?.data?.newCount ?? 0} new, ${res?.data?.resolvedCount ?? 0} resolved.`, 'success');
    } catch (err) {
      console.error('Failed to run full audit:', err);
      setError(err?.response?.data?.error?.message || 'Failed to run full audit. Please try again.');
    } finally {
      setAuditing(false);
    }
  }, []);

  const analyzeIssues = useCallback(async () => {
    if (!isAdminOrSuperAdmin) {
      showToast('Forbidden: AI Analyze requires an Admin-tier role', 'error');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await aiAccountingService.analyze();
      if (res?.data?.configured === false) {
        showToast('AI provider not configured — add OPENROUTER_API_KEY to enable AI Analyze.', 'warning');
      } else {
        showToast(`AI analyzed ${res?.data?.analyzed?.length ?? 0} of ${res?.data?.totalCandidates ?? 0} issue(s).`, 'success');
      }
      await fetchIssues();
    } catch (err) {
      console.error('Failed to run AI analysis:', err);
      setError(err?.response?.data?.error?.message || 'Failed to run AI analysis. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [isAdminOrSuperAdmin, fetchIssues]);

  const runSafeAutoRepair = useCallback(async () => {
    if (!isAdminOrSuperAdmin) {
      showToast('Forbidden: Safe Auto-Repair requires an Admin-tier role', 'error');
      return;
    }
    await confirm({
      title: 'Run Safe Auto-Repair?',
      description: 'This applies only LOW-risk, pre-vetted repair operations (balance/summary rebuilds and GL relinking). Nothing that touches transaction amounts, debit/credit values, or opening balances will ever run automatically.',
      confirmLabel: 'Run Safe Auto-Repair',
      loadingLabel: 'Applying safe repairs...',
      successMessage: 'Safe auto-repair completed.',
      action: async () => {
        setAutoRepairing(true);
        try {
          const res = await aiAccountingService.autoRepair();
          showToast(`Applied ${res?.data?.applied?.length ?? 0} of ${res?.data?.eligibleCount ?? 0} eligible repair(s).`, 'success');
          await fetchIssues();
        } finally {
          setAutoRepairing(false);
        }
      },
    });
  }, [isAdminOrSuperAdmin, confirm, fetchIssues]);

  const handleApprove = useCallback(async (issue) => {
    setApplyingRepair(true);
    try {
      const res = await aiAccountingService.applyRepair(issue.id, 'approve');
      if (res?.status === 200) {
        showToast(res?.message || 'Repair applied successfully.', 'success');
      } else {
        showToast(res?.message || 'Repair failed and was rolled back.', 'error');
      }
      setPreviewIssue(null);
      await fetchIssues();
    } catch (err) {
      console.error('Failed to apply repair:', err);
      showToast(err?.response?.data?.error?.message || 'Failed to apply repair.', 'error');
    } finally {
      setApplyingRepair(false);
    }
  }, [fetchIssues]);

  const handleReject = useCallback(async (issue) => {
    setApplyingRepair(true);
    try {
      await aiAccountingService.applyRepair(issue.id, 'reject');
      showToast('Issue rejected — no data was changed.', 'success');
      setPreviewIssue(null);
      await fetchIssues();
    } catch (err) {
      console.error('Failed to reject issue:', err);
      showToast(err?.response?.data?.error?.message || 'Failed to reject issue.', 'error');
    } finally {
      setApplyingRepair(false);
    }
  }, [fetchIssues]);

  const busy = auditing || analyzing || autoRepairing;

  const healthLabel = useMemo(() => {
    if (meta.totalIssues === 0) return 'Healthy';
    if (meta.criticalCount > 0) return 'Critical';
    return 'Needs Attention';
  }, [meta]);

  return (
    <DashboardLayout breadcrumbs={['Accounting', 'AI Accounting Health & Auto-Repair']}>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-slate-800/40 border border-slate-700/50 px-2.5 py-0.5 rounded-full">
                Admin Dashboard
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-50 tracking-tight">AI Accounting Health &amp; Auto-Repair</h2>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Deterministic reconciliation, AI-assisted diagnosis, and Admin-gated repair — the ledger is always the source of truth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={runFullAudit}
              disabled={busy}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${auditing ? 'animate-spin' : ''}`} />
              {auditing ? 'Running Audit...' : 'Run Full Audit'}
            </button>

            <button
              onClick={analyzeIssues}
              disabled={busy || !isAdminOrSuperAdmin}
              title={isAdminOrSuperAdmin ? 'Send open issues to the AI auditor for root-cause analysis' : 'Admin only'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                isAdminOrSuperAdmin ? 'border-violet-800/60 bg-violet-950/40 hover:bg-violet-900/40 text-violet-300 cursor-pointer' : 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
              }`}
            >
              {isAdminOrSuperAdmin ? <Sparkles className={`h-3.5 w-3.5 ${analyzing ? 'animate-pulse' : ''}`} /> : <Lock className="h-3.5 w-3.5" />}
              {analyzing ? 'Analyzing...' : 'AI Analyze Issues'}
            </button>

            <button
              onClick={runSafeAutoRepair}
              disabled={busy || !isAdminOrSuperAdmin}
              title={isAdminOrSuperAdmin ? 'Apply only LOW-risk, pre-vetted repair operations' : 'Admin only'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                isAdminOrSuperAdmin ? 'border-emerald-800/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 cursor-pointer' : 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
              }`}
            >
              {isAdminOrSuperAdmin ? <Wrench className={`h-3.5 w-3.5 ${autoRepairing ? 'animate-spin' : ''}`} /> : <Lock className="h-3.5 w-3.5" />}
              {autoRepairing ? 'Repairing...' : 'Safe Auto-Repair'}
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold cursor-pointer"
            >
              <History className="h-3.5 w-3.5" />
              Repair History
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setResetModalOpen(true)}
                disabled={busy}
                title="Delete transactional records and reset accounting calculations (Super Admin only)"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 hover:text-rose-100 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset ERP Data
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border bg-red-950 border-red-800/50">
              <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-300">Error</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading accounting issues...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total Issues', value: meta.totalIssues, icon: <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />, chip: 'bg-slate-800/60 border-slate-700/50', bar: 'from-slate-500 to-slate-400' },
                { label: 'Critical', value: meta.criticalCount, icon: <XCircle className="h-3.5 w-3.5 text-red-400" />, chip: 'bg-red-500/10 border-red-500/20', bar: 'from-red-500 to-red-400' },
                { label: 'Warnings', value: meta.warningCount, icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />, chip: 'bg-amber-500/10 border-amber-500/20', bar: 'from-amber-500 to-amber-400' },
                { label: 'Status', value: healthLabel, icon: meta.totalIssues === 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />, chip: 'bg-emerald-500/10 border-emerald-500/20', bar: 'from-emerald-500 to-emerald-400' },
              ].map((card) => (
                <div key={card.label} className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-800/60 transition-all duration-300 overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-gradient-to-b ${card.bar} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative px-5 pt-4 pb-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${card.chip} group-hover:scale-110 transition-transform duration-200`}>
                        {card.icon}
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 ${
              meta.totalIssues === 0 ? 'border-slate-800/60 bg-slate-900/40' : meta.criticalCount > 0 ? 'border-red-900/50 bg-red-950/20' : 'border-amber-900/50 bg-amber-950/20'
            }`}>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
                meta.totalIssues === 0 ? 'bg-slate-800/50 border-slate-700/50' : meta.criticalCount > 0 ? 'bg-red-950 border-red-800/50 animate-pulse' : 'bg-amber-950 border-amber-800/50'
              }`}>
                {meta.totalIssues === 0 ? <ShieldCheck className="h-4.5 w-4.5 text-slate-400" /> : meta.criticalCount > 0 ? <ShieldAlert className="h-4.5 w-4.5 text-red-400" /> : <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${meta.totalIssues === 0 ? 'text-slate-200' : meta.criticalCount > 0 ? 'text-red-300' : 'text-amber-300'}`}>
                  {meta.totalIssues === 0 ? 'All accounting checks passed' : meta.criticalCount > 0 ? 'Critical issues detected — review immediately' : 'Warnings detected — review and resolve'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {meta.timestamp ? `Last checked: ${new Date(meta.timestamp).toLocaleString()}` : 'Not yet audited this session'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
              <SectionHeader title="Issues Found" subtitle={`${issues.length} issue(s) currently open`} />
              {issues.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300 mb-1">Your accounting system is healthy</p>
                  <p className="text-xs text-slate-500">No issues detected. Click "Run Full Audit" to check again.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const style = severityStyles[issue.severity] || severityStyles.info;
                    return (
                      <button
                        type="button"
                        key={issue.id}
                        onClick={() => setPreviewIssue(issue)}
                        className={`w-full text-left rounded-lg border ${style.border} ${style.bg} p-4 transition-all hover:border-opacity-70 cursor-pointer`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.text} ${style.bg} border ${style.border}`}>
                            {style.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <Badge variant="default">{issue.type}</Badge>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.text} ${style.bg} border ${style.border} uppercase`}>{issue.severity}</span>
                              <Badge variant={statusVariant[issue.status] || 'default'}>{issue.status}</Badge>
                              {issue.aiConfidence !== null && issue.aiConfidence !== undefined && (
                                <span className="text-[10px] text-violet-300 bg-violet-950/40 border border-violet-800/40 px-2 py-0.5 rounded-full font-mono">
                                  {fmtConfidence(issue.aiConfidence)} confidence
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-slate-200 mb-1">{issue.description}</p>
                            {issue.aiRootCause && (
                              <p className="text-[11px] text-slate-400 mb-1">
                                <span className="font-bold text-slate-500 uppercase tracking-wide">Root cause: </span>{issue.aiRootCause}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {issue.currentValue !== null && issue.currentValue !== undefined && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">Current: {fmt(issue.currentValue)}</span>
                              )}
                              {issue.expectedValue !== null && issue.expectedValue !== undefined && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">Expected: {fmt(issue.expectedValue)}</span>
                              )}
                              {issue.difference !== null && issue.difference !== undefined && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">Difference: {fmt(issue.difference)}</span>
                              )}
                              {issue.entityRef && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">Ref: {issue.entityRef}</span>
                              )}
                            </div>
                            {issue.aiProposedRepairType ? (
                              <p className="text-[11px] text-emerald-400 mt-2 font-semibold">
                                Recommended fix: {issue.aiProposedChange?.description || issue.aiProposedRepairType} — click to preview
                              </p>
                            ) : issue.aiAnalyzedAt ? (
                              <p className="text-[11px] text-slate-500 mt-2">Unable to safely auto-repair. Admin review required.</p>
                            ) : (
                              <p className="text-[11px] text-slate-600 mt-2">Not analyzed yet — click "AI Analyze Issues"</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <AiRepairPreviewModal
          issue={previewIssue}
          onClose={() => setPreviewIssue(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isBusy={applyingRepair}
        />
        <AiRepairHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
        <ResetErpDataModal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          onSuccess={() => {
            runFullAudit();
            fetchIssues();
          }}
        />
      </div>
    </DashboardLayout>
  );
};

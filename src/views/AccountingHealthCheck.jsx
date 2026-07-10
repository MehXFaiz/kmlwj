
import { useEffect, useState, useCallback } from 'react';
import { accountingHealthService } from '../services/apiServices';
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const severityStyles = {
  critical: {
    bg: 'bg-red-950/20',
    border: 'border-red-900/50',
    text: 'text-red-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: 'bg-amber-950/20',
    border: 'border-amber-900/50',
    text: 'text-amber-400',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  info: {
    bg: 'bg-blue-950/20',
    border: 'border-blue-900/50',
    text: 'text-blue-400',
    icon: <Info className="h-3.5 w-3.5" />,
  },
};

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4 gap-3">
    <div className="min-w-0 flex-1">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.14em]">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const AccountingHealthCheck = () => {
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountingHealthService.getCheck();
      setCheckResult(result);
    } catch (err) {
      console.error('Failed to run accounting health check:', err);
      setError('Failed to load accounting health check. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-slate-800/40 border border-slate-700/50 px-2.5 py-0.5 rounded-full">
              Admin Dashboard
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-50 tracking-tight">Accounting Health Check</h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">Comprehensive integrity verification for your accounting system</p>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-200 transition-all text-xs font-semibold self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running Check...' : 'Run Check'}
        </button>
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

      {!loading && checkResult && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-800/60 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-gradient-to-b from-slate-500 to-slate-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative px-5 pt-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Total Issues</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center border bg-slate-800/60 border-slate-700/50 group-hover:scale-110 transition-transform duration-200">
                    <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">
                  {checkResult.totalIssues}
                </p>
              </div>
            </div>

            <div className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-800/60 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-gradient-to-b from-red-500 to-red-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative px-5 pt-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Critical</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center border bg-red-500/10 border-red-500/20 group-hover:scale-110 transition-transform duration-200">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">
                  {checkResult.criticalCount}
                </p>
              </div>
            </div>

            <div className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-800/60 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-gradient-to-b from-amber-500 to-amber-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative px-5 pt-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Warnings</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center border bg-amber-500/10 border-amber-500/20 group-hover:scale-110 transition-transform duration-200">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">
                  {checkResult.warningCount}
                </p>
              </div>
            </div>

            <div className="relative group rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm hover:border-slate-700/80 hover:bg-slate-800/60 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[2px] rounded-r-full bg-gradient-to-b from-emerald-500 to-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative px-5 pt-4 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/20 group-hover:scale-110 transition-transform duration-200">
                    {checkResult.totalIssues === 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100 leading-none tracking-tight tabular-nums">
                  {checkResult.totalIssues === 0 ? 'Healthy' : 'Needs Attention'}
                </p>
              </div>
            </div>
          </div>

          {/* Health Status Banner */}
          <div className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 ${
            checkResult.totalIssues === 0
              ? 'border-slate-800/60 bg-slate-900/40'
              : checkResult.criticalCount > 0
              ? 'border-red-900/50 bg-red-950/20'
              : 'border-amber-900/50 bg-amber-950/20'
          }`}>
            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
              checkResult.totalIssues === 0
                ? 'bg-slate-800/50 border-slate-700/50'
                : checkResult.criticalCount > 0
                ? 'bg-red-950 border-red-800/50 animate-pulse'
                : 'bg-amber-950 border-amber-800/50'
            }`}>
              {checkResult.totalIssues === 0 ? (
                <ShieldCheck className="h-4.5 w-4.5 text-slate-400" />
              ) : checkResult.criticalCount > 0 ? (
                <ShieldAlert className="h-4.5 w-4.5 text-red-400" />
              ) : (
                <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${
                checkResult.totalIssues === 0
                  ? 'text-slate-200'
                  : checkResult.criticalCount > 0
                  ? 'text-red-300'
                  : 'text-amber-300'
              }`}>
                {checkResult.totalIssues === 0
                  ? 'All accounting checks passed'
                  : checkResult.criticalCount > 0
                  ? 'Critical issues detected — please resolve immediately'
                  : 'Warnings detected — review and resolve'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Last checked: {new Date(checkResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Issues List */}
          <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 shadow-none">
            <SectionHeader
              title="Issues Found"
              subtitle={`${checkResult.issues.length} issues identified in your accounting system`}
            />
            {checkResult.issues.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-300 mb-1">Your accounting system is healthy</p>
                <p className="text-xs text-slate-500">No issues detected. Keep up the good work!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {checkResult.issues.map((issue, index) => {
                  const style = severityStyles[issue.severity];
                  return (
                    <div
                      key={index}
                      className={`rounded-lg border ${style.border} ${style.bg} p-4 transition-all hover:border-opacity-70`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.text} ${style.bg} border ${style.border}`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {issue.type}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.text} ${style.bg} border ${style.border}`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-200 mb-1">
                            {issue.description}
                          </p>
                          {issue.item && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {issue.item.glCode && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">
                                  GL Code: {issue.item.glCode}
                                </span>
                              )}
                              {issue.item.name && (
                                <span className="text-[10px] text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">
                                  Name: {issue.item.name}
                                </span>
                              )}
                              {issue.item.reference && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">
                                  Reference: {issue.item.reference}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

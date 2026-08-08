import { Fragment, useEffect, useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { aiAccountingService } from '../../services/apiServices';
import { Loader2, ChevronDown, ChevronUp, History } from 'lucide-react';

const riskVariant = { LOW: 'success', MEDIUM: 'warning', HIGH: 'orange', CRITICAL: 'danger' };
const rollbackVariant = { NOT_NEEDED: 'success', ROLLED_BACK: 'danger', ROLLBACK_FAILED: 'danger' };

/** Repair History — spec section 7's immutable audit log, rendered read-only. */
export const AiRepairHistoryModal = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiAccountingService.getHistory({ limit: 100 });
      setLogs(res?.data || []);
    } catch (err) {
      console.error('Failed to load repair history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Repair History" size="2xl">
      <div className="space-y-3">
        {loading && logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading repair history...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <History className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            No repairs have been applied yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date/Time</th>
                  <th className="py-2.5 px-3">Admin/User</th>
                  <th className="py-2.5 px-3">Issue Type</th>
                  <th className="py-2.5 px-3">Repair Type</th>
                  <th className="py-2.5 px-3">Risk</th>
                  <th className="py-2.5 px-3">Approval</th>
                  <th className="py-2.5 px-3">Success</th>
                  <th className="py-2.5 px-3">Rollback</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-800/40">
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-amber-300 font-semibold whitespace-nowrap">{log.user?.fullName || 'System'}</td>
                      <td className="py-2.5 px-3 text-slate-300">{log.issueType}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">{log.repairType}</td>
                      <td className="py-2.5 px-3"><Badge variant={riskVariant[log.riskLevel] || 'default'}>{log.riskLevel}</Badge></td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{log.approvalStatus}</td>
                      <td className="py-2.5 px-3"><Badge variant={log.success ? 'success' : 'danger'}>{log.success ? 'Success' : 'Failed'}</Badge></td>
                      <td className="py-2.5 px-3"><Badge variant={rollbackVariant[log.rollbackStatus] || 'default'}>{log.rollbackStatus}</Badge></td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="p-1 text-slate-400 hover:text-brand-300 cursor-pointer"
                          title="Show detail"
                        >
                          {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={9} className="bg-slate-950/60 px-4 py-3.5">
                          <div className="space-y-1.5 mb-3">
                            <p className="text-[11px]"><span className="text-slate-500">Root Cause: </span><span className="text-slate-300">{log.rootCause || '—'}</span></p>
                            {log.errorMessage && (
                              <p className="text-[11px]"><span className="text-slate-500">Note: </span><span className="text-slate-300">{log.errorMessage}</span></p>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Old Value / New Value</p>
                              <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 overflow-x-auto max-h-40">
{JSON.stringify({ old: log.oldValue, new: log.newValue, affectedRecords: log.affectedRecords }, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Before / After Validation</p>
                              <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 overflow-x-auto max-h-40">
{JSON.stringify({ before: log.beforeCheckResult, after: log.afterCheckResult }, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};

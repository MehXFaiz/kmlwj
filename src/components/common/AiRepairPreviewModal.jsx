import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Loader2 } from 'lucide-react';

const severityVariant = { critical: 'danger', warning: 'warning', info: 'info' };
const riskVariant = { LOW: 'success', MEDIUM: 'warning', HIGH: 'orange', CRITICAL: 'danger' };

const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const Label = ({ children }) => (
  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</span>
);

const Field = ({ label, value }) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    <p className="text-sm text-slate-200 leading-relaxed">{value}</p>
  </div>
);

const Stat = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-center">
    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1">{label}</p>
    <p className={`text-sm font-mono font-bold tabular-nums ${tone}`}>{value}</p>
  </div>
);

/**
 * Spec section 5: Issue / Root Cause / Current / Expected / Difference /
 * Affected Records / Proposed Change / Risk Level / AI Confidence, with
 * Cancel / Approve & Apply. A repair-ineligible issue still opens this modal
 * (so an Admin can inspect it), but Approve & Apply just acknowledges it —
 * the backend never invents a mutation the registry doesn't already vet.
 */
export const AiRepairPreviewModal = ({ issue, onClose, onApprove, onReject, isBusy }) => {
  if (!issue) return null;

  const hasProposal = Boolean(issue.aiProposedRepairType);
  const affected = Array.isArray(issue.affectedRecords) ? issue.affectedRecords : [];

  return (
    <Modal isOpen={Boolean(issue)} onClose={onClose} title="AI Repair Preview" size="lg">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Issue</Label>
          <p className="text-sm font-semibold text-slate-100 leading-relaxed">{issue.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default">{issue.type}</Badge>
            <Badge variant={severityVariant[issue.severity] || 'default'}>{issue.severity}</Badge>
            <Badge variant="brand">{issue.status}</Badge>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Root Cause" value={issue.aiRootCause || 'Not analyzed yet — click "AI Analyze Issues" first.'} />
          <Field
            label="AI Confidence"
            value={issue.aiConfidence !== null && issue.aiConfidence !== undefined ? `${Math.round(Number(issue.aiConfidence) * 100)}%` : '—'}
          />
        </div>

        {issue.aiExplanation && <Field label="Explanation" value={issue.aiExplanation} />}

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Current Value" value={fmt(issue.currentValue)} />
          <Stat label="Expected Value" value={fmt(issue.expectedValue)} tone="text-emerald-400" />
          <Stat label="Difference" value={fmt(issue.difference)} tone="text-amber-400" />
        </div>

        {affected.length > 0 && (
          <div className="space-y-1.5">
            <Label>Affected Records ({affected.length})</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {affected.map((r, i) => (
                <div key={i} className="text-[11px] font-mono text-slate-400 bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1.5">
                  {r.model} — {r.ref || r.id}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label>Proposed Change</Label>
          <p className="text-sm text-slate-300 leading-relaxed">
            {hasProposal
              ? issue.aiProposedChange?.description || 'A registered repair operation is available for this issue.'
              : 'No safe automated repair is available. Approving will acknowledge this issue for manual handling elsewhere — no data will be changed.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label>Risk Level</Label>
          <Badge variant={riskVariant[issue.aiRiskLevel] || 'default'}>{issue.aiRiskLevel || 'UNKNOWN'}</Badge>
          {!hasProposal && <span className="text-[11px] text-slate-500">Unable to safely auto-repair. Admin review required.</span>}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onReject(issue)}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-900/40 transition-colors cursor-pointer disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onApprove(issue)}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {hasProposal ? 'Approve & Apply' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

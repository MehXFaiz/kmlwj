import { CheckCircle2 } from 'lucide-react';

/**
 * StatusStepper — visual progress indicator for multi-stage workflows.
 *
 * Props:
 *   steps      — array of { label, description? }
 *   current    — 0-based index of current active step
 *   variant    — 'amber' | 'emerald' | 'rose' (color accent)
 */
export function StatusStepper({ steps = [], current = 0, variant = 'amber' }) {
  const accentColors = {
    amber: {
      done:    'bg-amber-600 border-amber-500 text-white',
      active:  'bg-amber-600/20 border-amber-500 text-amber-300 ring-4 ring-amber-500/20',
      pending: 'bg-slate-800 border-slate-700 text-slate-500',
      line:    'bg-amber-600',
      lineGray:'bg-slate-800',
      label:   'text-amber-300',
    },
    emerald: {
      done:    'bg-emerald-600 border-emerald-500 text-white',
      active:  'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-4 ring-emerald-500/20',
      pending: 'bg-slate-800 border-slate-700 text-slate-500',
      line:    'bg-emerald-600',
      lineGray:'bg-slate-800',
      label:   'text-emerald-300',
    },
    rose: {
      done:    'bg-rose-600 border-rose-500 text-white',
      active:  'bg-rose-600/20 border-rose-500 text-rose-300 ring-4 ring-rose-500/20',
      pending: 'bg-slate-800 border-slate-700 text-slate-500',
      line:    'bg-rose-600',
      lineGray:'bg-slate-800',
      label:   'text-rose-300',
    },
  };

  const c = accentColors[variant] || accentColors.amber;

  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, idx) => {
        const isDone   = idx < current;
        const isActive = idx === current;

        return (
          <div key={idx} className="flex items-center flex-1 min-w-0">
            {/* Step node + label */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 text-xs font-bold ${
                  isDone ? c.done : isActive ? c.active : c.pending
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              {/* Label */}
              <div className="text-center">
                <p
                  className={`text-[11px] font-bold leading-tight whitespace-nowrap ${
                    isDone || isActive ? c.label : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && isActive && (
                  <p className="text-[10px] text-slate-500 mt-0.5 max-w-[90px] leading-tight">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line (not after last step) */}
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mt-[-18px] rounded-full transition-all duration-500 ${
                  idx < current ? c.line : c.lineGray
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

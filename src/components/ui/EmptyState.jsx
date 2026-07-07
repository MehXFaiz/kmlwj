import { Plus } from 'lucide-react';

/**
 * EmptyState — shown when a list/table has no records.
 *
 * Props:
 *   icon       — lucide React component (optional)
 *   emoji      — fallback emoji string, e.g. "📭"
 *   title      — primary message  (required)
 *   description — secondary hint  (optional)
 *   actionLabel — button text     (optional)
 *   onAction   — button handler   (optional)
 *   actionIcon — lucide component to show on button (default: Plus)
 *   compact    — boolean, use smaller padding for inline usage
 */
export function EmptyState({
  icon: Icon,
  emoji = '📭',
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Plus,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-10 px-4' : 'py-16 px-6'
      }`}
    >
      {/* Illustration / icon */}
      <div className="relative mb-6 group">
        <div
          className={`rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-xl relative z-10 ${
            compact
              ? 'w-14 h-14 bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/60'
              : 'w-20 h-20 bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/60'
          }`}
        >
          {Icon ? (
            <Icon
              className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} text-amber-400/90 transition-colors group-hover:text-amber-300`}
            />
          ) : (
            <span className={compact ? 'text-3xl' : 'text-4xl'} role="img">
              {emoji}
            </span>
          )}
        </div>
        {/* Soft glow ring */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-amber-500/15 via-amber-500/5 to-transparent blur-xl z-0 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70" />
      </div>

      {/* Text */}
      <h3
        className={`font-bold text-slate-100 tracking-tight ${compact ? 'text-sm' : 'text-base'} mb-1.5`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`text-slate-400 leading-relaxed max-w-sm ${
            compact ? 'text-xs' : 'text-xs sm:text-sm'
          }`}
        >
          {description}
        </p>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500
            text-slate-950 font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30
            transition-all duration-200 active:scale-95 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
            ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
        >
          <ActionIcon className={compact ? 'h-3.5 w-3.5 stroke-[2.5]' : 'h-4 w-4 stroke-[2.5]'} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

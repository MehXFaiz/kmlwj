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
      <div className="relative mb-5">
        <div
          className={`rounded-2xl flex items-center justify-center ${
            compact
              ? 'w-14 h-14 bg-slate-800/60 border border-slate-700/50'
              : 'w-20 h-20 bg-slate-800/50 border border-slate-700/40'
          }`}
        >
          {Icon ? (
            <Icon
              className={`${compact ? 'h-7 w-7' : 'h-10 w-10'} text-slate-500`}
            />
          ) : (
            <span className={compact ? 'text-3xl' : 'text-4xl'} role="img">
              {emoji}
            </span>
          )}
        </div>
        {/* Soft glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-slate-700/10 blur-xl -z-10 scale-150" />
      </div>

      {/* Text */}
      <h3
        className={`font-bold text-slate-300 ${compact ? 'text-sm' : 'text-base'} mb-1`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`text-slate-500 leading-relaxed max-w-xs ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {description}
        </p>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-brand-600/10 border border-brand-600/30
            text-brand-300 hover:text-brand-200
            hover:bg-brand-600/20 hover:border-brand-500/50
            font-semibold transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
            ${compact ? 'text-xs' : 'text-sm'}`}
        >
          <ActionIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

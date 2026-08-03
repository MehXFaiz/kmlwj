import { useEffect, useState } from 'react';
import { DownloadCloud, RefreshCw, X } from 'lucide-react';
import { useUpdaterStore } from '../../store/updaterStore';

// Persistent, dismissible banner for the two update states worth interrupting
// whatever page the user is currently on: an update downloading in the
// background, and an update ready to install. Silent states (checking,
// up-to-date, offline/error) never surface here — they're only ever shown to
// someone actively looking at Settings, since a background 30-minute update
// check silently failing (e.g. offline) isn't something to interrupt for.
export function UpdateBanner() {
  const { isElectron, status, latestVersion, progress } = useUpdaterStore();
  const restartAndInstall = useUpdaterStore((s) => s.restartAndInstall);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    useUpdaterStore.getState().init();
  }, []);

  // A fresh status (e.g. a later update becoming available after this one was
  // dismissed) should reopen the banner rather than stay hidden forever.
  useEffect(() => {
    setDismissed(false);
  }, [status]);

  if (!isElectron || dismissed) return null;
  if (status !== 'available' && status !== 'downloading' && status !== 'downloaded') return null;

  const ready = status === 'downloaded';

  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex items-center gap-3 max-w-sm px-4 py-3 rounded-xl border bg-slate-900 border-slate-700/60 shadow-2xl shadow-black/40 print:hidden">
      {ready ? (
        <RefreshCw className="h-5 w-5 flex-shrink-0 text-emerald-400" />
      ) : (
        <DownloadCloud className="h-5 w-5 flex-shrink-0 text-amber-400 animate-pulse" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100">
          {ready ? `Update ${latestVersion || ''} ready to install` : `Downloading update ${latestVersion || ''}…`}
        </p>
        {!ready && (
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {ready ? (
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Later
          </button>
          <button
            onClick={restartAndInstall}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Restart Now
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

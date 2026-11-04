import React from 'react';
import { useAuthStore, AUTO_LOGOUT_OPTIONS } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { showToast } from '../components/ui/Toast';
import { Smartphone, Globe, Timer } from 'lucide-react';

export const MyAccount = () => {
  const { autoLogoutMinutes, setAutoLogoutMinutes } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">Account Preferences</h2>
        <p className="text-xs text-slate-400">Manage your active sessions, auto-logout timer, and regional settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Regional & Devices Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-brand-400" />
                <CardTitle>Regional Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Timezone</span>
                <span className="text-xs font-medium text-slate-200">PKT (UTC+05:00)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Date Format</span>
                <span className="text-xs font-medium text-slate-200">DD/MM/YYYY</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Currency</span>
                <span className="text-xs font-medium text-slate-200">PKR (Rs)</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-brand-400" />
                <CardTitle>Active Sessions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <Smartphone className="h-5 w-5 text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">Windows PC · Chrome</p>
                  <p className="text-xs text-slate-500">Current Session</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">Active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Auto-Logout Option Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-brand-400" />
                  <CardTitle>Auto-Logout Option</CardTitle>
                </div>
                <span className="text-[10px] font-bold text-brand-300 bg-brand-950/40 px-2.5 py-0.5 rounded border border-brand-800/60 uppercase">
                  {Number(autoLogoutMinutes) > 0 ? `${autoLogoutMinutes} Min` : 'Disabled'}
                </span>
              </div>
              <CardDescription className="mt-1">
                Choose how long your session stays active without user interaction before automatically logging out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {AUTO_LOGOUT_OPTIONS.map((opt) => {
                  const active = Number(autoLogoutMinutes) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setAutoLogoutMinutes(opt.value);
                        showToast(
                          opt.value > 0
                            ? `Auto-logout set to ${opt.label}`
                            : 'Auto-logout disabled',
                          'success'
                        );
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-brand-500/15 border-brand-500/70 text-slate-100'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-xs font-bold">{opt.shortLabel}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

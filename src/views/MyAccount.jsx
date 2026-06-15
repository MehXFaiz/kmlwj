import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Mail, Bell, Shield, Smartphone, Globe, AlertTriangle } from 'lucide-react';

export const MyAccount = () => {
  const { user } = useAuthStore();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);
  const [digest, setDigest] = useState('weekly');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">Account Preferences</h2>
        <p className="text-xs text-slate-400">Manage your notifications, devices, and regional settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications Card */}
        <Card>
          <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-400" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Control how and when the system alerts you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">Email Alerts</p>
                <p className="text-xs text-slate-500 mt-0.5">Receive immediate emails for critical events.</p>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emailAlerts ? 'bg-brand-500' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${emailAlerts ? 'translate-x-4.5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">Push Notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">Show browser notifications when active.</p>
              </div>
              <button
                onClick={() => setPushAlerts(!pushAlerts)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pushAlerts ? 'bg-brand-500' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${pushAlerts ? 'translate-x-4.5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800/60">
              <label className="text-sm font-semibold text-slate-200 block mb-2">Activity Digest</label>
              <select
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="daily">Daily Summary</option>
                <option value="weekly">Weekly Summary</option>
                <option value="never">Never</option>
              </select>
            </div>
          </CardContent>
        </Card>

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
                <span className="text-xs font-medium text-slate-200">UTC - Coordinated Universal Time</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Date Format</span>
                <span className="text-xs font-medium text-slate-200">YYYY-MM-DD</span>
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
      </div>
    </div>
  );
};

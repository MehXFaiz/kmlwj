import React from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Smartphone, Globe } from 'lucide-react';

export const MyAccount = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">Account Preferences</h2>
        <p className="text-xs text-slate-400">Manage your active sessions and regional settings.</p>
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

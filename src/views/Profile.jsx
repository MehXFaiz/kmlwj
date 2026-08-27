import React from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Shield, Building2, Briefcase, Calendar, Key, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';

export const Profile = () => {
  const { user } = useAuthStore();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">User Profile</h2>
        <p className="text-xs text-slate-400">View your personal information and system access details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-3xl shadow-[0_0_15px_rgba(99,102,241,0.2)] mb-4">
                {getInitials(user?.fullName || user?.name || 'Operator')}
              </div>
              <h3 className="text-xl font-bold text-slate-100">{user?.fullName || user?.name || 'Operator'}</h3>
              <p className="text-sm text-slate-400 mb-4">{user?.email || 'operator@example.com'}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-900/50 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <UserCheck className="h-3.5 w-3.5" />
                Active Session
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-400" />
                Security Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">2FA Status</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/40">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Last Password Change</span>
                <span className="text-xs font-medium text-slate-200">30 days ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Failed Logins</span>
                <span className="text-xs font-medium text-slate-200">0</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <CardTitle>Professional Details</CardTitle>
              <CardDescription>Your assigned roles and corporate identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5"><User className="h-3 w-3" /> Full Name</span>
                  <p className="text-sm font-medium text-slate-200">{user?.fullName || user?.name || 'Operator'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email Address</span>
                  <p className="text-sm font-medium text-slate-200">{user?.email || 'operator@example.com'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> System Role</span>
                  <p className="text-sm font-medium text-slate-200">{typeof user?.role === 'object' && user?.role !== null ? (user.role.name || 'User') : (user?.role || 'User')}</p>

                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Department</span>
                  <p className="text-sm font-medium text-slate-200">Finance & Accounting</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <CardTitle>Permissions</CardTitle>
              <CardDescription>System access rights mapped to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user?.permissions?.length > 0 ? (
                  user.permissions.map((perm) => (
                    <span key={perm} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider">
                      <Key className="h-3 w-3 text-brand-400" />
                      {perm.replace(/_/g, ' ')}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-950/40 border border-brand-900/60 text-brand-300 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider">
                    <Key className="h-3 w-3 text-brand-400" />
                    FULL ACCESS (SUPER ADMIN)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

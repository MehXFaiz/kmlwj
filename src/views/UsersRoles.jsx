import { useEffect, useState } from 'react';
import { fetchRoles, fetchActivity } from '../services/mockApi';
import { Lock, Users, RefreshCw } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

export const UsersRoles = () => {
  const [roles, setRoles] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    let mounted = true;
    Promise.all([fetchRoles(), fetchActivity()]).then(([r,a])=>{
      if(!mounted) return;
      setRoles(r);
      setActivity(a);
      setLoading(false);
    });
    return ()=>{ mounted=false };
  },[]);

  const togglePerm = (roleId, key) => {
    setRoles(prev => prev.map(r => r.id===roleId ? ({...r, permissions:{...r.permissions, [key]: !r.permissions[key]}}) : r));
    showToast('Permission updated', {duration:1500});
  };

  const toggleLock = (roleId) => {
    setRoles(prev => prev.map(r => r.id===roleId ? ({...r, locked: !r.locked}) : r));
    showToast('Role lock updated');
  };

  if(loading) return (<div className="p-6"><div className="h-4 bg-slate-800 rounded w-40 mb-4 animate-pulse"></div><div className="h-64 bg-slate-800 rounded animate-pulse"></div></div>);

  const permKeys = ['coa','journals','reports','users','settings'];

  return (
    <DashboardLayout breadcrumbs={["Settings","Users & Roles"]}>
      <ToastPlaceholder />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100">Users & Roles</h2>
          <p className="text-xs text-slate-500">Manage role permissions, lock editing and review recent user activity</p>
        </div>
        <div className={pageActionsClass}>
          <button onClick={()=>{ setLoading(true); fetchRoles().then(r=>{ setRoles(r); setLoading(false); showToast('Roles refreshed')}) }} className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-800 text-slate-200 text-sm w-full sm:w-auto"><RefreshCw className="h-4 w-4"/> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-2 sm:p-4 min-w-0">
          <MobileOnly className="space-y-3 p-1">
            {roles.map(r => (
              <div key={r.id} className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-semibold text-slate-200 flex items-center gap-2 min-w-0"><Users className="h-4 w-4 text-slate-300 shrink-0"/> <span className="truncate">{r.name}</span></div>
                  <button onClick={()=>toggleLock(r.id)} className={`px-2 py-1 rounded text-xs shrink-0 ${r.locked ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-200'}`}><Lock className="h-3.5 w-3.5 inline-block mr-1"/>{r.locked ? 'Locked' : 'Edit'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {permKeys.map(k=> (
                    <label key={k} className={`px-2 py-1.5 rounded text-[11px] ${r.permissions[k] ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800/60 text-slate-400'}`}>
                      <input type="checkbox" disabled={r.locked} checked={!!r.permissions[k]} onChange={()=>togglePerm(r.id,k)} className="mr-2" />{k}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </MobileOnly>
          <DesktopOnly>
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="text-xs text-slate-400 uppercase"><th className="py-2">Role</th><th>Permissions</th><th className="w-28">Locked</th></tr>
            </thead>
            <tbody>
              {roles.map(r=> (
                <tr key={r.id} className="border-t border-slate-800/50 hover:bg-slate-800/10">
                  <td className="py-3"><div className="font-semibold text-slate-200 flex items-center gap-2"><Users className="h-4 w-4 text-slate-300"/> {r.name}</div></td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {permKeys.map(k=> (
                        <label key={k} className={`px-2 py-1 rounded text-[11px] ${r.permissions[k] ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800/60 text-slate-400'}` }>
                          <input type="checkbox" disabled={r.locked} checked={!!r.permissions[k]} onChange={()=>togglePerm(r.id,k)} className="mr-2" />{k}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button onClick={()=>toggleLock(r.id)} className={`px-3 py-1 rounded ${r.locked ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-200'}`}><Lock className="h-4 w-4 inline-block mr-1"/>{r.locked ? 'Locked' : 'Editable'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </DesktopOnly>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 sm:p-4">
          <h4 className="text-sm font-bold text-slate-200 mb-3">Recent Activity</h4>
          <div className="space-y-3 text-[13px] text-slate-300">
            {activity.map(a => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="text-slate-400">{a.date} • <span className="text-slate-200">{a.actor}</span></div>
                <div className="text-slate-300">{a.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

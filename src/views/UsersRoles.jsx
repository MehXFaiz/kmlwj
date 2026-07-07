import { useEffect, useState, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import { useRoleStore } from '../store/roleStore';
import { Lock, Unlock, Users, RefreshCw, Plus, Edit2, UserPlus, Shield, CheckCircle2, XCircle, X, Clock, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

/* ─── Inline User Form Panel ─── */
function UserFormPanel({ onClose, onSave, initial, availableRoles }) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: availableRoles[0] || 'Accountant',
    isActive: true,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        fullName: initial.fullName || '',
        email: initial.email || '',
        password: '',
        role: initial.role || 'Accountant',
        isActive: initial.isActive !== undefined ? initial.isActive : true,
      });
    } else {
      setForm({
        fullName: '',
        email: '',
        password: '',
        role: availableRoles[0] || 'Accountant',
        isActive: true,
      });
    }
  }, [initial, availableRoles]);

  const handleSubmit = () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      showToast('Name and email are required');
      return;
    }
    if (!initial && !form.password.trim()) {
      showToast('Password is required for new users');
      return;
    }
    onSave(form);
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-slate-600';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/80 overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80 bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <UserPlus className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{initial ? 'Edit User' : 'New User'}</h3>
            <p className="text-[10px] text-slate-500">{initial ? 'Update user details below' : 'Fill in the details to provision access'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form Body */}
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        <div>
          <label className={labelClass}>Full Name *</label>
          <input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="e.g. Jane Doe"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Email Address *</label>
          <input
            value={form.email}
            disabled={!!initial}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="e.g. jane@company.com"
            type="email"
            className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </div>

        <div>
          <label className={labelClass}>
            {initial ? 'New Password' : 'Password *'}
          </label>
          <input
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder={initial ? 'Leave blank to keep current' : 'Enter security password'}
            type="password"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Role Assignment</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className={`${inputClass} cursor-pointer`}
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {initial && (
          <div className="flex items-center justify-between py-3 px-3.5 rounded-xl border border-slate-800 bg-slate-950/40 mt-2">
            <div>
              <span className="block text-xs font-bold text-slate-300">Account Status</span>
              <span className="text-[10px] text-slate-500">Deactivated users cannot authenticate</span>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                form.isActive
                  ? 'bg-emerald-950/80 border-emerald-800/40 text-emerald-400'
                  : 'bg-red-950/80 border-red-900/40 text-red-400'
              }`}
            >
              {form.isActive ? '● Active' : '○ Inactive'}
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-800/80 bg-slate-900/60">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs font-semibold transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          {initial ? 'Save Updates' : 'Add User'}
        </button>
      </div>
    </div>
  );
}

export const UsersRoles = () => {
  const { users, fetchUsers, addUser, updateUser, deleteUser } = useUserStore();
  const { roles, activity, fetchRoles, updateRole, fetchActivity } = useRoleStore();

  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const initData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchUsers(), fetchRoles(), fetchActivity()]);
    } catch (err) {
      console.error(err);
      showToast('Error loading directory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { initData(); }, []);

  const handleDeleteUser = async (id) => {
    try {
      await deleteUser(id);
      showToast('User deleted successfully');
      setConfirmDeleteId(null);
      if (editingUser?.id === id) closeForm();
    } catch (err) {
      showToast(err.message || 'Failed to delete user');
    }
  };

  const handleRefresh = async () => {
    await initData();
    showToast('Directory refreshed');
  };

  const handleSaveUser = async (formData) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData);
        showToast('User modified successfully');
      } else {
        await addUser(formData);
        showToast('New user added successfully');
      }
      setFormOpen(false);
      setEditingUser(null);
    } catch (err) {
      showToast(err.message || 'Operation failed');
    }
  };

  const openCreate = () => { setEditingUser(null); setFormOpen(true); };
  const openEdit = (u) => { setEditingUser(u); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingUser(null); };

  const togglePerm = async (roleId, key) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const newPerms = { ...role.permissions, [key]: !role.permissions[key] };
    try {
      await updateRole(roleId, { permissions: newPerms });
      showToast('Permission matrix updated');
    } catch (err) {
      showToast(err.message || 'Failed to update permission');
    }
  };

  const toggleLock = async (roleId) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    try {
      await updateRole(roleId, { locked: !role.locked });
      showToast('Role lock updated');
    } catch (err) {
      showToast(err.message || 'Failed to toggle lock status');
    }
  };

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);
  const permKeys = ['coa', 'journals', 'reports', 'users', 'settings'];

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-4 bg-slate-800 rounded w-40 mb-4 animate-pulse"></div>
        <div className="h-64 bg-slate-800 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <DashboardLayout breadcrumbs={['Settings', 'Users & Roles']}>
      <ToastPlaceholder />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Access Management</h2>
          <p className="text-xs text-slate-500">Provision user profiles, assign corporate roles, and audit access trials.</p>
        </div>
        <div className={pageActionsClass}>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold w-full sm:w-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload Directory
          </button>
          {activeTab === 'users' && (
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all w-full sm:w-auto shadow-lg shadow-amber-900/30"
            >
              <Plus className="h-4 w-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'users'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Users List ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'roles'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Roles & Permissions Matrix
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'users' ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
              <MobileOnly className="p-3 space-y-3">
                {users.length === 0 ? (
                  <p className="py-8 text-center text-slate-500 text-sm">No users found.</p>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-200">{u.fullName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${u.isActive ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' : 'bg-red-950/60 text-red-400 border-red-900/50'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">{u.email}</p>
                      {confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-2 pt-2 border-t border-red-900/40">
                          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="text-[10px] text-red-400 flex-1">Delete user?</span>
                          <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">{u.role}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(u)} className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white">
                              <Edit2 className="h-3 w-3" /> Edit
                            </button>
                            <button onClick={() => setConfirmDeleteId(u.id)} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300">
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </MobileOnly>
              <DesktopOnly>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase bg-slate-900/60">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 w-28"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">No users found.</td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className={`hover:bg-slate-800/10 transition-colors ${editingUser?.id === u.id && formOpen ? 'bg-amber-950/10 border-l-2 border-amber-500/50' : ''}`}>
                            <td className="py-3 px-4 font-semibold text-slate-200">{u.fullName}</td>
                            <td className="py-3 px-4 text-slate-400">{u.email}</td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.isActive ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' : 'bg-red-950/60 text-red-400 border-red-900/50'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {confirmDeleteId === u.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-[10px] text-red-400 font-semibold mr-1">Delete?</span>
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEdit(u)}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                    title="Edit user"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(u.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Delete user"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </DesktopOnly>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 sm:p-4 min-w-0">
              <MobileOnly className="space-y-3 p-1">
                {roles.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-semibold text-slate-200 flex items-center gap-2 min-w-0">
                        <Users className="h-4 w-4 text-slate-300 shrink-0" />
                        <span className="truncate">{r.name}</span>
                      </div>
                      <button onClick={() => toggleLock(r.id)} disabled={r.name === 'Super Admin'} className={`px-2 py-1 rounded text-xs shrink-0 flex items-center gap-1 ${r.locked ? 'bg-red-950/50 border border-red-900/50 text-red-400' : 'bg-slate-800 border border-slate-700 text-slate-200'} disabled:opacity-40`}>
                        {r.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {r.locked ? 'Locked' : 'Editable'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {permKeys.map((k) => (
                        <label key={k} className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 ${r.permissions[k] ? 'bg-emerald-950/60 border border-emerald-900/50 text-emerald-400' : 'bg-slate-850 border border-slate-800 text-slate-500'}`}>
                          <input type="checkbox" disabled={r.locked || r.name === 'Super Admin'} checked={!!r.permissions[k]} onChange={() => togglePerm(r.id, k)} className="accent-emerald-500 cursor-pointer disabled:cursor-not-allowed" />
                          {k}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </MobileOnly>
              <DesktopOnly>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px] border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-500 uppercase bg-slate-900/60 border-b border-slate-800">
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Permissions Matrix</th>
                        <th className="py-3 px-4 w-32">Lock Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((r) => (
                        <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/10">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" /> {r.name}
                            </div>
                            {r.description && <span className="text-[10px] text-slate-500 block mt-0.5">{r.description}</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {permKeys.map((k) => (
                                <label key={k} className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${r.permissions[k] ? 'bg-emerald-950/60 border border-emerald-900/50 text-emerald-400' : 'bg-slate-850 border border-slate-800 text-slate-500'}`}>
                                  <input type="checkbox" disabled={r.locked || r.name === 'Super Admin'} checked={!!r.permissions[k]} onChange={() => togglePerm(r.id, k)} className="accent-emerald-500 cursor-pointer disabled:cursor-not-allowed" />
                                  {k}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button onClick={() => toggleLock(r.id)} disabled={r.name === 'Super Admin'} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${r.locked ? 'bg-red-950/50 border border-red-900/50 text-red-400 hover:bg-red-950' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-755'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                              {r.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                              {r.locked ? 'Locked' : 'Editable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DesktopOnly>
            </div>
          )}
        </div>

        {/* Right Column — form panel OR activity feed */}
        <div className="h-full min-h-[400px]">
          {formOpen ? (
            <UserFormPanel
              onClose={closeForm}
              onSave={handleSaveUser}
              initial={editingUser}
              availableRoles={roleNames}
            />
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 h-full">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Clock className="h-4 text-slate-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Access Trail Logs</h4>
              </div>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No access logs found.</p>
                ) : (
                  activity.slice(0, 10).map((a) => {
                    const formattedTime = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isUsersModule = a.module === 'USERS';
                    return (
                      <div key={a.id} className="text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{formattedTime}</span>
                          <span className={`px-1.5 py-0.5 rounded border ${isUsersModule ? 'bg-amber-950/50 border-amber-900 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{a.module || 'SYSTEM'}</span>
                        </div>
                        <p className="text-slate-200 leading-normal">{a.action}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Actor: {a.user ? a.user.fullName : 'System'}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

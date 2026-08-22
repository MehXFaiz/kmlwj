import { useEffect, useState, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import { useRoleStore } from '../store/roleStore';
import {
  Lock,
  Unlock,
  Users,
  RefreshCw,
  Plus,
  Edit2,
  UserPlus,
  Shield,
  CheckCircle2,
  X,
  Clock,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Search,
  KeyRound,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { ManagePermissionsModal } from '../components/admin/ManagePermissionsModal';
import {
  ERP_MODULE_GROUPS,
  ACTION_LABELS,
  ACCESS_LEVELS,
  getActionsForAccessLevel,
  getAccessLevelFromActions,
} from '../constants/permissions';

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
        role: initial.role || availableRoles[0] || 'Accountant',
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
            <p className="text-[10px] text-slate-500">
              {initial ? 'Update user details below' : 'Fill in the details to provision access'}
            </p>
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
          <label className={labelClass}>{initial ? 'New Password' : 'Password *'}</label>
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
              <option key={r} value={r}>
                {r}
              </option>
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

/* ─── Role Create / Edit Modal / Panel ─── */
function RoleFormPanel({ onClose, onSave, initialRole }) {
  const [name, setName] = useState(initialRole?.name || '');
  const [description, setDescription] = useState(initialRole?.description || '');
  const [modulePermissions, setModulePermissions] = useState({});

  useEffect(() => {
    if (initialRole) {
      setName(initialRole.name || '');
      setDescription(initialRole.description || '');
      setModulePermissions(initialRole.modulePermissions || {});
    } else {
      setName('');
      setDescription('');
      // Default to standard Data Entry for operational modules
      const initial = {};
      for (const group of ERP_MODULE_GROUPS) {
        for (const mod of group.modules) {
          const actMap = {};
          mod.actions.forEach((act) => {
            actMap[act] = act === 'view' || act === 'create';
          });
          initial[mod.key] = actMap;
        }
      }
      setModulePermissions(initial);
    }
  }, [initialRole]);

  const handleAccessLevelChange = (moduleKey, accessLevel) => {
    const newActions = getActionsForAccessLevel(moduleKey, accessLevel);
    setModulePermissions((prev) => ({
      ...prev,
      [moduleKey]: newActions,
    }));
  };

  const handleActionToggle = (moduleKey, action) => {
    setModulePermissions((prev) => {
      const currentModActions = prev[moduleKey] || {};
      const nextValue = !currentModActions[action];
      const updatedModActions = {
        ...currentModActions,
        [action]: nextValue,
      };

      if (nextValue && action !== 'view') {
        updatedModActions.view = true;
      }
      return {
        ...prev,
        [moduleKey]: updatedModActions,
      };
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast('Role Name is required');
      return;
    }
    onSave({
      id: initialRole?.id,
      name: name.trim(),
      description: description.trim() || `${name.trim()} Role`,
      modulePermissions,
    });
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-slate-600';
  const labelClass = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/90 overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80 bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {initialRole ? 'Edit Role Details' : 'Create Dynamic Role'}
            </h3>
            <p className="text-[10px] text-slate-500">
              {initialRole
                ? 'Update role name and description'
                : 'Define role name & assign initial module permissions'}
            </p>
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
          <label className={labelClass}>Role Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Donation Manager, Hall Manager, Receptionist..."
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Handles welfare donations, beneficiary records & aid reports"
            className={inputClass}
          />
        </div>

        {!initialRole && (
          <div className="space-y-3 pt-2">
            <label className={labelClass}>Quick Module Access Setup</label>
            <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
              {ERP_MODULE_GROUPS.map((group) => (
                <div key={group.name} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    {group.name}
                  </span>
                  {group.modules.map((mod) => {
                    const currentActions = modulePermissions[mod.key] || {};
                    const currentAccessLevel = getAccessLevelFromActions(mod.key, currentActions);

                    return (
                      <div
                        key={mod.key}
                        className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-semibold text-slate-200 truncate">{mod.name}</span>
                        <select
                          value={currentAccessLevel}
                          onChange={(e) => handleAccessLevelChange(mod.key, e.target.value)}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-medium text-amber-300 focus:outline-none"
                        >
                          {ACCESS_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 italic">
              You can fine-tune action checkboxes anytime via [Manage Permissions].
            </p>
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
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          {initialRole ? 'Update Role' : 'Create Role'}
        </button>
      </div>
    </div>
  );
}

export const UsersRoles = () => {
  const { users, fetchUsers, addUser, updateUser, deleteUser } = useUserStore();
  const { roles, activity, fetchRoles, addRole, updateRole, deleteRole, fetchActivity } = useRoleStore();

  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [managingRolePermissions, setManagingRolePermissions] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [roleSearch, setRoleSearch] = useState('');

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

  useEffect(() => {
    initData();
  }, []);

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

  const handleDeleteRole = async (id) => {
    const role = roles.find((r) => r.id === id);
    if (role && (role.name === 'Super Admin' || role.name === 'Admin')) {
      showToast(`${role.name} is a protected system role and cannot be deleted.`, 'warning');
      return;
    }
    try {
      await deleteRole(id);
      showToast(role ? `Role "${role.name}" deleted successfully` : 'Role deleted successfully', 'success');
      setConfirmDeleteRoleId(null);
    } catch (err) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to delete role';
      showToast(errMsg, 'error');
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

  const handleSaveRole = async (roleData) => {
    try {
      if (roleData.id) {
        await updateRole(roleData.id, roleData);
        showToast(`Role "${roleData.name}" updated successfully`);
      } else {
        await addRole(roleData);
        showToast(`Dynamic role "${roleData.name}" created successfully`);
      }
      setRoleFormOpen(false);
      setEditingRole(null);
    } catch (err) {
      showToast(err.message || 'Failed to save role');
    }
  };

  const handleSavePermissionsModal = async ({ roleId, modulePermissions }) => {
    try {
      await updateRole(roleId, { modulePermissions });
      showToast('Role permissions updated successfully');
    } catch (err) {
      showToast(err.message || 'Failed to update role permissions');
      throw err;
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setRoleFormOpen(false);
    setEditingRole(null);
    setFormOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setRoleFormOpen(false);
    setEditingRole(null);
    setFormOpen(true);
  };

  const openCreateRole = () => {
    setFormOpen(false);
    setEditingUser(null);
    setEditingRole(null);
    setRoleFormOpen(true);
  };

  const openEditRole = (r) => {
    setFormOpen(false);
    setEditingUser(null);
    setEditingRole(r);
    setRoleFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setRoleFormOpen(false);
    setEditingUser(null);
    setEditingRole(null);
  };

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, roleSearch]);

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
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            Users & Roles Management
          </h2>
          <p className="text-xs text-slate-500">
            Provision user profiles, define dynamic roles, and configure action-level permissions.
          </p>
        </div>
        <div className={pageActionsClass}>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold w-full sm:w-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          {activeTab === 'users' ? (
            <button
              onClick={openCreateUser}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all w-full sm:w-auto shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add User
            </button>
          ) : (
            <button
              onClick={openCreateRole}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all w-full sm:w-auto shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Custom Role
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
          Dynamic Roles & Permissions ({roles.length})
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
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            u.isActive
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50'
                              : 'bg-red-950/60 text-red-400 border-red-900/50'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">{u.email}</p>
                      {confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-2 pt-2 border-t border-red-900/40">
                          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="text-[10px] text-red-400 flex-1">Delete user?</span>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">{u.role}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditUser(u)}
                              className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
                            >
                              <Edit2 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
                            >
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
                  <table className="w-full text-left min-w-[640px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase bg-slate-900/60 whitespace-nowrap">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 w-36 min-w-[140px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr
                            key={u.id}
                            className={`hover:bg-slate-800/10 transition-colors ${
                              editingUser?.id === u.id && formOpen
                                ? 'bg-amber-950/10 border-l-2 border-amber-500/50'
                                : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                              {u.fullName}
                            </td>
                            <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{u.email}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  u.isActive
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50'
                                    : 'bg-red-950/60 text-red-400 border-red-900/50'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    u.isActive ? 'bg-emerald-400' : 'bg-red-400'
                                  }`}
                                />
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-right">
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
                                    onClick={() => openEditUser(u)}
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
            /* ─── Redesigned Dynamic Roles & Permissions View ─── */
            <div className="space-y-4">
              {/* Filter bar for roles */}
              <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    placeholder="Search roles..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  Total: <strong className="text-slate-200">{filteredRoles.length}</strong> roles
                </span>
              </div>

              {/* Roles Cards List */}
              <div className="grid grid-cols-1 gap-3.5">
                {filteredRoles.map((r) => {
                  const isCore = r.name === 'Super Admin' || r.name === 'Admin';
                  const modulesCount = r.modulesCount !== undefined ? r.modulesCount : 8;
                  const permsCount = r.permissionsCount !== undefined ? r.permissionsCount : 24;

                  return (
                    <div
                      key={r.id}
                      className="p-4 sm:p-5 rounded-xl border border-slate-800/80 bg-slate-900/70 hover:border-slate-700/80 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Role Info & Badges */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Shield className="h-4 w-4 text-amber-400" />
                          </div>
                          <span className="text-sm font-bold text-slate-100">{r.name}</span>
                          {isCore ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" /> Protected System Role
                            </span>
                          ) : r.locked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/50 border border-red-900/50 text-red-400 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </span>
                          ) : null}
                          {r.assignedUsersCount !== undefined && r.assignedUsersCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 flex items-center gap-1">
                              <Users className="h-2.5 w-2.5" /> {r.assignedUsersCount} User(s)
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed pl-10">
                          {r.description || `${r.name} operational role`}
                        </p>

                        {/* Compact Module & Permissions Count Summary */}
                        <div className="flex items-center gap-3 pt-1.5 pl-10 text-xs font-semibold">
                          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 rounded-md">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{modulesCount} Modules</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2.5 py-0.5 rounded-md">
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>{permsCount} Permissions</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => setManagingRolePermissions(r)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                          Manage Permissions
                        </button>

                        {!isCore && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditRole(r)}
                              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors"
                              title="Edit role details"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {confirmDeleteRoleId === r.id ? (
                              <div className="flex items-center gap-1.5 bg-red-950/80 p-1 rounded-xl border border-red-900">
                                <span className="text-[10px] text-red-300 font-bold px-1">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRole(r.id)}
                                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRoleId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRoleId(r.id)}
                                className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/40 text-xs transition-colors"
                                title="Delete role"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
          ) : roleFormOpen ? (
            <RoleFormPanel
              onClose={closeForm}
              onSave={handleSaveRole}
              initialRole={editingRole}
            />
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                  <Clock className="h-4 text-slate-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Security & Access Audit Trail
                  </h4>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {activity.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No access logs found.</p>
                  ) : (
                    activity.slice(0, 10).map((a) => {
                      const formattedTime = new Date(a.timestamp || a.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isRoles = a.module === 'ROLES' || a.module === 'USERS';
                      return (
                        <div key={a.id} className="text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{formattedTime}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${
                                isRoles
                                  ? 'bg-amber-950/50 border-amber-900 text-amber-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              {a.module || 'SYSTEM'}
                            </span>
                          </div>
                          <p className="text-slate-200 leading-normal">{a.action}</p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Actor: {a.user ? a.user.fullName : 'System'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Granular Manage Permissions Modal */}
      {managingRolePermissions && (
        <ManagePermissionsModal
          role={managingRolePermissions}
          isOpen={!!managingRolePermissions}
          onClose={() => setManagingRolePermissions(null)}
          onSave={handleSavePermissionsModal}
        />
      )}
    </DashboardLayout>
  );
};

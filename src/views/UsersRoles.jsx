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
  Mail,
  ShieldCheck,
  Check,
  Filter,
} from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { pageActionsClass } from '../components/common/responsive';
import { ManagePermissionsModal } from '../components/admin/ManagePermissionsModal';
import {
  ERP_MODULE_GROUPS,
  ACTION_LABELS,
  ACCESS_LEVELS,
  getActionsForAccessLevel,
  getAccessLevelFromActions,
} from '../constants/permissions';

/* ─── User Modal Dialog ─── */
function UserFormModal({ isOpen, onClose, onSave, initial, availableRoles }) {
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
  }, [initial, availableRoles, isOpen]);

  if (!isOpen) return null;

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
    'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all placeholder:text-slate-500';
  const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{initial ? 'Edit User Profile' : 'Add New User'}</h3>
              <p className="text-xs text-slate-400">
                {initial ? 'Update user credentials & role assignment' : 'Provision system access for a new user'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Ali Raza"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email Address *</label>
            <input
              value={form.email}
              disabled={!!initial}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. ali@company.com"
              type="email"
              className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>

          <div>
            <label className={labelClass}>{initial ? 'New Password (Optional)' : 'Password *'}</label>
            <input
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={initial ? 'Leave blank to keep existing password' : 'Enter account password'}
              type="password"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Assign Role</label>
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
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 mt-3">
              <div>
                <span className="block text-xs font-bold text-slate-200">Account Active Status</span>
                <span className="text-[11px] text-slate-500">Inactive users cannot log into the ERP</span>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  form.isActive
                    ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-400'
                    : 'bg-red-950/80 border-red-900/60 text-red-400'
                }`}
              >
                {form.isActive ? '● Active' : '○ Inactive'}
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            {initial ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Role Create / Edit Modal Dialog ─── */
function RoleFormModal({ isOpen, onClose, onSave, initialRole }) {
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
  }, [initialRole, isOpen]);

  if (!isOpen) return null;

  const handleAccessLevelChange = (moduleKey, accessLevel) => {
    const newActions = getActionsForAccessLevel(moduleKey, accessLevel);
    setModulePermissions((prev) => ({
      ...prev,
      [moduleKey]: newActions,
    }));
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
    'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all placeholder:text-slate-500';
  const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialRole ? 'Edit Role' : 'Create Dynamic Role'}
              </h3>
              <p className="text-xs text-slate-400">
                {initialRole
                  ? 'Update role name & operational scope'
                  : 'Define new dynamic role title & description'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
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
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Handles welfare donations, beneficiary records & aid reports"
              className={inputClass}
            />
          </div>

          {!initialRole && (
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                After creating this role, you can immediately click{' '}
                <strong className="text-amber-200 font-semibold">[ Manage Permissions ]</strong> to configure
                action-level checkboxes (View, Add, Edit, Delete, Post to Ledger, Approve, Export, Print).
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            {initialRole ? 'Save Updates' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const UsersRoles = () => {
  const { users, fetchUsers, addUser, updateUser, deleteUser } = useUserStore();
  const { roles, activity, fetchRoles, addRole, updateRole, deleteRole, fetchActivity } = useRoleStore();

  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [managingRolePermissions, setManagingRolePermissions] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

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
      if (editingUser?.id === id) setUserModalOpen(false);
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
      setUserModalOpen(false);
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
        const created = await addRole(roleData);
        showToast(`Dynamic role "${roleData.name}" created successfully`);
        // If created, automatically open manage permissions modal for smooth UX
        if (created?.data) {
          setManagingRolePermissions(created.data);
        }
      }
      setRoleModalOpen(false);
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
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserModalOpen(true);
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleModalOpen(true);
  };

  const openEditRole = (r) => {
    setEditingRole(r);
    setRoleModalOpen(true);
  };

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, roleSearch]);

  const filteredActivity = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return activity;
    return activity.filter(
      (a) =>
        (a.action && a.action.toLowerCase().includes(q)) ||
        (a.module && a.module.toLowerCase().includes(q)) ||
        (a.user?.fullName && a.user.fullName.toLowerCase().includes(q))
    );
  }, [activity, auditSearch]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 bg-slate-800 rounded w-48 animate-pulse"></div>
        <div className="h-72 bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <DashboardLayout breadcrumbs={['Settings', 'Users & Roles']}>
      <ToastPlaceholder />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            Users & Roles Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Provision user accounts, configure dynamic role privileges, and inspect security audit trails.
          </p>
        </div>
        <div className={pageActionsClass}>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold w-full sm:w-auto shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          {activeTab === 'users' && (
            <button
              onClick={openCreateUser}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all w-full sm:w-auto shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add User
            </button>
          )}
          {activeTab === 'roles' && (
            <button
              onClick={openCreateRole}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all w-full sm:w-auto shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Custom Role
            </button>
          )}
        </div>
      </div>

      {/* Clean Full-Width Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Users List ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'roles'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Dynamic Roles & Permissions ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Security Audit Trail ({activity.length})
        </button>
      </div>

      {/* ─── TAB 1: USERS LIST (Full-Width Clean Table) ─── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, or role..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Showing <strong className="text-slate-200">{filteredUsers.length}</strong> of{' '}
              <strong className="text-slate-200">{users.length}</strong> users
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-900/90 whitespace-nowrap">
                    <th className="py-3.5 px-5">User</th>
                    <th className="py-3.5 px-5">Email</th>
                    <th className="py-3.5 px-5">Assigned Role</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No users matching &quot;{userSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                              {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <span className="font-semibold text-slate-100">{u.fullName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/40 border border-amber-900/50 px-3 py-1 rounded-full uppercase tracking-wider">
                            <Shield className="h-3 w-3 text-amber-400" />
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
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
                        <td className="py-3.5 px-5 whitespace-nowrap text-right">
                          {confirmDeleteId === u.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] text-red-400 font-semibold">Delete?</span>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditUser(u)}
                                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
                                title="Edit user"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(u.id)}
                                className="p-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/40 transition-colors"
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
          </div>
        </div>
      )}

      {/* ─── TAB 2: DYNAMIC ROLES & PERMISSIONS (Full-Width Clean Cards) ─── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search roles by title or description..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Showing <strong className="text-slate-200">{filteredRoles.length}</strong> of{' '}
              <strong className="text-slate-200">{roles.length}</strong> roles
            </div>
          </div>

          {/* Roles Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoles.map((r) => {
              const isCore = r.name === 'Super Admin' || r.name === 'Admin';
              const modulesCount = r.modulesCount !== undefined ? r.modulesCount : 8;
              const permsCount = r.permissionsCount !== undefined ? r.permissionsCount : 24;

              return (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between gap-4"
                >
                  {/* Card Header & Description */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                          <Shield className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-100">{r.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isCore ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-950/70 border border-amber-800 text-amber-300 flex items-center gap-1">
                                <Lock className="h-2.5 w-2.5" /> Protected System Role
                              </span>
                            ) : r.locked ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-950/50 border border-red-900/50 text-red-400 flex items-center gap-1">
                                <Lock className="h-2.5 w-2.5" /> Locked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                                Dynamic Role
                              </span>
                            )}
                            {r.assignedUsersCount !== undefined && r.assignedUsersCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-800/80 text-slate-300 flex items-center gap-1">
                                <Users className="h-2.5 w-2.5" /> {r.assignedUsersCount} User(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit / Delete quick controls */}
                      {!isCore && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditRole(r)}
                            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Edit role details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {confirmDeleteRoleId === r.id ? (
                            <div className="flex items-center gap-1 bg-red-950 p-1 rounded-lg border border-red-900">
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(r.id)}
                                className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRoleId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRoleId(r.id)}
                              className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 transition-colors"
                              title="Delete role"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed min-h-[32px]">
                      {r.description || `${r.name} operational role`}
                    </p>
                  </div>

                  {/* Card Bottom: Summary Badges + Manage Permissions CTA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {modulesCount} Modules
                      </span>
                      <span className="flex items-center gap-1 text-amber-400 bg-amber-950/50 border border-amber-900/50 px-2.5 py-1 rounded-lg">
                        <KeyRound className="h-3.5 w-3.5" />
                        {permsCount} Permissions
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setManagingRolePermissions(r)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-900/20 cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Manage Permissions
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: SECURITY AUDIT TRAIL (Full-Width Clean Timeline) ─── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/70 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail by action, module, or actor..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Total <strong className="text-slate-200">{filteredActivity.length}</strong> logged events
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-900/90 whitespace-nowrap">
                    <th className="py-3.5 px-5">Time</th>
                    <th className="py-3.5 px-5">Module</th>
                    <th className="py-3.5 px-5">Action Performed</th>
                    <th className="py-3.5 px-5">Actor / User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {filteredActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredActivity.map((a) => {
                      const dateObj = new Date(a.timestamp || a.createdAt);
                      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const dateStr = dateObj.toLocaleDateString();
                      const isRoles = a.module === 'ROLES' || a.module === 'USERS';

                      return (
                        <tr key={a.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-slate-300 font-medium">{timeStr}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{dateStr}</div>
                          </td>
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border font-mono ${
                                isRoles
                                  ? 'bg-amber-950/60 border-amber-900/60 text-amber-400'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {a.module || 'SYSTEM'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-medium text-slate-200">{a.action}</td>
                          <td className="py-3.5 px-5 whitespace-nowrap text-slate-400">
                            {a.user ? (
                              <span className="font-semibold text-slate-300">{a.user.fullName}</span>
                            ) : (
                              <span className="italic text-slate-500">System</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      <UserFormModal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        initial={editingUser}
        availableRoles={roleNames}
      />

      <RoleFormModal
        isOpen={roleModalOpen}
        onClose={() => {
          setRoleModalOpen(false);
          setEditingRole(null);
        }}
        onSave={handleSaveRole}
        initialRole={editingRole}
      />

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

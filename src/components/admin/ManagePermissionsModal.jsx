import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  X,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronDown,
  Layers,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  ERP_MODULE_GROUPS,
  ERP_MODULES_MAP,
  ACTION_LABELS,
  ACCESS_LEVELS,
  SENSITIVE_MODULE_KEYS,
  getActionsForAccessLevel,
  getAccessLevelFromActions,
} from '../../constants/permissions';

export function ManagePermissionsModal({ role, isOpen, onClose, onSave }) {
  // Map of moduleKey -> { actionName: boolean }
  const [modulePermissions, setModulePermissions] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Initialize permissions state when role changes
  useEffect(() => {
    if (!role) return;

    const initial = {};
    for (const group of ERP_MODULE_GROUPS) {
      for (const mod of group.modules) {
        const modKey = mod.key;
        const existingActions = role.modulePermissions?.[modKey] || {};
        const actMap = {};

        for (const act of mod.actions) {
          actMap[act] = !!existingActions[act];
        }

        // Fallback for legacy role objects
        if (Object.keys(existingActions).length === 0 && role.permissions) {
          if (role.permissions[modKey]) {
            actMap.view = true;
            if (mod.actions.includes('create')) actMap.create = true;
          }
        }

        initial[modKey] = actMap;
      }
    }

    setModulePermissions(initial);
    setSearchQuery('');
    setSelectedCategory('ALL');
  }, [role, isOpen]);

  // Handle individual checkbox toggle
  const handleActionToggle = (moduleKey, action) => {
    setModulePermissions((prev) => {
      const currentModActions = prev[moduleKey] || {};
      const nextValue = !currentModActions[action];
      const updatedModActions = {
        ...currentModActions,
        [action]: nextValue,
      };

      // If user enables create/update/delete/post/approve/export/print, ensure view is enabled
      if (nextValue && action !== 'view' && ERP_MODULES_MAP[moduleKey]?.actions.includes('view')) {
        updatedModActions.view = true;
      }

      // If user unchecks view, disable other actions dependent on viewing
      if (!nextValue && action === 'view') {
        ERP_MODULES_MAP[moduleKey]?.actions.forEach((act) => {
          updatedModActions[act] = false;
        });
      }

      return {
        ...prev,
        [moduleKey]: updatedModActions,
      };
    });
  };

  // Handle Access Level dropdown selection
  const handleAccessLevelChange = (moduleKey, accessLevel) => {
    const newActions = getActionsForAccessLevel(moduleKey, accessLevel);
    setModulePermissions((prev) => ({
      ...prev,
      [moduleKey]: newActions,
    }));
  };

  // Bulk: Set all modules to a specific access level (protecting sensitive modules)
  const handleBulkSetAccessLevel = (level) => {
    setModulePermissions((prev) => {
      const next = { ...prev };
      for (const group of ERP_MODULE_GROUPS) {
        for (const mod of group.modules) {
          // Safeguard: Do not give full access or manager to sensitive administration modules in bulk
          if (SENSITIVE_MODULE_KEYS.includes(mod.key) && (level === 'Full Access' || level === 'Manager')) {
            continue;
          }
          next[mod.key] = getActionsForAccessLevel(mod.key, level);
        }
      }
      return next;
    });
  };

  // Bulk: Clear all permissions
  const handleClearAll = () => {
    setModulePermissions((prev) => {
      const next = {};
      for (const group of ERP_MODULE_GROUPS) {
        for (const mod of group.modules) {
          const actMap = {};
          mod.actions.forEach((act) => { actMap[act] = false; });
          next[mod.key] = actMap;
        }
      }
      return next;
    });
  };

  // Compute counts
  const { totalEnabledModules, totalActivePermissions, assignedWorkList } = useMemo(() => {
    let modCount = 0;
    let permCount = 0;
    const workList = [];

    for (const group of ERP_MODULE_GROUPS) {
      for (const mod of group.modules) {
        const acts = modulePermissions[mod.key] || {};
        const activeActs = mod.actions.filter((a) => !!acts[a]);

        if (activeActs.length > 0) {
          modCount++;
          permCount += activeActs.length;

          const actionSummaryText = activeActs
            .map((a) => ACTION_LABELS[a] || a)
            .join(' + ');

          workList.push({
            category: group.name,
            moduleName: mod.name,
            moduleKey: mod.key,
            summary: actionSummaryText,
            activeCount: activeActs.length,
          });
        }
      }
    }

    return {
      totalEnabledModules: modCount,
      totalActivePermissions: permCount,
      assignedWorkList: workList,
    };
  }, [modulePermissions]);

  // Filter modules by search & category
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return ERP_MODULE_GROUPS.map((group) => {
      if (selectedCategory !== 'ALL' && group.name !== selectedCategory) {
        return null;
      }

      const matchingModules = group.modules.filter((mod) => {
        if (!query) return true;
        return (
          mod.name.toLowerCase().includes(query) ||
          mod.description.toLowerCase().includes(query) ||
          mod.key.toLowerCase().includes(query) ||
          group.name.toLowerCase().includes(query)
        );
      });

      if (matchingModules.length === 0) return null;

      return {
        ...group,
        modules: matchingModules,
      };
    }).filter(Boolean);
  }, [searchQuery, selectedCategory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        roleId: role.id,
        modulePermissions,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !role) return null;

  const isProtectedRole = role.isPrivileged || role.name === 'Super Admin' || role.name === 'Admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
        {/* ─── Header ─── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  Manage Permissions: <span className="text-amber-400 font-extrabold">{role.name}</span>
                </h3>
                {isProtectedRole ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> Full System Privileges
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    Dynamic Role
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md sm:max-w-xl mt-0.5">
                {role.description || 'Configure action-level access across all ERP operational modules'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Stats Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
              <span className="font-semibold text-emerald-400">✓ {totalEnabledModules} Modules</span>
              <span className="text-slate-600">|</span>
              <span className="font-semibold text-amber-400">✓ {totalActivePermissions} Permissions</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─── Search & Bulk Controls Toolbar ─── */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search modules (e.g. Donations, Invoices, General Ledger)..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs & Bulk Presets */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px] overflow-x-auto">
              <span className="text-[10px] font-bold uppercase text-slate-500 px-2">Set All:</span>
              <button
                type="button"
                onClick={() => handleBulkSetAccessLevel('View Only')}
                className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium"
              >
                View Only
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAccessLevel('Data Entry')}
                className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium"
              >
                Data Entry
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAccessLevel('Editor')}
                className="px-2 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium"
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAccessLevel('Manager')}
                className="px-2 py-1 rounded-lg text-amber-400 hover:bg-amber-950/40 transition-colors font-semibold"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAccessLevel('Full Access')}
                className="px-2 py-1 rounded-lg text-emerald-400 hover:bg-emerald-950/40 transition-colors font-semibold"
              >
                Full Access
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors font-medium ml-1"
              >
                Clear All
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSummary(!showSummary)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showSummary
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {showSummary ? 'Hide Summary' : 'Assigned Work'}
            </button>
          </div>
        </div>

        {/* ─── Main Content Body ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Sensitive Module Warning / Info */}
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-300/90">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-amber-200">Security Isolation:</span> &quot;Post to Ledger&quot; is an independent permission that allows posting transactions without giving General Ledger edit access. Administration modules (Users, Roles, Settings) are safeguarded from bulk assignments.
            </div>
          </div>

          {/* Assigned Work Live Summary Drawer (When toggled) */}
          {showSummary && (
            <div className="rounded-xl border border-amber-500/30 bg-slate-950/80 p-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Assigned Work Summary for &quot;{role.name}&quot;
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {totalEnabledModules} active modules / {totalActivePermissions} total permissions
                </span>
              </div>

              {assignedWorkList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No module permissions assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {assignedWorkList.map((item) => (
                    <div
                      key={item.moduleKey}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-slate-200 truncate">{item.moduleName}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-400 truncate">
                        {item.summary}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Module Groups List */}
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No ERP modules matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.name} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                      {group.name}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500">{group.description}</span>
                </div>

                {/* Module Cards Grid */}
                <div className="grid grid-cols-1 gap-3">
                  {group.modules.map((mod) => {
                    const currentActions = modulePermissions[mod.key] || {};
                    const currentAccessLevel = getAccessLevelFromActions(mod.key, currentActions);
                    const isModuleEnabled = Object.values(currentActions).some(Boolean);
                    const isSensitive = SENSITIVE_MODULE_KEYS.includes(mod.key);

                    return (
                      <div
                        key={mod.key}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                          isModuleEnabled
                            ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                          {/* Module Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-100">{mod.name}</span>
                              {isSensitive && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-950/80 border border-red-900 text-red-400">
                                  Sensitive Admin
                                </span>
                              )}
                              {isModuleEnabled && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                                  ● {currentAccessLevel}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{mod.description}</p>
                          </div>

                          {/* Access Level Dropdown */}
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Access:
                            </label>
                            <div className="relative">
                              <select
                                value={currentAccessLevel}
                                onChange={(e) => handleAccessLevelChange(mod.key, e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm"
                              >
                                {ACCESS_LEVELS.map((lvl) => (
                                  <option key={lvl} value={lvl}>
                                    {lvl}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        {/* Granular Action Checkboxes */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                          {mod.actions.map((act) => {
                            const isChecked = !!currentActions[act];
                            const isPostOrApprove = act === 'post' || act === 'approve';

                            return (
                              <label
                                key={act}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 cursor-pointer transition-all ${
                                  isChecked
                                    ? isPostOrApprove
                                      ? 'bg-amber-950/50 border-amber-500/70 text-amber-200 shadow-sm'
                                      : 'bg-emerald-950/50 border-emerald-800/80 text-emerald-200 shadow-sm'
                                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleActionToggle(mod.key, act)}
                                  className={`rounded ${
                                    isPostOrApprove ? 'accent-amber-500' : 'accent-emerald-500'
                                  } cursor-pointer`}
                                />
                                <span>{ACTION_LABELS[act] || act}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── Footer Actions ─── */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{totalEnabledModules}</span> of{' '}
            {ERP_MODULE_GROUPS.flatMap((g) => g.modules).length} modules enabled ({totalActivePermissions} actions)
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving Changes...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

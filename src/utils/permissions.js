/**
 * Central Permission Evaluation Utilities
 *
 * Implements the core ERP authorization logic:
 * 1. Super Admin / Privileged users have unrestricted access across all modules.
 * 2. Having ANY valid action on a module (e.g. create, update, post) implies 'view' access.
 * 3. Specific actions ('create', 'update', 'delete', 'post') require exact match.
 */

/**
 * Normalizes input permissions into a list of { module: string, action: string }
 * @param {Array<Object|string>|Set<string>} permissions
 * @returns {Array<{ module: string, action: string }>}
 */
export function normalizePermissions(permissions) {
  if (!permissions) return [];

  const list = [];

  // Plain object: e.g. { donations: { delete: true } } or { 'donations.delete': true }
  if (typeof permissions === 'object' && !Array.isArray(permissions) && !(permissions instanceof Set)) {
    for (const [key, val] of Object.entries(permissions)) {
      if (val && typeof val === 'object') {
        for (const [actionKey, isGranted] of Object.entries(val)) {
          if (isGranted) {
            list.push({ module: key, action: actionKey });
          }
        }
      } else if (val) {
        if (key.includes('.')) {
          const [mod, act] = key.split('.');
          list.push({ module: mod, action: act });
        } else {
          list.push({ module: key, action: 'view' });
        }
      }
    }
    return list;
  }

  const rawArray = permissions instanceof Set ? Array.from(permissions) : Array.isArray(permissions) ? permissions : [];

  for (const item of rawArray) {
    if (!item) continue;
    if (typeof item === 'object' && item.module && item.action) {
      list.push({ module: item.module, action: item.action });
    } else if (typeof item === 'string') {
      if (item.includes('.')) {
        const [mod, act] = item.split('.');
        list.push({ module: mod, action: act });
      } else {
        list.push({ module: item, action: 'view' });
      }
    }
  }

  return list;
}

/**
 * Checks if the user has permission to perform `action` on `module`.
 *
 * @param {Array|Set|Object} permissions List of permissions
 * @param {boolean} isPrivileged Whether the user has a privileged role (Super Admin / Admin)
 * @param {string} module The module key (e.g. 'donations', 'revenueCollections', 'coa')
 * @param {string} [action='view'] The action to check ('view', 'create', 'update', 'delete', 'post', 'print')
 * @param {any} [role=null] The user's role
 * @returns {boolean}
 */
export function hasPermission(permissions, isPrivileged, module, action = 'view', role = null) {
  const isSuper = role === 'Super Admin' || role?.name === 'Super Admin';
  if (isSuper) return true;
  if (!module) return false;

  const roleName = typeof role === 'string' ? role : (role?.name || '');
  const isAccountant = roleName === 'Accountant' || roleName?.toLowerCase?.().includes('accountant');

  // Accountant has full access to post across modules
  if (action === 'post' && isAccountant) {
    return true;
  }

  // Rule: Non-privileged roles (Accountant, Data Entry, etc.) are strictly forbidden from edit or delete
  if ((action === 'update' || action === 'delete') && !isPrivileged) {
    return false;
  }

  const normalized = normalizePermissions(permissions);
  const targetModule = String(module).trim();
  const targetAction = String(action || 'view').trim();

  // Rule 5: Any valid action on a module implies 'view' access to that module
  if (targetAction === 'view') {
    return normalized.some((p) => p.module === targetModule);
  }

  // Specific action check
  return normalized.some((p) => p.module === targetModule && p.action === targetAction);
}

/**
 * Checks if a user has access to view or enter a given module.
 *
 * @param {Array|Set} permissions
 * @param {boolean} isPrivileged
 * @param {string} module
 * @returns {boolean}
 */
export function canAccessModule(permissions, isPrivileged, module) {
  return hasPermission(permissions, isPrivileged, module, 'view');
}

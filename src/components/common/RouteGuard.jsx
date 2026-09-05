import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const RouteGuard = ({ module, action = 'view', requiredPerms, children }) => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isPrivileged = useAuthStore((state) => state.isPrivileged);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!isAuthenticated && !user) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin / privileged bypass
  if (isPrivileged || user?.role === 'Super Admin' || user?.role?.name === 'Super Admin') {
    return children;
  }

  let allowed = false;

  if (module) {
    if (Array.isArray(module)) {
      allowed = module.some((m) => hasPermission(m, action));
    } else {
      allowed = hasPermission(module, action);
    }
  } else if (requiredPerms && requiredPerms.length > 0) {
    allowed = requiredPerms.some((p) => hasPermission(p));
  } else {
    // If no guard rule specified, permit authenticated user
    allowed = true;
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12">
        <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 shadow-lg shadow-rose-950/20">
          <svg
            className="w-10 h-10 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          403 Forbidden
        </div>

        <h2 className="text-xl font-bold text-slate-100 tracking-tight mb-2">
          Access Denied
        </h2>

        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          You do not have the required permissions to access this page or perform this action.
          If you believe this is an error, please contact your system administrator.
        </p>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
};

export default RouteGuard;

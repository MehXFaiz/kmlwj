import { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { SplashScreen } from './components/common/SplashScreen';
import { Sidebar } from './components/common/Sidebar';
import { Topbar } from './components/common/Topbar';
import { useAuthStore } from './store/authStore';
import { ThemeProvider } from './components/theme/ThemeProvider';

// Lazy-loaded views for code splitting
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const ChartOfAccounts = lazy(() => import('./views/ChartOfAccounts').then(m => ({ default: m.ChartOfAccounts })));
const GeneralLedger = lazy(() => import('./views/GeneralLedger').then(m => ({ default: m.GeneralLedger })));
const JournalEntries = lazy(() => import('./views/JournalEntries').then(m => ({ default: m.JournalEntries })));
const AuditTrail = lazy(() => import('./views/AuditTrail').then(m => ({ default: m.AuditTrail })));
const Settings = lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const Profile = lazy(() => import('./views/Profile').then(m => ({ default: m.Profile })));
const MyAccount = lazy(() => import('./views/MyAccount').then(m => ({ default: m.MyAccount })));
const RevenueHeads = lazy(() => import('./views/RevenueHeads').then(m => ({ default: m.RevenueHeads })));
const ExpenseHeads = lazy(() => import('./views/ExpenseHeads').then(m => ({ default: m.ExpenseHeads })));
const ReservedCodes = lazy(() => import('./views/ReservedCodes').then(m => ({ default: m.ReservedCodes })));
const UsersRoles = lazy(() => import('./views/UsersRoles').then(m => ({ default: m.UsersRoles })));
const Reports = lazy(() => import('./views/Reports').then(m => ({ default: m.Reports })));

// Donation Module Views
const Beneficiaries = lazy(() => import('./views/Beneficiaries').then(m => ({ default: m.Beneficiaries })));
const Donations = lazy(() => import('./views/Donations').then(m => ({ default: m.Donations })));
const DonationReports = lazy(() => import('./views/DonationReports').then(m => ({ default: m.DonationReports })));

// Auth Views (also lazy-loaded)
const Login = lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./views/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./views/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./views/ResetPassword').then(m => ({ default: m.ResetPassword })));

// Protected Routes Shell
const ProtectedRoutesWrapper = ({ isCollapsed, setIsCollapsed }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Core Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden relative">
        {/* Top Info / Entity selection bar */}
        <Topbar onMobileMenuToggle={() => setIsMobileOpen((open) => !open)} />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-[50vh]">
                <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

const PermissionGuard = ({ requiredPerms, children }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Super Admin') return children;
  
  const hasPerm = requiredPerms.some((p) => user.permissions?.includes(p));
  if (!hasPerm) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest">
          403 — Access Denied
        </h3>
        <p className="text-xs text-slate-500 mt-2">
          Your credentials do not permit viewing this financial classification path.
        </p>
      </div>
    );
  }
  return children;
};

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { restoreSession } = useAuthStore();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    restoreSession().finally(() => {
      setRestoring(false);
    });
  }, [restoreSession]);

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-950">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      {/* Splash screen — shown until loading sequence completes */}
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}

      {/* Main ERP Shell */}
      <Router>
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen w-screen bg-slate-950">
            <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
        <Routes>
          {/* Public Authentication Screens */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Secure ERP Interface */}
          <Route element={<ProtectedRoutesWrapper isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coa" element={
              <PermissionGuard requiredPerms={['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT', 'LOCK_ACCOUNT']}>
                <ChartOfAccounts />
              </PermissionGuard>
            } />
            <Route path="/revenue-heads" element={
              <PermissionGuard requiredPerms={['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT']}>
                <RevenueHeads />
              </PermissionGuard>
            } />
            <Route path="/expense-heads" element={
              <PermissionGuard requiredPerms={['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT']}>
                <ExpenseHeads />
              </PermissionGuard>
            } />
            <Route path="/reserved" element={
              <PermissionGuard requiredPerms={['MANAGE_RESERVED_CODES']}>
                <ReservedCodes />
              </PermissionGuard>
            } />
            <Route path="/reports" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <Reports />
              </PermissionGuard>
            } />
            <Route path="/beneficiaries" element={<Beneficiaries />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/donation-reports" element={<DonationReports />} />
            <Route path="/users-roles" element={
              <PermissionGuard requiredPerms={['MANAGE_USERS', 'MANAGE_ROLES']}>
                <UsersRoles />
              </PermissionGuard>
            } />
            <Route path="/ledger" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <GeneralLedger />
              </PermissionGuard>
            } />
            <Route path="/journals" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <JournalEntries />
              </PermissionGuard>
            } />
            <Route path="/audit" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS', 'MANAGE_USERS']}>
                <AuditTrail />
              </PermissionGuard>
            } />
            <Route path="/settings" element={
              <PermissionGuard requiredPerms={['MANAGE_ROLES']}>
                <Settings />
              </PermissionGuard>
            } />
            <Route path="/profile" element={<Profile />} />
            <Route path="/account" element={<MyAccount />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <h3 className="text-lg font-bold text-slate-200 uppercase tracking-widest">
                  404 — Ledger Entry Not Found
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  The financial view path you requested does not exist in this ERP terminal.
                </p>
              </div>
            } />
          </Route>
        </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;

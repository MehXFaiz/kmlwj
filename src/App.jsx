import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SplashScreen } from './components/common/SplashScreen';
import { Sidebar } from './components/common/Sidebar';
import { Topbar } from './components/common/Topbar';
import { useAuthStore } from './store/authStore';

// Lazy-loaded views for code splitting
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const ChartOfAccounts = lazy(() => import('./views/ChartOfAccounts').then(m => ({ default: m.ChartOfAccounts })));
const GeneralLedger = lazy(() => import('./views/GeneralLedger').then(m => ({ default: m.GeneralLedger })));
const JournalEntries = lazy(() => import('./views/JournalEntries').then(m => ({ default: m.JournalEntries })));
const AuditTrail = lazy(() => import('./views/AuditTrail').then(m => ({ default: m.AuditTrail })));
const Settings = lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const RevenueHeads = lazy(() => import('./views/RevenueHeads').then(m => ({ default: m.RevenueHeads })));
const ExpenseHeads = lazy(() => import('./views/ExpenseHeads').then(m => ({ default: m.ExpenseHeads })));
const ReservedCodes = lazy(() => import('./views/ReservedCodes').then(m => ({ default: m.ReservedCodes })));
const UsersRoles = lazy(() => import('./views/UsersRoles').then(m => ({ default: m.UsersRoles })));
const Reports = lazy(() => import('./views/Reports').then(m => ({ default: m.Reports })));

// Auth Views (also lazy-loaded)
const Login = lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./views/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./views/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./views/ResetPassword').then(m => ({ default: m.ResetPassword })));

// Protected Routes Shell
const ProtectedRoutesWrapper = ({ isCollapsed, setIsCollapsed }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Core Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Info / Entity selection bar */}
        <Topbar onMobileMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 bg-slate-950">
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

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
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
            <Route path="/coa" element={<ChartOfAccounts />} />
            <Route path="/revenue-heads" element={<RevenueHeads />} />
            <Route path="/expense-heads" element={<ExpenseHeads />} />
            <Route path="/reserved" element={<ReservedCodes />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users-roles" element={<UsersRoles />} />
            <Route path="/ledger" element={<GeneralLedger />} />
            <Route path="/journals" element={<JournalEntries />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/settings" element={<Settings />} />
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
    </>
  );
}

export default App;

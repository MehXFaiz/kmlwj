import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SplashScreen } from './components/common/SplashScreen';
import { Sidebar } from './components/common/Sidebar';
import { Topbar } from './components/common/Topbar';
import { Dashboard } from './views/Dashboard';
import { ChartOfAccounts } from './views/ChartOfAccounts';
import { GeneralLedger } from './views/GeneralLedger';
import { JournalEntries } from './views/JournalEntries';
import { AuditTrail } from './views/AuditTrail';
import { Settings } from './views/Settings';
import { RevenueHeads } from './views/RevenueHeads';
import { ExpenseHeads } from './views/ExpenseHeads';
import { ReservedCodes } from './views/ReservedCodes';
import { UsersRoles } from './views/UsersRoles';
import { Reports } from './views/Reports';

// Auth Views
import { Login } from './views/Login';
import { Signup } from './views/Signup';
import { ForgotPassword } from './views/ForgotPassword';
import { ResetPassword } from './views/ResetPassword';
import { useAuthStore } from './store/authStore';

// Protected Routes Shell
const ProtectedRoutesWrapper = ({ isCollapsed, setIsCollapsed }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* Core Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Info / Entity selection bar */}
        <Topbar />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
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
      </Router>
    </>
  );
}

export default App;

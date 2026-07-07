import React, { useState, lazy, Suspense, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, FileText, RefreshCw, Plus, X, BookOpen } from 'lucide-react';
import { SplashScreen } from './components/common/SplashScreen';
import { Sidebar } from './components/common/Sidebar';
import { Topbar } from './components/common/Topbar';
import { useAuthStore } from './store/authStore';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { ToastContainer } from './components/ui/Toast';

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
const TrialBalanceSheet = lazy(() => import('./views/TrialBalanceSheet').then(m => ({ default: m.TrialBalanceSheet })));
const HallBookings = lazy(() => import('./views/HallBookings').then(m => ({ default: m.HallBookings })));
const HallBookingForm = lazy(() => import('./views/HallBookingForm').then(m => ({ default: m.HallBookingForm })));

// Donation Module Views
const Beneficiaries = lazy(() => import('./views/Beneficiaries').then(m => ({ default: m.Beneficiaries })));
const Donations = lazy(() => import('./views/Donations').then(m => ({ default: m.Donations })));
const Donors = lazy(() => import('./views/Donors').then(m => ({ default: m.Donors })));
const DonationsReceived = lazy(() => import('./views/DonationsReceived').then(m => ({ default: m.DonationsReceived })));
const DonationReports = lazy(() => import('./views/DonationReports').then(m => ({ default: m.DonationReports })));
const Invoices = lazy(() => import('./views/Invoices').then(m => ({ default: m.Invoices })));

// Operation Module Views
const Income = lazy(() => import('./views/Income').then(m => ({ default: m.Income })));
const Expenses = lazy(() => import('./views/Expenses').then(m => ({ default: m.Expenses })));

const DonorForm = lazy(() => import('./views/DonorForm').then(m => ({ default: m.DonorForm })));
const DonationReceiptForm = lazy(() => import('./views/DonationReceiptForm').then(m => ({ default: m.DonationReceiptForm })));

// Categorized Revenue Views
const MembershipFeeSection = lazy(() => import('./views/CategorizedRevenues').then(m => ({ default: m.MembershipFeeSection })));
const BusBookingSection = lazy(() => import('./views/CategorizedRevenues').then(m => ({ default: m.BusBookingSection })));
const ZakatSection = lazy(() => import('./views/CategorizedRevenues').then(m => ({ default: m.ZakatSection })));
const FitraSection = lazy(() => import('./views/CategorizedRevenues').then(m => ({ default: m.FitraSection })));
const SpecializedRevenueForm = lazy(() => import('./views/SpecializedRevenueForm').then(m => ({ default: m.SpecializedRevenueForm })));

// Invoice Module Views
const Customers = lazy(() => import('./views/Customers').then(m => ({ default: m.Customers })));
const InvoiceForm = lazy(() => import('./views/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceDetail = lazy(() => import('./views/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const Members = lazy(() => import('./views/Members').then(m => ({ default: m.Members })));
const MemberForm = lazy(() => import('./views/MemberForm').then(m => ({ default: m.MemberForm })));

// Bank Voucher Module Views
const BankVouchers = lazy(() => import('./views/BankVouchers').then(m => ({ default: m.BankVouchers })));
const BankVoucherForm = lazy(() => import('./views/BankVoucherForm').then(m => ({ default: m.BankVoucherForm })));
const RevenueEntryForm = lazy(() => import('./views/RevenueEntryForm').then(m => ({ default: m.RevenueEntryForm })));
const ExpenseEntryForm = lazy(() => import('./views/ExpenseEntryForm').then(m => ({ default: m.ExpenseEntryForm })));
const TransferForm = lazy(() => import('./views/TransferForm').then(m => ({ default: m.TransferForm })));

// Auth Views (also lazy-loaded)
const Login = lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./views/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./views/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./views/ResetPassword').then(m => ({ default: m.ResetPassword })));

// Error Boundary for Chunk Load Errors (new deployments)
class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary Caught:', error, errorInfo);
    const isChunkLoadError = 
      error?.name === 'ChunkLoadError' || 
      error?.message?.includes('Failed to fetch dynamically imported module') || 
      error?.message?.includes('Importing a module script failed');
      
    if (isChunkLoadError) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkLoadError = 
        this.state.error?.name === 'ChunkLoadError' || 
        this.state.error?.message?.includes('Failed to fetch dynamically imported module');
        
      if (isChunkLoadError) {
        return (
          <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-center px-4">
            <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-200">Applying latest updates...</h3>
            <p className="text-sm text-slate-500 mt-2">Loading the newest version of the application.</p>
          </div>
        );
      }
      
      // Real runtime error
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-center px-4">
          <div className="p-6 bg-red-950/30 border border-red-900 rounded-xl max-w-xl w-full">
            <h3 className="text-lg font-bold text-red-400 mb-2">Application Error</h3>
            <div className="p-4 bg-black/40 rounded bg-slate-900 overflow-auto text-left text-red-300 font-mono text-sm max-h-[50vh]">
              {this.state.error?.toString()}
              <br/><br/>
              {this.state.error?.stack}
            </div>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ──────────────────────────────────────────────────
   Mobile Floating Action Button
   Visible only on small screens (hidden on lg+)
───────────────────────────────────────────────── */
const MobileFab = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions = [
    { label: 'Add Income', desc: 'Record money received', icon: TrendingUp, color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60', path: '/bank-vouchers/revenue/new' },
    { label: 'Add Expense', desc: 'Record money spent', icon: TrendingDown, color: 'text-red-400 bg-red-950/80 border-red-800/60', path: '/bank-vouchers/expense/new' },
    { label: 'Journal Entry', desc: 'Manual entry', icon: FileText, color: 'text-amber-400 bg-amber-950/80 border-amber-800/60', path: '/journals' },
    { label: 'General Ledger', desc: 'View account ledgers', icon: BookOpen, color: 'text-cyan-400 bg-cyan-950/80 border-cyan-800/60', path: '/ledger' },
    { label: 'Transfer', desc: 'Move between accounts', icon: RefreshCw, color: 'text-violet-400 bg-violet-950/80 border-violet-800/60', path: '/bank-vouchers/transfer/new' },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Action sheet */}
      {open && (
        <div className="fixed bottom-24 left-4 right-4 z-[90] lg:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/80">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quick Action</p>
              <p className="text-[11px] text-slate-600 mt-0.5">What would you like to do?</p>
            </div>
            <div className="p-3 space-y-2">
              {actions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => { navigate(action.path); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${action.color}`}
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-900/60 flex items-center justify-center flex-shrink-0">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{action.label}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-6 right-5 z-[90] lg:hidden w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-500 active:scale-95 shadow-2xl shadow-amber-900/60 flex items-center justify-center text-white transition-all duration-200"
        aria-label="Quick actions"
      >
        {open
          ? <X className="h-6 w-6" />
          : <Plus className="h-6 w-6" />}
      </button>
    </>
  );
};

// Protected Routes Shell
const ProtectedRoutesWrapper = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
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
      <Sidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Core Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden relative">
        {/* Top Info / Entity selection bar */}
        <Topbar onMobileMenuToggle={() => setIsMobileOpen((open) => !open)} />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-[50vh]">
                <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile FAB — quick actions floating button */}
      <MobileFab />
    </div>
  );
};

const PermissionGuard = ({ requiredPerms, children }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Super Admin') return children;

  const hasPerm = requiredPerms.some((p) => user.permissions?.includes(p));
  if (!hasPerm) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-900/40 flex items-center justify-center mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h3 className="text-base font-bold text-slate-200">You don't have access to this page</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">
          Please contact your administrator to request access.
        </p>
      </div>
    );
  }
  return children;
};

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    restoreSession().finally(() => {
      setRestoring(false);
    });
  }, [restoreSession]);

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-950">
        <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      {/* Global toast notifications — replaces all alert() calls */}
      <ToastContainer />

      {/* Splash screen — shown until loading sequence completes */}
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}

      {/* Main ERP Shell */}
      <Router>
        <ChunkErrorBoundary>
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen w-screen bg-slate-950">
              <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
          <Routes>
          {/* Public Authentication Screens */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Secure ERP Interface */}
          <Route element={<ProtectedRoutesWrapper />}>
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
            <Route path="/income" element={
              <PermissionGuard requiredPerms={['RECORD_INCOME', 'CREATE_ACCOUNT']}>
                <Income />
              </PermissionGuard>
            } />
            <Route path="/expenses" element={
              <PermissionGuard requiredPerms={['RECORD_EXPENSE', 'CREATE_ACCOUNT']}>
                <Expenses />
              </PermissionGuard>
            } />
            <Route path="/trial-balance-sheet" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <TrialBalanceSheet />
              </PermissionGuard>
            } />
            <Route path="/hall-bookings" element={<HallBookings />} />
            <Route path="/hall-bookings/new" element={<HallBookingForm />} />
            <Route path="/hall-bookings/edit/:id" element={<HallBookingForm />} />
            <Route path="/beneficiaries" element={<Beneficiaries />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/donors" element={<Donors />} />
            <Route path="/donors/new" element={<DonorForm />} />
            <Route path="/donors/edit/:id" element={<DonorForm />} />
            <Route path="/donations-received" element={<DonationsReceived />} />
            <Route path="/donations-received/new" element={<DonationReceiptForm />} />
            <Route path="/donations-received/edit/:id" element={<DonationReceiptForm />} />
            <Route path="/donation-reports" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <DonationReports />
              </PermissionGuard>
            } />
            <Route path="/membership-fees" element={<MembershipFeeSection />} />
            <Route path="/membership-fees/new" element={<SpecializedRevenueForm category="Membership Fee" title="Membership Fee Collection" desc="Manage member fee contributions and annual renewals" titleLabel="Member Name" subTitleLabel="Membership ID / CNIC" dateLabel="Fee Date" showRate={true} rateLabel="Fee Rate" backPath="/membership-fees" />} />
            <Route path="/membership-fees/edit/:id" element={<SpecializedRevenueForm category="Membership Fee" title="Membership Fee Collection" desc="Manage member fee contributions and annual renewals" titleLabel="Member Name" subTitleLabel="Membership ID / CNIC" dateLabel="Fee Date" showRate={true} rateLabel="Fee Rate" backPath="/membership-fees" />} />
            <Route path="/bus-bookings" element={<BusBookingSection />} />
            <Route path="/bus-bookings/new" element={<SpecializedRevenueForm category="Bus Booking" title="Bus Booking Receipt" desc="Manage Jamia bus reservations, trip schedules, and ledger receipts" titleLabel="Booker Name" subTitleLabel="Bus / Vehicle Number" dateLabel="Trip Date" showDest={true} destLabel="Trip Destination" backPath="/bus-bookings" />} />
            <Route path="/bus-bookings/edit/:id" element={<SpecializedRevenueForm category="Bus Booking" title="Bus Booking Receipt" desc="Manage Jamia bus reservations, trip schedules, and ledger receipts" titleLabel="Booker Name" subTitleLabel="Bus / Vehicle Number" dateLabel="Trip Date" showDest={true} destLabel="Trip Destination" backPath="/bus-bookings" />} />
            <Route path="/zakat" element={<ZakatSection />} />
            <Route path="/zakat/new" element={<SpecializedRevenueForm category="Zakat" title="Zakat Collection" desc="Manage Zakat contributions, donor records, and ledger postings" titleLabel="Donor Name" subTitleLabel="CNIC / ID" dateLabel="Collection Date" backPath="/zakat" />} />
            <Route path="/zakat/edit/:id" element={<SpecializedRevenueForm category="Zakat" title="Zakat Collection" desc="Manage Zakat contributions, donor records, and ledger postings" titleLabel="Donor Name" subTitleLabel="CNIC / ID" dateLabel="Collection Date" backPath="/zakat" />} />
            <Route path="/fitra" element={<FitraSection />} />
            <Route path="/fitra/new" element={<SpecializedRevenueForm category="Fitra" title="Fitra Collection" desc="Manage Eid Fitra collections and head-counts" titleLabel="Donor Name" subTitleLabel={null} dateLabel="Collection Date" showQty={true} qtyLabel="Head Count" showRate={true} rateLabel="Rate per Head" backPath="/fitra" />} />
            <Route path="/fitra/edit/:id" element={<SpecializedRevenueForm category="Fitra" title="Fitra Collection" desc="Manage Eid Fitra collections and head-counts" titleLabel="Donor Name" subTitleLabel={null} dateLabel="Collection Date" showQty={true} qtyLabel="Head Count" showRate={true} rateLabel="Rate per Head" backPath="/fitra" />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/new" element={<MemberForm />} />
            <Route path="/members/edit/:id" element={<MemberForm />} />
            <Route path="/invoices" element={
              <PermissionGuard requiredPerms={['VIEW_INVOICES']}>
                <Invoices />
              </PermissionGuard>
            } />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/edit/:id" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/bank-vouchers" element={<BankVouchers />} />
            <Route path="/bank-vouchers/new" element={<BankVoucherForm />} />
            <Route path="/bank-vouchers/revenue/new" element={<RevenueEntryForm />} />
            <Route path="/bank-vouchers/expense/new" element={<ExpenseEntryForm />} />
            <Route path="/bank-vouchers/transfer/new" element={<TransferForm />} />
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
              <PermissionGuard requiredPerms={['POST_JOURNAL']}>
                <JournalEntries />
              </PermissionGuard>
            } />
            <Route path="/audit" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS', 'MANAGE_USERS']}>
                <AuditTrail />
              </PermissionGuard>
            } />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/account" element={<MyAccount />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-4">
                  <span className="text-3xl">🔍</span>
                </div>
                <h3 className="text-base font-bold text-slate-200">Page not found</h3>
                <p className="text-sm text-slate-500 mt-2">This page doesn't exist. Go back and try again.</p>
              </div>
            } />
          </Route>
        </Routes>
        </Suspense>
        </ChunkErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App;

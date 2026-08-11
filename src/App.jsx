import React, { useState, lazy, Suspense, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { SplashScreen } from './components/common/SplashScreen';
import { Sidebar } from './components/common/Sidebar';
import { Topbar } from './components/common/Topbar';
import { useAuthStore } from './store/authStore';
import { ToastContainer } from './components/ui/Toast';
import { UpdateBanner } from './components/common/UpdateBanner';

// Lazy-loaded views for code splitting
// ConfirmationModal pulls in framer-motion (a sizable dependency); it's always
// mounted but only ever visually renders after a user action, so it's split
// out of the eager main bundle the same way the routes below are.
const ConfirmationModal = lazy(() => import('./components/ui/ConfirmationModal').then(m => ({ default: m.ConfirmationModal })));
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const ChartOfAccounts = lazy(() => import('./views/ChartOfAccounts').then(m => ({ default: m.ChartOfAccounts })));
const GeneralLedger = lazy(() => import('./views/GeneralLedger').then(m => ({ default: m.GeneralLedger })));
const JournalEntries = lazy(() => import('./views/JournalEntries').then(m => ({ default: m.JournalEntries })));
const AuditTrail = lazy(() => import('./views/AuditTrail').then(m => ({ default: m.AuditTrail })));
const Settings = lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const AccountingHealthCheck = lazy(() => import('./views/AccountingHealthCheck').then(m => ({ default: m.AccountingHealthCheck })));
const Profile = lazy(() => import('./views/Profile').then(m => ({ default: m.Profile })));
const MyAccount = lazy(() => import('./views/MyAccount').then(m => ({ default: m.MyAccount })));
const RevenueHeads = lazy(() => import('./views/RevenueHeads').then(m => ({ default: m.RevenueHeads })));
const IncomeCategoryMapping = lazy(() => import('./views/IncomeCategoryMapping').then(m => ({ default: m.IncomeCategoryMapping })));
const ExpenseHeads = lazy(() => import('./views/ExpenseHeads').then(m => ({ default: m.ExpenseHeads })));
const ReservedCodes = lazy(() => import('./views/ReservedCodes').then(m => ({ default: m.ReservedCodes })));
const UsersRoles = lazy(() => import('./views/UsersRoles').then(m => ({ default: m.UsersRoles })));
const Reports = lazy(() => import('./views/Reports').then(m => ({ default: m.Reports })));
const TrialBalanceSheet = lazy(() => import('./views/TrialBalanceSheet').then(m => ({ default: m.TrialBalanceSheet })));
const HallBookings = lazy(() => import('./views/HallBookings').then(m => ({ default: m.HallBookings })));
const HallBookingForm = lazy(() => import('./views/HallBookingForm').then(m => ({ default: m.HallBookingForm })));
const OpeningBalances = lazy(() => import('./views/OpeningBalances').then(m => ({ default: m.OpeningBalances })));
const YearEndClosing = lazy(() => import('./views/YearEndClosing').then(m => ({ default: m.YearEndClosing })));

// Donation Module Views
const Beneficiaries = lazy(() => import('./views/Beneficiaries').then(m => ({ default: m.Beneficiaries })));
const BeneficiaryForm = lazy(() => import('./views/BeneficiaryForm').then(m => ({ default: m.BeneficiaryForm })));
const Donations = lazy(() => import('./views/Donations').then(m => ({ default: m.Donations })));
const DonationForm = lazy(() => import('./views/DonationForm').then(m => ({ default: m.DonationForm })));
const Donors = lazy(() => import('./views/Donors').then(m => ({ default: m.Donors })));
const DonationsReceived = lazy(() => import('./views/DonationsReceived').then(m => ({ default: m.DonationsReceived })));
const DonationReports = lazy(() => import('./views/DonationReports').then(m => ({ default: m.DonationReports })));
const Invoices = lazy(() => import('./views/Invoices').then(m => ({ default: m.Invoices })));

// Operation Module Views
const AddIncome = lazy(() => import('./views/AddIncome').then(m => ({ default: m.AddIncome })));
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
const CustomerForm = lazy(() => import('./views/CustomerForm').then(m => ({ default: m.CustomerForm })));
const InvoiceForm = lazy(() => import('./views/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceDetail = lazy(() => import('./views/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const Members = lazy(() => import('./views/Members').then(m => ({ default: m.Members })));
const MemberDetails = lazy(() => import('./views/MemberDetails').then(m => ({ default: m.MemberDetails })));
const MemberForm = lazy(() => import('./views/MemberForm').then(m => ({ default: m.MemberForm })));
const MembershipCards = lazy(() => import('./views/MembershipCards').then(m => ({ default: m.MembershipCards })));
const ZakatCards = lazy(() => import('./views/ZakatCards').then(m => ({ default: m.ZakatCards })));
const MemberVerify = lazy(() => import('./views/MemberVerify').then(m => ({ default: m.MemberVerify })));
const ZakatCardVerify = lazy(() => import('./views/ZakatCardVerify'));

// Bank Voucher Module Views
const BankVouchers = lazy(() => import('./views/BankVouchers').then(m => ({ default: m.BankVouchers })));
const BankVoucherForm = lazy(() => import('./views/BankVoucherForm').then(m => ({ default: m.BankVoucherForm })));
const RevenueEntryForm = lazy(() => import('./views/RevenueEntryForm').then(m => ({ default: m.RevenueEntryForm })));
const ExpenseEntryForm = lazy(() => import('./views/ExpenseEntryForm').then(m => ({ default: m.ExpenseEntryForm })));
const TransferForm = lazy(() => import('./views/TransferForm').then(m => ({ default: m.TransferForm })));
const PettyCash = lazy(() => import('./views/PettyCash').then(m => ({ default: m.PettyCash })));

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
  const [splashDone, setSplashDone] = useState(() => typeof window !== 'undefined' && !!window.navigator.webdriver);
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
    <>
      {/* Global toast notifications — replaces all alert() calls */}
      <ToastContainer />

      {/* Desktop-only: background update download / restart-to-install prompt */}
      <UpdateBanner />
      
      {/* Global confirmation & alert modals */}
      <Suspense fallback={null}>
        <ConfirmationModal />
      </Suspense>

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

          {/* Public Member Verification — no auth required (QR scan target) */}
          <Route path="/member/verify/:id" element={<MemberVerify />} />
          <Route path="/verify/member/:id" element={<MemberVerify />} />
          <Route path="/verify/zakat/:cardNumber" element={<ZakatCardVerify />} />

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
            <Route path="/income-category-mapping" element={
              <PermissionGuard requiredPerms={['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT']}>
                <IncomeCategoryMapping />
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
            <Route path="/financial-year-closing" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <YearEndClosing />
              </PermissionGuard>
            } />
            <Route path="/add-income" element={<AddIncome />} />
            <Route path="/add-income/new" element={<AddIncome />} />
            <Route path="/add-income/edit/:id" element={<AddIncome />} />
            <Route path="/add-income/records" element={<AddIncome />} />
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
            <Route path="/petty-cash" element={<PettyCash />} />
            <Route path="/trial-balance-sheet" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS']}>
                <TrialBalanceSheet />
              </PermissionGuard>
            } />
            <Route path="/hall-bookings" element={<HallBookings />} />
            <Route path="/hall-bookings/new" element={<HallBookingForm />} />
            <Route path="/hall-bookings/edit/:id" element={<HallBookingForm />} />
            <Route path="/beneficiaries" element={<Beneficiaries />} />
            <Route path="/beneficiaries/new" element={<BeneficiaryForm />} />
            <Route path="/beneficiaries/edit/:id" element={<BeneficiaryForm />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/donations/new" element={<DonationForm />} />
            <Route path="/donations/edit/:id" element={<DonationForm />} />
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
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/edit/:id" element={<CustomerForm />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/new" element={<MemberForm />} />
            <Route path="/members/edit/:id" element={<MemberForm />} />
            <Route path="/members/:id" element={<MemberDetails />} />
            <Route path="/membership-cards" element={<MembershipCards />} />
            <Route path="/zakat-cards" element={<ZakatCards />} />
            <Route path="/invoices" element={
              <PermissionGuard requiredPerms={['VIEW_INVOICES']}>
                <Invoices />
              </PermissionGuard>
            } />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/edit/:id" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/bank-vouchers" element={<BankVouchers />} />
            <Route path="/opening-balances" element={
              <PermissionGuard requiredPerms={['POST_JOURNAL']}>
                <OpeningBalances />
              </PermissionGuard>
            } />
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
            <Route path="/accounting-health" element={
              <PermissionGuard requiredPerms={['VIEW_REPORTS', 'MANAGE_USERS']}>
                <AccountingHealthCheck />
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
    </>
  );
}

export default App;

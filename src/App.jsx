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
const MonthlyDonationCards = lazy(() => import('./views/MonthlyDonationCards').then(m => ({ default: m.MonthlyDonationCards })));
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

import { RouteGuard } from './components/common/RouteGuard';

const PermissionGuard = ({ requiredPerms, module, action = 'view', children }) => {
  return <RouteGuard module={module} action={action} requiredPerms={requiredPerms}>{children}</RouteGuard>;
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
          <Route path="/health" element={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400 font-mono text-sm">OK</div>} />

          {/* Public Member Verification — no auth required (QR scan target) */}
          <Route path="/member/verify/:id" element={<MemberVerify />} />
          <Route path="/verify/member/:id" element={<MemberVerify />} />
          <Route path="/verify/zakat/:cardNumber" element={<ZakatCardVerify />} />

          {/* Secure ERP Interface */}
          <Route element={<ProtectedRoutesWrapper />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coa" element={
              <RouteGuard module="coa">
                <ChartOfAccounts />
              </RouteGuard>
            } />
            <Route path="/revenue-heads" element={
              <RouteGuard module="revenue">
                <RevenueHeads />
              </RouteGuard>
            } />
            <Route path="/income-category-mapping" element={
              <RouteGuard module="revenue">
                <IncomeCategoryMapping />
              </RouteGuard>
            } />
            <Route path="/expense-heads" element={
              <RouteGuard module="expenses">
                <ExpenseHeads />
              </RouteGuard>
            } />
            <Route path="/reserved" element={
              <RouteGuard module="settings">
                <ReservedCodes />
              </RouteGuard>
            } />
            <Route path="/reports" element={
              <RouteGuard module="reports">
                <Reports />
              </RouteGuard>
            } />
            <Route path="/financial-year-closing" element={
              <RouteGuard module="reports">
                <YearEndClosing />
              </RouteGuard>
            } />
            <Route path="/add-income" element={
              <RouteGuard module="revenue">
                <AddIncome />
              </RouteGuard>
            } />
            <Route path="/add-income/new" element={
              <RouteGuard module="revenue" action="create">
                <AddIncome />
              </RouteGuard>
            } />
            <Route path="/add-income/edit/:id" element={
              <RouteGuard module="revenue" action="update">
                <AddIncome />
              </RouteGuard>
            } />
            <Route path="/add-income/records" element={
              <RouteGuard module="revenue">
                <AddIncome />
              </RouteGuard>
            } />
            <Route path="/income" element={
              <RouteGuard module="revenue">
                <Income />
              </RouteGuard>
            } />
            <Route path="/expenses" element={
              <RouteGuard module="expenses">
                <Expenses />
              </RouteGuard>
            } />
            <Route path="/petty-cash" element={
              <RouteGuard module="expenses">
                <PettyCash />
              </RouteGuard>
            } />
            <Route path="/trial-balance-sheet" element={
              <RouteGuard module="reports">
                <TrialBalanceSheet />
              </RouteGuard>
            } />
            <Route path="/hall-bookings" element={
              <RouteGuard module="hallBookings">
                <HallBookings />
              </RouteGuard>
            } />
            <Route path="/hall-bookings/new" element={
              <RouteGuard module="hallBookings" action="create">
                <HallBookingForm />
              </RouteGuard>
            } />
            <Route path="/hall-bookings/edit/:id" element={
              <RouteGuard module="hallBookings" action="update">
                <HallBookingForm />
              </RouteGuard>
            } />
            <Route path="/beneficiaries" element={
              <RouteGuard module="beneficiaries">
                <Beneficiaries />
              </RouteGuard>
            } />
            <Route path="/beneficiaries/new" element={
              <RouteGuard module="beneficiaries" action="create">
                <BeneficiaryForm />
              </RouteGuard>
            } />
            <Route path="/beneficiaries/edit/:id" element={
              <RouteGuard module="beneficiaries" action="update">
                <BeneficiaryForm />
              </RouteGuard>
            } />
            <Route path="/donation-distribution" element={
              <RouteGuard module="donations">
                <Donations />
              </RouteGuard>
            } />
            <Route path="/donation-distribution/new" element={
              <RouteGuard module="donations" action="create">
                <DonationForm />
              </RouteGuard>
            } />
            <Route path="/donation-distribution/edit/:id" element={
              <RouteGuard module="donations" action="update">
                <DonationForm />
              </RouteGuard>
            } />
            <Route path="/donations" element={
              <RouteGuard module="donations">
                <Donations />
              </RouteGuard>
            } />
            <Route path="/donations/new" element={
              <RouteGuard module="donations" action="create">
                <DonationForm />
              </RouteGuard>
            } />
            <Route path="/donations/edit/:id" element={
              <RouteGuard module="donations" action="update">
                <DonationForm />
              </RouteGuard>
            } />
            <Route path="/donors" element={
              <RouteGuard module="donors">
                <Donors />
              </RouteGuard>
            } />
            <Route path="/donors/new" element={
              <RouteGuard module="donors" action="create">
                <DonorForm />
              </RouteGuard>
            } />
            <Route path="/donors/edit/:id" element={
              <RouteGuard module="donors" action="update">
                <DonorForm />
              </RouteGuard>
            } />
            <Route path="/donations-received" element={
              <RouteGuard module="revenueCollections">
                <DonationsReceived />
              </RouteGuard>
            } />
            <Route path="/monthly-donations" element={
              <RouteGuard module="revenueCollections">
                <DonationsReceived defaultType="MONTHLY" titleOverride="Monthly Donations (Inflow)" />
              </RouteGuard>
            } />
            <Route path="/general-donations" element={
              <RouteGuard module="revenueCollections">
                <DonationsReceived defaultType="GENERAL_DONATION" titleOverride="General & Other Donations (Inflow)" />
              </RouteGuard>
            } />
            <Route path="/donations-received/new" element={
              <RouteGuard module="revenueCollections" action="create">
                <DonationReceiptForm />
              </RouteGuard>
            } />
            <Route path="/donations-received/edit/:id" element={
              <RouteGuard module="revenueCollections" action="update">
                <DonationReceiptForm />
              </RouteGuard>
            } />
            <Route path="/donation-reports" element={
              <RouteGuard module="reports">
                <DonationReports />
              </RouteGuard>
            } />
            <Route path="/membership-fees" element={
              <RouteGuard module="revenueCollections">
                <MembershipFeeSection />
              </RouteGuard>
            } />
            <Route path="/membership-fees/new" element={
              <RouteGuard module="revenueCollections" action="create">
                <SpecializedRevenueForm category="Membership Fee" title="Membership Fee Collection" desc="Manage member fee contributions and annual renewals" titleLabel="Member Name" subTitleLabel="Membership ID / CNIC" dateLabel="Fee Date" showRate={true} rateLabel="Fee Rate" backPath="/membership-fees" />
              </RouteGuard>
            } />
            <Route path="/membership-fees/edit/:id" element={
              <RouteGuard module="revenueCollections" action="update">
                <SpecializedRevenueForm category="Membership Fee" title="Membership Fee Collection" desc="Manage member fee contributions and annual renewals" titleLabel="Member Name" subTitleLabel="Membership ID / CNIC" dateLabel="Fee Date" showRate={true} rateLabel="Fee Rate" backPath="/membership-fees" />
              </RouteGuard>
            } />
            <Route path="/bus-bookings" element={
              <RouteGuard module="revenueCollections">
                <BusBookingSection />
              </RouteGuard>
            } />
            <Route path="/bus-bookings/new" element={
              <RouteGuard module="revenueCollections" action="create">
                <SpecializedRevenueForm category="Bus Booking" title="Bus Booking Receipt" desc="Manage Jamia bus reservations, trip schedules, and ledger receipts" titleLabel="Booker Name" subTitleLabel="Bus / Vehicle Number" dateLabel="Trip Date" showDest={true} destLabel="Trip Destination" backPath="/bus-bookings" />
              </RouteGuard>
            } />
            <Route path="/bus-bookings/edit/:id" element={
              <RouteGuard module="revenueCollections" action="update">
                <SpecializedRevenueForm category="Bus Booking" title="Bus Booking Receipt" desc="Manage Jamia bus reservations, trip schedules, and ledger receipts" titleLabel="Booker Name" subTitleLabel="Bus / Vehicle Number" dateLabel="Trip Date" showDest={true} destLabel="Trip Destination" backPath="/bus-bookings" />
              </RouteGuard>
            } />
            <Route path="/zakat" element={
              <RouteGuard module="zakat">
                <ZakatSection />
              </RouteGuard>
            } />
            <Route path="/zakat/new" element={
              <RouteGuard module="zakat" action="create">
                <SpecializedRevenueForm category="Zakat" title="Zakat Collection" desc="Manage Zakat contributions, donor records, and ledger postings" titleLabel="Donor Name" subTitleLabel="CNIC / ID" dateLabel="Collection Date" backPath="/zakat" />
              </RouteGuard>
            } />
            <Route path="/zakat/edit/:id" element={
              <RouteGuard module="zakat" action="update">
                <SpecializedRevenueForm category="Zakat" title="Zakat Collection" desc="Manage Zakat contributions, donor records, and ledger postings" titleLabel="Donor Name" subTitleLabel="CNIC / ID" dateLabel="Collection Date" backPath="/zakat" />
              </RouteGuard>
            } />
            <Route path="/fitra" element={
              <RouteGuard module="revenueCollections">
                <FitraSection />
              </RouteGuard>
            } />
            <Route path="/fitra/new" element={
              <RouteGuard module="revenueCollections" action="create">
                <SpecializedRevenueForm category="Fitra" title="Fitra Collection" desc="Manage Eid Fitra collections and head-counts" titleLabel="Donor Name" subTitleLabel={null} dateLabel="Collection Date" showQty={true} qtyLabel="Head Count" showRate={true} rateLabel="Rate per Head" backPath="/fitra" />
              </RouteGuard>
            } />
            <Route path="/fitra/edit/:id" element={
              <RouteGuard module="revenueCollections" action="update">
                <SpecializedRevenueForm category="Fitra" title="Fitra Collection" desc="Manage Eid Fitra collections and head-counts" titleLabel="Donor Name" subTitleLabel={null} dateLabel="Collection Date" showQty={true} qtyLabel="Head Count" showRate={true} rateLabel="Rate per Head" backPath="/fitra" />
              </RouteGuard>
            } />
            <Route path="/customers" element={
              <RouteGuard module="customers">
                <Customers />
              </RouteGuard>
            } />
            <Route path="/customers/new" element={
              <RouteGuard module="customers" action="create">
                <CustomerForm />
              </RouteGuard>
            } />
            <Route path="/customers/edit/:id" element={
              <RouteGuard module="customers" action="update">
                <CustomerForm />
              </RouteGuard>
            } />
            <Route path="/members" element={
              <RouteGuard module="members">
                <Members />
              </RouteGuard>
            } />
            <Route path="/members/new" element={
              <RouteGuard module="members" action="create">
                <MemberForm />
              </RouteGuard>
            } />
            <Route path="/members/edit/:id" element={
              <RouteGuard module="members" action="update">
                <MemberForm />
              </RouteGuard>
            } />
            <Route path="/members/:id" element={
              <RouteGuard module="members">
                <MemberDetails />
              </RouteGuard>
            } />
            <Route path="/membership-cards" element={
              <RouteGuard module="membership">
                <MembershipCards />
              </RouteGuard>
            } />
            <Route path="/zakat-cards" element={
              <RouteGuard module="zakatCards">
                <ZakatCards />
              </RouteGuard>
            } />
            <Route path="/monthly-donation-cards" element={
              <RouteGuard module="zakatCards">
                <MonthlyDonationCards />
              </RouteGuard>
            } />
            <Route path="/invoices" element={
              <RouteGuard module="invoices">
                <Invoices />
              </RouteGuard>
            } />
            <Route path="/invoices/new" element={
              <RouteGuard module="invoices" action="create">
                <InvoiceForm />
              </RouteGuard>
            } />
            <Route path="/invoices/edit/:id" element={
              <RouteGuard module="invoices" action="update">
                <InvoiceForm />
              </RouteGuard>
            } />
            <Route path="/invoices/:id" element={
              <RouteGuard module="invoices">
                <InvoiceDetail />
              </RouteGuard>
            } />
            <Route path="/bank-vouchers" element={
              <RouteGuard module="expenses">
                <BankVouchers />
              </RouteGuard>
            } />
            <Route path="/opening-balances" element={
              <RouteGuard module="openingBalances">
                <OpeningBalances />
              </RouteGuard>
            } />
            <Route path="/bank-vouchers/new" element={
              <RouteGuard module="expenses" action="create">
                <BankVoucherForm />
              </RouteGuard>
            } />
            <Route path="/bank-vouchers/revenue/new" element={
              <RouteGuard module="revenue" action="create">
                <RevenueEntryForm />
              </RouteGuard>
            } />
            <Route path="/bank-vouchers/expense/new" element={
              <RouteGuard module="expenses" action="create">
                <ExpenseEntryForm />
              </RouteGuard>
            } />
            <Route path="/bank-vouchers/transfer/new" element={
              <RouteGuard module="expenses" action="create">
                <TransferForm />
              </RouteGuard>
            } />
            <Route path="/users-roles" element={
              <RouteGuard module="roles">
                <UsersRoles />
              </RouteGuard>
            } />
            <Route path="/ledger" element={
              <RouteGuard module="generalLedger">
                <GeneralLedger />
              </RouteGuard>
            } />
            <Route path="/journals" element={
              <RouteGuard module="journalEntries">
                <JournalEntries />
              </RouteGuard>
            } />
            <Route path="/audit" element={
              <RouteGuard module="audit">
                <AuditTrail />
              </RouteGuard>
            } />
            <Route path="/accounting-health" element={
              <RouteGuard module="audit">
                <AccountingHealthCheck />
              </RouteGuard>
            } />

            <Route path="/settings" element={
              <RouteGuard module="settings">
                <Settings />
              </RouteGuard>
            } />
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

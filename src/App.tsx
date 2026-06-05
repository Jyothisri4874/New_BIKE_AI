import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { CustomerAuthContext, useCustomerAuthProvider } from './hooks/useCustomerAuth'
import { DealerAuthContext, useDealerAuthProvider } from './hooks/useDealerAuth'

// ── ADMIN ──────────────────────────────────────────────────────────────────────
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DealersPage from './pages/DealersPage'
import DealerDetailPage from './pages/DealerDetailPage'
import UsersPage from './pages/UsersPage'
import BookingsPage from './pages/BookingsPage'
import BookingWizardPage from './pages/BookingWizardPage'
import VehiclesPage from './pages/VehiclesPage'
import SettingsPage from './pages/SettingsPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import CustomerFormPage from './pages/CustomerFormPage'
import LiveOpsPage from './pages/LiveOpsPage'
import JobDetailPage from './pages/JobDetailPage'
import NewJobPage from './pages/NewJobPage'
import RSAPage from './pages/RSAPage'
import VehicleSearchPage from './pages/VehicleSearchPage'

// ── PUBLIC ──────────────────────────────────────────────────────────────────────
import LandingPage from './pages/LandingPage'
import ForDealersPage from './dealer/ForDealersPage'
import WipCustomerTrackingPage from './pages/WipCustomerTrackingPage'

// ── CUSTOMER PORTAL ────────────────────────────────────────────────────────────
import CustomerLayout from './customer/CustomerLayout'
import CustomerAuthPage from './customer/CustomerAuthPage'
import CustomerDashboardPage from './customer/CustomerDashboardPage'
import GaragePage from './customer/GaragePage'
import AddVehiclePage from './customer/AddVehiclePage'
import CustomerBookingWizardPage from './customer/BookingWizardPage'
import CustomerBookingsPage from './customer/BookingsPage'
import BookingDetailPage from './customer/BookingDetailPage'
import CustomerSettingsPage from './customer/CustomerSettingsPage'
import CustomerSupportPage from './customer/CustomerSupportPage'
import SelfServicePage from './customer/SelfServicePage'

// ── DEALER PORTAL ──────────────────────────────────────────────────────────────
import DealerAuthPage from './dealer/DealerAuthPage'
import DealerLayout from './dealer/DealerLayout'
import DealerDashboardPage from './dealer/DealerDashboardPage'
import DealerPlaceholderPage from './dealer/DealerPlaceholderPage'
import DealerConnectedEmptyStatePage from './dealer/DealerConnectedEmptyStatePage'
import CRMDashboardPage from './dealer/CRMDashboardPage'
import ServiceManagerDashboardPage from './dealer/ServiceManagerDashboardPage'
import WipWorkflowPage from './dealer/WipWorkflowPage'
import ServiceDueUploadPage from './dealer/ServiceDueUploadPage'
import { Calendar, Wrench, Users, Package, ChartBar as BarChart2, Circle as HelpCircle, Settings } from 'lucide-react'

export default function App() {
  const auth = useAuthProvider()
  const customerAuth = useCustomerAuthProvider()
  const dealerAuth = useDealerAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <CustomerAuthContext.Provider value={customerAuth}>
        <DealerAuthContext.Provider value={dealerAuth}>
          <BrowserRouter>
            <Routes>
              {/* ── PUBLIC ── */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/for-dealers" element={<ForDealersPage />} />
              <Route path="/track/:token" element={<SelfServicePage mode="track" />} />
              <Route path="/service/track/:trackingCode" element={<WipCustomerTrackingPage />} />
              <Route path="/approval/:token" element={<SelfServicePage mode="approval" />} />
              <Route path="/feedback/:token" element={<SelfServicePage mode="feedback" />} />
              <Route
                path="/customer/book/:token"
                element={
                  <ProtectedCustomerRoute customerAuth={customerAuth}>
                    <CustomerBookingWizardPage />
                  </ProtectedCustomerRoute>
                }
              />

              {/* ── ADMIN ── */}
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute auth={auth}>
                    <AdminLayout />
                  </ProtectedAdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="dealers" element={<DealersPage />} />
                <Route path="dealers/:id" element={<DealerDetailPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="bookings/new" element={<BookingWizardPage />} />
                <Route path="vehicles" element={<VehiclesPage />} />
                <Route path="search" element={<VehicleSearchPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/new" element={<CustomerFormPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="customers/:id/edit" element={<CustomerFormPage />} />
                <Route path="live-ops" element={<LiveOpsPage />} />
                <Route path="live-ops/job/:id" element={<JobDetailPage />} />
                <Route path="live-ops/new-job" element={<NewJobPage />} />
                <Route path="rsa" element={<RSAPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* ── CUSTOMER PORTAL ── */}
              <Route path="/my/auth" element={<CustomerAuthPage />} />
              <Route
                path="/my"
                element={
                  <ProtectedCustomerRoute customerAuth={customerAuth}>
                    <CustomerLayout />
                  </ProtectedCustomerRoute>
                }
              >
                <Route index element={<Navigate to="/my/dashboard" replace />} />
                <Route path="dashboard" element={<CustomerDashboardPage />} />
                <Route path="garage" element={<GaragePage />} />
                <Route path="garage/add" element={<AddVehiclePage />} />
                <Route path="garage/:id" element={<GaragePage />} />
                <Route path="book" element={<CustomerBookingWizardPage />} />
                <Route path="bookings" element={<CustomerBookingsPage />} />
                <Route path="bookings/:id" element={<BookingDetailPage />} />
                <Route path="settings" element={<CustomerSettingsPage />} />
                <Route path="support" element={<CustomerSupportPage />} />
              </Route>

              {/* ── DEALER PORTAL ── */}
              <Route path="/dealer/auth" element={<DealerAuthPage />} />
              <Route
                path="/dealer"
                element={
                  <ProtectedDealerRoute dealerAuth={dealerAuth}>
                    <DealerLayout />
                  </ProtectedDealerRoute>
                }
              >
                <Route index element={<Navigate to="/dealer/dashboard" replace />} />
                <Route path="dashboard" element={<DealerDashboardPage />} />
                <Route path="bookings" element={<DealerPlaceholderPage title="Bookings" description="Manage all service bookings, confirmations, and scheduling from one place." icon={Calendar} color="#3B82F6" />} />
                <Route path="bookings/new" element={<DealerPlaceholderPage title="New Booking" description="Create a new service booking for a walk-in or scheduled customer." icon={Calendar} color="#3B82F6" />} />
                <Route path="queue" element={<ServiceManagerDashboardPage />} />
                <Route path="wip" element={<WipWorkflowPage />} />
                <Route path="queue/new" element={<DealerPlaceholderPage title="New Job Card" description="Create a new job card for a vehicle entering the workshop." icon={Wrench} color="#FFD600" />} />
                <Route path="customers" element={<DealerConnectedEmptyStatePage moduleKey="customers" />} />
                <Route path="customers/new" element={<DealerPlaceholderPage title="Add Customer" description="Register a new customer and link their vehicle to the workshop." icon={Users} color="#10B981" />} />
                <Route path="vehicles" element={<DealerConnectedEmptyStatePage moduleKey="vehicles" />} />
                <Route path="technicians" element={<DealerConnectedEmptyStatePage moduleKey="technicians" />} />
                <Route path="riders" element={<DealerConnectedEmptyStatePage moduleKey="riders" />} />
                <Route path="inventory" element={<DealerPlaceholderPage title="Inventory" description="Parts stock management, low-stock alerts, reorder automation, and supplier management." icon={Package} color="#F59E0B" />} />
                <Route path="billing" element={<DealerConnectedEmptyStatePage moduleKey="billing" />} />
                <Route path="crm" element={<CRMDashboardPage />} />
                <Route path="crm/service-due-upload" element={<ServiceDueUploadPage />} />
                <Route path="service-manager" element={<ServiceManagerDashboardPage />} />
                <Route path="analytics" element={<DealerPlaceholderPage title="Analytics" description="Revenue trends, technician productivity, customer retention metrics, and growth reports." icon={BarChart2} color="#3B82F6" />} />
                <Route path="support" element={<DealerPlaceholderPage title="Support" description="Raise support tickets, access documentation, and chat with the BikeAI partner team." icon={HelpCircle} color="#6B7280" />} />
                <Route path="settings" element={<DealerPlaceholderPage title="Settings" description="Workshop profile, operating hours, service catalog, pricing, and notification preferences." icon={Settings} color="#6B7280" />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </DealerAuthContext.Provider>
      </CustomerAuthContext.Provider>
    </AuthContext.Provider>
  )
}

// ── GUARDS ─────────────────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: '#6b7280', fontSize: '13px' }}>Loading BikeAI...</span>
    </div>
  )
}

function AccessDenied({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '14px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: '40px' }}>🔒</div>
      <h2 style={{ color: '#1f2937', margin: 0 }}>Access Denied</h2>
      <p style={{ color: '#6b7280', margin: 0 }}>You don't have permission to access this area.</p>
      <button onClick={onSignOut} style={{ padding: '8px 18px', background: '#0B1F4D', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>
        Sign Out
      </button>
    </div>
  )
}

function ProtectedAdminRoute({ auth, children }: { auth: ReturnType<typeof useAuthProvider>; children: React.ReactNode }) {
  if (auth.loading) return <Spinner color="#3b82f6" />
  if (!auth.user) return <Navigate to="/login" replace />
  if (!auth.profile || auth.profile.role !== 'admin') return <AccessDenied onSignOut={() => auth.signOut()} />
  return <>{children}</>
}

function ProtectedCustomerRoute({ customerAuth, children }: { customerAuth: ReturnType<typeof useCustomerAuthProvider>; children: React.ReactNode }) {
  const location = useLocation()
  if (customerAuth.loading) return <Spinner color="#FFD600" />
  if (!customerAuth.user) return <Navigate to="/my/auth" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (!customerAuth.profile || customerAuth.profile.role !== 'customer') return <AccessDenied onSignOut={() => customerAuth.signOut()} />
  return <>{children}</>
}

function ProtectedDealerRoute({ dealerAuth, children }: { dealerAuth: ReturnType<typeof useDealerAuthProvider>; children: React.ReactNode }) {
  if (dealerAuth.loading) return <Spinner color="#FFD600" />
  if (!dealerAuth.user) return <Navigate to="/dealer/auth" replace />
  if (!dealerAuth.profile || !['dealer', 'admin', 'crm', 'service_manager'].includes(dealerAuth.profile.role)) {
    return <AccessDenied onSignOut={() => dealerAuth.signOut()} />
  }
  return <>{children}</>
}

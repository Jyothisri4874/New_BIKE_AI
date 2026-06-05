import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { LayoutDashboard, Calendar, Wrench, ClipboardList, Users, Car, UserCheck, Truck, Package, CreditCard, ChartBar as BarChart2, Settings, Circle as HelpCircle, Menu, X, ChevronLeft, Bell, LogOut, MessageSquare, Zap } from 'lucide-react'
import AIChatWidget from '../components/AIChatWidget'
import { safeGet } from '../lib/api'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dealer/dashboard' },
  { icon: Calendar, label: 'Bookings', path: '/dealer/bookings' },
  { icon: Wrench, label: 'Service Queue', path: '/dealer/queue' },
  { icon: ClipboardList, label: 'WIP Tracking', path: '/dealer/wip' },
  { icon: Users, label: 'Customers', path: '/dealer/customers' },
  { icon: Car, label: 'Vehicles', path: '/dealer/vehicles' },
  { icon: UserCheck, label: 'Technicians', path: '/dealer/technicians' },
  { icon: Truck, label: 'Pickup Riders', path: '/dealer/riders' },
  { icon: Package, label: 'Inventory', path: '/dealer/inventory' },
  { icon: CreditCard, label: 'Billing', path: '/dealer/billing' },
  { icon: MessageSquare, label: 'CRM', path: '/dealer/crm' },
  { icon: BarChart2, label: 'Analytics', path: '/dealer/analytics' },
  { icon: HelpCircle, label: 'Support', path: '/dealer/support' },
  { icon: Settings, label: 'Settings', path: '/dealer/settings' },
]

interface DealerNotification {
  id: string
  subject: string | null
  body: string
  channel: string
  status: string
  created_at: string
}

export default function DealerLayout() {
  const { user, profile, signOut } = useDealerAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<DealerNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 900
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [user?.id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/dealer/auth')
  }

  const collapsed = !sidebarOpen && !isMobile
  const activeNotificationCount = notifications.filter(item => ['pending', 'queued', 'failed'].includes(item.status)).length

  const loadNotifications = async () => {
    if (!user) return
    setNotificationsLoading(true)
    setNotificationsError('')
    const { center, error } = await resolveDealerServiceCenter(user, 'id,name,city')
    if (error || !center) {
      setNotifications([])
      setNotificationsError(error || 'No linked workshop notifications yet.')
      setNotificationsLoading(false)
      return
    }

    // TODO: Confirm backend endpoint for dealer notification queue.
    const data = await safeGet<DealerNotification[]>(
      `/api/notifications?serviceCenterId=${encodeURIComponent(center.id)}&limit=8`,
      [],
    )
    setNotifications((data || []) as DealerNotification[])
    setNotificationsError('')
    setNotificationsLoading(false)
  }

  const toggleNotifications = async () => {
    const next = !notificationsOpen
    setNotificationsOpen(next)
    if (next) await loadNotifications()
  }

  return (
    <div style={dl.root}>
      <style>{`
        @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        .dl-nav-item:hover { background: rgba(255,255,255,0.07) !important; }
        .dl-nav-item.active { background: rgba(255,214,0,0.12) !important; border-color: rgba(255,214,0,0.3) !important; }
        .dl-nav-item.active span { color: #FFD600 !important; }
        .dl-nav-item.active svg { color: #FFD600 !important; }
        .dl-signout:hover { background: rgba(239,68,68,0.12) !important; color: #fca5a5 !important; }
      `}</style>

      {/* Mobile overlay */}
      {isMobile && mobileSidebarOpen && (
        <div style={dl.overlay} onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{
        ...dl.sidebar,
        width: collapsed ? '64px' : '240px',
        transform: isMobile ? (mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        animation: isMobile && mobileSidebarOpen ? 'slideInLeft 0.22s ease' : 'none',
      }}>
        {/* Logo */}
        <div style={{ ...dl.sidebarLogo, justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <Link to="/dealer/dashboard" style={dl.logoLink}>
              <div style={dl.logoMark}><img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={dl.logoImg} /></div>
              <div>
                <div style={dl.logoText}>Bike<span style={{ color: '#FFD600' }}>AI</span></div>
                <div style={dl.logoBadge}>Dealer Portal</div>
              </div>
            </Link>
          )}
          {!isMobile && (
            <button style={dl.collapseBtn} onClick={() => setSidebarOpen(v => !v)} title={collapsed ? 'Expand' : 'Collapse'}>
              <ChevronLeft size={16} color="rgba(255,255,255,0.5)" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
          {isMobile && (
            <button style={dl.collapseBtn} onClick={() => setMobileSidebarOpen(false)}>
              <X size={16} color="rgba(255,255,255,0.5)" />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav style={dl.nav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path || (item.path !== '/dealer/dashboard' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{ ...dl.navItem, justifyContent: collapsed ? 'center' : 'flex-start' }}
                className={`dl-nav-item${active ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={() => isMobile && setMobileSidebarOpen(false)}
              >
                <item.icon size={17} />
                {!collapsed && <span style={dl.navLabel}>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={dl.sidebarBottom}>
          {!collapsed && profile && (
            <div style={dl.userInfo}>
              <div style={dl.userAvatar}>{(profile.full_name || 'D')[0].toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={dl.userName}>{profile.full_name || 'Dealer'}</div>
                <div style={dl.userRole}>Dealer Account</div>
              </div>
            </div>
          )}
          <button style={{ ...dl.signoutBtn, justifyContent: collapsed ? 'center' : 'flex-start' }} className="dl-signout" onClick={handleSignOut} title="Sign Out">
            <LogOut size={15} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ ...dl.main, marginLeft: isMobile ? 0 : (collapsed ? '64px' : '240px'), transition: 'margin-left 0.22s ease' }}>
        {/* Top header */}
        <header style={dl.topbar}>
          <div style={dl.topbarLeft}>
            {isMobile && (
              <button style={dl.menuBtn} onClick={() => setMobileSidebarOpen(true)}>
                <Menu size={20} color="#0B1F4D" />
              </button>
            )}
            <div style={dl.breadcrumb}>
              {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label || 'Dashboard'}
            </div>
          </div>
          <div style={dl.topbarRight}>
            <div style={dl.notificationWrap}>
              <button style={dl.iconBtn} title="Notifications" onClick={toggleNotifications}>
                <Bell size={18} color="#6B7280" />
                {activeNotificationCount > 0 && <span style={dl.notifDot} />}
              </button>
              {notificationsOpen && (
                <div style={dl.notificationMenu}>
                  <div style={dl.notificationHead}>
                    <strong>Notifications</strong>
                    <button style={dl.notificationRefresh} onClick={loadNotifications} disabled={notificationsLoading}>Refresh</button>
                  </div>
                  {notificationsError && <div style={dl.notificationEmpty}>{notificationsError}</div>}
                  {!notificationsError && notificationsLoading && <div style={dl.notificationEmpty}>Loading notifications...</div>}
                  {!notificationsError && !notificationsLoading && notifications.length === 0 && (
                    <div style={dl.notificationEmpty}>No queued notifications yet.</div>
                  )}
                  {!notificationsError && !notificationsLoading && notifications.map(item => (
                    <div key={item.id} style={dl.notificationItem}>
                      <div style={dl.notificationTitle}>{item.subject || labelize(item.channel)}</div>
                      <div style={dl.notificationBody}>{item.body}</div>
                      <div style={dl.notificationMeta}>{item.channel} | {item.status} | {timeAgo(item.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link to="/" style={dl.customerLink}>
              <Zap size={13} color="#FFD600" /> Customer App
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={dl.content}>
          <Outlet />
        </main>
      </div>

      <AIChatWidget role="dealer" />
    </div>
  )
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return ''
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const dl: Record<string, React.CSSProperties> = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden', background: '#f4f6fb', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 },

  sidebar: { position: 'fixed', top: 0, left: 0, height: '100vh', background: '#0B1F4D', display: 'flex', flexDirection: 'column', zIndex: 200, transition: 'width 0.22s ease', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.07)' },
  sidebarLogo: { display: 'flex', alignItems: 'center', padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, minHeight: '62px', gap: '8px' },
  logoLink: { display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flex: 1, minWidth: 0 },
  logoMark: { width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(255,214,0,0.35)', flexShrink: 0 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoText: { fontSize: '16px', fontWeight: '800', color: 'white', letterSpacing: '-0.2px', lineHeight: 1.2 },
  logoBadge: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500', letterSpacing: '0.03em' },
  collapseBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', flexShrink: 0 },

  nav: { flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: '2px' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '13px', fontWeight: '500', border: '1px solid transparent', transition: 'all 0.12s', whiteSpace: 'nowrap' },
  navLabel: { fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis' },

  sidebarBottom: { padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', marginBottom: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,214,0,0.15)', border: '1.5px solid rgba(255,214,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', color: '#FFD600', flexShrink: 0 },
  userName: { fontSize: '13px', fontWeight: '700', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' },
  signoutBtn: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 10px', background: 'none', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' },

  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topbar: { height: '60px', background: 'white', borderBottom: '1px solid #eaecf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, boxShadow: '0 1px 3px rgba(11,31,77,0.05)' },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  menuBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px' },
  breadcrumb: { fontSize: '16px', fontWeight: '700', color: '#0B1F4D' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  iconBtn: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '8px' },
  notifDot: { position: 'absolute', top: '7px', right: '7px', width: '7px', height: '7px', borderRadius: '50%', background: '#EF4444', border: '1.5px solid white' },
  notificationWrap: { position: 'relative' },
  notificationMenu: { position: 'absolute', top: '40px', right: 0, width: '320px', maxWidth: 'calc(100vw - 32px)', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 18px 40px rgba(15,23,42,0.18)', zIndex: 80, overflow: 'hidden' },
  notificationHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', color: '#0B1F4D' },
  notificationRefresh: { border: 0, background: 'transparent', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  notificationEmpty: { padding: '16px 12px', color: '#64748B', fontSize: '13px' },
  notificationItem: { padding: '10px 12px', borderBottom: '1px solid #F1F5F9' },
  notificationTitle: { fontSize: '13px', fontWeight: 800, color: '#0B1F4D', marginBottom: '3px' },
  notificationBody: { fontSize: '12px', color: '#475569', lineHeight: 1.45, maxHeight: '36px', overflow: 'hidden' },
  notificationMeta: { fontSize: '11px', color: '#94A3B8', marginTop: '5px' },
  customerLink: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.25)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: '#92690a', textDecoration: 'none' },

  content: { flex: 1, overflowY: 'auto', padding: '24px' },
}

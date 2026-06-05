import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, Store, Users, CalendarCheck, Settings, LogOut, ChevronLeft, ChevronRight, Bike, CircleUser as UserCircle, Navigation, Shield, Search } from 'lucide-react'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'LIVE OPS',
    items: [
      { path: '/admin/live-ops', label: 'Live Operations', icon: Navigation },
      { path: '/admin/rsa', label: 'RSA / Breakdown', icon: Shield },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { path: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
      { path: '/admin/customers', label: 'Customers', icon: UserCircle },
      { path: '/admin/vehicles', label: 'Vehicles', icon: Bike },
      { path: '/admin/search', label: 'Vehicle Search', icon: Search },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { path: '/admin/dealers', label: 'Dealers', icon: Store },
      { path: '/admin/users', label: 'Users', icon: Users },
      { path: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={{ ...styles.sidebar, width: open ? '260px' : '72px' }}>
      {/* Logo */}
      <div style={styles.logoArea}>
        <div style={styles.logoImgWrap}>
          <img
            src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg"
            alt="BikeAI"
            style={styles.logoImg}
          />
        </div>
        {open && (
          <div style={styles.logoText}>
            <span style={styles.logoName}>
              Bike<span style={styles.logoAI}>AI</span>
            </span>
            <span style={styles.logoSub}>Admin Portal</span>
          </div>
        )}
        <button onClick={onToggle} style={styles.toggleBtn} title="Toggle sidebar">
          {open ? <ChevronLeft size={14} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.5)" />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {navGroups.map(group => (
          <div key={group.label}>
            {open && <span style={styles.sectionLabel}>{group.label}</span>}
            {group.items.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                title={!open ? label : undefined}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  background: isActive ? 'rgba(245,224,25,0.12)' : 'transparent',
                  color: isActive ? '#f5e019' : 'rgba(255,255,255,0.65)',
                  justifyContent: open ? 'flex-start' : 'center',
                  borderLeft: isActive ? '3px solid #f5e019' : '3px solid transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} color={isActive ? '#f5e019' : 'rgba(255,255,255,0.55)'} />
                    {open && <span style={styles.navLabel}>{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User profile at bottom */}
      <div style={styles.bottomArea}>
        <div style={{ ...styles.profileArea, justifyContent: open ? 'flex-start' : 'center' }}>
          <div style={styles.avatar}>
            {profile?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          {open && (
            <div style={styles.profileInfo}>
              <span style={styles.profileName}>{profile?.full_name || 'Admin User'}</span>
              <span style={styles.profileRole}>Administrator</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          style={{ ...styles.signOutBtn, justifyContent: open ? 'flex-start' : 'center' }}
          title="Sign out"
        >
          <LogOut size={15} color="rgba(255,255,255,0.4)" />
          {open && <span style={styles.signOutText}>Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    background: '#0f2044',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s ease',
    overflow: 'hidden',
    zIndex: 100,
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  logoArea: {
    height: '72px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    gap: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
    background: '#0a1830',
  },
  logoImgWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    overflow: 'hidden',
    flexShrink: 0,
    border: '2px solid rgba(245,224,25,0.3)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  logoName: {
    fontSize: '17px',
    fontWeight: '700',
    color: 'white',
    lineHeight: '1.2',
    letterSpacing: '-0.3px',
  },
  logoAI: {
    color: '#f5e019',
  },
  logoSub: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  toggleBtn: {
    width: '22px',
    height: '22px',
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  nav: {
    flex: 1,
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    overflow: 'auto',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: '0.12em',
    padding: '8px 10px 4px',
    display: 'block',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 10px',
    borderRadius: '0 8px 8px 0',
    fontSize: '13.5px',
    fontWeight: '500',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    marginLeft: '-8px',
    paddingLeft: '13px',
  },
  navLabel: {
    flex: 1,
  },
  bottomArea: {
    padding: '10px 8px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  profileArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #f5e019, #e6d200)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    color: '#0f2044',
    flexShrink: 0,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  profileName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'white',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileRole: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'background 0.15s',
    width: '100%',
  },
  signOutText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
  },
}

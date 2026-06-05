import { Menu, Bell } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import VehicleSearchBar from './VehicleSearchBar'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dealers': 'Dealer Management',
  '/users': 'User Management',
  '/bookings': 'Service Bookings',
  '/vehicles': 'Vehicle Database',
  '/search': 'Vehicle Search',
  '/settings': 'Settings',
  '/live-ops': 'Live Operations',
  '/rsa': 'RSA / Breakdown',
  '/customers': 'Customers',
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { profile } = useAuth()
  const location = useLocation()

  const title = Object.entries(pageTitles).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'BikeAI Admin'

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <button onClick={onMenuClick} style={styles.menuBtn}>
          <Menu size={18} color="#0f2044" />
        </button>
        <div>
          <h1 style={styles.pageTitle}>{title}</h1>
        </div>
      </div>

      <div style={styles.right}>
        <div style={{ width: '260px' }}>
          <VehicleSearchBar variant="header" placeholder="Search bikes, models, specs…" />
        </div>

        <button style={styles.iconBtn}>
          <Bell size={17} color="#4a5270" />
          <span style={styles.notifDot} />
        </button>

        <div style={styles.userChip}>
          <div style={styles.userAvatar}>
            {profile?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Admin'}</span>
            <span style={styles.userRole}>Admin</span>
          </div>
        </div>
      </div>

    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: '64px',
    background: 'white',
    borderBottom: '1px solid #e2e6f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    gap: '16px',
    flexShrink: 0,
    zIndex: 50,
    boxShadow: '0 1px 4px rgba(15,32,68,0.06)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  menuBtn: {
    width: '36px',
    height: '36px',
    background: '#f1f3f8',
    border: '1px solid #e2e6f0',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  pageTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f2044',
    letterSpacing: '-0.2px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    background: '#f8f9fc',
    border: '1px solid #e2e6f0',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: '7px',
    right: '7px',
    width: '8px',
    height: '8px',
    background: '#f5e019',
    borderRadius: '50%',
    border: '1.5px solid white',
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 12px 5px 5px',
    border: '1px solid #e2e6f0',
    borderRadius: '20px',
    cursor: 'pointer',
    background: 'white',
    transition: 'background 0.15s',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, #f5e019, #e6d200)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#0f2044',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: '1.2',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f2044',
  },
  userRole: {
    fontSize: '10px',
    color: '#9aa3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}

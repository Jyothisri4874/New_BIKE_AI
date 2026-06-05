import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import AIChatWidget from '../components/AIChatWidget'
import { useState } from 'react'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div style={styles.wrapper}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div style={{ ...styles.main, marginLeft: sidebarOpen ? '260px' : '72px', transition: 'margin-left 0.25s ease' }}>
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
      <AIChatWidget role="admin" />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#f9fafb',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
}

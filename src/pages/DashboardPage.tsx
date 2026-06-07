import { useEffect, useState } from 'react'
import { Store, Users, CalendarCheck, TrendingUp, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Activity, Bot, Send, Loader } from 'lucide-react'
import {
  api,
  getChatBackupIdentity,
  getChatBackupSessionKey,
  loadChatBackupHistory,
  safeGet,
  saveChatBackupMessage,
  type ChatMessage,
} from "@/lib/api"

interface Stats {
  totalDealers: number
  activeDealers: number
  pendingDealers: number
  totalUsers: number
  totalBookings: number
  pendingBookings: number
  completedBookings: number
  revenueToday: number
}

interface RecentBooking {
  id: string
  service_type: string
  status: string
  scheduled_date: string
  estimated_cost: number
  profiles?: { full_name: string }
  service_centers?: { name: string }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalDealers: 0, activeDealers: 0, pendingDealers: 0,
    totalUsers: 0, totalBookings: 0, pendingBookings: 0,
    completedBookings: 0, revenueToday: 0
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // TODO: Confirm backend endpoints for admin dashboard aggregates.
      const dashboard = await safeGet<{ stats?: Stats; recentBookings?: RecentBooking[] }>(
        '/api/admin/dashboard',
        { stats, recentBookings: [] },
      )

      if (dashboard?.stats) setStats(dashboard.stats)
      else {
        // Safe fallback if aggregate endpoint is missing.
        const today = new Date().toISOString().split('T')[0]
        const [dealers, users, bookings, recent] = await Promise.all([
          safeGet<Array<{ status: string }>>('/api/service-centers?fields=status', []),
          safeGet<Array<{ id: string; role: string }>>('/api/users?fields=id,role', []),
          safeGet<Array<{ status: string; estimated_cost?: number; created_at?: string }>>('/api/bookings?fields=status,estimated_cost,created_at', []),
          safeGet<RecentBooking[]>('/api/bookings/recent?limit=6', []),
        ])

        setStats({
          totalDealers: dealers.length,
          activeDealers: dealers.filter(d => d.status === 'active').length,
          pendingDealers: dealers.filter(d => d.status === 'pending').length,
          totalUsers: users.filter(u => u.role === 'customer').length,
          totalBookings: bookings.length,
          pendingBookings: bookings.filter(b => b.status === 'pending').length,
          completedBookings: bookings.filter(b => b.status === 'completed').length,
          revenueToday: bookings
            .filter(b => b.created_at?.startsWith(today) && b.status === 'completed')
            .reduce((s, b) => s + (b.estimated_cost || 0), 0),
        })
        setRecentBookings(recent)
      }

      if (dashboard?.recentBookings) setRecentBookings(dashboard.recentBookings)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) return <PageLoader />

  const statCards = [
    { label: 'Total Dealers', value: stats.totalDealers, sub: `${stats.activeDealers} active`, icon: Store, color: '#0f2044', bg: '#eef2f8' },
    { label: 'Pending Approval', value: stats.pendingDealers, sub: 'Needs review', icon: AlertCircle, color: '#d97706', bg: '#fffbeb' },
    { label: 'Total Customers', value: stats.totalUsers, sub: 'Registered users', icon: Users, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Total Bookings', value: stats.totalBookings, sub: `${stats.pendingBookings} pending`, icon: CalendarCheck, color: '#7c3aed', bg: '#faf5ff' },
    { label: 'Completed', value: stats.completedBookings, sub: 'Service done', icon: CheckCircle2, color: '#059669', bg: '#ecfdf5' },
    { label: 'Today Revenue', value: `₹${stats.revenueToday.toLocaleString()}`, sub: 'Completed services', icon: TrendingUp, color: '#dc2626', bg: '#fef2f2' },
  ]

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Overview</h2>
          <p style={styles.pageSub}>Welcome back! Here's what's happening today.</p>
        </div>
        <div style={styles.dateBadge}>
          <Activity size={14} color="#6b7280" />
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {statCards.map(card => (
          <div key={card.label} style={styles.statCard}>
            <div style={styles.statTop}>
              <div style={{ ...styles.statIconWrap, background: card.bg }}>
                <card.icon size={20} color={card.color} />
              </div>
              <span style={styles.statLabel}>{card.label}</span>
            </div>
            <div style={styles.statValue}>{card.value}</div>
            <div style={styles.statSub}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Executive AI + Recent Bookings row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
        {/* Recent Bookings */}
        <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableTitle}>Recent Bookings</h3>
            <p style={styles.tableSub}>Latest service requests</p>
          </div>
          <a href="/bookings" style={styles.viewAll}>View all</a>
        </div>

        {recentBookings.length === 0 ? (
          <div style={styles.emptyState}>
            <CalendarCheck size={32} color="#d1d5db" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Customer', 'Service Center', 'Service Type', 'Date', 'Status', 'Amount'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBookings.map(b => (
                <tr key={b.id} style={styles.tr}>
                  <td style={styles.td}>{b.profiles?.full_name || '—'}</td>
                  <td style={styles.td}>{b.service_centers?.name || '—'}</td>
                  <td style={styles.td}>{b.service_type}</td>
                  <td style={styles.td}>{b.scheduled_date}</td>
                  <td style={styles.td}><StatusBadge status={b.status} /></td>
                  <td style={styles.td}>₹{b.estimated_cost?.toLocaleString() || '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        {/* Executive AI Panel */}
        <ExecutiveAIPanel stats={stats} />
      </div>
    </div>
  )
}

function ExecutiveAIPanel({ stats }: { stats: Stats }) {
  const [messages, setMessages] = useState<Array<{ role: 'user'|'assistant'; content: string; id: string }>>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [backupSessionId, setBackupSessionId] = useState<string | null>(null)

  const context = `Current platform stats: ${stats.totalDealers} total dealers (${stats.activeDealers} active, ${stats.pendingDealers} pending approval). ${stats.totalUsers} customers. ${stats.totalBookings} bookings total (${stats.pendingBookings} pending, ${stats.completedBookings} completed). Today's revenue: ₹${stats.revenueToday.toLocaleString()}.`
  const backupSource = 'dashboard_chat'
  const backupChatbotType = 'executive'
  const backupIdentity = getChatBackupIdentity()
  const backupSessionKey = getChatBackupSessionKey(backupSource, backupChatbotType, backupIdentity.identity)

  const QUICK = ['Why is revenue down?', 'Which dealers need attention?', 'Predict today\'s load']

  useEffect(() => {
    let active = true
    loadChatBackupHistory({
      source: backupSource,
      chatbotType: backupChatbotType,
      sessionKey: backupSessionKey,
      userId: backupIdentity.userId,
      customerId: backupIdentity.customerId,
      limit: 80,
    }).then(history => {
      if (!active) return
      setBackupSessionId(history.session?.id ?? null)
      if (history.messages.length) setMessages(history.messages.map(toExecutiveMessage))
    }).catch(() => {})
    return () => { active = false }
  }, [backupSessionKey, backupIdentity.userId, backupIdentity.customerId])

  async function savePanelMessage(sender: 'user' | 'assistant', message: string, sessionId = backupSessionId) {
    const saved = await saveChatBackupMessage({
      sessionId,
      sessionKey: backupSessionKey,
      source: backupSource,
      chatbotType: backupChatbotType,
      sender,
      message,
      userId: backupIdentity.userId,
      customerId: backupIdentity.customerId,
    }).catch(() => null)
    if (saved?.session?.id) setBackupSessionId(saved.session.id)
    return saved?.session?.id || sessionId || undefined
  }

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userText = text.trim()
    const uid = Date.now().toString()
    const aid = (Date.now()+1).toString()
    setMessages(prev => [...prev, { role: 'user', content: userText, id: uid }, { role: 'assistant', content: '', id: aid }])
    setInput('')
    setLoading(true)
    const history: ChatMessage[] = [
      ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userText },
    ]
    try {
      const activeSessionId = await savePanelMessage('user', userText)
      const response = await api.post<{ reply?: string; message?: string }>('/api/ai-chat', {
        messages: history,
        context,
        mode: 'executive',
      })

      const assistantText = response?.reply || response?.message || 'No response received.'

      setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: assistantText } : m))
      await savePanelMessage('assistant', assistantText, activeSessionId)
    } catch {
      const fallback = 'AI service unavailable.'
      setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: fallback } : m))
      await savePanelMessage('assistant', fallback)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '480px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px', background: '#b45309', borderRadius: '12px 12px 0 0' }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={16} color="white" />
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>Executive AI</p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Business intelligence assistant</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>Ask about revenue, performance, or predictions:</p>
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: '6px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12.5px', color: '#b45309', cursor: 'pointer', fontFamily: 'inherit' }}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '88%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? '#b45309' : '#f9f9f9', color: m.role === 'user' ? 'white' : '#1f2937', fontSize: '13px', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>
              {m.content || <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '6px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask about revenue, performance..."
          disabled={loading}
          style={{ flex: 1, padding: '8px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={() => send(input)} disabled={!input.trim() || loading} style={{ width: '34px', height: '34px', borderRadius: '8px', background: input.trim() && !loading ? '#b45309' : '#e5e7eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Send size={14} color={input.trim() && !loading ? 'white' : '#9ca3af'} />
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function toExecutiveMessage(message: { id: string; sender: string; message: string }) {
  return {
    id: message.id,
    role: message.sender === 'user' ? 'user' as const : 'assistant' as const,
    content: message.message,
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
    confirmed: { bg: '#eef2f8', color: '#0f2044', label: 'Confirmed' },
    in_progress: { bg: '#f0f9ff', color: '#0284c7', label: 'In Progress' },
    completed: { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ ...styles.badge, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7280' },
  dateBadge: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  statCard: { background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'box-shadow 0.15s' },
  statTop: { display: 'flex', alignItems: 'center', gap: '10px' },
  statIconWrap: { width: '36px', height: '36px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: '28px', fontWeight: '700', color: '#111827', lineHeight: '1.2' },
  statSub: { fontSize: '12px', color: '#9ca3af' },
  tableCard: { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  tableHeader: { padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  tableTitle: { fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '2px' },
  tableSub: { fontSize: '12px', color: '#9ca3af' },
  viewAll: { fontSize: '13px', color: '#0f2044', fontWeight: '500' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '14px 24px', fontSize: '13.5px', color: '#374151' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', display: 'inline-block' },
  emptyState: { padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#9ca3af', fontSize: '14px' },
}

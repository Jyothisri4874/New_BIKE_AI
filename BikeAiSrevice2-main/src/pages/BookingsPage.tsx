import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, safeGet } from '../lib/api'
import { Booking, BookingStatus } from '../types'
import { Search, Calendar, Plus } from 'lucide-react'

const STATUS_TABS: { label: string; value: BookingStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function BookingsPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filtered, setFiltered] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')

  useEffect(() => {
    const load = async () => {
      // TODO: Confirm backend endpoint for admin bookings list (with customer + service center joins).
      const data = await safeGet<Booking[]>('/api/bookings', [])
      setBookings((data || []) as Booking[])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let list = bookings
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        b.profiles?.full_name?.toLowerCase().includes(q) ||
        b.service_centers?.name?.toLowerCase().includes(q) ||
        b.service_type?.toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [bookings, search, statusFilter])

  const updateStatus = async (id: string, status: BookingStatus) => {
    try {
      // TODO: Confirm backend endpoint for updating booking status.
      await api.patch(`/api/bookings/${id}`, { status })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Service Bookings</h2>
          <p style={styles.pageSub}>{bookings.length} total bookings</p>
        </div>
        <button onClick={() => navigate('/bookings/new')} style={styles.addBtn}>
          <Plus size={15} /> New Booking
        </button>
      </div>

      <div style={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)} style={{
            ...styles.tab,
            background: statusFilter === tab.value ? '#0f2044' : 'transparent',
            color: statusFilter === tab.value ? 'white' : '#6b7280',
            border: statusFilter === tab.value ? '1px solid #0f2044' : '1px solid #e5e7eb',
          }}>
            {tab.label}
            <span style={{ ...styles.tabCount, background: statusFilter === tab.value ? 'rgba(255,255,255,0.2)' : '#f3f4f6', color: statusFilter === tab.value ? 'white' : '#6b7280' }}>
              {tab.value === 'all' ? bookings.length : bookings.filter(b => b.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, service center, or service type..." style={styles.searchInput} />
        </div>
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadState}>
            <div style={styles.spinner} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <Calendar size={36} color="#d1d5db" />
            <p>No bookings found</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Customer', 'Service Center', 'Service Type', 'Date & Time', 'Status', 'Est. Cost', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: '500', color: '#111827', fontSize: '13.5px' }}>{b.profiles?.full_name || '—'}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '13.5px' }}>{b.service_centers?.name || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{b.service_centers?.city || ''}</div>
                  </td>
                  <td style={styles.td}>{b.service_type}</td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '13.5px' }}>{b.scheduled_date}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{b.scheduled_time}</div>
                  </td>
                  <td style={styles.td}><StatusBadge status={b.status} /></td>
                  <td style={styles.td}>₹{b.estimated_cost?.toLocaleString() || '0'}</td>
                  <td style={styles.td}>
                    <select
                      value={b.status}
                      onChange={e => updateStatus(b.id, e.target.value as BookingStatus)}
                      style={styles.statusSelect}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#fffbeb', color: '#d97706' },
    confirmed: { bg: '#eef2f8', color: '#0f2044' },
    in_progress: { bg: '#f0f9ff', color: '#0284c7' },
    completed: { bg: '#f0fdf4', color: '#16a34a' },
    cancelled: { bg: '#fef2f2', color: '#dc2626' },
  }
  const s = map[status] || map.pending
  return <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: s.bg, color: s.color, display: 'inline-block', textTransform: 'capitalize' }}>{status?.replace('_', ' ')}</span>
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7280' },
  tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s' },
  tabCount: { padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  searchBar: { display: 'flex', gap: '10px' },
  searchWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#374151', background: 'white' },
  tableCard: { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '14px 20px', fontSize: '13.5px', color: '#374151' },
  statusSelect: { padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', color: '#374151', background: 'white', cursor: 'pointer', outline: 'none' },
  loadState: { display: 'flex', justifyContent: 'center', padding: '48px' },
  spinner: { width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#9ca3af', fontSize: '14px' },
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, safeGet } from '../lib/api'
import { Dealer, DealerStatus } from '../types'
import { Plus, Search, ListFilter as Filter, Eye, CircleCheck as CheckCircle, Circle as XCircle, Pause, MapPin, Phone, Star } from 'lucide-react'
import DealerModal from '../components/DealerModal'

const STATUS_TABS: { label: string; value: DealerStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Rejected', value: 'rejected' },
]

export default function DealersPage() {
  const navigate = useNavigate()
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [filtered, setFiltered] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DealerStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editDealer, setEditDealer] = useState<Dealer | null>(null)

  const loadDealers = async () => {
    setLoading(true)
    // TODO: Confirm backend endpoint for admin dealer list.
    const data = await safeGet<Dealer[]>('/api/service-centers', [])
    setDealers((data || []) as Dealer[])
    setLoading(false)
  }

  useEffect(() => { loadDealers() }, [])

  useEffect(() => {
    let list = dealers
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.phone?.includes(q)
      )
    }
    setFiltered(list)
  }, [dealers, search, statusFilter])

  const updateStatus = async (id: string, status: DealerStatus) => {
    try {
      // TODO: Confirm backend endpoint for updating dealer status.
      await api.patch(`/api/service-centers/${id}`, { status })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setDealers(prev => prev.map(d => d.id === id ? { ...d, status } : d))
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Dealer Management</h2>
          <p style={styles.pageSub}>{dealers.length} total dealers registered</p>
        </div>
        <button onClick={() => { setEditDealer(null); setShowModal(true) }} style={styles.addBtn}>
          <Plus size={16} />
          Add Dealer
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              ...styles.tab,
              background: statusFilter === tab.value ? '#0f2044' : 'transparent',
              color: statusFilter === tab.value ? 'white' : '#6b7280',
              border: statusFilter === tab.value ? '1px solid #0f2044' : '1px solid #e5e7eb',
            }}
          >
            {tab.label}
            <span style={{
              ...styles.tabCount,
              background: statusFilter === tab.value ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
              color: statusFilter === tab.value ? 'white' : '#6b7280',
            }}>
              {tab.value === 'all' ? dealers.length : dealers.filter(d => d.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, city, or phone..."
            style={styles.searchInput}
          />
        </div>
        <button style={styles.filterBtn}>
          <Filter size={15} />
          Filters
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadState}>
            <div style={styles.spinner} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '40px' }}>🏪</span>
            <p style={{ fontWeight: '500', color: '#374151' }}>No dealers found</p>
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Dealer', 'Location', 'Contact', 'Status', 'Rating', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(dealer => (
                <tr key={dealer.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.dealerCell}>
                      <div style={styles.dealerAvatar}>
                        {dealer.name?.[0]?.toUpperCase() || 'D'}
                      </div>
                      <div>
                        <div style={styles.dealerName}>{dealer.name}</div>
                        <div style={styles.dealerMeta}>{dealer.brands?.join(', ') || 'Multi-brand'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#6b7280', fontSize: '13px' }}>
                      <MapPin size={13} />
                      {dealer.city}{dealer.state ? `, ${dealer.state}` : ''}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#6b7280', fontSize: '13px' }}>
                      <Phone size={13} />
                      {dealer.phone || '—'}
                    </div>
                  </td>
                  <td style={styles.td}><StatusBadge status={dealer.status} /></td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={13} color="#f59e0b" fill="#f59e0b" />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        {dealer.rating?.toFixed(1) || '0.0'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>({dealer.total_reviews || 0})</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ActionBtn icon={<Eye size={14} />} title="View" onClick={() => navigate(`/dealers/${dealer.id}`)} color="#0f2044" />
                      {dealer.status !== 'active' && (
                        <ActionBtn icon={<CheckCircle size={14} />} title="Approve" onClick={() => updateStatus(dealer.id, 'active')} color="#16a34a" />
                      )}
                      {dealer.status !== 'suspended' && (
                        <ActionBtn icon={<Pause size={14} />} title="Suspend" onClick={() => updateStatus(dealer.id, 'suspended')} color="#d97706" />
                      )}
                      {dealer.status !== 'rejected' && (
                        <ActionBtn icon={<XCircle size={14} />} title="Reject" onClick={() => updateStatus(dealer.id, 'rejected')} color="#dc2626" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <DealerModal
          dealer={editDealer}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadDealers() }}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon, title, onClick, color }: { icon: React.ReactNode; title: string; onClick: () => void; color: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: '30px', height: '30px', border: `1px solid ${color}20`, background: `${color}10`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color }}
    >
      {icon}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: '#f0fdf4', color: '#16a34a' },
    pending: { bg: '#fffbeb', color: '#d97706' },
    suspended: { bg: '#fff7ed', color: '#ea580c' },
    rejected: { bg: '#fef2f2', color: '#dc2626' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: s.bg, color: s.color, display: 'inline-block', textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7280' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer' },
  tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s' },
  tabCount: { padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  searchBar: { display: 'flex', gap: '10px' },
  searchWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#374151', background: 'white' },
  filterBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', color: '#374151', cursor: 'pointer' },
  tableCard: { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' },
  td: { padding: '14px 20px', fontSize: '13.5px', color: '#374151' },
  dealerCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  dealerAvatar: { width: '36px', height: '36px', background: 'linear-gradient(135deg, #eef2f8, #dce3f0)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#0f2044', flexShrink: 0 },
  dealerName: { fontSize: '14px', fontWeight: '600', color: '#111827' },
  dealerMeta: { fontSize: '12px', color: '#9ca3af', marginTop: '1px' },
  loadState: { display: 'flex', justifyContent: 'center', padding: '48px' },
  spinner: { width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
}

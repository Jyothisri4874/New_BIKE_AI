import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KPICard from '../components/dashboard/KPICard'
import { Users, Search, Plus, Phone, MessageSquare, Car, ListFilter as Filter, ChevronRight, Tag, MapPin } from 'lucide-react'
import { safeGet } from '../lib/api'

const TAGS = ['VIP', 'Fleet', 'Warranty', 'Insurance Due', 'Service Due', 'Regular', 'New Customer']

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, newThisMonth: 0, withVehicles: 0 })

  useEffect(() => { load() }, [])

  useEffect(() => {
    let list = customers
    if (search) list = list.filter(c =>
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
    )
    if (tagFilter) list = list.filter(c => c.tags?.includes(tagFilter))
    setFiltered(list)
  }, [search, tagFilter, customers])

  const load = async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    // TODO: Confirm backend endpoints for customers list + active vehicle keys.
    const [profs, activeVehicleKeys] = await Promise.all([
      safeGet<any[]>('/api/crm/customers?role=customer&order=created_at.desc', []),
      safeGet<Array<{ customer_id: string }>>('/api/crm/vehicles/keys?isActive=true', []),
    ])
    const vehCustomers = new Set((activeVehicleKeys || []).map((v: any) => v.customer_id))

    setCustomers(profs || [])
    setFiltered(profs || [])
    setStats({
      total: (profs || []).length,
      active: (profs || []).filter((p: any) => p.is_active).length,
      newThisMonth: (profs || []).filter((p: any) => p.created_at >= monthStart).length,
      withVehicles: (profs || []).filter((p: any) => vehCustomers.has(p.id)).length,
    })
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Customer Management</h2>
          <p style={S.sub}>Complete customer profiles, vehicles & communication history</p>
        </div>
        <button onClick={() => navigate('/customers/new')} style={S.addBtn}><Plus size={15} /> Add Customer</button>
      </div>

      <div style={S.kpiRow}>
        <KPICard label="Total Customers" value={stats.total} sub="Registered" icon={Users} iconColor="#0f2044" iconBg="#eef2f8" accent />
        <KPICard label="Active" value={stats.active} sub="Active accounts" icon={Users} iconColor="#16a34a" iconBg="#f0fdf4" />
        <KPICard label="New This Month" value={stats.newThisMonth} sub="Joined recently" icon={Plus} iconColor="#0284c7" iconBg="#f0f9ff" />
        <KPICard label="With Vehicles" value={stats.withVehicles} sub="Vehicle linked" icon={Car} iconColor="#d97706" iconBg="#fffbeb" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={14} color="#9aa3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..." style={S.searchInput} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setTagFilter('')} style={{ ...S.tagBtn, background: !tagFilter ? '#0f2044' : 'white', color: !tagFilter ? 'white' : '#6b7595', border: !tagFilter ? '1px solid #0f2044' : '1px solid #e2e6f0' }}>
            <Filter size={11} /> All
          </button>
          {TAGS.map(t => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? '' : t)} style={{ ...S.tagBtn, background: tagFilter === t ? '#0f2044' : 'white', color: tagFilter === t ? 'white' : '#6b7595', border: tagFilter === t ? '1px solid #0f2044' : '1px solid #e2e6f0' }}>
              <Tag size={10} /> {t}
            </button>
          ))}
        </div>
      </div>

      {/* Customer grid */}
      {loading ? <Loader /> : (
        <div style={S.grid}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
              <Users size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
              <p>No customers found</p>
            </div>
          ) : filtered.map(c => (
            <CustomerCard key={c.id} customer={c} onClick={() => navigate(`/customers/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerCard({ customer: c, onClick }: { customer: any; onClick: () => void }) {
  const initials = c.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div onClick={onClick} style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f2044, #1a3566)', color: '#f5e019', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044' }}>{c.full_name}</div>
            <div style={{ fontSize: '11px', color: '#9aa3b8', marginTop: '1px' }}>
              {c.loyalty_points > 0 ? `${c.loyalty_points} pts` : 'Customer'}
            </div>
          </div>
        </div>
        <ChevronRight size={15} color="#c8cfdf" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
        {c.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7595' }}>
            <Phone size={11} color="#9aa3b8" /> {c.phone}
          </div>
        )}
        {c.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7595' }}>
            <MapPin size={11} color="#9aa3b8" /> {c.city}
          </div>
        )}
      </div>

      {c.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {c.tags.map((t: string) => (
            <span key={t} style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', background: '#eef2f8', color: '#0f2044' }}>{t}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid #f1f3f8' }}>
        <ActionChip icon={<Phone size={11} />} label="Call" color="#0f2044" />
        <ActionChip icon={<MessageSquare size={11} />} label="WhatsApp" color="#25d366" />
        <ActionChip icon={<Car size={11} />} label="Vehicles" color="#0284c7" />
      </div>
    </div>
  )
}

function ActionChip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '6px', fontSize: '11px', fontWeight: '500', color, cursor: 'pointer', fontFamily: 'inherit' }}>
      {icon} {label}
    </button>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  title: { fontSize: '22px', fontWeight: '800', color: '#0f2044', letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: '#6b7595', marginTop: '2px' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' },
  searchInput: { width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #e2e6f0', borderRadius: '9px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  tagBtn: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  card: { background: 'white', border: '1px solid #e2e6f0', borderRadius: '14px', padding: '16px', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s', boxShadow: '0 1px 4px rgba(15,32,68,0.05)' },
}

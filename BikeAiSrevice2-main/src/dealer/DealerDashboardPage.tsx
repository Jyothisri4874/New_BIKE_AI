import { Link } from 'react-router-dom'
import { Wrench, Calendar, Users, TrendingUp, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Truck, Package, ArrowRight, ChartBar as BarChart2 } from 'lucide-react'

const KPI = [
  { icon: Calendar, label: "Today's Bookings", value: '24', sub: '+3 from yesterday', color: '#3B82F6', bg: '#EFF6FF' },
  { icon: Wrench, label: 'In Progress', value: '8', sub: '3 awaiting parts', color: '#F59E0B', bg: '#FFFBEB' },
  { icon: CheckCircle, label: 'Completed Today', value: '11', sub: '96% on-time rate', color: '#10B981', bg: '#F0FDF4' },
  { icon: TrendingUp, label: "Today's Revenue", value: '₹42,800', sub: '+18% vs last week', color: '#FFD600', bg: '#FFF9E6' },
]

const RECENT_JOBS = [
  { id: 'JC-1041', bike: 'Honda Activa 6G', reg: 'TS09AB1234', service: 'Periodic Service', tech: 'Ravi Kumar', status: 'In Progress', eta: '2h', statusColor: '#3B82F6' },
  { id: 'JC-1040', bike: 'Royal Enfield Classic 350', reg: 'MH12CD5678', service: 'Engine Repair', tech: 'Suresh M.', status: 'Awaiting Parts', eta: '4h', statusColor: '#F59E0B' },
  { id: 'JC-1039', bike: 'Bajaj Pulsar NS200', reg: 'KA03EF9012', service: 'Tyre Change', tech: 'Priya S.', status: 'Ready', eta: 'Done', statusColor: '#10B981' },
  { id: 'JC-1038', bike: 'TVS NTorq 125', reg: 'AP28GH3456', service: 'Oil Change', tech: 'Arjun K.', status: 'Completed', eta: 'Done', statusColor: '#6B7280' },
  { id: 'JC-1037', bike: 'Hero Splendor Plus', reg: 'TN11IJ7890', service: 'Free Service', tech: 'Ravi Kumar', status: 'In Progress', eta: '1h', statusColor: '#3B82F6' },
]

const PENDING_PICKUPS = [
  { name: 'Arun Mehta', bike: 'Honda Activa', area: 'Banjara Hills', time: '10:30 AM', rider: 'Kiran R.' },
  { name: 'Sneha Rao', bike: 'TVS Jupiter', area: 'Jubilee Hills', time: '11:15 AM', rider: 'Unassigned' },
  { name: 'Vijay Kumar', bike: 'Bajaj Pulsar', area: 'Madhapur', time: '12:00 PM', rider: 'Deepak S.' },
]

export default function DealerDashboardPage() {
  return (
    <div style={p.root}>
      {/* Header */}
      <div style={p.pageHeader}>
        <div>
          <h1 style={p.pageTitle}>Workshop Dashboard</h1>
          <p style={p.pageSub}>Tuesday, 23 May 2026 · Hyderabad</p>
        </div>
        <div style={p.headerActions}>
          <Link to="/dealer/queue/new" style={p.newJobBtn}>+ New Job Card</Link>
          <Link to="/dealer/bookings" style={p.viewAllBtn}>View Bookings →</Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={p.kpiGrid}>
        {KPI.map(k => (
          <div key={k.label} style={p.kpiCard}>
            <div style={{ ...p.kpiIcon, background: k.bg }}>
              <k.icon size={20} color={k.color} />
            </div>
            <div>
              <div style={p.kpiValue}>{k.value}</div>
              <div style={p.kpiLabel}>{k.label}</div>
              <div style={{ ...p.kpiSub, color: k.color }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={p.twoCol}>
        {/* Jobs table */}
        <div style={p.card}>
          <div style={p.cardHeader}>
            <div style={p.cardTitle}><Wrench size={16} color="#FFD600" /> Active Job Cards</div>
            <Link to="/dealer/queue" style={p.cardLink}>View all →</Link>
          </div>
          <div style={p.table}>
            <div style={p.tableHead}>
              <span style={{ flex: 0.6 }}>Job ID</span>
              <span style={{ flex: 1.5 }}>Vehicle</span>
              <span style={{ flex: 1.4 }}>Service</span>
              <span style={{ flex: 1 }}>Technician</span>
              <span style={{ flex: 0.8 }}>ETA</span>
              <span style={{ flex: 0.9 }}>Status</span>
            </div>
            {RECENT_JOBS.map(j => (
              <div key={j.id} style={p.tableRow}>
                <span style={{ ...p.tableCell, flex: 0.6, fontWeight: '700', color: '#0B1F4D', fontSize: '12px' }}>{j.id}</span>
                <div style={{ flex: 1.5, minWidth: 0 }}>
                  <div style={p.bikeName}>{j.bike}</div>
                  <div style={p.bikeReg}>{j.reg}</div>
                </div>
                <span style={{ ...p.tableCell, flex: 1.4 }}>{j.service}</span>
                <span style={{ ...p.tableCell, flex: 1 }}>{j.tech}</span>
                <span style={{ ...p.tableCell, flex: 0.8, fontWeight: '600' }}>{j.eta}</span>
                <div style={{ flex: 0.9 }}>
                  <span style={{ ...p.statusBadge, background: j.statusColor + '18', color: j.statusColor }}>{j.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pickups */}
          <div style={p.card}>
            <div style={p.cardHeader}>
              <div style={p.cardTitle}><Truck size={16} color="#10B981" /> Pending Pickups</div>
              <Link to="/dealer/riders" style={p.cardLink}>Manage →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PENDING_PICKUPS.map((pk, i) => (
                <div key={i} style={p.pickupRow}>
                  <div style={p.pickupAvatar}>{pk.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={p.pickupName}>{pk.name}</div>
                    <div style={p.pickupBike}>{pk.bike} · {pk.area}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={p.pickupTime}>{pk.time}</div>
                    <div style={{ ...p.pickupRider, color: pk.rider === 'Unassigned' ? '#EF4444' : '#10B981' }}>{pk.rider}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div style={p.card}>
            <div style={p.cardTitle} >Quick Actions</div>
            <div style={p.quickActions}>
              {[
                { icon: Calendar, label: 'New Booking', to: '/dealer/bookings/new', color: '#3B82F6' },
                { icon: Users, label: 'Add Customer', to: '/dealer/customers/new', color: '#10B981' },
                { icon: Package, label: 'Check Inventory', to: '/dealer/inventory', color: '#F59E0B' },
                { icon: BarChart2, label: 'View Analytics', to: '/dealer/analytics', color: '#8B5CF6' },
              ].map(a => (
                <Link key={a.label} to={a.to} style={p.quickAction}>
                  <div style={{ ...p.quickActionIcon, background: a.color + '15' }}>
                    <a.icon size={16} color={a.color} />
                  </div>
                  <span style={p.quickActionLabel}>{a.label}</span>
                  <ArrowRight size={12} color="#9aa3b8" style={{ marginLeft: 'auto' }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Parts alert */}
          <div style={{ ...p.card, background: '#FFFBEB', border: '1.5px solid #FEF3C7' }}>
            <div style={p.cardHeader}>
              <div style={{ ...p.cardTitle, color: '#92400E' }}><AlertCircle size={15} color="#F59E0B" /> Parts Alert</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[['Engine Oil 10W40', '2 units left'], ['Air Filter - Activa', 'Out of stock'], ['Spark Plug NGK', '4 units left']].map(([item, stock]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: '#78350F', fontWeight: '500' }}>{item}</span>
                  <span style={{ color: '#F59E0B', fontWeight: '700', fontSize: '12px' }}>{stock}</span>
                </div>
              ))}
            </div>
            <Link to="/dealer/inventory" style={{ display: 'block', marginTop: '12px', fontSize: '13px', fontWeight: '700', color: '#D97706', textDecoration: 'none' }}>Reorder Now →</Link>
          </div>
        </div>
      </div>

      {/* Revenue chart placeholder */}
      <div style={p.card}>
        <div style={p.cardHeader}>
          <div style={p.cardTitle}><TrendingUp size={16} color="#3B82F6" /> Weekly Revenue</div>
          <Link to="/dealer/analytics" style={p.cardLink}>Full Analytics →</Link>
        </div>
        <div style={p.chartPlaceholder}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
            const heights = [55, 72, 48, 88, 65, 92, 78]
            return (
              <div key={day} style={p.chartBar}>
                <div style={{ ...p.chartBarFill, height: `${heights[i]}%`, background: i === 1 ? '#FFD600' : '#0B1F4D' }} />
                <div style={p.chartBarLabel}>{day}</div>
              </div>
            )
          })}
        </div>
        <div style={p.chartLegend}>
          <div style={p.legendItem}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#0B1F4D' }} /><span>Revenue</span></div>
          <div style={p.legendItem}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#FFD600' }} /><span>Today</span></div>
        </div>
      </div>
    </div>
  )
}

const p: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: '"Inter", system-ui, sans-serif' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' },
  pageTitle: { fontSize: '22px', fontWeight: '900', color: '#0B1F4D', margin: 0, letterSpacing: '-0.3px' },
  pageSub: { fontSize: '13px', color: '#9aa3b8', margin: '4px 0 0', fontWeight: '500' },
  headerActions: { display: 'flex', gap: '10px', alignItems: 'center' },
  newJobBtn: { padding: '9px 18px', background: '#FFD600', color: '#0B1F4D', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none' },
  viewAllBtn: { padding: '9px 16px', background: 'white', border: '1.5px solid #eaecf5', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#0B1F4D', textDecoration: 'none' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' },
  kpiCard: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '14px', padding: '18px', display: 'flex', alignItems: 'flex-start', gap: '14px', boxShadow: '0 1px 4px rgba(11,31,77,0.05)' },
  kpiIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiValue: { fontSize: '22px', fontWeight: '900', color: '#0B1F4D', letterSpacing: '-0.3px', lineHeight: 1.2 },
  kpiLabel: { fontSize: '12px', color: '#6B7280', marginTop: '2px', fontWeight: '500' },
  kpiSub: { fontSize: '11px', marginTop: '3px', fontWeight: '600' },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' },

  card: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(11,31,77,0.04)' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  cardTitle: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: '700', color: '#0B1F4D' },
  cardLink: { fontSize: '12px', fontWeight: '600', color: '#3B82F6', textDecoration: 'none' },

  table: { display: 'flex', flexDirection: 'column', gap: '4px' },
  tableHead: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: '#9aa3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 10px', borderRadius: '8px', border: '1px solid #f0f2f8', transition: 'background 0.1s' },
  tableCell: { fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  bikeName: { fontSize: '13px', fontWeight: '600', color: '#0B1F4D' },
  bikeReg: { fontSize: '11px', color: '#9aa3b8', marginTop: '1px' },
  statusBadge: { display: 'inline-block', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' },

  pickupRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '10px' },
  pickupAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: '#0B1F4D', color: '#FFD600', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 },
  pickupName: { fontSize: '13px', fontWeight: '700', color: '#0B1F4D' },
  pickupBike: { fontSize: '11px', color: '#9aa3b8', marginTop: '1px' },
  pickupTime: { fontSize: '12px', fontWeight: '700', color: '#0B1F4D' },
  pickupRider: { fontSize: '11px', fontWeight: '600', marginTop: '1px' },

  quickActions: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' },
  quickAction: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '9px', textDecoration: 'none', transition: 'background 0.1s' },
  quickActionIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quickActionLabel: { fontSize: '13px', fontWeight: '600', color: '#0B1F4D' },

  chartPlaceholder: { display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', padding: '0 8px', marginTop: '4px' },
  chartBar: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderRadius: '5px 5px 0 0', transition: 'height 0.3s' },
  chartBarLabel: { fontSize: '11px', color: '#9aa3b8', fontWeight: '500' },
  chartLegend: { display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f2f8' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', fontWeight: '500' },
}

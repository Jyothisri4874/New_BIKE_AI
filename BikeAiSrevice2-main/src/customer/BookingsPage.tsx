import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, Clock, MapPin, Plus, Wrench } from 'lucide-react'
import { safeGet } from '../lib/api'

type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

interface VehicleInfo {
  nickname?: string | null
  displayName?: string | null
  display_name?: string | null
  registrationNo?: string | null
  registration_number?: string | null
  registration_no?: string | null
  brand?: string | null
  brand_name?: string | null
  model_name?: string | null
  oem?: { name?: string | null } | null
  model?: { name?: string | null } | null
  vehicle_oems?: { name?: string | null } | null
  vehicle_models?: { name?: string | null } | null
}

interface ServiceCenterInfo {
  id?: string
  name?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  rating?: number | null
}

interface Booking {
  id: string
  serviceType?: string | null
  service_type?: string | null
  service_category?: string | null
  scheduledAt?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  status: BookingStatus | string
  pickup_required?: boolean
  estimated_cost?: number
  final_cost?: number
  vehicle?: VehicleInfo | null
  customer_vehicles?: VehicleInfo | null
  dealer?: ServiceCenterInfo | null
  service_center?: ServiceCenterInfo | null
  service_centers?: ServiceCenterInfo | null
}

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'] as const

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  confirmed: { label: 'Confirmed', color: '#2563eb', bg: '#eff6ff' },
  in_progress: { label: 'In Progress', color: '#7c3aed', bg: '#faf5ff' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

function formatServiceLabel(value?: string | null) {
  if (!value) return 'Service'

  const labels: Record<string, string> = {
    general_service: 'General Service',
    minor_repairs: 'Minor Repairs',
    major_service: 'Major Service',
    free_service: 'Free Service',
    accident_repair: 'Accident Repair',
    breakdown_help: 'Breakdown Help',
    ev_diagnostics: 'EV Diagnostics',
    tyre_battery: 'Tyre & Battery',
    rsa_support: 'RSA Support',
    paid_service: 'Paid Service',
  }

  return labels[value] || value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function getServiceValue(booking: Booking) {
  return booking.service_type || booking.serviceType || booking.service_category || ''
}

function getScheduledDate(booking: Booking) {
  return booking.scheduled_date || booking.scheduledAt || booking.scheduled_at || ''
}

function getScheduledTime(booking: Booking) {
  if (booking.scheduled_time) return booking.scheduled_time

  const raw = booking.scheduledAt || booking.scheduled_at
  if (!raw) return ''

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function getVehicle(booking: Booking) {
  return booking.vehicle || booking.customer_vehicles || null
}

function getVehicleLabel(vehicle?: VehicleInfo | null) {
  if (!vehicle) return ''

  const brand =
    vehicle.brand ||
    vehicle.brand_name ||
    vehicle.oem?.name ||
    vehicle.vehicle_oems?.name ||
    ''

  const model =
    vehicle.model_name ||
    vehicle.model?.name ||
    vehicle.vehicle_models?.name ||
    ''

  const name =
    vehicle.nickname ||
    vehicle.displayName ||
    vehicle.display_name ||
    `${brand} ${model}`.trim() ||
    vehicle.registrationNo ||
    vehicle.registration_number ||
    vehicle.registration_no ||
    'My Vehicle'

  const reg =
    vehicle.registrationNo ||
    vehicle.registration_number ||
    vehicle.registration_no ||
    ''

  return reg && reg !== name ? `${name} · ${reg}` : name
}

function getCenter(booking: Booking) {
  return booking.service_center || booking.service_centers || booking.dealer || null
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')

  useEffect(() => {
    ;(async () => {
      const data = await safeGet<Booking[]>('/api/bookings?scope=customer', [])
      setBookings(Array.isArray(data) ? data : [])
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'All') return bookings

    if (filter === 'Active') {
      return bookings.filter(b => ['pending', 'confirmed', 'in_progress'].includes(b.status))
    }

    if (filter === 'Completed') {
      return bookings.filter(b => b.status === 'completed')
    }

    if (filter === 'Cancelled') {
      return bookings.filter(b => b.status === 'cancelled')
    }

    return bookings
  }, [bookings, filter])

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>My Bookings</h1>
          <p style={s.sub}>{bookings.length} total bookings</p>
        </div>

        <Link to="/my/book" style={s.newBtn}>
          <Plus size={15} />
          New Booking
        </Link>
      </div>

      <div style={s.filters}>
        {FILTERS.map(f => (
          <button
            key={f}
            style={{ ...s.filter, ...(filter === f ? s.filterActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={s.shimmer} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          <Calendar size={48} color="#d1d5db" />
          <h3 style={s.emptyTitle}>No bookings found</h3>
          <p style={s.emptyText}>Book your first service to see it here</p>

          <Link to="/my/book" style={s.emptyBtn}>
            <Wrench size={14} />
            Book a Service
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(b => {
            const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
            const vehicle = getVehicle(b)
            const center = getCenter(b)
            const cost = Number(b.final_cost || b.estimated_cost || 0)

            return (
              <Link key={b.id} to={`/my/bookings/${b.id}`} style={s.card}>
                <div style={{ ...s.statusBar, background: sc.color }} />

                <div style={s.cardBody}>
                  <div style={s.cardTop}>
                    <div>
                      <h3 style={s.cardTitle}>{formatServiceLabel(getServiceValue(b))}</h3>

                      {vehicle && (
                        <p style={s.cardVehicle}>
                          {getVehicleLabel(vehicle)}
                        </p>
                      )}
                    </div>

                    <span style={{ ...s.badge, color: sc.color, background: sc.bg }}>
                      {sc.label}
                    </span>
                  </div>

                  <div style={s.cardMeta}>
                    <span style={s.metaItem}>
                      <Calendar size={13} />
                      {formatDate(getScheduledDate(b))}
                    </span>

                    <span style={s.metaItem}>
                      <Clock size={13} />
                      {getScheduledTime(b) || '-'}
                    </span>

                    {center?.name && (
                      <span style={s.metaItem}>
                        <MapPin size={13} />
                        {center.name}
                      </span>
                    )}

                    {b.pickup_required && (
                      <span style={{ ...s.metaItem, color: '#16a34a' }}>
                        🚗 Pickup arranged
                      </span>
                    )}
                  </div>

                  <div style={s.cardFooter}>
                    {cost > 0 ? (
                      <span style={s.cost}>₹{cost.toLocaleString('en-IN')}</span>
                    ) : (
                      <span />
                    )}

                    <span style={s.viewBtn}>
                      View Details
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 4px' },
  sub: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  newBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#0f2044', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },
  filters: { display: 'flex', gap: '8px' },
  filter: { padding: '8px 18px', border: '1.5px solid #e2e6f0', borderRadius: '20px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#555', cursor: 'pointer', transition: 'all 0.15s' },
  filterActive: { border: '1.5px solid #0f2044', background: '#0f2044', color: 'white' },
  shimmer: { height: '110px', background: 'linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6)', borderRadius: '14px', animation: 'shimmer 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 20px', background: 'white', borderRadius: '16px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#0f2044', margin: 0 },
  emptyText: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  emptyBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 22px', background: '#0f2044', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },
  card: { display: 'flex', background: 'white', borderRadius: '14px', overflow: 'hidden', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f2f8', transition: 'box-shadow 0.15s' },
  statusBar: { width: '5px', flexShrink: 0 },
  cardBody: { flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  cardTitle: { fontSize: '15px', fontWeight: '700', color: '#0f2044', margin: '0 0 3px' },
  cardVehicle: { fontSize: '12px', color: '#9aa3b8', margin: 0 },
  badge: { fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  metaItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280', fontWeight: '500' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f0f2f8' },
  cost: { fontSize: '15px', fontWeight: '800', color: '#0f2044' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#f5a623', fontWeight: '600' },
}
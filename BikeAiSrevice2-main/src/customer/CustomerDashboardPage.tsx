import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomerAuth } from '../hooks/useCustomerAuth'
import { safeGet } from '../lib/api'
import { Calendar, Bike, MapPin, ArrowRight, Clock, CircleAlert as AlertCircle, Wrench, Battery, Zap, Star, Shield } from 'lucide-react'

interface Booking {
  id: string
  serviceType?: string | null
  service_type?: string | null
  service_category?: string | null
  scheduledAt?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  status: string
  current_stage?: string | null
  service_centers?: { name?: string | null; city?: string | null } | null
  service_center?: { name?: string | null; city?: string | null } | null
  dealer?: { name?: string | null; city?: string | null } | null
  customer_vehicles?: { nickname?: string | null; registration_number?: string | null } | null
  vehicle?: {
    nickname?: string | null
    registrationNo?: string | null
    registration_number?: string | null
    registration_no?: string | null
  } | null
}

interface Vehicle {
  id: string
  nickname?: string | null
  registration_number?: string | null
  registrationNo?: string | null
  manufactureYear?: number | null
  manufacturing_year?: number | null
  fuel_type?: string | null
  fuelType?: string | null
  insurance_expiry?: string | null
  insuranceExpiry?: string | null
  puc_expiry?: string | null
  pucExpiry?: string | null
  vehicle_models?: { name?: string | null } | null
  vehicle_oems?: { name?: string | null } | null
  model?: { name?: string | null } | null
  oem?: { name?: string | null } | null
}

const SERVICE_CATEGORIES = [
  { id: 'free_service', label: 'Free Service', icon: Star, color: '#16a34a', bg: '#f0fdf4' },
  { id: 'general_service', label: 'General Service', icon: Wrench, color: '#0f2044', bg: '#f0f4ff' },
  { id: 'major_service', label: 'Major Service', icon: Shield, color: '#d97706', bg: '#fffbeb' },
  { id: 'accident_repair', label: 'Accident Repair', icon: AlertCircle, color: '#dc2626', bg: '#fef2f2' },
  { id: 'breakdown', label: 'Breakdown Help', icon: AlertCircle, color: '#7c3aed', bg: '#faf5ff' },
  { id: 'breakdown_help', label: 'Breakdown Help', icon: AlertCircle, color: '#7c3aed', bg: '#faf5ff' },
  { id: 'ev_diagnostics', label: 'EV Diagnostics', icon: Zap, color: '#0891b2', bg: '#ecfeff' },
  { id: 'tyre_battery', label: 'Tyre & Battery', icon: Battery, color: '#ca8a04', bg: '#fefce8' },
  { id: 'rsa', label: 'RSA Support', icon: MapPin, color: '#ea580c', bg: '#fff7ed' },
  { id: 'rsa_support', label: 'RSA Support', icon: MapPin, color: '#ea580c', bg: '#fff7ed' },
]

function formatServiceLabel(value?: string | null) {
  if (!value) return 'Service'

  const labels: Record<string, string> = {
    free_service: 'Free Service',
    general_service: 'General Service',
    minor_repairs: 'Minor Repairs',
    major_service: 'Major Service',
    accident_repair: 'Accident Repair',
    breakdown: 'Breakdown Help',
    breakdown_help: 'Breakdown Help',
    ev_diagnostics: 'EV Diagnostics',
    tyre_battery: 'Tyre & Battery',
    rsa: 'RSA Support',
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

function getServiceCenter(booking: Booking) {
  return booking.service_center || booking.service_centers || booking.dealer || null
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

function formatShortDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

function getVehicleName(v: Vehicle) {
  return (
    v.nickname ||
    v.oem?.name ||
    v.vehicle_oems?.name ||
    v.model?.name ||
    v.vehicle_models?.name ||
    'Vehicle'
  )
}

function getVehicleReg(v: Vehicle) {
  return v.registration_number || v.registrationNo || ''
}

function getVehicleYear(v: Vehicle) {
  return v.manufacturing_year || v.manufactureYear || ''
}

function getVehicleInsurance(v: Vehicle) {
  return v.insurance_expiry || v.insuranceExpiry || ''
}

export default function CustomerDashboardPage() {
  const { profile } = useCustomerAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [b, v] = await Promise.all([
        safeGet<Booking[]>('/api/bookings?scope=customer&limit=5', []),
        safeGet<Vehicle[]>('/api/vehicles?isActive=true&limit=3', []),
      ])

      setBookings(Array.isArray(b) ? b : [])
      setVehicles(Array.isArray(v) ? v : [])
      setLoading(false)
    }

    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'Rider'

  const activeBooking = bookings.find(b => ['pending', 'confirmed', 'in_progress'].includes(b.status))

  return (
    <div style={s.root}>
      <div style={s.hero}>
        <div style={s.heroText}>
          <p style={s.greeting}>{greeting},</p>
          <h1 style={s.name}>{firstName} 👋</h1>
          <p style={s.sub}>Ready to book your next service?</p>
        </div>

        <Link to="/my/book" style={s.bookBtn}>
          <Wrench size={16} />
          Book a Service
          <ArrowRight size={14} />
        </Link>
      </div>

      {activeBooking && (
        <Link to={`/my/bookings/${activeBooking.id}`} style={s.activeBooking}>
          <div style={s.activeDot} />

          <div style={s.activeInfo}>
            <span style={s.activeTitle}>{formatServiceLabel(getServiceValue(activeBooking))}</span>
            <span style={s.activeSub}>
              {getServiceCenter(activeBooking)?.name || 'Service Center'} · {formatShortDate(getScheduledDate(activeBooking))}
            </span>
          </div>

          <span style={s.activeBadge}>{statusLabel(activeBooking.status)}</span>
          <ArrowRight size={16} color="#f5a623" />
        </Link>
      )}

      <section style={s.section}>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>Book a Service</h2>
          <Link to="/my/book" style={s.seeAll}>See all</Link>
        </div>

        <div style={s.servicesGrid}>
          {SERVICE_CATEGORIES.map(cat => (
            <Link key={cat.id} to={`/my/book?type=${cat.id}`} style={{ ...s.serviceCard, background: cat.bg }}>
              <div style={{ ...s.serviceIcon, color: cat.color }}>
                <cat.icon size={22} />
              </div>
              <span style={{ ...s.serviceLabel, color: cat.color }}>{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div style={s.cols}>
        <section style={s.colSection}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>My Garage</h2>
            <Link to="/my/garage" style={s.seeAll}>Manage</Link>
          </div>

          {loading ? (
            <div style={s.shimmer} />
          ) : vehicles.length === 0 ? (
            <div style={s.empty}>
              <Bike size={36} color="#d1d5db" />
              <p style={s.emptyText}>No vehicles added yet</p>
              <Link to="/my/garage/add" style={s.emptyBtn}>Add Vehicle</Link>
            </div>
          ) : (
            <div style={s.vehicleList}>
              {vehicles.map(v => {
                const reg = getVehicleReg(v)
                const year = getVehicleYear(v)

                return (
                  <Link key={v.id} to={`/my/garage/${v.id}`} style={s.vehicleCard}>
                    <div style={s.vehicleIconWrap}>
                      <Bike size={20} color="#f5a623" />
                    </div>

                    <div style={s.vehicleInfo}>
                      <span style={s.vehicleName}>{getVehicleName(v)}</span>
                      <span style={s.vehicleReg}>
                        {[reg, year].filter(Boolean).join(' · ') || '-'}
                      </span>

                      {getVehicleInsurance(v) && isExpiringSoon(getVehicleInsurance(v)) && (
                        <span style={s.expWarning}>Insurance expiring soon</span>
                      )}
                    </div>

                    <ArrowRight size={14} color="#9aa3b8" />
                  </Link>
                )
              })}

              <Link to="/my/garage/add" style={s.addVehicleBtn}>
                <span style={s.plusIcon}>+</span> Add Vehicle
              </Link>
            </div>
          )}
        </section>

        <section style={s.colSection}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Recent Bookings</h2>
            <Link to="/my/bookings" style={s.seeAll}>View all</Link>
          </div>

          {loading ? (
            <div style={s.shimmer} />
          ) : bookings.length === 0 ? (
            <div style={s.empty}>
              <Calendar size={36} color="#d1d5db" />
              <p style={s.emptyText}>No bookings yet</p>
              <Link to="/my/book" style={s.emptyBtn}>Book Now</Link>
            </div>
          ) : (
            <div style={s.bookingList}>
              {bookings.slice(0, 4).map(b => (
                <Link key={b.id} to={`/my/bookings/${b.id}`} style={s.bookingCard}>
                  <div style={{ ...s.bookingStatus, background: statusColor(b.status) }} />

                  <div style={s.bookingInfo}>
                    <span style={s.bookingCat}>{formatServiceLabel(getServiceValue(b))}</span>

                    <span style={s.bookingMeta}>
                      <Clock size={11} />
                      {formatShortDate(getScheduledDate(b))} · {getScheduledTime(b) || '-'}
                    </span>

                    {getServiceCenter(b)?.name && (
                      <span style={s.bookingCenter}>
                        <MapPin size={11} />
                        {getServiceCenter(b)?.name}
                      </span>
                    )}
                  </div>

                  <span style={{ ...s.statusPill, background: statusBg(b.status), color: statusColor(b.status) }}>
                    {statusLabel(b.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={s.promo}>
        <div>
          <h3 style={s.promoTitle}>Free Pickup & Drop</h3>
          <p style={s.promoSub}>Book any service worth ₹500+ and get free doorstep pickup</p>
        </div>

        <Link to="/my/book" style={s.promoCta}>Book Now</Link>
      </div>
    </div>
  )
}

function isExpiringSoon(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

function statusLabel(s: string) {
  return { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[s] || s
}

function statusColor(s: string) {
  return { pending: '#d97706', confirmed: '#2563eb', in_progress: '#7c3aed', completed: '#16a34a', cancelled: '#dc2626' }[s] || '#6b7280'
}

function statusBg(s: string) {
  return { pending: '#fffbeb', confirmed: '#eff6ff', in_progress: '#faf5ff', completed: '#f0fdf4', cancelled: '#fef2f2' }[s] || '#f3f4f6'
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px' },
  hero: { background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6e 100%)', borderRadius: '16px', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { display: 'flex', flexDirection: 'column', gap: '4px' },
  greeting: { fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 },
  name: { fontSize: '28px', fontWeight: '800', color: 'white', margin: 0, letterSpacing: '-0.3px' },
  sub: { fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0, marginTop: '4px' },
  bookBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 22px', background: '#f5a623', color: 'white', borderRadius: '12px', fontWeight: '700', fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' },
  activeBooking: { display: 'flex', alignItems: 'center', gap: '12px', background: 'white', border: '1.5px solid #fde68a', borderRadius: '14px', padding: '14px 18px', textDecoration: 'none', boxShadow: '0 2px 8px rgba(245,166,35,0.1)' },
  activeDot: { width: '10px', height: '10px', background: '#f5a623', borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 0 3px rgba(245,166,35,0.2)' },
  activeInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  activeTitle: { fontSize: '14px', fontWeight: '600', color: '#0f2044' },
  activeSub: { fontSize: '12px', color: '#9aa3b8' },
  activeBadge: { fontSize: '12px', fontWeight: '600', color: '#f5a623', background: '#fffbeb', padding: '3px 10px', borderRadius: '20px', border: '1px solid #fde68a' },
  section: { display: 'flex', flexDirection: 'column', gap: '14px' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: '17px', fontWeight: '700', color: '#0f2044', margin: 0 },
  seeAll: { fontSize: '13px', color: '#f5a623', fontWeight: '600', textDecoration: 'none' },
  servicesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  serviceCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 8px', borderRadius: '14px', textDecoration: 'none', transition: 'transform 0.15s', cursor: 'pointer' },
  serviceIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { fontSize: '12px', fontWeight: '600', textAlign: 'center', lineHeight: '1.3' },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  colSection: { background: 'white', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  shimmer: { height: '120px', background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)', borderRadius: '10px', animation: 'shimmer 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '28px 0' },
  emptyText: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  emptyBtn: { fontSize: '13px', fontWeight: '600', color: '#f5a623', textDecoration: 'none', padding: '7px 18px', border: '1.5px solid #f5a623', borderRadius: '20px' },
  vehicleList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  vehicleCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8f9ff', borderRadius: '10px', textDecoration: 'none', transition: 'background 0.15s' },
  vehicleIconWrap: { width: '38px', height: '38px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  vehicleInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  vehicleName: { fontSize: '13px', fontWeight: '600', color: '#0f2044' },
  vehicleReg: { fontSize: '12px', color: '#9aa3b8' },
  expWarning: { fontSize: '11px', color: '#dc2626', fontWeight: '500' },
  addVehicleBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 12px', border: '1.5px dashed #e2e6f0', borderRadius: '10px', color: '#9aa3b8', fontSize: '13px', fontWeight: '500', textDecoration: 'none', justifyContent: 'center', transition: 'border-color 0.15s' },
  plusIcon: { fontSize: '16px', fontWeight: '300', lineHeight: '1' },
  bookingList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  bookingCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8f9ff', borderRadius: '10px', textDecoration: 'none' },
  bookingStatus: { width: '4px', height: '40px', borderRadius: '4px', flexShrink: 0 },
  bookingInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  bookingCat: { fontSize: '13px', fontWeight: '600', color: '#0f2044' },
  bookingMeta: { fontSize: '11px', color: '#9aa3b8', display: 'flex', alignItems: 'center', gap: '4px' },
  bookingCenter: { fontSize: '11px', color: '#9aa3b8', display: 'flex', alignItems: 'center', gap: '3px' },
  statusPill: { fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' },
  promo: { background: 'linear-gradient(135deg, #f5a623 0%, #f59e0b 100%)', borderRadius: '16px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  promoTitle: { fontSize: '18px', fontWeight: '700', color: 'white', margin: '0 0 4px' },
  promoSub: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0 },
  promoCta: { padding: '10px 22px', background: 'white', color: '#f5a623', borderRadius: '10px', fontWeight: '700', fontSize: '14px', textDecoration: 'none', flexShrink: 0 },
}
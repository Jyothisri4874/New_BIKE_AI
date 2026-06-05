import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiPost, safeGet } from '../lib/api'
import {
  Bike,
  Plus,
  ArrowRight,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Calendar,
  FileText,
  Trash2,
} from 'lucide-react'

interface Vehicle {
  id: string

  nickname?: string | null

  registrationNo?: string | null
  registration_number?: string | null
  registration_no?: string | null

  manufactureYear?: number | null
  manufacturing_year?: number | null
  manufacture_year?: number | null

  fuelType?: string | null
  fuel_type?: string | null

  colour?: string | null
  color?: string | null

  odometerKm?: number | null
  odometer_km?: number | null

  insuranceExpiry?: string | null
  insurance_expiry?: string | null

  pucExpiry?: string | null
  puc_expiry?: string | null

  warranty_expiry?: string | null

  amcExpiry?: string | null
  amc_expiry?: string | null

  isPrimary?: boolean | null
  is_primary?: boolean | null

  brand?: string | null
  brand_name?: string | null
  oem_name?: string | null
  model_name?: string | null
  variant_name?: string | null

  oem?: { name?: string | null } | null
  model?: { name?: string | null } | null
  variant?: { name?: string | null } | null

  vehicle_oems?: { name?: string | null } | null
  vehicle_models?: { name?: string | null } | null
}

function valueOrEmpty(value?: string | number | null) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function titleCase(value?: string | null) {
  const text = valueOrEmpty(value)
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function getRegistration(v: Vehicle) {
  return (
    valueOrEmpty(v.registrationNo) ||
    valueOrEmpty(v.registration_number) ||
    valueOrEmpty(v.registration_no)
  )
}

function getYear(v: Vehicle) {
  return (
    valueOrEmpty(v.manufactureYear) ||
    valueOrEmpty(v.manufacturing_year) ||
    valueOrEmpty(v.manufacture_year)
  )
}

function getFuel(v: Vehicle) {
  return titleCase(v.fuelType || v.fuel_type)
}

function getColor(v: Vehicle) {
  return titleCase(v.colour || v.color)
}

function getOdometer(v: Vehicle) {
  return Number(v.odometerKm ?? v.odometer_km ?? 0)
}

function getInsurance(v: Vehicle) {
  return valueOrEmpty(v.insuranceExpiry || v.insurance_expiry)
}

function getPuc(v: Vehicle) {
  return valueOrEmpty(v.pucExpiry || v.puc_expiry)
}

function getAmc(v: Vehicle) {
  return valueOrEmpty(v.amcExpiry || v.amc_expiry)
}

function getBrand(v: Vehicle) {
  return (
    valueOrEmpty(v.brand) ||
    valueOrEmpty(v.brand_name) ||
    valueOrEmpty(v.oem_name) ||
    valueOrEmpty(v.oem?.name) ||
    valueOrEmpty(v.vehicle_oems?.name)
  )
}

function getModel(v: Vehicle) {
  return (
    valueOrEmpty(v.model_name) ||
    valueOrEmpty(v.model?.name) ||
    valueOrEmpty(v.vehicle_models?.name)
  )
}

function getVariant(v: Vehicle) {
  return valueOrEmpty(v.variant_name) || valueOrEmpty(v.variant?.name)
}

function getVehicleTitle(v: Vehicle) {
  return valueOrEmpty(v.nickname) || getRegistration(v) || 'My Vehicle'
}

function getBrandModelLine(v: Vehicle) {
  return [getBrand(v), getModel(v), getVariant(v)].filter(Boolean).join(' ')
}

function getMetaLine(v: Vehicle) {
  return [getColor(v), getFuel(v), getYear(v)].filter(Boolean).join(' • ')
}

export default function GaragePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    ;(async () => {
      const data = await safeGet<Vehicle[]>('/api/vehicles?isActive=true', [])
      setVehicles(Array.isArray(data) ? data : [])
      setLoading(false)
    })()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this vehicle from your garage?')) return

    try {
      await apiPost(`/api/vehicles/${id}`, { is_active: false })
    } catch {
      // UI still removes optimistically.
    }

    setVehicles(prev => prev.filter(v => v.id !== id))
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>My Garage</h1>
          <p style={s.sub}>Manage your vehicles, documents, and service history</p>
        </div>

        <Link to="/my/garage/add" style={s.addBtn}>
          <Plus size={16} />
          Add Vehicle
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2].map(i => (
            <div key={i} style={s.shimmer} />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div style={s.empty}>
          <Bike size={56} color="#d1d5db" />
          <h3 style={s.emptyTitle}>No vehicles yet</h3>
          <p style={s.emptyText}>
            Add your bike or scooter to get personalized service reminders and quick booking.
          </p>

          <Link to="/my/garage/add" style={s.emptyBtn}>
            <Plus size={15} />
            Add Your Vehicle
          </Link>
        </div>
      ) : (
        <div style={s.grid}>
          {vehicles.map(v => {
            const title = getVehicleTitle(v)
            const registration = getRegistration(v)
            const brandModel = getBrandModelLine(v)
            const metaLine = getMetaLine(v)
            const odometer = getOdometer(v)
            const isPrimary = Boolean(v.isPrimary || v.is_primary)

            return (
              <div key={v.id} style={s.card}>
                {isPrimary && <div style={s.primaryBadge}>Primary</div>}

                <div style={s.cardTop}>
                  <div style={s.bikeIcon}>
                    <Bike size={28} color="#f5a623" />
                  </div>

                  <div style={s.cardInfo}>
                    <h3 style={s.cardName}>{title}</h3>

                    {registration && (
                      <p style={s.cardReg}>{registration}</p>
                    )}

                    {brandModel && (
                      <p style={s.cardModel}>{brandModel}</p>
                    )}

                    {metaLine && (
                      <p style={s.cardMeta}>{metaLine}</p>
                    )}
                  </div>

                  <div style={s.cardActions}>
                    <button
                      type="button"
                      style={s.iconBtn}
                      onClick={() => handleDelete(v.id)}
                      title="Delete vehicle"
                    >
                      <Trash2 size={15} color="#dc2626" />
                    </button>

                    <button
                      type="button"
                      style={s.iconBtn}
                      onClick={() => navigate(`/my/garage/${v.id}`)}
                      title="Open vehicle"
                    >
                      <ArrowRight size={15} color="#9aa3b8" />
                    </button>
                  </div>
                </div>

                <div style={s.divider} />

                <div style={s.docs}>
                  <DocStatus label="Insurance" expiry={getInsurance(v)} />
                  <DocStatus label="PUC" expiry={getPuc(v)} />
                  <DocStatus label="Warranty" expiry={valueOrEmpty(v.warranty_expiry)} />
                  <DocStatus label="AMC" expiry={getAmc(v)} />
                </div>

                {odometer > 0 && (
                  <div style={s.odo}>
                    <span style={s.odoLabel}>Odometer</span>
                    <span style={s.odoVal}>{odometer.toLocaleString('en-IN')} km</span>
                  </div>
                )}

                <div style={s.cardBtns}>
                  <Link to={`/my/book?vehicle=${v.id}`} style={s.bookBtn}>
                    Book Service
                  </Link>

                  <Link to={`/my/garage/${v.id}`} style={s.historyBtn}>
                    <FileText size={13} />
                    History
                  </Link>

                  <Link to={`/my/garage/${v.id}/docs`} style={s.historyBtn}>
                    <Calendar size={13} />
                    Documents
                  </Link>
                </div>
              </div>
            )
          })}

          <Link to="/my/garage/add" style={s.addCard}>
            <Plus size={32} color="#d1d5db" />
            <span style={s.addCardText}>Add Another Vehicle</span>
          </Link>
        </div>
      )}

      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}

function DocStatus({ label, expiry }: { label: string; expiry: string }) {
  if (!expiry) {
    return (
      <div style={ds.item}>
        <span style={ds.label}>{label}</span>
        <span style={ds.none}>Not set</span>
      </div>
    )
  }

  const diff = new Date(expiry).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  const expired = days < 0
  const soon = days >= 0 && days <= 30

  return (
    <div style={ds.item}>
      <span style={ds.label}>{label}</span>
      <span
        style={{
          ...ds.status,
          color: expired ? '#dc2626' : soon ? '#d97706' : '#16a34a',
        }}
      >
        {expired ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
        {expired ? 'Expired' : soon ? `${days}d left` : 'Valid'}
      </span>
    </div>
  )
}

const ds: Record<string, CSSProperties> = {
  item: { display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' },
  label: { fontSize: '10px', color: '#9aa3b8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' },
  status: { fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' },
  none: { fontSize: '11px', color: '#d1d5db' },
}

const s: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 4px' },
  sub: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  addBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#0f2044', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },
  shimmer: { height: '200px', background: 'linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6)', borderRadius: '16px', animation: 'shimmer 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 20px', background: 'white', borderRadius: '16px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#0f2044', margin: 0 },
  emptyText: { fontSize: '14px', color: '#9aa3b8', textAlign: 'center', maxWidth: '320px', margin: 0 },
  emptyBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', background: '#0f2044', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' },
  card: { background: 'white', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', position: 'relative', border: '1px solid #f0f2f8' },
  primaryBadge: { position: 'absolute', top: '16px', right: '16px', fontSize: '11px', fontWeight: '700', color: '#f5a623', background: '#fffbeb', padding: '3px 10px', borderRadius: '20px', border: '1px solid #fde68a' },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' },
  bikeIcon: { width: '52px', height: '52px', background: '#fffbeb', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: '16px', fontWeight: '700', color: '#0f2044', margin: '0 0 4px' },
  cardReg: { fontSize: '13px', color: '#6b7280', margin: '0 0 3px', fontWeight: '600' },
  cardModel: { fontSize: '13px', color: '#0f2044', margin: '0 0 3px', fontWeight: '600' },
  cardMeta: { fontSize: '12px', color: '#9aa3b8', margin: 0 },
  cardActions: { display: 'flex', gap: '6px' },
  iconBtn: { background: '#f5f7fa', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  divider: { height: '1px', background: '#f0f2f8', marginBottom: '16px' },
  docs: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', background: '#f8f9ff', borderRadius: '10px', padding: '12px', marginBottom: '14px' },
  odo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8f9ff', borderRadius: '8px', marginBottom: '14px' },
  odoLabel: { fontSize: '12px', color: '#9aa3b8', fontWeight: '500' },
  odoVal: { fontSize: '13px', fontWeight: '700', color: '#0f2044' },
  cardBtns: { display: 'flex', gap: '8px' },
  bookBtn: { flex: 1, padding: '9px', background: '#f5a623', color: 'white', borderRadius: '9px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', textAlign: 'center' },
  historyBtn: { display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 12px', background: '#f5f7fa', color: '#555', borderRadius: '9px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' },
  addCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'white', borderRadius: '16px', border: '2px dashed #e2e6f0', minHeight: '200px', textDecoration: 'none', cursor: 'pointer' },
  addCardText: { fontSize: '14px', color: '#9aa3b8', fontWeight: '500' },
}
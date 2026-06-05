import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, safeGet } from '../lib/api'
import { Dealer, Booking, DealerStatus } from '../types'
import {
  ArrowLeft, MapPin, Phone, Mail, Clock, Star,
  CircleCheck as CheckCircle, Circle as XCircle, Pause,
  CreditCard as Edit2, Zap, Shield, Truck, ChevronDown, ChevronUp,
} from 'lucide-react'
import DealerModal from '../components/DealerModal'
import { SERVICE_GROUPS, FACILITIES, CAPABILITY_TAGS, OEM_BRANDS } from '../components/WorkshopConfig'

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  const load = async () => {
    if (!id) return
    // TODO: Confirm backend endpoints for dealer detail + recent bookings.
    const [dealerRow, recent] = await Promise.all([
      safeGet<Dealer | null>(`/api/service-centers/${encodeURIComponent(id)}`, null),
      safeGet<Booking[]>(`/api/bookings?serviceCenterId=${encodeURIComponent(id)}&limit=10`, []),
    ])
    setDealer(dealerRow)
    setBookings((recent || []) as Booking[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const updateStatus = async (status: DealerStatus) => {
    if (!dealer) return
    try {
      // TODO: Confirm backend endpoint for updating dealer status.
      await api.patch(`/api/service-centers/${dealer.id}`, { status })
    } catch {
      // keep UI responsive
    }
    setDealer({ ...dealer, status })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!dealer) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
        <p>Dealer not found</p>
        <button onClick={() => navigate('/dealers')} style={{ marginTop: '16px', padding: '8px 16px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Back to Dealers
        </button>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    active: '#16a34a', pending: '#d97706', suspended: '#ea580c', rejected: '#dc2626',
  }

  const workshopServices  = (dealer.workshop_services  ?? {}) as Record<string, string[]>
  const capabilityTags    = (dealer.capability_tags    ?? []) as string[]
  const supportedOems     = (dealer.supported_oems     ?? dealer.brands ?? []) as string[]
  const facilities        = (dealer.facilities         ?? []) as string[]
  const totalServiceCount = Object.values(workshopServices).reduce((s: number, a: string[]) => s + a.length, 0)

  return (
    <div style={styles.page}>
      {/* Back */}
      <button onClick={() => navigate('/dealers')} style={styles.backBtn}>
        <ArrowLeft size={16} /> Back to Dealers
      </button>

      {/* Hero card */}
      <div style={styles.heroCard}>
        <div style={styles.heroLeft}>
          <div style={styles.heroAvatar}>{dealer.name?.[0]?.toUpperCase()}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={styles.heroName}>{dealer.name}</h2>
              {dealer.is_ev_capable && (
                <span style={styles.evPill}><Zap size={10} /> EV</span>
              )}
              {dealer.is_rsa_enabled && (
                <span style={styles.rsaPill}><Shield size={10} /> RSA</span>
              )}
              {dealer.is_pickup_available && (
                <span style={styles.pickupPill}><Truck size={10} /> Pickup</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...styles.statusBadge, background: `${statusColor[dealer.status]}15`, color: statusColor[dealer.status] }}>
                {dealer.status?.toUpperCase()}
              </span>
              <span style={styles.heroMeta}><MapPin size={13} /> {dealer.city}, {dealer.state}</span>
              <span style={styles.heroMeta}><Phone size={13} /> {dealer.phone}</span>
              {dealer.email && <span style={styles.heroMeta}><Mail size={13} /> {dealer.email}</span>}
              <span style={styles.heroMeta}><Clock size={13} /> {dealer.open_time} - {dealer.close_time}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button onClick={() => setShowEdit(true)} style={styles.editBtn}>
            <Edit2 size={14} /> Edit
          </button>
          {dealer.status !== 'active' && (
            <ActionButton onClick={() => updateStatus('active')} icon={<CheckCircle size={14} />} label="Approve" color="#16a34a" />
          )}
          {dealer.status !== 'suspended' && (
            <ActionButton onClick={() => updateStatus('suspended')} icon={<Pause size={14} />} label="Suspend" color="#d97706" />
          )}
          {dealer.status !== 'rejected' && (
            <ActionButton onClick={() => updateStatus('rejected')} icon={<XCircle size={14} />} label="Reject" color="#dc2626" />
          )}
        </div>
      </div>

      {/* Capability tags strip */}
      {capabilityTags.length > 0 && (
        <div style={styles.tagsStrip}>
          {capabilityTags.map(slug => {
            const tag = CAPABILITY_TAGS.find(t => t.slug === slug)
            if (!tag) return null
            return (
              <span key={slug} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: tag.bg, color: tag.color, border: `1px solid ${tag.color}30` }}>
                {tag.label}
              </span>
            )
          })}
        </div>
      )}

      <div style={styles.grid}>
        {/* Dealer info */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Dealer Information</h3>
          <div style={styles.infoGrid}>
            <InfoRow label="Full Address"  value={dealer.address} />
            <InfoRow label="City"          value={dealer.city} />
            <InfoRow label="State"         value={dealer.state} />
            <InfoRow label="Pincode"       value={dealer.pincode || '—'} />
            <InfoRow label="GST Number"    value={dealer.gst_number || '—'} />
            <InfoRow label="Workshop Type" value={
              <span style={{ textTransform: 'capitalize' }}>
                {dealer.workshop_type?.replace(/_/g, ' ') || 'Multi-brand'}
              </span>
            } />
            <InfoRow label="Rating" value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={13} color="#f59e0b" fill="#f59e0b" />
                {dealer.rating?.toFixed(1)} ({dealer.total_reviews} reviews)
              </span>
            } />
          </div>
          {dealer.description && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>{dealer.description}</p>
            </div>
          )}
        </div>

        {/* OEM brands + facilities */}
        <div style={styles.infoCard}>
          <h3 style={styles.cardTitle}>OEM & Brand Compatibility</h3>
          {supportedOems.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {supportedOems.map(slug => {
                const oem = OEM_BRANDS.find(o => o.slug === slug) ?? { name: slug, type: 'ice' as const }
                const isEv = oem.type === 'ev'
                return (
                  <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: isEv ? '#f0fdf4' : '#eef2f8', border: `1px solid ${isEv ? '#a7f3d0' : '#c7d2e8'}` }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: isEv ? '#dcfce7' : '#dce3f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', color: isEv ? '#059669' : '#0f2044' }}>
                      {oem.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: isEv ? '#059669' : '#0f2044' }}>{oem.name}</span>
                    {isEv && <Zap size={10} color="#059669" />}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>No OEM brands configured</p>
          )}

          {facilities.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
              <p style={styles.sectionLabel}>Facilities</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {facilities.map(slug => {
                  const f = FACILITIES.find(f => f.slug === slug)
                  return f ? (
                    <span key={slug} style={{ padding: '4px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', color: '#374151', fontWeight: '500' }}>
                      {f.label}
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Services taxonomy */}
      <div style={styles.infoCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>Services Offered</h3>
          <span style={{ fontSize: '13px', color: '#6b7280', background: '#f1f3f8', padding: '3px 10px', borderRadius: '20px' }}>
            {totalServiceCount} service{totalServiceCount !== 1 ? 's' : ''}
          </span>
        </div>
        {totalServiceCount === 0 ? (
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>No services configured. Edit this dealer to configure services.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {SERVICE_GROUPS.map(group => {
              const selected = workshopServices[group.slug] ?? []
              if (selected.length === 0) return null
              return <ServiceGroupDisplay key={group.slug} group={group} selected={selected} />
            })}
          </div>
        )}
      </div>

      {/* Bookings */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.cardTitle}>Recent Bookings</h3>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{bookings.length} total</span>
        </div>
        {bookings.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>No bookings yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Customer', 'Service', 'Date', 'Status', 'Amount'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={styles.td}>{b.profiles?.full_name || '—'}</td>
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

      {showEdit && (
        <DealerModal dealer={dealer} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceGroupDisplay({ group, selected }: {
  group: { slug: string; name: string; color: string; bg: string; isEv?: boolean; services: { slug: string; name: string }[] }
  selected: string[]
}) {
  const [open, setOpen] = useState(true)
  const selectedServices = group.services.filter(s => selected.includes(s.slug))

  return (
    <div style={{ border: `1px solid ${group.color}30`, borderRadius: '10px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', background: group.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{group.name}</span>
          {group.isEv && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 6px', background: '#f0fdf4', color: '#059669', borderRadius: '4px', fontSize: '10px', fontWeight: '700', border: '1px solid #a7f3d0' }}>
              <Zap size={9} /> EV
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: group.color + '20', color: group.color }}>
            {selectedServices.length}
          </span>
          {open ? <ChevronUp size={13} color="#9ca3af" /> : <ChevronDown size={13} color="#9ca3af" />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'white' }}>
          {selectedServices.map(svc => (
            <span key={svc.slug} style={{ padding: '4px 12px', background: group.bg, color: group.color, border: `1px solid ${group.color}30`, borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              {svc.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionButton({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '8px', color, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
      {icon} {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:     { bg: '#fffbeb', color: '#d97706' },
    confirmed:   { bg: '#eef2f8', color: '#0f2044' },
    in_progress: { bg: '#f0f9ff', color: '#0284c7' },
    completed:   { bg: '#f0fdf4', color: '#16a34a' },
    cancelled:   { bg: '#fef2f2', color: '#dc2626' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: s.bg, color: s.color, display: 'inline-block', textTransform: 'capitalize' }}>
      {status?.replace('_', ' ')}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', flexDirection: 'column', gap: '20px' },
  backBtn:     { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0', width: 'fit-content' },
  heroCard:    { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  heroLeft:    { display: 'flex', alignItems: 'flex-start', gap: '16px' },
  heroAvatar:  { width: '56px', height: '56px', background: 'linear-gradient(135deg, #eef2f8, #dce3f0)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: '#0f2044', flexShrink: 0 },
  heroName:    { fontSize: '20px', fontWeight: '700', color: '#111827' },
  statusBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em' },
  heroMeta:    { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6b7280' },
  editBtn:     { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  evPill:      { display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: '#f0fdf4', color: '#059669', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid #a7f3d0' },
  rsaPill:     { display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid #fecaca' },
  pickupPill:  { display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: '#f0f9ff', color: '#0284c7', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid #bae6fd' },
  tagsStrip:   { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb' },
  grid:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  infoCard:    { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' },
  cardTitle:   { fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '16px' },
  infoGrid:    { display: 'flex', flexDirection: 'column' },
  sectionLabel:{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
  tableCard:   { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  tableHeader: { padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  th:          { padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  td:          { padding: '14px 20px', fontSize: '13.5px', color: '#374151' },
}

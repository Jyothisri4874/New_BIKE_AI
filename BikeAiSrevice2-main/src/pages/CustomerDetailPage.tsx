import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard as Edit2, Phone, MessageSquare, MapPin, Car, FileText, Bell, History, Shield, Wrench, ChevronRight, Plus, Calendar, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Activity, User, Heart } from 'lucide-react'
import { safeGet } from '../lib/api'

type TabId = 'overview' | 'vehicles' | 'history' | 'documents' | 'communication'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [followups, setFollowups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useEffect(() => { if (id) load(id) }, [id])

  const load = async (customerId: string) => {
    // TODO: Confirm backend endpoints for customer detail bundles (profile, vehicles, bookings, documents, followups).
    const [profileData, vehiclesData, bookingsData, docsData, followupsData] = await Promise.all([
      safeGet<any>(`/api/crm/customers/${encodeURIComponent(customerId)}`, null),
      safeGet<any[]>(`/api/crm/vehicles?customerId=${encodeURIComponent(customerId)}`, []),
      safeGet<any[]>(`/api/crm/bookings?customerId=${encodeURIComponent(customerId)}&limit=20`, []),
      safeGet<any[]>(`/api/crm/vehicle-documents?customerId=${encodeURIComponent(customerId)}`, []),
      safeGet<any[]>(`/api/crm/followups?customerId=${encodeURIComponent(customerId)}&limit=10`, []),
    ])
    setProfile(profileData)
    setVehicles(vehiclesData || [])
    setBookings(bookingsData || [])
    setDocuments(docsData || [])
    setFollowups(followupsData || [])
    setLoading(false)
  }

  if (loading) return <Loader />
  if (!profile) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
      <User size={40} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
      <p>Customer not found</p>
      <button onClick={() => navigate('/customers')} style={S.backLinkBtn}>Back to Customers</button>
    </div>
  )

  const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const totalSpend = bookings.filter(b => b.status === 'completed').reduce((s: number, b: any) => s + (b.estimated_cost || 0), 0)
  const activeVehicles = vehicles.filter(v => v.is_active)

  const TABS: { id: TabId; label: string; icon: typeof Car; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'vehicles', label: 'Vehicles', icon: Car, count: activeVehicles.length },
    { id: 'history', label: 'Service History', icon: History, count: bookings.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
    { id: 'communication', label: 'Follow-ups', icon: Bell, count: followups.length },
  ]

  return (
    <div style={S.page}>
      {/* Back + header actions */}
      <div style={S.topBar}>
        <button onClick={() => navigate('/customers')} style={S.backBtn}>
          <ArrowLeft size={15} /> Customers
        </button>
        <button onClick={() => navigate(`/customers/${id}/edit`)} style={S.editBtn}>
          <Edit2 size={13} /> Edit Profile
        </button>
      </div>

      {/* Profile hero card */}
      <div style={S.heroCard}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={S.avatarLg}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={S.heroName}>{profile.full_name}</h1>
              {profile.tags?.map((t: string) => (
                <span key={t} style={S.tag}>{t}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
              {profile.phone && (
                <a href={`tel:${profile.phone}`} style={S.contactLink}>
                  <Phone size={13} /> {profile.phone}
                </a>
              )}
              {profile.email && (
                <span style={S.contactText}>{profile.email}</span>
              )}
              {profile.city && (
                <span style={S.contactText}><MapPin size={13} /> {profile.city}{profile.pincode ? ` - ${profile.pincode}` : ''}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={S.heroStats}>
          <HeroStat label="Loyalty Points" value={profile.loyalty_points || 0} color="#f5e019" />
          <HeroStat label="Vehicles" value={activeVehicles.length} />
          <HeroStat label="Bookings" value={bookings.length} />
          <HeroStat label="Total Spend" value={`₹${(totalSpend / 1000).toFixed(0)}K`} />
        </div>

        {/* Action chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          {profile.phone && (
            <a href={`tel:${profile.phone}`} style={S.actionChip}>
              <Phone size={13} /> Call
            </a>
          )}
          {(profile.whatsapp_number || profile.phone) && (
            <a href={`https://wa.me/${(profile.whatsapp_number || profile.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ ...S.actionChip, background: '#25d36615', borderColor: '#25d36630', color: '#25d366' }}>
              <MessageSquare size={13} /> WhatsApp
            </a>
          )}
          <button onClick={() => navigate('/bookings/new')} style={{ ...S.actionChip, background: '#0f204415', borderColor: '#0f204430', color: '#0f2044', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={13} /> New Booking
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            ...S.tab,
            background: activeTab === t.id ? '#0f2044' : 'white',
            color: activeTab === t.id ? 'white' : '#6b7595',
            border: activeTab === t.id ? '1px solid #0f2044' : '1px solid #e2e6f0',
          }}>
            <t.icon size={13} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ ...S.tabCount, background: activeTab === t.id ? 'rgba(255,255,255,0.2)' : '#eef2f8', color: activeTab === t.id ? 'white' : '#0f2044' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab profile={profile} vehicles={vehicles} bookings={bookings} />}
      {activeTab === 'vehicles' && <VehiclesTab vehicles={vehicles} />}
      {activeTab === 'history' && <HistoryTab bookings={bookings} />}
      {activeTab === 'documents' && <DocumentsTab documents={documents} />}
      {activeTab === 'communication' && <CommunicationTab followups={followups} />}
    </div>
  )
}

function OverviewTab({ profile, vehicles, bookings }: { profile: any; vehicles: any[]; bookings: any[] }) {
  const recentBookings = bookings.slice(0, 5)
  const recentVehicles = vehicles.filter(v => v.is_active).slice(0, 3)
  const nextService = vehicles.find(v => v.next_service_date)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Vehicle health summary */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <Car size={15} color="#0f2044" /> <span style={S.cardTitle}>Active Vehicles</span>
          </div>
          {recentVehicles.length === 0 ? (
            <p style={S.emptyNote}>No vehicles linked</p>
          ) : recentVehicles.map(v => (
            <div key={v.id} style={S.vehicleRow}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044' }}>
                  {v.vehicle_oems?.name} {v.vehicle_models?.name}
                </span>
                <HealthScore score={v.health_score} />
              </div>
              <span style={{ fontSize: '12px', color: '#9aa3b8' }}>
                {v.registration_number || 'No plate'} · {v.manufacturing_year}
              </span>
            </div>
          ))}
        </div>

        {/* Upcoming / alerts */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <AlertCircle size={15} color="#d97706" /> <span style={S.cardTitle}>Alerts & Upcoming</span>
          </div>
          {nextService ? (
            <AlertRow icon={<Wrench size={13} color="#0284c7" />} label="Next Service Due" value={nextService.next_service_date} color="#0284c7" />
          ) : null}
          {vehicles.filter(v => v.insurance_expiry).map(v => (
            <AlertRow key={v.id} icon={<Shield size={13} color="#d97706" />} label={`Insurance (${v.vehicle_models?.name || ''})`} value={v.insurance_expiry} color="#d97706" />
          ))}
          {vehicles.filter(v => v.warranty_expiry).map(v => (
            <AlertRow key={v.id} icon={<CheckCircle2 size={13} color="#16a34a" />} label={`Warranty (${v.vehicle_models?.name || ''})`} value={v.warranty_expiry} color="#16a34a" />
          ))}
          {!nextService && vehicles.every(v => !v.insurance_expiry && !v.warranty_expiry) && (
            <p style={S.emptyNote}>No upcoming alerts</p>
          )}
        </div>

        {/* Customer notes */}
        {profile.customer_notes && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <FileText size={15} color="#0f2044" /> <span style={S.cardTitle}>Notes</span>
            </div>
            <p style={{ fontSize: '13.5px', color: '#374151', lineHeight: '1.6', margin: 0 }}>{profile.customer_notes}</p>
          </div>
        )}
      </div>

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <History size={15} color="#0f2044" /> <span style={S.cardTitle}>Recent Service History</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {recentBookings.map(b => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VehiclesTab({ vehicles }: { vehicles: any[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {vehicles.length === 0 ? (
        <div style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
          <Car size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
          <p>No vehicles linked</p>
        </div>
      ) : vehicles.map(v => (
        <div key={v.id} style={{ ...S.card, opacity: v.is_active ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2044' }}>
                {v.vehicle_oems?.name} {v.vehicle_models?.name}
              </div>
              <div style={{ fontSize: '12px', color: '#9aa3b8', marginTop: '2px' }}>
                {v.registration_number || 'No plate'} · {v.manufacturing_year}
              </div>
            </div>
            <HealthScore score={v.health_score} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {v.fuel_type && <InfoRow label="Fuel" value={v.fuel_type} />}
            {v.chassis_number && <InfoRow label="Chassis" value={v.chassis_number} />}
            {v.odometer_km && <InfoRow label="Odometer" value={`${v.odometer_km.toLocaleString()} km`} />}
            {v.insurance_expiry && <InfoRow label="Insurance" value={v.insurance_expiry} icon={<Shield size={11} color="#d97706" />} />}
            {v.warranty_expiry && <InfoRow label="Warranty" value={v.warranty_expiry} icon={<CheckCircle2 size={11} color="#16a34a" />} />}
            {v.next_service_date && <InfoRow label="Next Service" value={v.next_service_date} icon={<Wrench size={11} color="#0284c7" />} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryTab({ bookings }: { bookings: any[] }) {
  return (
    <div style={S.card}>
      {bookings.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
          <History size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
          <p>No service history yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {bookings.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', gap: '16px', padding: '14px 0', borderBottom: i < bookings.length - 1 ? '1px solid #f1f3f8' : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '2px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: STATUS_COLORS[b.status]?.dot || '#9aa3b8', flexShrink: 0 }} />
                {i < bookings.length - 1 && <div style={{ width: '1px', flex: 1, background: '#e2e6f0', minHeight: '20px' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044' }}>{b.service_type?.replace(/_/g, ' ')}</span>
                    <span style={{ marginLeft: '10px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: STATUS_COLORS[b.status]?.bg || '#f1f3f8', color: STATUS_COLORS[b.status]?.text || '#6b7595', textTransform: 'capitalize' }}>
                      {b.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {b.estimated_cost > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2044' }}>₹{b.estimated_cost?.toLocaleString()}</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#9aa3b8', marginTop: '3px', display: 'flex', gap: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> {b.scheduled_date}</span>
                  {b.service_centers?.name && <span>{b.service_centers.name}, {b.service_centers.city}</span>}
                </div>
                {b.customer_complaint && <p style={{ fontSize: '12px', color: '#6b7595', marginTop: '4px', fontStyle: 'italic' }}>"{b.customer_complaint}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentsTab({ documents }: { documents: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {documents.length === 0 ? (
        <div style={{ ...S.card, padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
          <FileText size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
          <p>No documents uploaded</p>
        </div>
      ) : documents.map(d => (
        <div key={d.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#eef2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} color="#0f2044" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044' }}>{d.document_name || d.document_type}</div>
                <div style={{ fontSize: '12px', color: '#9aa3b8' }}>{d.document_type} · {d.expiry_date ? `Expires ${d.expiry_date}` : 'No expiry'}</div>
              </div>
            </div>
            {d.document_url && (
              <a href={d.document_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none' }}>
                View <ChevronRight size={12} style={{ display: 'inline' }} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CommunicationTab({ followups }: { followups: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {followups.length === 0 ? (
        <div style={{ ...S.card, padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
          <Bell size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
          <p>No follow-up history</p>
        </div>
      ) : followups.map(f => (
        <div key={f.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044', textTransform: 'capitalize' }}>{f.follow_up_type?.replace(/_/g, ' ')}</div>
              {f.notes && <p style={{ fontSize: '12.5px', color: '#6b7595', margin: '4px 0 0' }}>{f.notes}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: f.status === 'contacted' ? '#f0fdf4' : '#fff7ed', color: f.status === 'contacted' ? '#16a34a' : '#d97706' }}>
                {f.status}
              </span>
              <span style={{ fontSize: '11px', color: '#9aa3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={10} /> {f.follow_up_date}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function HealthScore({ score }: { score: number | null }) {
  if (!score) return null
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const bg = score >= 80 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : '#fef2f2'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: bg }}>
      <Heart size={11} color={color} />
      <span style={{ fontSize: '12px', fontWeight: '700', color }}>{score}%</span>
    </div>
  )
}

function HeroStat({ label, value, color = '#0f2044' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px 20px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', minWidth: '90px' }}>
      <span style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
    </div>
  )
}

function AlertRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f3f8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
        {icon} {label}
      </div>
      <span style={{ fontSize: '12px', fontWeight: '600', color }}>{value}</span>
    </div>
  )
}

function BookingRow({ booking: b }: { booking: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f3f8' }}>
      <div>
        <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#0f2044', textTransform: 'capitalize' }}>{b.service_type?.replace(/_/g, ' ')}</span>
        <div style={{ fontSize: '12px', color: '#9aa3b8', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Calendar size={10} /> {b.scheduled_date}
          {b.service_centers?.name && <span>· {b.service_centers.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {b.estimated_cost > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2044' }}>₹{b.estimated_cost?.toLocaleString()}</span>}
        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: STATUS_COLORS[b.status]?.bg || '#f1f3f8', color: STATUS_COLORS[b.status]?.text || '#6b7595', textTransform: 'capitalize' }}>
          {b.status?.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
      <span style={{ color: '#9aa3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>{icon}{label}</span>
      <span style={{ color: '#374151', fontWeight: '500' }}>{value}</span>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: '#fffbeb', text: '#d97706', dot: '#d97706' },
  confirmed: { bg: '#eef2f8', text: '#0f2044', dot: '#0f2044' },
  in_progress: { bg: '#f0f9ff', text: '#0284c7', dot: '#0284c7' },
  completed: { bg: '#f0fdf4', text: '#16a34a', dot: '#16a34a' },
  cancelled: { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '16px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  backLinkBtn: { marginTop: '12px', padding: '8px 20px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  editBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#0f2044', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
  heroCard: { background: 'linear-gradient(135deg, #0f2044, #1a3566)', borderRadius: '16px', padding: '24px', color: 'white' },
  avatarLg: { width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #f5e019, #e6d200)', color: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0 },
  heroName: { fontSize: '22px', fontWeight: '800', color: 'white', margin: 0, letterSpacing: '-0.3px' },
  tag: { fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245,224,25,0.15)', color: '#f5e019' },
  contactLink: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'rgba(255,255,255,0.75)', textDecoration: 'none' },
  contactText: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
  heroStats: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' },
  actionChip: { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: 'white', textDecoration: 'none' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabCount: { padding: '1px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' },
  card: { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '16px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' },
  cardTitle: { fontSize: '14px', fontWeight: '700', color: '#0f2044' },
  vehicleRow: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 0', borderBottom: '1px solid #f1f3f8' },
  emptyNote: { fontSize: '13px', color: '#9aa3b8', textAlign: 'center', padding: '16px 0', margin: 0 },
}

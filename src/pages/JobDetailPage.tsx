import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Navigation, Phone, MapPin, Clock, CircleCheck as CheckCircle2, Truck, Camera, Star, User, RefreshCw, MessageSquare, Shield, Fuel, Gauge } from 'lucide-react'
import { api, safeGet } from '../lib/api'

const JOURNEY_STEPS = [
  { key: 'pending',        label: 'Job Created',         desc: 'Waiting for rider assignment' },
  { key: 'assigned',       label: 'Rider Assigned',      desc: 'Rider notified and confirmed' },
  { key: 'rider_en_route', label: 'Rider En Route',      desc: 'Rider heading to customer' },
  { key: 'arrived',        label: 'Arrived at Customer', desc: 'Rider reached pickup location' },
  { key: 'picked_up',      label: 'Vehicle Picked Up',   desc: 'OTP verified, vehicle collected' },
  { key: 'in_transit',     label: 'In Transit',          desc: 'Vehicle en route to workshop' },
  { key: 'delivered',      label: 'Delivered',           desc: 'Vehicle handed over, job complete' },
]

const STATUS_ORDER = JOURNEY_STEPS.map(s => s.key)

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending:        { color: '#d97706', bg: '#fffbeb' },
  assigned:       { color: '#0f2044', bg: '#eef2f8' },
  rider_en_route: { color: '#2563eb', bg: '#eff6ff' },
  arrived:        { color: '#0284c7', bg: '#f0f9ff' },
  picked_up:      { color: '#9333ea', bg: '#fdf4ff' },
  in_transit:     { color: '#7c3aed', bg: '#fdf4ff' },
  delivered:      { color: '#16a34a', bg: '#f0fdf4' },
  cancelled:      { color: '#dc2626', bg: '#fef2f2' },
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<any>(null)
  const [riders, setRiders] = useState<any[]>([])
  const [conditionReports, setConditionReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningRider, setAssigningRider] = useState(false)
  const [selectedRider, setSelectedRider] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => { if (id) load(id) }, [id])

  const load = async (jobId: string) => {
    // TODO: Confirm backend endpoints for live ops job detail + riders + condition reports.
    const [jobData, ridersData, reportsData] = await Promise.all([
      safeGet<any>(`/api/live-ops/jobs/${encodeURIComponent(jobId)}`, null),
      safeGet<any[]>('/api/riders?isActive=true&isAvailable=true', []),
      safeGet<any[]>(`/api/live-ops/condition-reports?jobId=${encodeURIComponent(jobId)}`, []),
    ])
    setJob(jobData)
    setRiders(ridersData || [])
    setConditionReports(reportsData || [])
    setLoading(false)
  }

  const assignRider = async () => {
    if (!selectedRider || !id) return
    setAssigningRider(true)
    await api.patch(`/api/live-ops/jobs/${encodeURIComponent(id)}`, {
      rider_id: selectedRider,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(() => {})
    await api.patch(`/api/riders/${encodeURIComponent(selectedRider)}`, { is_available: false, current_job_id: id }).catch(() => {})
    await load(id)
    setAssigningRider(false)
  }

  const updateStatus = async (status: string) => {
    if (!id) return
    setSavingStatus(true)
    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }
    if (status === 'rider_en_route') updates.rider_departed_at = new Date().toISOString()
    if (status === 'arrived')        updates.arrived_at_customer = new Date().toISOString()
    if (status === 'picked_up')      updates.picked_up_at = new Date().toISOString()
    if (status === 'delivered')      updates.delivered_at = new Date().toISOString()
    // TODO: Confirm backend endpoint for updating a live ops job status.
    await api.patch(`/api/live-ops/jobs/${encodeURIComponent(id)}`, updates).catch(() => {})
    if (status === 'delivered' && job?.rider_id) {
      await api.patch(`/api/riders/${encodeURIComponent(job.rider_id)}`, { is_available: true, current_job_id: null }).catch(() => {})
    }
    setJob((prev: any) => ({ ...prev, ...updates }))
    setSavingStatus(false)
  }

  const verifyOtp = () => {
    if (otpInput === job?.otp_code) {
      setOtpSuccess(true)
      setOtpError('')
      updateStatus(job.job_type === 'pickup' ? 'picked_up' : 'delivered')
    } else {
      setOtpError('Incorrect OTP. Please try again.')
    }
  }

  const generateOtp = async () => {
    if (!id) return
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    // TODO: Confirm backend endpoint for updating OTP code.
    await api.patch(`/api/live-ops/jobs/${encodeURIComponent(id)}`, { otp_code: otp }).catch(() => {})
    setJob((prev: any) => ({ ...prev, otp_code: otp }))
  }

  if (loading) return <Loader />
  if (!job) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
      <Truck size={40} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
      <p>Job not found</p>
    </div>
  )

  const currentStep = STATUS_ORDER.indexOf(job.status)
  const statusMeta = STATUS_COLORS[job.status] || STATUS_COLORS.pending
  const isPickup = job.job_type === 'pickup'
  const needsOtp = (isPickup && job.status === 'arrived') || (!isPickup && job.status === 'in_transit')
  const canProgress = !['delivered', 'cancelled'].includes(job.status)

  const NEXT_STATUS: Record<string, string | null> = {
    pending: 'assigned', assigned: 'rider_en_route', rider_en_route: 'arrived',
    arrived: 'picked_up', picked_up: 'in_transit', in_transit: 'delivered',
  }

  return (
    <div style={S.page}>
      {/* Back bar */}
      <div style={S.topBar}>
        <button onClick={() => navigate('/live-ops')} style={S.backBtn}>
          <ArrowLeft size={15} /> Live Operations
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => id && load(id)} style={S.refreshBtn}><RefreshCw size={13} /></button>
          <span style={{ ...S.statusPill, background: statusMeta.bg, color: statusMeta.color }}>
            {job.status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Hero */}
      <div style={S.heroCard}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: isPickup ? 'rgba(2,132,199,0.15)' : 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isPickup ? <Truck size={22} color="#0284c7" /> : <Navigation size={22} color="#7c3aed" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f2044', margin: 0, textTransform: 'capitalize' }}>{job.job_type} Job</h2>
              {job.is_delayed && <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626' }}>DELAYED</span>}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7595', marginTop: '3px' }}>
              {job.service_bookings?.service_type?.replace(/_/g, ' ')} · {job.service_bookings?.scheduled_date}
            </div>
          </div>
          {job.eta_minutes && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f2044' }}>{job.eta_minutes}m</div>
              <div style={{ fontSize: '11px', color: '#9aa3b8' }}>ETA</div>
            </div>
          )}
        </div>
      </div>

      <div style={S.grid}>
        {/* Journey timeline */}
        <div style={S.card}>
          <div style={S.cardHdr}><Navigation size={14} color="#0f2044" /><span style={S.cardTitle}>Journey Progress</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {JOURNEY_STEPS.map((step, i) => {
              const done  = i < currentStep
              const active = i === currentStep
              const future = i > currentStep
              return (
                <div key={step.key} style={{ display: 'flex', gap: '12px', paddingBottom: i < JOURNEY_STEPS.length - 1 ? '0' : '0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: done ? '#0f2044' : active ? '#0284c7' : '#f1f3f8',
                      border: active ? '2px solid #0284c7' : done ? '2px solid #0f2044' : '2px solid #e2e6f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, zIndex: 1,
                    }}>
                      {done ? <CheckCircle2 size={14} color="white" /> : <span style={{ fontSize: '11px', fontWeight: '700', color: active ? '#0284c7' : '#c8cfdf' }}>{i + 1}</span>}
                    </div>
                    {i < JOURNEY_STEPS.length - 1 && (
                      <div style={{ width: '2px', flex: 1, minHeight: '24px', background: done ? '#0f2044' : '#e2e6f0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: '20px', paddingTop: '4px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: active ? '700' : '500', color: future ? '#c8cfdf' : done ? '#374151' : '#0284c7' }}>{step.label}</div>
                    <div style={{ fontSize: '11.5px', color: future ? '#d1d5db' : '#9aa3b8', marginTop: '2px' }}>{step.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action button */}
          {canProgress && NEXT_STATUS[job.status] && !needsOtp && (
            <button
              onClick={() => updateStatus(NEXT_STATUS[job.status]!)}
              disabled={savingStatus || (job.status === 'pending' && !job.rider_id)}
              style={{ ...S.progressBtn, opacity: (savingStatus || (job.status === 'pending' && !job.rider_id)) ? 0.5 : 1 }}
            >
              {savingStatus ? 'Updating...' : `Mark as "${JOURNEY_STEPS[STATUS_ORDER.indexOf(NEXT_STATUS[job.status]!)]?.label}"`}
            </button>
          )}
        </div>

        {/* Customer & rider info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Customer */}
          <div style={S.card}>
            <div style={S.cardHdr}><User size={14} color="#0f2044" /><span style={S.cardTitle}>Customer</span></div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2044', marginBottom: '6px' }}>{job.profiles?.full_name || '—'}</div>
            {job.profiles?.phone && (
              <div style={S.infoRow}>
                <Phone size={12} color="#9aa3b8" />
                <span style={S.infoVal}>{job.profiles.phone}</span>
                <a href={`tel:${job.profiles.phone}`} style={S.miniCallBtn}><Phone size={11} /></a>
                {(job.profiles.whatsapp_number || job.profiles.phone) && (
                  <a href={`https://wa.me/${(job.profiles.whatsapp_number || job.profiles.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ ...S.miniCallBtn, background: '#f0fdf4', color: '#16a34a' }}><MessageSquare size={11} /></a>
                )}
              </div>
            )}
            {job.customer_address && (
              <div style={S.infoRow}>
                <MapPin size={12} color="#9aa3b8" />
                <span style={S.infoVal}>{job.customer_address}</span>
              </div>
            )}
          </div>

          {/* Rider */}
          <div style={S.card}>
            <div style={S.cardHdr}><Navigation size={14} color="#0f2044" /><span style={S.cardTitle}>Assigned Rider</span></div>
            {job.riders ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f2044', marginBottom: '6px' }}>{job.riders.name}</div>
                <div style={S.infoRow}>
                  <Phone size={12} color="#9aa3b8" />
                  <span style={S.infoVal}>{job.riders.phone}</span>
                  <a href={`tel:${job.riders.phone}`} style={S.miniCallBtn}><Phone size={11} /></a>
                </div>
                {job.riders.vehicle_number && (
                  <div style={S.infoRow}>
                    <Truck size={12} color="#9aa3b8" />
                    <span style={S.infoVal}>{job.riders.vehicle_number}</span>
                  </div>
                )}
                {job.riders.rating && (
                  <div style={S.infoRow}>
                    <Star size={12} color="#d97706" />
                    <span style={S.infoVal}>{job.riders.rating} Rating</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: '#9aa3b8', marginBottom: '10px' }}>No rider assigned yet</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedRider}
                    onChange={e => setSelectedRider(e.target.value)}
                    style={S.select}
                  >
                    <option value="">Select available rider</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.rider_type.replace(/_/g, ' ')}) — {r.vehicle_number}</option>
                    ))}
                  </select>
                  <button onClick={assignRider} disabled={!selectedRider || assigningRider} style={{ ...S.assignBtn, opacity: (!selectedRider || assigningRider) ? 0.5 : 1 }}>
                    {assigningRider ? '...' : 'Assign'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OTP panel */}
          {needsOtp && (
            <div style={{ ...S.card, borderColor: '#0284c7', background: '#f0f9ff' }}>
              <div style={S.cardHdr}><Shield size={14} color="#0284c7" /><span style={{ ...S.cardTitle, color: '#0284c7' }}>OTP Verification Required</span></div>
              {otpSuccess ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                  <CheckCircle2 size={18} /><span style={{ fontWeight: '600' }}>OTP Verified!</span>
                </div>
              ) : (
                <div>
                  {job.otp_code ? (
                    <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                      <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>Generated OTP: </span>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f2044', letterSpacing: '4px' }}>{job.otp_code}</span>
                    </div>
                  ) : (
                    <button onClick={generateOtp} style={S.genOtpBtn}>Generate OTP</button>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value)}
                      placeholder="Enter customer OTP"
                      maxLength={6}
                      style={S.otpInput}
                    />
                    <button onClick={verifyOtp} style={S.verifyBtn}>Verify</button>
                  </div>
                  {otpError && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{otpError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vehicle condition */}
        <div style={S.card}>
          <div style={S.cardHdr}><Camera size={14} color="#0f2044" /><span style={S.cardTitle}>Vehicle Condition</span></div>
          {conditionReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9aa3b8' }}>
              <Camera size={28} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>No condition reports yet</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px' }}>Rider will upload photos at pickup</p>
            </div>
          ) : conditionReports.map(r => (
            <div key={r.id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f1f3f8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2044', textTransform: 'capitalize' }}>{r.report_type} Report</span>
                <span style={{ fontSize: '11px', color: '#9aa3b8' }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {r.odometer_km && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#374151' }}>
                    <Gauge size={12} color="#9aa3b8" /> {r.odometer_km.toLocaleString()} km
                  </div>
                )}
                {r.fuel_level && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#374151' }}>
                    <Fuel size={12} color="#9aa3b8" /> {r.fuel_level}
                  </div>
                )}
              </div>
              {r.damage_notes && <p style={{ fontSize: '12.5px', color: '#6b7595', marginTop: '6px', fontStyle: 'italic' }}>"{r.damage_notes}"</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline events */}
      <div style={S.card}>
        <div style={S.cardHdr}><Clock size={14} color="#0f2044" /><span style={S.cardTitle}>Activity Log</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Job Created',         time: job.created_at },
            { label: 'Rider Assigned',      time: job.assigned_at },
            { label: 'Rider Departed',      time: job.rider_departed_at },
            { label: 'Arrived at Customer', time: job.arrived_at_customer },
            { label: 'Vehicle Picked Up',   time: job.picked_up_at },
            { label: 'Delivery Completed',  time: job.delivered_at },
          ].filter(e => e.time).map(e => (
            <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={13} color="#16a34a" />
                <span style={{ color: '#374151', fontWeight: '500' }}>{e.label}</span>
              </div>
              <span style={{ color: '#9aa3b8', fontSize: '12px' }}>{new Date(e.time).toLocaleString()}</span>
            </div>
          ))}
          {!job.assigned_at && <p style={{ fontSize: '13px', color: '#9aa3b8', margin: 0 }}>Job created. Awaiting rider assignment.</p>}
        </div>
      </div>

      {/* Customer feedback (if delivered) */}
      {job.status === 'delivered' && (
        <div style={S.card}>
          <div style={S.cardHdr}><Star size={14} color="#d97706" /><span style={S.cardTitle}>Customer Feedback</span></div>
          {job.customer_rating ? (
            <div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={18} color={s <= job.customer_rating ? '#d97706' : '#e2e6f0'} fill={s <= job.customer_rating ? '#d97706' : 'transparent'} />
                ))}
              </div>
              {job.customer_feedback && <p style={{ fontSize: '13.5px', color: '#374151', fontStyle: 'italic' }}>"{job.customer_feedback}"</p>}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#9aa3b8', margin: 0 }}>No feedback submitted yet</p>
          )}
        </div>
      )}
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

const S: Record<string, React.CSSProperties> = {
  page:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  topBar:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:      { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  refreshBtn:   { padding: '7px 10px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' },
  statusPill:   { fontSize: '12px', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', textTransform: 'capitalize' },
  heroCard:     { background: 'white', border: '1px solid #e2e6f0', borderRadius: '14px', padding: '20px' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card:         { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '16px' },
  cardHdr:      { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' },
  cardTitle:    { fontSize: '14px', fontWeight: '700', color: '#0f2044' },
  infoRow:      { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' },
  infoVal:      { fontSize: '13.5px', color: '#374151', flex: 1 },
  miniCallBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: '#f0f9ff', color: '#0284c7', textDecoration: 'none', border: '1px solid #bae6fd', flexShrink: 0 },
  progressBtn:  { width: '100%', padding: '11px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', marginTop: '14px' },
  select:       { flex: 1, padding: '8px 10px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  assignBtn:    { padding: '8px 16px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  genOtpBtn:    { padding: '7px 14px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  otpInput:     { flex: 1, padding: '8px 12px', border: '1.5px solid #bae6fd', borderRadius: '8px', fontSize: '15px', fontFamily: 'inherit', color: '#0f2044', letterSpacing: '4px', fontWeight: '700', outline: 'none', textAlign: 'center' },
  verifyBtn:    { padding: '8px 16px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
}

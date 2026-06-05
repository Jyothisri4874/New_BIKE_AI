import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { api } from '../lib/api'
import { useDealerAuth } from '../hooks/useDealerAuth'

type WorkOrderStage =
  | 'TRACKING_CREATED'
  | 'INSPECTION_COMPLETED'
  | 'ESTIMATE_CREATED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'WORK_ALLOCATED'
  | 'PARTS_ISSUED'
  | 'WORK_IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'QC_PASS'
  | 'WASHING'
  | 'WASH_COMPLETED'
  | 'READY_FOR_BILLING'
  | 'INVOICE_GENERATED'
  | 'READY_FOR_DELIVERY'
  | 'PAYMENT_RECEIVED'
  | 'DELIVERED'
  | 'FEEDBACK_RECEIVED'

type PublicTracking = {
  id: string
  number: string
  status: string
  workflowStage?: WorkOrderStage | string | null
  complaint?: string | null
  estimatedReady?: string | null
  advisorName?: string | null
  technicianName?: string | null
  bayNumber?: number | null
  customer?: {
    fullName?: string | null
    phone?: string | null
  } | null
  vehicle?: {
    registrationNo?: string | null
    nickname?: string | null
    fuelType?: string | null
    odometerKm?: number | null
    oem?: { name?: string | null } | null
    model?: { name?: string | null } | null
  } | null
  dealer?: {
    name?: string | null
    city?: string | null
    phone?: string | null
  } | null
  wipEvents?: Array<{
    id: string
    stage: string
    remarks?: string | null
    photoUrl?: string | null
    createdAt: string
  }>
}

const STAGE_FLOW: WorkOrderStage[] = [
  'TRACKING_CREATED',
  'INSPECTION_COMPLETED',
  'ESTIMATE_CREATED',
  'APPROVAL_PENDING',
  'APPROVED',
  'WORK_ALLOCATED',
  'PARTS_ISSUED',
  'WORK_IN_PROGRESS',
  'WORK_COMPLETED',
  'QC_PASS',
  'WASHING',
  'WASH_COMPLETED',
  'READY_FOR_BILLING',
  'INVOICE_GENERATED',
  'READY_FOR_DELIVERY',
  'PAYMENT_RECEIVED',
  'DELIVERED',
  'FEEDBACK_RECEIVED',
]

const STAGE_ALIASES: Record<string, WorkOrderStage> = {
  SPARES_ISSUED: 'PARTS_ISSUED',
  SERVICE_FINISHED: 'READY_FOR_DELIVERY',
  GATE_PASS_GENERATED: 'DELIVERED',
}

const NEXT_ACTION_LABELS: Partial<Record<WorkOrderStage, string>> = {
  INSPECTION_COMPLETED: 'Complete Inspection',
  ESTIMATE_CREATED: 'Create Estimate',
  APPROVAL_PENDING: 'Send Approval Pending',
  APPROVED: 'Mark Approved',
  WORK_ALLOCATED: 'Mark Work Allocated',
  PARTS_ISSUED: 'Mark Spares Issued',
  WORK_IN_PROGRESS: 'Start Work',
  WORK_COMPLETED: 'Mark Work Completed',
  QC_PASS: 'Mark QC Completed',
  WASHING: 'Send to Washing',
  WASH_COMPLETED: 'Mark Washing Done',
  READY_FOR_BILLING: 'Ready for Billing',
  INVOICE_GENERATED: 'Invoice Generated',
  READY_FOR_DELIVERY: 'Mark Ready for Delivery',
  PAYMENT_RECEIVED: 'Payment Received',
  DELIVERED: 'Mark Delivered',
  FEEDBACK_RECEIVED: 'Feedback Received',
}

const STAFF_ROLES = new Set(['admin', 'dealer', 'service_advisor', 'technician', 'service_manager', 'crm'])

function normalizeStage(value?: string | null): WorkOrderStage {
  const raw = String(value || 'TRACKING_CREATED').toUpperCase()
  return STAGE_ALIASES[raw] || (STAGE_FLOW.includes(raw as WorkOrderStage) ? raw as WorkOrderStage : 'TRACKING_CREATED')
}

const STAGE_LABELS: Record<string, string> = {
  TRACKING_CREATED: 'Tracking Created',
  INSPECTION_COMPLETED: 'Inspection Completed',
  ESTIMATE_CREATED: 'Estimate Created',
  APPROVAL_PENDING: 'Approval Pending',
  APPROVED: 'Approved',
  WORK_ALLOCATED: 'Work Allocated',
  PARTS_ISSUED: 'Spares Issued',
  SPARES_ISSUED: 'Spares Issued',
  WORK_IN_PROGRESS: 'Work In Progress',
  WORK_COMPLETED: 'Work Completed',
  QC_PASS: 'QC Completed',
  QC_COMPLETED: 'QC Completed',
  WASHING: 'Washing',
  WASH_COMPLETED: 'Washing Done',
  WASHING_DONE: 'Washing Done',
  READY_FOR_BILLING: 'Ready for Billing',
  INVOICE_GENERATED: 'Invoice Generated',
  READY_FOR_DELIVERY: 'Ready for Delivery',
  PAYMENT_RECEIVED: 'Payment Received',
  DELIVERED: 'Delivered',
  FEEDBACK_RECEIVED: 'Feedback Received',
}

function label(value?: string | null) {
  if (!value) return '-'
  const raw = String(value).toUpperCase()
  return STAGE_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getNextStage(current?: string | null): WorkOrderStage | null {
  const stage = normalizeStage(current)
  const index = STAGE_FLOW.indexOf(stage)
  return STAGE_FLOW[index + 1] || null
}

export default function PublicTrackingPage() {
  const { trackingId } = useParams()
  const location = useLocation()
  const dealerAuth = useDealerAuth()
  const [data, setData] = useState<PublicTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [remarks, setRemarks] = useState('')

  const isStaff = Boolean(
    dealerAuth.session?.access_token &&
      dealerAuth.profile?.role &&
      STAFF_ROLES.has(String(dealerAuth.profile.role)),
  )

  useEffect(() => {
    load()
  }, [trackingId])

  const load = async () => {
    if (!trackingId) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await api.get<PublicTracking>(`/api/job-cards/public/track/${encodeURIComponent(trackingId)}`)
      setData(result)
    } catch (e) {
      setError((e as Error).message || 'Tracking record not found.')
    }

    setLoading(false)
  }

  const currentStage = useMemo(() => normalizeStage(data?.workflowStage || data?.status), [data?.workflowStage, data?.status])
  const nextStage = useMemo(() => getNextStage(currentStage), [currentStage])

  const updateNextStage = async () => {
    if (!data || !nextStage) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await api.patch<PublicTracking>(
        `/api/job-cards/${encodeURIComponent(data.id)}/workflow`,
        {
          nextStage,
          remarks: remarks.trim() || `Updated from QR scan: ${label(nextStage)}`,
        },
        dealerAuth.session?.access_token || undefined,
      )

      setData(updated)
      setRemarks('')
      setSuccess(`Updated to ${label(nextStage)}.`)
      await load()
    } catch (e) {
      setError((e as Error).message || 'Could not update workflow status.')
    }

    setSaving(false)
  }

  if (loading) return <div style={s.center}>Loading tracking details...</div>

  if (error && !data) {
    return (
      <div style={s.center}>
        <div style={s.error}><AlertTriangle size={22} /> {error || 'Tracking record not found.'}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={s.center}>
        <div style={s.error}><AlertTriangle size={22} /> Tracking record not found.</div>
      </div>
    )
  }

  const vehicleName = [data.vehicle?.nickname, data.vehicle?.oem?.name, data.vehicle?.model?.name].filter(Boolean).join(' · ') || '-'

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.hero}>
          <div>
            <div style={s.brand}>BikeAI Service Tracking</div>
            <h1 style={s.tracking}>{data.number}</h1>
            <p style={s.sub}>{data.dealer?.name || 'Workshop'} · {data.dealer?.city || '-'}</p>
          </div>
          <div style={s.stage}>{label(currentStage)}</div>
        </div>

        {error && <div style={s.errorInline}><AlertTriangle size={16} /> {error}</div>}
        {success && <div style={s.successInline}><CheckCircle2 size={16} /> {success}</div>}

        {isStaff ? (
          <section style={s.staffPanel}>
            <div style={s.staffHeader}>
              <div>
                <h2 style={s.staffTitle}><ShieldCheck size={18} /> Staff QR Update</h2>
                <p style={s.staffHint}>Scan job-card QR at each stage and update only the next valid workflow step.</p>
              </div>
              <span style={s.staffBadge}>Logged in staff</span>
            </div>

            {nextStage ? (
              <>
                <div style={s.nextBox}>
                  <div style={s.infoLabel}>Next allowed action</div>
                  <div style={s.nextAction}>{NEXT_ACTION_LABELS[nextStage] || label(nextStage)}</div>
                </div>
                <textarea value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Optional remarks for this stage..." style={s.textarea} />
                <button onClick={updateNextStage} style={s.staffButton} disabled={saving}>
                  <Save size={16} /> {saving ? 'Updating...' : NEXT_ACTION_LABELS[nextStage] || label(nextStage)}
                </button>
              </>
            ) : (
              <div style={s.empty}>Workflow completed. No further staff action is available.</div>
            )}
          </section>
        ) : (
          <section style={s.customerPanel}>
            <Lock size={16} />
            <span>Customer view only. Workshop staff must log in to update status from this QR.</span>
            <Link to={`/dealer/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} style={s.loginLink}>Staff Login</Link>
          </section>
        )}

        <div style={s.grid}>
          <Info icon={<CheckCircle2 size={18} />} label="Customer" value={data.customer?.fullName || '-'} />
          <Info icon={<Phone size={18} />} label="Phone" value={data.customer?.phone || '-'} />
          <Info icon={<Bike size={18} />} label="Vehicle" value={vehicleName} />
          <Info icon={<Bike size={18} />} label="Registration" value={data.vehicle?.registrationNo || '-'} />
          <Info icon={<Wrench size={18} />} label="Complaint" value={data.complaint || '-'} />
          <Info icon={<MapPin size={18} />} label="Ramp / Bay" value={data.bayNumber ? `Bay ${data.bayNumber}` : '-'} />
          <Info icon={<Clock size={18} />} label="Estimated Ready" value={formatDate(data.estimatedReady)} />
          <Info icon={<Wrench size={18} />} label="Advisor" value={data.advisorName || '-'} />
        </div>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Service Timeline</h2>
          <div style={s.timeline}>
            {(data.wipEvents || []).map(event => (
              <div key={event.id} style={s.timelineItem}>
                <span style={s.dot} />
                <div>
                  <strong>{label(normalizeStage(event.stage))}</strong>
                  <p style={s.timelineText}>{event.remarks || 'Status updated'}</p>
                  <small style={s.time}>{formatDate(event.createdAt)}</small>
                </div>
              </div>
            ))}

            {!data.wipEvents?.length && <div style={s.empty}>Tracking has been created. Updates will appear here.</div>}
          </div>
        </section>

        <button onClick={load} style={s.button}><RefreshCw size={15} /> Refresh Status</button>
      </div>
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={s.info}>
      <div style={s.infoIcon}>{icon}</div>
      <div>
        <div style={s.infoLabel}>{label}</div>
        <div style={s.infoValue}>{value}</div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F7FB', padding: '20px', fontFamily: '"Inter", system-ui, sans-serif', color: '#0B1F4D' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FB', fontFamily: '"Inter", system-ui, sans-serif' },
  card: { maxWidth: '860px', margin: '0 auto', background: '#FFFFFF', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 12px 34px rgba(15,23,42,0.12)' },
  hero: { background: '#0B1F4D', color: '#FFFFFF', padding: '24px', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  brand: { color: '#FFD600', fontSize: '13px', fontWeight: 900 },
  tracking: { margin: '8px 0', fontSize: '34px', fontWeight: 900 },
  sub: { margin: 0, color: '#CBD5E1' },
  stage: { alignSelf: 'flex-start', background: '#FFFFFF', color: '#0B1F4D', borderRadius: '999px', padding: '8px 14px', fontWeight: 900, fontSize: '13px' },
  staffPanel: { margin: '18px', border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '14px', padding: '16px', display: 'grid', gap: '12px' },
  staffHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  staffTitle: { margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' },
  staffHint: { margin: '4px 0 0', color: '#64748B', fontSize: '13px' },
  staffBadge: { background: '#DCFCE7', color: '#15803D', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: 900 },
  nextBox: { background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px' },
  nextAction: { marginTop: '4px', color: '#0B1F4D', fontSize: '20px', fontWeight: 900 },
  staffButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 0, borderRadius: '10px', background: '#0B1F4D', color: '#FFFFFF', padding: '12px 16px', fontWeight: 900, cursor: 'pointer' },
  customerPanel: { margin: '18px', border: '1px solid #DBEAFE', background: '#EFF6FF', borderRadius: '12px', padding: '12px', color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, flexWrap: 'wrap' },
  loginLink: { marginLeft: 'auto', background: '#0B1F4D', color: '#FFFFFF', borderRadius: '8px', padding: '8px 10px', textDecoration: 'none', fontWeight: 900 },
  textarea: { width: '100%', minHeight: '82px', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '10px', font: 'inherit', resize: 'vertical', background: '#FFFFFF' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', padding: '18px' },
  info: { border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' },
  infoIcon: { color: '#2563EB' },
  infoLabel: { color: '#94A3B8', fontSize: '12px', fontWeight: 900 },
  infoValue: { marginTop: '4px', fontSize: '16px', fontWeight: 900 },
  section: { padding: '0 18px 18px' },
  sectionTitle: { fontSize: '18px', margin: '8px 0 14px' },
  timeline: { display: 'grid', gap: '12px' },
  timelineItem: { display: 'grid', gridTemplateColumns: '14px 1fr', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B', marginTop: '5px' },
  timelineText: { margin: '4px 0', color: '#475569' },
  time: { color: '#94A3B8', fontWeight: 700 },
  empty: { border: '1px dashed #CBD5E1', borderRadius: '12px', padding: '14px', color: '#64748B', background: '#FFFFFF' },
  button: { margin: '0 18px 20px', border: 0, borderRadius: '10px', background: '#0B1F4D', color: '#FFFFFF', padding: '12px 16px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  error: { display: 'flex', alignItems: 'center', gap: '10px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '14px', padding: '18px', fontSize: '18px' },
  errorInline: { margin: '18px 18px 0', display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontWeight: 800 },
  successInline: { margin: '18px 18px 0', display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontWeight: 800 },
}
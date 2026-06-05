import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Bike, CheckCircle2, ClipboardCheck, Clock, FileText, Image as ImageIcon, MapPin, Phone, Wrench } from 'lucide-react'
import type { WipApproval, WipCustomerTrackingPayload, WipStatus } from '../types/wip'
import { WIP_STATUS_COPY, WIP_STATUS_FLOW, getWipCustomerTracking, labelWipStatus, respondWipApproval } from '../lib/wipWorkflow'

export default function WipCustomerTrackingPage() {
  const { trackingCode = '' } = useParams()
  const [payload, setPayload] = useState<WipCustomerTrackingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approvalNote, setApprovalNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!trackingCode) return
    load()
  }, [trackingCode])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getWipCustomerTracking(trackingCode)
      if (!data.ok) setError(data.error || 'Tracking link is invalid.')
      setPayload(data)
    } catch (e) {
      setError((e as Error).message || 'Tracking link is invalid.')
    }
    setLoading(false)
  }

  const record = payload?.record
  const serviceCenter = payload?.service_center || {}
  const activeIndex = record ? WIP_STATUS_FLOW.indexOf(record.current_status) : -1
  const pendingApproval = useMemo(() => (payload?.approvals || []).find(item => item.status === 'pending'), [payload?.approvals])

  const submitApproval = async (event: FormEvent, approval: WipApproval, status: 'approved' | 'rejected') => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await respondWipApproval(trackingCode, approval.id, status, approvalNote)
      if (!response.ok) setError(response.error || 'Approval could not be submitted.')
      else {
        setApprovalNote('')
        setMessage(`Approval ${status}.`)
        await load()
      }
    } catch (e) {
      setError((e as Error).message || 'Approval could not be submitted.')
    }
    setSubmitting(false)
  }

  if (loading) return <Shell><div style={s.empty}>Loading service progress...</div></Shell>

  if (error || !payload?.ok || !record) {
    return (
      <Shell>
        <div style={s.error}><AlertTriangle size={18} /> {error || payload?.error || 'Tracking link is invalid.'}</div>
      </Shell>
    )
  }

  return (
    <Shell>
      <section style={s.hero}>
        <div>
          <p style={s.eyebrow}>Service.BikeAI</p>
          <h1 style={s.title}>{WIP_STATUS_COPY[record.current_status].label}</h1>
          <p style={s.sub}>{record.vehicle_registration_no} {record.vehicle_model ? `- ${record.vehicle_model}` : ''}</p>
        </div>
        <StatusBadge status={record.current_status} />
      </section>

      {message && <div style={s.success}><CheckCircle2 size={16} /> {message}</div>}

      <section style={s.card}>
        <h2 style={s.cardTitle}><Clock size={17} /> Live Progress</h2>
        <div style={s.progressRail}>
          {WIP_STATUS_FLOW.map((status, index) => {
            const done = index <= activeIndex
            return (
              <div key={status} style={s.progressStep}>
                <div style={{ ...s.progressDot, background: done ? WIP_STATUS_COPY[status].color : '#CBD5E1' }}>{index + 1}</div>
                <strong style={{ color: done ? '#0B1F4D' : '#94A3B8' }}>{WIP_STATUS_COPY[status].label}</strong>
                <span>{WIP_STATUS_COPY[status].description}</span>
              </div>
            )
          })}
        </div>
      </section>

      <div style={s.grid}>
        <section style={s.card}>
          <h2 style={s.cardTitle}><Bike size={17} /> Vehicle</h2>
          <Info label="Dealer DMS Job" value={record.dealer_dms_job_no} />
          <Info label="Vehicle" value={`${record.vehicle_registration_no} ${record.vehicle_model || ''}`.trim()} />
          <Info label="Customer" value={record.customer_name || 'Customer'} />
          <Info label="Promised time" value={formatDateTime(record.promised_at)} />
          <Info label="Invoice" value={record.dealer_dms_invoice_no || 'Not generated yet'} />
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}><MapPin size={17} /> Workshop</h2>
          <Info label="Name" value={readString(serviceCenter, 'name', 'BikeAI partner workshop')} />
          <Info label="City" value={readString(serviceCenter, 'city', '-')} />
          <Info label="Phone" value={readString(serviceCenter, 'phone', '-')} />
          <a href={`tel:${readString(serviceCenter, 'phone', '')}`} style={s.outlineBtn}><Phone size={14} /> Call Workshop</a>
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}><ClipboardCheck size={17} /> Approval</h2>
          {pendingApproval ? (
            <form style={s.stack}>
              <strong>{pendingApproval.title}</strong>
              <p style={s.muted}>{pendingApproval.description || 'Workshop has requested customer approval.'}</p>
              <p style={s.amount}>INR {Number(pendingApproval.estimate_amount || 0).toLocaleString('en-IN')}</p>
              <textarea value={approvalNote} onChange={event => setApprovalNote(event.target.value)} placeholder="Optional note" style={s.textarea} />
              <div style={s.actions}>
                <button onClick={event => submitApproval(event, pendingApproval, 'approved')} disabled={submitting} style={s.primaryBtn}>Approve</button>
                <button onClick={event => submitApproval(event, pendingApproval, 'rejected')} disabled={submitting} style={s.outlineBtn}>Reject</button>
              </div>
            </form>
          ) : (
            <div style={s.muted}>No pending approval.</div>
          )}
          {(payload.approvals || []).filter(item => item.status !== 'pending').map(item => (
            <div key={item.id} style={s.approvalRow}>
              <span>{item.title}</span>
              <strong>{labelWipStatus(item.status)}</strong>
            </div>
          ))}
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}><FileText size={17} /> Updates</h2>
          <div style={s.timeline}>
            {(payload.history || []).map(item => (
              <div key={item.id} style={s.timelineItem}>
                <span style={{ ...s.timelineDot, background: WIP_STATUS_COPY[item.status_to]?.color || '#94A3B8' }} />
                <div>
                  <strong>{labelWipStatus(item.status_to)}</strong>
                  <p>{item.note || item.status_detail || WIP_STATUS_COPY[item.status_to]?.description}</p>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
              </div>
            ))}
            {!(payload.history || []).length && <p style={s.muted}>No workshop updates yet.</p>}
          </div>
        </section>
      </div>

      {(payload.photos || []).length > 0 && (
        <section style={s.card}>
          <h2 style={s.cardTitle}><ImageIcon size={17} /> Photos</h2>
          <div style={s.photoGrid}>
            {(payload.photos || []).map(photo => (
              <a key={photo.id} href={photo.photo_url} target="_blank" rel="noreferrer" style={s.photoLink}>
                <span>{labelWipStatus(photo.photo_type)}</span>
                <small>{photo.caption || 'View photo'}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      <section style={s.footerBand}>
        <Wrench size={16} />
        <span>Tracking record closed when the vehicle is delivered.</span>
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main style={s.root}>{children}</main>
}

function StatusBadge({ status }: { status: WipStatus }) {
  const copy = WIP_STATUS_COPY[status]
  return <span style={{ ...s.badge, background: `${copy.color}18`, color: copy.color }}>{copy.label}</span>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.info}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function readString(source: Record<string, unknown>, key: string, fallback: string) {
  const value = source[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#F5F7FB', color: '#0F172A', padding: '20px', fontFamily: '"Inter", system-ui, sans-serif' },
  hero: { maxWidth: '1080px', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px', flexWrap: 'wrap' },
  eyebrow: { margin: 0, color: '#B7791F', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' },
  title: { margin: '4px 0', color: '#0B1F4D', fontSize: '28px', fontWeight: 900 },
  sub: { margin: 0, color: '#64748B', fontSize: '13px' },
  grid: { maxWidth: '1080px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '14px' },
  card: { maxWidth: '1080px', margin: '0 auto 14px', width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  cardTitle: { margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0B1F4D', fontSize: '16px' },
  badge: { borderRadius: '999px', padding: '7px 12px', fontSize: '12px', fontWeight: 900 },
  progressRail: { display: 'grid', gridTemplateColumns: 'repeat(8, minmax(108px, 1fr))', gap: '10px', overflowX: 'auto', paddingBottom: '4px' },
  progressStep: { display: 'grid', gap: '6px', alignContent: 'start', minWidth: '108px', fontSize: '12px', color: '#64748B' },
  progressDot: { width: '30px', height: '30px', borderRadius: '50%', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 },
  info: { display: 'grid', gap: '3px', borderBottom: '1px solid #F1F5F9', padding: '9px 0', fontSize: '13px' },
  muted: { color: '#64748B', fontSize: '13px', lineHeight: 1.5, margin: 0 },
  amount: { margin: 0, color: '#0B1F4D', fontSize: '20px', fontWeight: 900 },
  stack: { display: 'grid', gap: '10px' },
  textarea: { width: '100%', minHeight: '76px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px', font: 'inherit', resize: 'vertical' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 0, borderRadius: '8px', background: '#0B1F4D', color: '#FFFFFF', padding: '10px 15px', font: 'inherit', fontSize: '13px', fontWeight: 900, cursor: 'pointer' },
  outlineBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', background: '#FFFFFF', color: '#0B1F4D', padding: '10px 15px', font: 'inherit', fontSize: '13px', fontWeight: 900, cursor: 'pointer', textDecoration: 'none', marginTop: '10px' },
  approvalRow: { marginTop: '10px', display: 'flex', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', fontSize: '13px' },
  timeline: { display: 'grid', gap: '10px' },
  timelineItem: { display: 'grid', gridTemplateColumns: '12px 1fr', gap: '10px', fontSize: '13px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' },
  timelineDot: { width: '9px', height: '9px', borderRadius: '50%', marginTop: '5px' },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' },
  photoLink: { display: 'grid', gap: '4px', color: '#0B1F4D', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: 900 },
  success: { maxWidth: '1080px', margin: '0 auto 14px', display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' },
  error: { maxWidth: '720px', margin: '80px auto', display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px', fontSize: '14px' },
  empty: { maxWidth: '720px', margin: '80px auto', textAlign: 'center', color: '#64748B', background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '24px' },
  footerBand: { maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px' },
}

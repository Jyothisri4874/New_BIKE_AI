import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Save,
  Wrench,
  User,
  Bike,
  IndianRupee,
  Plus,
  Trash2,
  CheckCircle,
} from 'lucide-react'
import { api, safeGet } from '../lib/api'

type JobStatus = 'open' | 'in_progress' | 'qc' | 'ready' | 'delivered' | 'cancelled'

type WorkOrderStage =
  | 'TRACKING_CREATED'
  | 'WORK_ALLOCATED'
  | 'INSPECTION_COMPLETED'
  | 'ESTIMATE_CREATED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PARTIAL_APPROVAL'
  | 'PARTS_AVAILABLE'
  | 'PARTS_ISSUED'
  | 'PARTS_PENDING'
  | 'WORK_IN_PROGRESS'
  | 'ADDITIONAL_APPROVAL_PENDING'
  | 'ADDITIONAL_JOB_APPROVED'
  | 'ADDITIONAL_JOB_REJECTED'
  | 'WORK_COMPLETED'
  | 'WASHING'
  | 'WASH_COMPLETED'
  | 'QC_PASS'
  | 'QC_FAIL'
  | 'REWORK_REQUIRED'
  | 'READY_FOR_BILLING'
  | 'INVOICE_GENERATED'
  | 'READY_FOR_DELIVERY'
  | 'PAYMENT_RECEIVED'
  | 'GATE_PASS_GENERATED'
  | 'DELIVERED'
  | 'FEEDBACK_RECEIVED'

type WipEvent = {
  id: string
  stage: WorkOrderStage
  remarks?: string | null
  updatedBy?: string | null
  userRole?: string | null
  photoUrl?: string | null
  createdAt: string
}

type ItemKind = 'labour' | 'part'

type JobCardItem = {
  id: string
  kind: ItemKind
  name: string
  partNumber?: string | null
  quantity: string | number
  unitPrice: string | number
  taxPercent: string | number
  total: string | number
}

type JobCard = {
  id: string
  number: string
  bookingId?: string | null
  booking?: {
    serviceType?: string | null
    service_type?: string | null
    reportedIssues?: any
    reported_issues?: any
    scheduledAt?: string | null
    scheduled_at?: string | null
  } | null
  dealerId: string
  customerId: string
  vehicleId: string
  status: JobStatus
  priority: number
  odometerKm?: number | null
  fuelLevel?: string | null
  complaint?: string | null
  estimateTotal?: string | number | null
  estimatedReady?: string | null
  advisorName?: string | null
  technicianName?: string | null
  bayNumber?: number | null
  source?: string | null
  dealerJobCardFileUrl?: string | null
  dealerJobCardFileType?: string | null
  dealerJobCardFileName?: string | null
  createdAt?: string
  updatedAt?: string
  customer?: {
    fullName?: string
    phone?: string
    email?: string | null
  } | null
  vehicle?: {
    nickname?: string | null
    registrationNo?: string | null
    brand?: string | null
    model_name?: string | null
    color?: string | null
    fuelType?: string | null
    year?: number | null
    odometerKm?: number | null
    oem?: { name?: string } | null
    model?: { name?: string } | null
  } | null
  dealer?: {
    name?: string
    city?: string | null
  } | null
  technician?: {
    fullName?: string | null
    phone?: string | null
  } | null
  items?: JobCardItem[]
  workflowStage?: WorkOrderStage
  wipEvents?: WipEvent[]
}

function money(value?: string | number | null) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN')}`
}

function label(value?: string | null) {
  if (!value) return '-'
  return String(value).replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const WORKFLOW_SEQUENCE: WorkOrderStage[] = [
  'TRACKING_CREATED',
  'WORK_ALLOCATED',
  'INSPECTION_COMPLETED',
  'ESTIMATE_CREATED',
  'APPROVAL_PENDING',
  'APPROVED',
  'PARTS_ISSUED',
  'WORK_IN_PROGRESS',
  'WORK_COMPLETED',
  'WASHING',
  'WASH_COMPLETED',
  'QC_PASS',
  'READY_FOR_BILLING',
  'INVOICE_GENERATED',
  'READY_FOR_DELIVERY',
  'PAYMENT_RECEIVED',
  'GATE_PASS_GENERATED',
  'DELIVERED',
  'FEEDBACK_RECEIVED',
]

const NEXT_ACTION_LABELS: Record<WorkOrderStage, string> = {
  TRACKING_CREATED: 'Allocate Work',
  WORK_ALLOCATED: 'Complete Inspection',
  INSPECTION_COMPLETED: 'Create Estimate',
  ESTIMATE_CREATED: 'Send Estimate for Approval',
  APPROVAL_PENDING: 'Mark Approved',
  APPROVED: 'Issue Parts',
  PARTS_ISSUED: 'Start Work',
  WORK_IN_PROGRESS: 'Mark Work Completed',
  WORK_COMPLETED: 'Start Washing',
  WASHING: 'Complete Washing',
  WASH_COMPLETED: 'QC Passed',
  QC_PASS: 'Ready for Billing',
  READY_FOR_BILLING: 'Invoice Generated',
  INVOICE_GENERATED: 'Ready for Delivery',
  READY_FOR_DELIVERY: 'Payment Received',
  PAYMENT_RECEIVED: 'Generate Gate Pass',
  GATE_PASS_GENERATED: 'Deliver Vehicle',
  DELIVERED: 'Collect Feedback',
  FEEDBACK_RECEIVED: 'Completed',

  REJECTED: 'Rejected',
  PARTIAL_APPROVAL: 'Partial Approval',
  PARTS_AVAILABLE: 'Parts Available',
  PARTS_PENDING: 'Parts Pending',
  ADDITIONAL_APPROVAL_PENDING: 'Additional Approval Pending',
  ADDITIONAL_JOB_APPROVED: 'Additional Job Approved',
  ADDITIONAL_JOB_REJECTED: 'Additional Job Rejected',
  QC_FAIL: 'QC Failed',
  REWORK_REQUIRED: 'Rework Required',
}

function getNextStage(current?: WorkOrderStage) {
  const stage = current || 'TRACKING_CREATED'
  const index = WORKFLOW_SEQUENCE.indexOf(stage)
  if (index < 0 || index >= WORKFLOW_SEQUENCE.length - 1) return null
  return WORKFLOW_SEQUENCE[index + 1]
}

function stageLabel(stage?: string | null) {
  return label(stage || 'TRACKING_CREATED')
}

function formatEventTime(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function vehicleTitle(job: JobCard | null) {
  if (!job?.vehicle) return '-'
  const v = job.vehicle
  const oem = v.oem?.name || v.brand || ''
  const model = v.model?.name || v.model_name || ''
  return [v.nickname, oem, model].filter(Boolean).join(' · ') || '-'
}

function vehicleMeta(job: JobCard | null) {
  if (!job?.vehicle) return '-'
  const v = job.vehicle
  return [v.color, v.fuelType, v.year].filter(Boolean).join(' · ') || '-'
}

function serviceTypeLabel(job: JobCard | null) {
  const value = job?.booking?.serviceType || job?.booking?.service_type || ''
  return label(value || 'Service')
}

function getTrackingUrl(job: JobCard | null) {
  const trackingId = job?.number || ''
  return trackingId ? `https://service.bikeai.in/track/${encodeURIComponent(trackingId)}` : ''
}

function getWhatsApp(job: JobCard | null) {
  return job?.customer?.phone || '-'
}

function getExpectedDelivery(job: JobCard | null) {
  if (!job?.estimatedReady) return ''
  const d = new Date(job.estimatedReady)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function isWalkInJob(job: JobCard | null) {
  if (!job) return false
  const reported = job.booking?.reportedIssues || job.booking?.reported_issues || {}
  return job.source === 'WALK_IN_UPLOAD' || reported?.source === 'WALK_IN_UPLOAD'
}

function printTrackingSlip(job: JobCard | null) {
  if (!job) return

  const trackingUrl = getTrackingUrl(job)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`

  const customerName = job.customer?.fullName || '-'
  const phone = job.customer?.phone || '-'
  const whatsapp = getWhatsApp(job)
  const vehicleNumber = job.vehicle?.registrationNo || '-'
  const vehicleModel = vehicleTitle(job)
  const odometer = job.odometerKm ? `${Number(job.odometerKm).toLocaleString('en-IN')} km` : '-'
  const serviceType = serviceTypeLabel(job)
  const workshop = [job.dealer?.name, job.dealer?.city].filter(Boolean).join(', ') || '-'
  const trackingId = job.number || '-'
  const currentStatus = label(job.status)
  const expectedDelivery = getExpectedDelivery(job) || 'Pending'
  const advisor = job.advisorName || ''
  const technician = job.technicianName || ''
  const bay = job.bayNumber ? `Bay ${job.bayNumber}` : ''

  const html = `
<!doctype html>
<html>
<head>
  <title>BikeAI Tracking Slip - ${trackingId}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      color: #071b4d;
      background: #ffffff;
    }

    body {
      width: 100%;
      font-size: 11px;
      line-height: 1.25;
    }

    .print-button {
      margin: 0 0 8px;
      padding: 8px 12px;
      border: 0;
      border-radius: 8px;
      background: #0b1f4d;
      color: #ffffff;
      font-weight: 800;
      cursor: pointer;
    }

    .slip {
      width: 100%;
      max-width: 190mm;
      min-height: 270mm;
      margin: 0 auto;
      border: 1px solid #d7deea;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }

    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      background: #0b1f4d;
      color: #ffffff;
      padding: 12px 14px;
      border-bottom: 4px solid #f6a619;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-box {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(246, 166, 25, 0.8);
      display: grid;
      place-items: center;
      font-weight: 900;
      color: #f6a619;
      font-size: 12px;
    }

    .brand-title {
      margin: 0;
      font-size: 23px;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .brand-sub {
      margin: 2px 0 0;
      font-size: 12px;
      font-weight: 700;
      color: #e5ecff;
    }

    .qr-box {
      background: #ffffff;
      border-radius: 8px;
      padding: 6px;
      width: 112px;
      height: 112px;
      display: grid;
      place-items: center;
    }

    .qr-box img {
      width: 100px;
      height: 100px;
      display: block;
    }

    .content {
      padding: 10px 14px 12px;
    }

    .scan-text {
      margin: 0;
      font-size: 11px;
      font-weight: 800;
      color: #071b4d;
    }

    .url {
      margin: 2px 0 8px;
      color: #64748b;
      font-size: 9.5px;
      word-break: break-all;
    }

    h2 {
      margin: 8px 0 5px;
      font-size: 14px;
      font-weight: 900;
      color: #071b4d;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      page-break-inside: avoid;
    }

    td {
      border: 1px solid #d7deea;
      padding: 5px 7px;
      vertical-align: top;
      color: #071b4d;
      font-size: 10.5px;
    }

    td:first-child {
      width: 31%;
      background: #f3f6fb;
      font-weight: 900;
      color: #334155;
    }

    .tracking-cell {
      font-weight: 900;
      color: #0b1f4d;
      letter-spacing: 0.02em;
    }

    .blank-line {
      display: block;
      min-height: 14px;
      border-bottom: 1px dashed #94a3b8;
    }

    .note {
      margin: 7px 0 0;
      padding: 7px 8px;
      border-radius: 8px;
      background: #fff7ed;
      color: #64748b;
      font-size: 9.3px;
      line-height: 1.25;
      page-break-inside: avoid;
    }

    .footer {
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 8.8px;
    }

    @media print {
      .print-button {
        display: none;
      }

      .slip {
        border-radius: 0;
        min-height: auto;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">Print / Save as PDF</button>

  <div class="slip">
    <div class="hero">
      <div class="brand-row">
        <div class="logo-box">BikeAI</div>
        <div>
          <h1 class="brand-title">Service.BikeAI</h1>
          <p class="brand-sub">Customer Vehicle Tracking Slip</p>
        </div>
      </div>

      <div class="qr-box">
        <img src="${qrUrl}" />
      </div>
    </div>

    <div class="content">
      <p class="scan-text">Scan the QR code or open the tracking URL to view live vehicle service status.</p>
      <p class="url">${trackingUrl}</p>

      <h2>Customer Details</h2>
      <table>
        <tr><td>Customer Name</td><td>${customerName}</td></tr>
        <tr><td>Mobile Number</td><td>${phone}</td></tr>
        <tr><td>WhatsApp Number</td><td>${whatsapp}</td></tr>
        <tr><td>Address / Area</td><td>${job.dealer?.city || ''}</td></tr>
      </table>

      <h2>Vehicle Details</h2>
      <table>
        <tr><td>Vehicle Number</td><td>${vehicleNumber}</td></tr>
        <tr><td>Vehicle Model</td><td>${vehicleModel}</td></tr>
        <tr><td>Odometer</td><td>${odometer}</td></tr>
        <tr><td>Service Type</td><td>${serviceType}</td></tr>
      </table>

      <h2>Dealer DMS Reference</h2>
      <table>
        <tr><td>Dealer / Workshop</td><td>${workshop}</td></tr>
        <tr><td>DMS Job Card No.</td><td><span class="blank-line"></span></td></tr>
        <tr><td>BikeAI Tracking ID</td><td class="tracking-cell">${trackingId}</td></tr>
        <tr><td>Current Status</td><td>${currentStatus}</td></tr>
      </table>

      <h2>WIP Status Flow</h2>
      <table>
        <tr><td>Stages</td><td>Received → Inspection → Approval → Repair → Wash → QC → Ready → Delivered</td></tr>
        <tr><td>Expected Delivery</td><td>${expectedDelivery}</td></tr>
        <tr><td>Ramp / Bay</td><td>${bay}</td></tr>
        <tr><td>Advisor</td><td>${advisor}</td></tr>
        <tr><td>Technician</td><td>${technician}</td></tr>
      </table>

      <p class="note">
        Note: Dealer DMS remains the official job card and billing system. BikeAI provides WIP tracking, QR link, customer status updates, approval flow, and WhatsApp notifications.
      </p>

      <div class="footer">
        <span>BikeAI Tracking ID: ${trackingId}</span>
        <span>Generated from Service.BikeAI</span>
      </div>
    </div>
  </div>
</body>
</html>
`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
}

export default function DealerJobCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<JobCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [trackingId, setTrackingId] = useState('')
  const [odometerKm, setOdometerKm] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')
  const [complaint, setComplaint] = useState('')
  const [estimatedReady, setEstimatedReady] = useState('')
  const [advisorName, setAdvisorName] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [bayNumber, setBayNumber] = useState('')
  const [workflowRemarks, setWorkflowRemarks] = useState('')

  const [itemKind, setItemKind] = useState<ItemKind>('labour')
  const [itemName, setItemName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [taxPercent, setTaxPercent] = useState('0')

  const load = async () => {
    if (!id) return
    setLoading(true)
    setError('')

    const data = await safeGet<JobCard | null>(`/api/job-cards/${encodeURIComponent(id)}`, null)

    if (!data) {
      setError('BikeAI tracking record not found.')
      setJob(null)
      setLoading(false)
      return
    }

    setJob(data)
    setTrackingId(data.number || '')
    setOdometerKm(data.odometerKm ? String(data.odometerKm) : data.vehicle?.odometerKm ? String(data.vehicle.odometerKm) : '')
    setFuelLevel(data.fuelLevel || '')
    setComplaint(data.complaint || '')
    setEstimatedReady(data.estimatedReady ? data.estimatedReady.slice(0, 16) : '')
    setAdvisorName(data.advisorName || '')
    setTechnicianName(data.technicianName || '')
    setBayNumber(data.bayNumber ? String(data.bayNumber) : '')
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const saveJob = async () => {
    if (!id || !job) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.patch(`/api/job-cards/${encodeURIComponent(id)}`, {
        odometerKm: odometerKm ? Number(odometerKm) : undefined,
        fuelLevel: fuelLevel || undefined,
        complaint: complaint || undefined,
        estimatedReady: estimatedReady ? new Date(estimatedReady).toISOString() : undefined,
        advisorName: advisorName || undefined,
        technicianName: technicianName || undefined,
        bayNumber: bayNumber ? Number(bayNumber) : undefined,
      })

      setSuccess('BikeAI tracking details saved.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save BikeAI tracking details.')
    } finally {
      setSaving(false)
    }
  }

  // const _updateStatus = async (status: JobStatus) => {
  //   if (!id) return
  //   setSaving(true)
  //   setError('')
  //   setSuccess('')

  //   try {
  //     await api.patch(`/api/job-cards/${encodeURIComponent(id)}/status`, { status })

  //     if (job?.bookingId) {
  //       const bookingStatus =
  //         status === 'ready' ? 'ready_for_delivery' :
  //         status === 'delivered' ? 'completed' :
  //         status === 'cancelled' ? 'cancelled' :
  //         'in_progress'

  //       await api.patch(`/api/bookings/${encodeURIComponent(job.bookingId)}/status`, {
  //         status: bookingStatus,
  //         note: `BikeAI tracking moved to ${label(status)}`,
  //       })
  //     }

  //     setSuccess(`Status updated to ${label(status)}.`)
  //     await load()
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : 'Failed to update status.')
  //   } finally {
  //     setSaving(false)
  //   }
  // }

  const moveWorkflowStage = async () => {
  if (!id || !job) return

  const currentStage = job.workflowStage || 'TRACKING_CREATED'
  const nextStage = getNextStage(currentStage)

  if (!nextStage) {
    setError('No next workflow stage is available.')
    return
  }

  setSaving(true)
  setError('')
  setSuccess('')

  try {
    await api.patch(`/api/job-cards/${encodeURIComponent(id)}/workflow`, {
      nextStage,
      remarks: workflowRemarks || undefined,
    })

    setWorkflowRemarks('')
    setSuccess(`Moved to ${stageLabel(nextStage)}.`)
    await load()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to update workflow stage.')
  } finally {
    setSaving(false)
  }
}

  const addItem = async () => {
    if (!id || !itemName.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.post(`/api/job-cards/${encodeURIComponent(id)}/items`, {
        kind: itemKind,
        name: itemName.trim(),
        partNumber: partNumber.trim() || undefined,
        quantity: Number(quantity || 1),
        unitPrice: Number(unitPrice || 0),
        taxPercent: Number(taxPercent || 0),
      })

      setItemName('')
      setPartNumber('')
      setQuantity('1')
      setUnitPrice('0')
      setTaxPercent('0')
      setSuccess('Item added.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item.')
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (itemId: string) => {
    if (!window.confirm('Remove this item?')) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.delete(`/api/job-cards/items/${encodeURIComponent(itemId)}`)
      setSuccess('Item removed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={s.loading}>Loading BikeAI tracking...</div>
  }

  if (!job) {
    return (
      <div style={s.page}>
        <div style={s.top}>
          <button style={s.backBtn} onClick={() => navigate('/dealer/bookings')}>
            <ArrowLeft size={16} /> Back to Bookings
          </button>
        </div>
        {error && <div style={s.error}>{error}</div>}
      </div>
    )
  }

  const status = String(job.status || 'open') as JobStatus
  const backToWip = isWalkInJob(job)
  const backTarget = backToWip ? '/dealer/wip' : '/dealer/bookings'
  const backLabel = backToWip ? 'Back to WIP Tracking' : 'Back to Bookings'

  return (
    <div style={s.page}>
      <div style={s.top}>
        <button style={s.backBtn} onClick={() => navigate(backTarget)}>
          <ArrowLeft size={16} /> {backLabel}
        </button>

        <button style={s.refreshBtn} onClick={load} disabled={saving}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}><CheckCircle size={16} /> {success}</div>}

      <section style={s.hero}>
        <div>
          <div style={s.kicker}>BikeAI Tracking ID</div>
          <h1 style={s.title}>{trackingId || job.number}</h1>
          <p style={s.sub}>
            {job.dealer?.name || 'Workshop'}{job.dealer?.city ? ` · ${job.dealer.city}` : ''}
          </p>
        </div>

        <span style={{ ...s.statusBadge, ...statusStyle(status) }}>
          {label(status)}
        </span>
      </section>

      <div style={s.grid}>
        <section style={s.card}>
          <h2 style={s.cardTitle}><ClipboardList size={18} /> Tracking Details</h2>

          <div style={s.formGrid}>
            <label style={s.field}>
              BikeAI Tracking ID *
              <input
                style={{ ...s.input, background: '#f8fafc', cursor: 'not-allowed' }}
                value={trackingId}
                readOnly
                placeholder="TRK-009812"
              />
            </label>

            <label style={s.field}>
              Odometer KM
              <input style={s.input} type="number" value={odometerKm} onChange={e => setOdometerKm(e.target.value)} />
            </label>

            <label style={s.field}>
              Fuel Level
              <select style={s.input} value={fuelLevel} onChange={e => setFuelLevel(e.target.value)}>
                <option value="">Select fuel level</option>
                <option value="empty">Empty</option>
                <option value="quarter">Quarter</option>
                <option value="half">Half</option>
                <option value="three_quarter">Three Quarter</option>
                <option value="full">Full</option>
              </select>
            </label>

            <label style={s.field}>
              Estimated Ready Time
              <input style={s.input} type="datetime-local" value={estimatedReady} onChange={e => setEstimatedReady(e.target.value)} />
            </label>

            <label style={s.field}>
              Advisor
              <input
                style={s.input}
                value={advisorName}
                onChange={e => setAdvisorName(e.target.value)}
                placeholder="Enter advisor name"
              />
            </label>

            <label style={s.field}>
              Technician
              <input
                style={s.input}
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                placeholder="Enter technician name"
              />
            </label>

            <label style={s.field}>
              Ramp / Bay Number
              <select style={s.input} value={bayNumber} onChange={e => setBayNumber(e.target.value)}>
                <option value="">Select ramp / bay</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Bay {n}</option>
                ))}
              </select>
            </label>

            <label style={s.fullField}>
              Customer Complaint / Intake Notes
              <textarea style={s.textarea} value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Complaint, service notes, customer instructions..." />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={s.primaryBtn} onClick={saveJob} disabled={saving || !trackingId.trim()}>
              <Save size={16} /> Save Tracking
            </button>
            <button style={s.secondaryBtn} onClick={() => printTrackingSlip(job)} disabled={saving}>
              Print / Download Slip
            </button>
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}><User size={18} /> Customer</h2>
          <Info label="Name" value={job.customer?.fullName || '-'} />
          <Info label="Phone" value={job.customer?.phone || '-'} />
          <Info label="Email" value={job.customer?.email || '-'} />
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}><Bike size={18} /> Vehicle</h2>
          <Info label="Vehicle" value={vehicleTitle(job)} />
          <Info label="Registration" value={job.vehicle?.registrationNo || '-'} />
          <Info label="Details" value={vehicleMeta(job)} />
          <Info label="Odometer" value={job.odometerKm ? `${job.odometerKm.toLocaleString('en-IN')} km` : '-'} />
        </section>

        <section style={s.card}>
  <h2 style={s.cardTitle}><Wrench size={18} /> Workflow</h2>

  <div style={s.stageBox}>
    <span style={s.infoLabel}>Current Stage</span>
    <strong style={s.stageValue}>{stageLabel(job.workflowStage)}</strong>
  </div>

  {getNextStage(job.workflowStage) ? (
    <>
      <div style={s.stageBox}>
        <span style={s.infoLabel}>Next Allowed Action</span>
        <strong style={s.nextAction}>
          {NEXT_ACTION_LABELS[getNextStage(job.workflowStage)!] || stageLabel(getNextStage(job.workflowStage))}
        </strong>
      </div>

      <textarea
        style={s.smallTextarea}
        value={workflowRemarks}
        onChange={e => setWorkflowRemarks(e.target.value)}
        placeholder="Remarks for this stage update..."
      />

      <button style={s.primaryBtn} onClick={moveWorkflowStage} disabled={saving}>
        {saving ? 'Updating...' : NEXT_ACTION_LABELS[getNextStage(job.workflowStage)!]}
      </button>
    </>
  ) : (
    <p style={s.hint}>Workflow completed.</p>
  )}

  <p style={s.hint}>
    Only the next valid stage is available. Staff QR page will use the same rule.
  </p>
</section>

      </div>

      <section style={s.card}>
  <h2 style={s.cardTitle}><ClipboardList size={18} /> WIP Timeline</h2>

  {!job.wipEvents?.length ? (
    <div style={s.emptyTimeline}>No WIP events yet.</div>
  ) : (
    <div style={s.timeline}>
      {job.wipEvents.map(event => (
        <div key={event.id} style={s.timelineItem}>
          <div style={s.timelineDot} />
          <div>
            <strong style={s.timelineStage}>{stageLabel(event.stage)}</strong>
            <div style={s.timelineTime}>{formatEventTime(event.createdAt)}</div>
            {event.remarks && <div style={s.timelineRemarks}>{event.remarks}</div>}
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      <section style={s.card}>
        <h2 style={s.cardTitle}><IndianRupee size={18} /> Labour / Parts / Spares</h2>

        <div style={s.itemForm}>
          <select style={s.input} value={itemKind} onChange={e => setItemKind(e.target.value as ItemKind)}>
            <option value="labour">Labour</option>
            <option value="part">Part / Spare</option>
          </select>

          <input style={s.input} value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item name" />
          <input style={s.input} value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="Part no optional" />
          <input style={s.input} type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" />
          <input style={s.input} type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="Unit price" />
          <input style={s.input} type="number" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} placeholder="Tax %" />

          <button style={s.primaryBtn} onClick={addItem} disabled={saving || !itemName.trim()}>
            <Plus size={16} /> Add
          </button>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Type</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Part No</th>
                <th style={s.th}>Qty</th>
                <th style={s.th}>Unit</th>
                <th style={s.th}>Tax</th>
                <th style={s.th}>Total</th>
                <th style={s.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(job.items || []).map(item => (
                <tr key={item.id}>
                  <td style={s.td}>{label(item.kind)}</td>
                  <td style={s.td}>{item.name}</td>
                  <td style={s.td}>{item.partNumber || '-'}</td>
                  <td style={s.td}>{String(item.quantity)}</td>
                  <td style={s.td}>{money(item.unitPrice)}</td>
                  <td style={s.td}>{String(item.taxPercent)}%</td>
                  <td style={s.td}>{money(item.total)}</td>
                  <td style={s.td}>
                    <button style={s.deleteBtn} onClick={() => removeItem(item.id)} disabled={saving}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!job.items?.length && (
                <tr>
                  <td style={s.emptyTd} colSpan={8}>No items added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={s.totalBox}>
          Estimate Total: <strong>{money(job.estimateTotal)}</strong>
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <strong style={s.infoValue}>{value}</strong>
    </div>
  )
}

function statusStyle(status: JobStatus): React.CSSProperties {
  if (status === 'open') return { background: '#fff7ed', color: '#ea580c' }
  if (status === 'in_progress') return { background: '#eff6ff', color: '#2563eb' }
  if (status === 'qc') return { background: '#f5f3ff', color: '#7c3aed' }
  if (status === 'ready') return { background: '#ecfdf5', color: '#16a34a' }
  if (status === 'delivered') return { background: '#f0fdf4', color: '#15803d' }
  return { background: '#fef2f2', color: '#dc2626' }
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#071b4d',
    display: 'grid',
    gap: '18px',
  },
  loading: {
    padding: '48px',
    color: '#64748b',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #cbd5e1',
    background: 'white',
    color: '#071b4d',
    borderRadius: '10px',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #cbd5e1',
    background: 'white',
    color: '#071b4d',
    borderRadius: '10px',
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    padding: '13px 15px',
    borderRadius: '10px',
  },
  success: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#15803d',
    padding: '13px 15px',
    borderRadius: '10px',
  },
  hero: {
    background: '#0b1f4d',
    color: 'white',
    borderRadius: '18px',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
  },
  kicker: {
    color: '#f6a619',
    fontWeight: 900,
    textTransform: 'uppercase',
    fontSize: '12px',
    letterSpacing: '.05em',
  },
  title: {
    margin: '6px 0 0',
    fontSize: '32px',
    fontWeight: 900,
  },
  sub: {
    margin: '8px 0 0',
    color: '#cbd5e1',
  },
  statusBadge: {
    display: 'inline-flex',
    padding: '7px 12px',
    borderRadius: '999px',
    fontWeight: 900,
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(420px, 1.2fr) repeat(3, minmax(220px, .8fr))',
    gap: '16px',
    alignItems: 'stretch',
  },
  card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '18px',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
  },
  cardTitle: {
    margin: '0 0 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '18px',
    fontWeight: 900,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '14px',
  },
  field: {
    display: 'grid',
    gap: '6px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 800,
  },
  fullField: {
    gridColumn: '1 / -1',
    display: 'grid',
    gap: '6px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 800,
  },
  input: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 12px',
    font: 'inherit',
    fontSize: '14px',
    outline: 'none',
    background: 'white',
  },
  textarea: {
    width: '100%',
    minHeight: '88px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 12px',
    font: 'inherit',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    border: 'none',
    borderRadius: '10px',
    background: '#0b1f4d',
    color: 'white',
    padding: '10px 14px',
    font: 'inherit',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: 'white',
    color: '#0b1f4d',
    padding: '10px 14px',
    font: 'inherit',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  infoRow: {
    display: 'grid',
    gap: '4px',
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#071b4d',
    fontSize: '14px',
    lineHeight: 1.4,
  },
  statusActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#071b4d',
    borderRadius: '10px',
    padding: '8px 11px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  hint: {
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.5,
    marginTop: '14px',
  },
  itemForm: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr 150px 90px 120px 90px 100px',
    gap: '10px',
    marginBottom: '16px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '850px',
  },
  th: {
    textAlign: 'left',
    padding: '11px',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  td: {
    padding: '12px 11px',
    borderTop: '1px solid #e2e8f0',
    fontSize: '14px',
  },
  emptyTd: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748b',
    borderTop: '1px solid #e2e8f0',
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    border: 'none',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#dc2626',
    padding: '7px 9px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  totalBox: {
    marginTop: '14px',
    padding: '14px',
    borderRadius: '12px',
    background: '#f8fafc',
    textAlign: 'right',
    color: '#071b4d',
  },
  stageBox: {
  display: 'grid',
  gap: '5px',
  padding: '10px 0',
  borderBottom: '1px solid #f1f5f9',
},
stageValue: {
  color: '#071b4d',
  fontSize: '15px',
  lineHeight: 1.35,
},
nextAction: {
  color: '#2563eb',
  fontSize: '15px',
  lineHeight: 1.35,
},
smallTextarea: {
  width: '100%',
  minHeight: '72px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: '13px',
  outline: 'none',
  resize: 'vertical',
  margin: '12px 0',
},
timeline: {
  display: 'grid',
  gap: '12px',
},
timelineItem: {
  display: 'grid',
  gridTemplateColumns: '16px 1fr',
  gap: '10px',
  alignItems: 'start',
  paddingBottom: '12px',
  borderBottom: '1px solid #f1f5f9',
},
timelineDot: {
  width: '10px',
  height: '10px',
  borderRadius: '999px',
  background: '#f6a619',
  marginTop: '5px',
},
timelineStage: {
  color: '#071b4d',
  fontSize: '14px',
},
timelineTime: {
  color: '#64748b',
  fontSize: '12px',
  marginTop: '3px',
},
timelineRemarks: {
  color: '#334155',
  fontSize: '13px',
  marginTop: '6px',
  lineHeight: 1.45,
},
emptyTimeline: {
  border: '1px dashed #cbd5e1',
  borderRadius: '12px',
  padding: '16px',
  color: '#64748b',
},
}
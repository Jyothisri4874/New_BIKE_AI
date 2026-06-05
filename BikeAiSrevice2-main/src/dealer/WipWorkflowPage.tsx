import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Send,
  UserCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { api } from '../lib/api'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'
import type { DealerStaff, WipApproval, WipPhoto, WipStatus, WipStatusHistory, WipTrackingRecord } from '../types/wip'
import {
  WIP_STATUS_COPY,
  WIP_STATUS_FLOW,
  addWipPhoto,
  advanceWipStatus,
  assignWipTechnician,
  buildWipTrackingQrImageUrl,
  buildWipTrackingUrl,
  canTransitionWipStatus,
  createWipApproval,
  getNextWipStatus,
  isReadyBlocked,
  isRepairBlockedByApproval,
  labelWipStatus,
  loadWipModuleData,
  queueWipWhatsAppNotification,
} from '../lib/wipWorkflow'

interface DealerCenter {
  id: string
  name: string
  city: string
  phone?: string | null
}

type StatusFilter = WipStatus | 'all'


const emptyWalkInForm = {
  customerName: '',
  customerPhone: '',
  registrationNo: '',
  complaint: '',
  serviceType: '',
  advisorName: '',
  technicianName: '',
  bayNumber: '',
  odometerKm: '',
}

type WalkInUploadFile = {
  fileName: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}

type WalkInJobCardResponse = {
  id: string
  number: string
  customer?: { fullName?: string | null; phone?: string | null }
  vehicle?: { registrationNo?: string | null }
}

type ExtractJobCardResponse = {
  customerName?: string
  customerPhone?: string
  registrationNo?: string
  extractionMethod?: string
  message?: string
}

type JobCardListItem = {
  id: string
  number: string
  bookingId?: string | null
  source?: string | null
  serviceType?: string | null
  status?: string | null
  workflowStage?: string | null
  complaint?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  customer?: {
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
  vehicle?: {
    registrationNo?: string | null
    nickname?: string | null
    oem?: { name?: string | null } | null
    model?: { name?: string | null } | null
  } | null
  booking?: {
    serviceType?: string | null
    status?: string | null
    scheduledAt?: string | null
    reportedIssues?: any
  } | null
}

function jobCardVehicleTitle(job: JobCardListItem) {
  const vehicle = job.vehicle
  if (!vehicle) return '-'
  return [vehicle.nickname, vehicle.oem?.name, vehicle.model?.name].filter(Boolean).join(' · ') || '-'
}

function jobCardSourceLabel(job: JobCardListItem) {
  const source = job.source || job.booking?.reportedIssues?.source
  return source === 'WALK_IN_UPLOAD' ? 'Walk-in' : 'BikeAI'
}

function jobCardWipStatus(job: JobCardListItem): WipStatus {
  const status = String(job.status || '').toLowerCase()
  if (status === 'delivered') return 'delivered'
  if (status === 'ready') return 'ready'
  return 'received'
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read uploaded job card file.'))
    reader.readAsDataURL(file)
  })
}

export default function WipWorkflowPage() {
  const { user } = useDealerAuth()
  const navigate = useNavigate()
  const [center, setCenter] = useState<DealerCenter | null>(null)
  const [records, setRecords] = useState<WipTrackingRecord[]>([])
  const [jobCards, setJobCards] = useState<JobCardListItem[]>([])
  const [history, setHistory] = useState<WipStatusHistory[]>([])
  const [approvals, setApprovals] = useState<WipApproval[]>([])
  const [photos, setPhotos] = useState<WipPhoto[]>([])
  const [staff, setStaff] = useState<DealerStaff[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [statusDetail, setStatusDetail] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [approvalForm, setApprovalForm] = useState({ title: 'Additional work approval', description: '', estimate_amount: '' })
  const [photoForm, setPhotoForm] = useState({ photo_type: 'inspection' as WipPhoto['photo_type'], photo_url: '', caption: '', customer_visible: true })
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [showWalkInForm, setShowWalkInForm] = useState(false)
  const [walkInForm, setWalkInForm] = useState(emptyWalkInForm)
  const [walkInFile, setWalkInFile] = useState<WalkInUploadFile | null>(null)
  const [walkInFileName, setWalkInFileName] = useState('')
  const [extractingJobCard, setExtractingJobCard] = useState(false)
  const [extractMessage, setExtractMessage] = useState('')

  useEffect(() => {
    if (!user) return
    loadInitial()
  }, [user?.id])

  const loadInitial = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const { center: resolvedCenter, error: centerError } = await resolveDealerServiceCenter(user, 'id,name,city,phone')

    if (centerError) {
      setError(centerError)
      setLoading(false)
      return
    }

    if (!resolvedCenter) {
      setCenter(null)
      setLoading(false)
      return
    }

    const dealerCenter = resolvedCenter as DealerCenter
    setCenter(dealerCenter)
    await loadData(dealerCenter.id)
    setLoading(false)
  }

  const loadData = async (serviceCenterId = center?.id) => {
    if (!serviceCenterId) return
    const data = await loadWipModuleData(serviceCenterId)
    setRecords(data.records)
    setHistory(data.history)
    setApprovals(data.approvals)
    setPhotos(data.photos)
    setStaff(data.staff)
    if (!selectedId && data.records.length) setSelectedId(data.records[0].id)

    try {
      const cards = await api.get<JobCardListItem[]>(`/api/job-cards?dealerId=${encodeURIComponent(serviceCenterId)}`)
      setJobCards(Array.isArray(cards) ? cards : [])
    } catch {
      setJobCards([])
    }
  }

  const selectedRecord = records.find(item => item.id === selectedId) || null
  const selectedHistory = selectedRecord ? history.filter(item => item.wip_tracking_record_id === selectedRecord.id) : []
  const selectedApprovals = selectedRecord ? approvals.filter(item => item.wip_tracking_record_id === selectedRecord.id) : []
  const selectedPhotos = selectedRecord ? photos.filter(item => item.wip_tracking_record_id === selectedRecord.id) : []
  const technicians = staff.filter(item => item.role === 'technician' && item.is_active)
  const nextStatus = selectedRecord ? getNextWipStatus(selectedRecord.current_status) : null
  const trackingUrl = selectedRecord ? buildWipTrackingUrl(selectedRecord.tracking_code) : ''
  const qrUrl = trackingUrl ? buildWipTrackingQrImageUrl(trackingUrl) : ''
  const readyBlocked = selectedRecord ? isReadyBlocked(selectedRecord, nextStatus) && !invoiceNo.trim() : false
  const repairBlocked = selectedRecord ? isRepairBlockedByApproval(selectedRecord, selectedApprovals, nextStatus) : false

  const metrics = useMemo(() => {
    const activeJobCards = jobCards.filter(item => String(item.status || '').toLowerCase() !== 'delivered').length
    const readyJobCards = jobCards.filter(item => String(item.status || '').toLowerCase() === 'ready').length
    const deliveredJobCards = jobCards.filter(item => String(item.status || '').toLowerCase() === 'delivered').length

    return {
      active: activeJobCards + records.filter(item => item.current_status !== 'delivered').length,
      pendingApproval: records.filter(item => item.approval_state === 'pending').length,
      ready: readyJobCards + records.filter(item => item.current_status === 'ready').length,
      delivered: deliveredJobCards + records.filter(item => item.current_status === 'delivered').length,
    }
  }, [jobCards, records])

  const filteredRecords = records.filter(record => {
    const text = `${record.dealer_dms_job_no} ${record.customer_name} ${record.vehicle_registration_no} ${record.vehicle_model} ${record.current_status}`.toLowerCase()
    const matchesSearch = text.includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || record.current_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredJobCards = jobCards.filter(job => {
    const text = `${job.number} ${jobCardSourceLabel(job)} ${job.customer?.fullName || ''} ${job.customer?.phone || ''} ${job.vehicle?.registrationNo || ''} ${jobCardVehicleTitle(job)} ${job.status || ''} ${job.workflowStage || ''}`.toLowerCase()
    const matchesSearch = text.includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || jobCardWipStatus(job) === statusFilter
    return matchesSearch && matchesStatus
  })


  const handleWalkInFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setWalkInFile(null)
      setWalkInFileName('')
      return
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Upload only PDF, JPG, PNG, or WEBP job card files.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Uploaded job card file must be under 5 MB.')
      event.target.value = ''
      return
    }

    const base64 = await fileToBase64(file)
    const dealerJobCardFile = { fileName: file.name, mimeType: file.type as WalkInUploadFile['mimeType'], base64 }
    setWalkInFile(dealerJobCardFile)
    setWalkInFileName(file.name)
    setExtractMessage('')

    setExtractingJobCard(true)
    try {
      const extracted = await api.post<ExtractJobCardResponse>('/api/job-cards/extract', { dealerJobCardFile })

      setWalkInForm(current => ({
        ...current,
        customerName: extracted.customerName?.trim() || current.customerName,
        customerPhone: extracted.customerPhone?.trim() || current.customerPhone,
        registrationNo: extracted.registrationNo?.trim().toUpperCase() || current.registrationNo,
      }))

      setExtractMessage(extracted.message || 'Extraction completed. Please verify the details before creating tracking.')
    } catch (e) {
      setExtractMessage((e as Error).message || 'Could not extract details. Please enter them manually.')
    }
    setExtractingJobCard(false)
  }

  const createWalkInTracking = async (event: FormEvent) => {
    event.preventDefault()
    if (!center) return

    const customerName = walkInForm.customerName.trim()
    const customerPhone = walkInForm.customerPhone.trim()
    const registrationNo = walkInForm.registrationNo.trim().toUpperCase()

    if (!customerName || !customerPhone || !registrationNo) {
      setError('Customer name, phone number, and registration number are required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const created = await api.post<WalkInJobCardResponse>('/api/job-cards/walk-in', {
        dealerId: center.id,
        customerName,
        customerPhone,
        customerCity: center.city,
        registrationNo,
        complaint: walkInForm.complaint.trim() || 'Walk-in service tracking',
        serviceType: walkInForm.serviceType.trim() || 'walk_in',
        advisorName: walkInForm.advisorName.trim() || undefined,
        technicianName: walkInForm.technicianName.trim() || undefined,
        bayNumber: walkInForm.bayNumber ? Number(walkInForm.bayNumber) : undefined,
        odometerKm: walkInForm.odometerKm ? Number(walkInForm.odometerKm) : undefined,
        dealerJobCardFile: walkInFile || undefined,
      })

      setWalkInForm(emptyWalkInForm)
      setWalkInFile(null)
      setWalkInFileName('')
      setShowWalkInForm(false)
      setSuccess(`Walk-in BikeAI tracking created: ${created.number}.`)
      await loadData(center.id)
      navigate(`/dealer/job-cards/${encodeURIComponent(created.id)}`)
    } catch (e) {
      setError((e as Error).message || 'Could not create walk-in tracking.')
    }

    setSaving(false)
  }

  const advanceSelected = async () => {
    if (!center || !selectedRecord || !nextStatus) return
    if (!canTransitionWipStatus(selectedRecord.current_status, nextStatus)) return
    if (readyBlocked) {
      setError('Dealer DMS invoice number is required before Ready.')
      return
    }
    if (repairBlocked) {
      setError('Pending customer approval must be approved or rejected before Repair.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await advanceWipStatus({
        record_id: selectedRecord.id,
        next_status: nextStatus,
        status_detail: statusDetail,
        note: statusNote,
        customer_visible: true,
        dealer_dms_invoice_no: invoiceNo.trim() || undefined,
      })
      setSuccess(`Moved ${updated.dealer_dms_job_no} to ${labelWipStatus(updated.current_status)}.`)
      setStatusNote('')
      setStatusDetail('')
      setInvoiceNo('')
      await loadData(center.id)
    } catch (e) {
      setError((e as Error).message || 'Could not advance WIP status.')
    }
    setSaving(false)
  }

  const requestApproval = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedRecord) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createWipApproval({
        record_id: selectedRecord.id,
        title: approvalForm.title,
        description: approvalForm.description,
        estimate_amount: Number(approvalForm.estimate_amount || 0),
      })
      setApprovalForm({ title: 'Additional work approval', description: '', estimate_amount: '' })
      setSuccess('Customer approval request queued.')
      await loadData(center.id)
    } catch (e) {
      setError((e as Error).message || 'Could not create approval request.')
    }
    setSaving(false)
  }

  const assignTechnician = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedRecord || !selectedTechnicianId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await assignWipTechnician({
        record_id: selectedRecord.id,
        technician_staff_id: selectedTechnicianId,
        notes: 'Assigned from WIP workflow.',
      })
      setSuccess('Technician assigned.')
      await loadData(center.id)
    } catch (e) {
      setError((e as Error).message || 'Could not assign technician.')
    }
    setSaving(false)
  }

  const savePhoto = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedRecord) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await addWipPhoto({
        record_id: selectedRecord.id,
        service_center_id: center.id,
        photo_type: photoForm.photo_type,
        photo_url: photoForm.photo_url,
        caption: photoForm.caption,
        customer_visible: photoForm.customer_visible,
      })
      setPhotoForm({ photo_type: 'inspection', photo_url: '', caption: '', customer_visible: true })
      setSuccess('Photo added to tracking record.')
      await loadData(center.id)
    } catch (e) {
      setError((e as Error).message || 'Could not add photo.')
    }
    setSaving(false)
  }

  const queueWhatsApp = async () => {
    if (!center || !selectedRecord) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await queueWipWhatsAppNotification(selectedRecord.id, 'manual_share')
      setSuccess('WhatsApp notification queued.')
      await loadData(center.id)
    } catch (e) {
      setError((e as Error).message || 'Could not queue WhatsApp notification.')
    }
    setSaving(false)
  }

  const copyTrackingLink = async () => {
    if (!trackingUrl) return
    await navigator.clipboard?.writeText(trackingUrl)
    setSuccess('Tracking link copied.')
  }

  const openTrackingLink = () => {
    if (trackingUrl) window.open(trackingUrl, '_blank', 'noopener,noreferrer')
  }

  const openWhatsApp = () => {
    if (!selectedRecord || !trackingUrl) return
    const phone = selectedRecord.customer_whatsapp || selectedRecord.customer_phone
    const body = `Hi ${selectedRecord.customer_name}, track your vehicle service for DMS job ${selectedRecord.dealer_dms_job_no}: ${trackingUrl}`
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div style={s.empty}>Loading WIP workflow...</div>

  if (!center) {
    return (
      <div style={s.empty}>
        <AlertTriangle size={20} />
        No linked workshop was found for this dealer account.
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Service WIP Tracking</h1>
          <p style={s.subTitle}>{center.name} - BikeAI tracking records linked to dealer DMS job numbers.</p>
        </div>
        <div style={s.headerActions}>
          <button style={s.primaryBtn} onClick={() => setShowWalkInForm(value => !value)} disabled={saving}>
            <Plus size={15} /> Create Walk-in Tracking
          </button>
          <button style={s.secondaryBtn} onClick={() => loadData(center.id)} disabled={saving}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div style={s.error}><AlertTriangle size={16} /> {error}</div>}
      {success && <div style={s.success}><CheckCircle2 size={16} /> {success}</div>}


      {showWalkInForm && (
        <section style={s.walkInPanel}>
          <div style={s.panelHead}>
            <div>
              <h2 style={s.panelTitle}><QrCode size={16} /> Create Walk-in BikeAI Tracking</h2>
              <p style={s.panelHint}>Upload dealer job card PDF/image if available. If not available, enter customer and vehicle details manually.</p>
            </div>
          </div>
          <form onSubmit={createWalkInTracking} style={s.formGrid}>
            <Field label="Customer Name" value={walkInForm.customerName} required onChange={value => setWalkInForm({ ...walkInForm, customerName: value })} />
            <Field label="Phone / WhatsApp Number" value={walkInForm.customerPhone} required onChange={value => setWalkInForm({ ...walkInForm, customerPhone: value })} />
            <Field label="Registration Number" value={walkInForm.registrationNo} required onChange={value => setWalkInForm({ ...walkInForm, registrationNo: value.toUpperCase() })} />
            <Field label="Service Type" value={walkInForm.serviceType} onChange={value => setWalkInForm({ ...walkInForm, serviceType: value })} />
            <Field label="Advisor" value={walkInForm.advisorName} onChange={value => setWalkInForm({ ...walkInForm, advisorName: value })} />
            <Field label="Technician" value={walkInForm.technicianName} onChange={value => setWalkInForm({ ...walkInForm, technicianName: value })} />
            <label style={s.field}>
              Ramp / Bay Number
              <select value={walkInForm.bayNumber} onChange={event => setWalkInForm({ ...walkInForm, bayNumber: event.target.value })} style={s.input}>
                <option value="">Select ramp / bay</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Bay {n}</option>)}
              </select>
            </label>
            <Field label="Odometer KM" value={walkInForm.odometerKm} type="number" onChange={value => setWalkInForm({ ...walkInForm, odometerKm: value })} />
            <label style={s.fullField}>
              Dealer Job Card PDF/Image
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleWalkInFile} style={s.input} />
              <span style={s.fileHint}>{walkInFileName || 'Optional. Upload PDF/JPG/PNG/WEBP under 5 MB.'}</span>
            </label>

            {extractingJobCard && (
              <div style={s.info}>
                Extracting customer and vehicle details from uploaded job card...
              </div>
            )}
{extractMessage && (
  <div style={s.info}>
    {extractMessage}
  </div>
)}

            <label style={s.fullField}>
              Complaint / Intake Notes
              <textarea value={walkInForm.complaint} onChange={event => setWalkInForm({ ...walkInForm, complaint: event.target.value })} style={s.textarea} />
            </label>
            <div style={s.buttonRow}>
              <button style={s.primaryBtn} disabled={saving}>
                <Save size={14} /> Create BikeAI Tracking
              </button>
              <button type="button" style={s.secondaryBtn} onClick={() => setShowWalkInForm(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <div style={s.kpiGrid}>
        <Metric label="Active WIP" value={metrics.active} color="#2563EB" />
        <Metric label="Approval Pending" value={metrics.pendingApproval} color="#DC2626" />
        <Metric label="Ready" value={metrics.ready} color="#16A34A" />
        <Metric label="Delivered" value={metrics.delivered} color="#334155" />
      </div>

      <div style={s.mainGrid}>
        <section style={s.panel}>
          <div style={s.panelHead}>
            <div>
              <h2 style={s.panelTitle}><ClipboardList size={16} /> WIP Records</h2>
              <p style={s.panelHint}>{filteredJobCards.length + filteredRecords.length} shown</p>
            </div>
          </div>
          <div style={s.searchRow}>
            <div style={s.searchBox}><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search DMS job, customer, vehicle" style={s.searchInput} /></div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} style={s.select}>
              <option value="all">All</option>
              {WIP_STATUS_FLOW.map(status => <option key={status} value={status}>{WIP_STATUS_COPY[status].label}</option>)}
            </select>
          </div>
          <div style={s.recordList}>
            {filteredJobCards.map(job => (
              <button key={job.id} onClick={() => navigate(`/dealer/job-cards/${encodeURIComponent(job.id)}`)} style={s.recordCard}>
                <div style={s.recordTop}>
                  <strong>{job.number}</strong>
                  <span style={s.smallBadge}>{jobCardSourceLabel(job)}</span>
                </div>
                <div style={s.recordVehicle}>
                  <Bike size={13} /> {job.vehicle?.registrationNo || '-'} {jobCardVehicleTitle(job) !== '-' ? `- ${jobCardVehicleTitle(job)}` : ''}
                </div>
                <div style={s.recordMeta}>
                  {(job.customer?.fullName || 'Customer')} - {String(job.workflowStage || job.status || 'tracking_created').replace(/_/g, ' ')}
                </div>
              </button>
            ))}

            {filteredRecords.map(record => (
              <button key={record.id} onClick={() => setSelectedId(record.id)} style={{ ...s.recordCard, ...(record.id === selectedId ? s.recordCardActive : {}) }}>
                <div style={s.recordTop}>
                  <strong>{record.dealer_dms_job_no}</strong>
                  <StatusPill status={record.current_status} />
                </div>
                <div style={s.recordVehicle}><Bike size={13} /> {record.vehicle_registration_no} {record.vehicle_model ? `- ${record.vehicle_model}` : ''}</div>
                <div style={s.recordMeta}>{record.customer_name} - {record.assigned_technician_name || 'Technician unassigned'}</div>
              </button>
            ))}

            {!filteredJobCards.length && !filteredRecords.length && <div style={s.emptyInline}>No WIP tracking records found.</div>}
          </div>
        </section>
      </div>

      {selectedRecord && (
        <div style={s.detailGrid}>
          <section style={s.panelWide}>
            <div style={s.detailHead}>
              <div>
                <h2 style={s.detailTitle}>{selectedRecord.dealer_dms_job_no}</h2>
                <p style={s.panelHint}>{selectedRecord.customer_name} - {selectedRecord.vehicle_registration_no} - {selectedRecord.vehicle_model || 'Vehicle'}</p>
              </div>
              <StatusPill status={selectedRecord.current_status} />
            </div>

            <div style={s.flowRow}>
              {WIP_STATUS_FLOW.map((status, index) => {
                const activeIndex = WIP_STATUS_FLOW.indexOf(selectedRecord.current_status)
                const done = index <= activeIndex
                return (
                  <div key={status} style={s.flowStep}>
                    <div style={{ ...s.flowDot, background: done ? WIP_STATUS_COPY[status].color : '#CBD5E1' }}>{index + 1}</div>
                    <span style={{ ...s.flowLabel, color: done ? '#0B1F4D' : '#94A3B8' }}>{WIP_STATUS_COPY[status].label}</span>
                  </div>
                )
              })}
            </div>

            <div style={s.actionGrid}>
              <div style={s.actionPanel}>
                <h3 style={s.sectionTitle}>Status Transition</h3>
                {nextStatus ? (
                  <>
                    <p style={s.panelHint}>Next: {WIP_STATUS_COPY[nextStatus].label}</p>
                    {nextStatus === 'ready' && (
                      <Field label="Dealer DMS Invoice No" value={invoiceNo || selectedRecord.dealer_dms_invoice_no} onChange={setInvoiceNo} />
                    )}
                    <Field label="Status Detail" value={statusDetail} onChange={setStatusDetail} />
                    <label style={s.fullField}>
                      Update Note
                      <textarea value={statusNote} onChange={event => setStatusNote(event.target.value)} style={s.textarea} />
                    </label>
                    {(readyBlocked || repairBlocked) && <div style={s.warning}>{readyBlocked ? 'Invoice number required before Ready.' : 'Resolve pending approval before Repair.'}</div>}
                    <button style={s.primaryBtn} onClick={advanceSelected} disabled={saving || readyBlocked || repairBlocked}>
                      <Send size={14} /> Move to {WIP_STATUS_COPY[nextStatus].label}
                    </button>
                  </>
                ) : (
                  <div style={s.emptyInline}>Tracking record is closed.</div>
                )}
              </div>

              <div style={s.actionPanel}>
                <h3 style={s.sectionTitle}>Customer Link</h3>
                <div style={s.qrWrap}>
                  <img src={qrUrl} alt="WIP tracking QR code" style={s.qrImg} />
                  <div style={s.linkText}>{trackingUrl}</div>
                </div>
                <div style={s.buttonRow}>
                  <button style={s.secondaryBtn} onClick={copyTrackingLink}><Copy size={14} /> Copy</button>
                  <button style={s.secondaryBtn} onClick={openTrackingLink}><ExternalLink size={14} /> Open</button>
                  <button style={s.whatsAppBtn} onClick={openWhatsApp}><MessageSquare size={14} /> Share</button>
                  <button style={s.secondaryBtn} onClick={queueWhatsApp} disabled={saving}><QrCode size={14} /> Queue Hook</button>
                </div>
              </div>
            </div>
          </section>

          <section style={s.panel}>
            <h2 style={s.panelTitle}><UserCheck size={16} /> Technician</h2>
            <form onSubmit={assignTechnician} style={s.stack}>
              <select value={selectedTechnicianId} onChange={event => setSelectedTechnicianId(event.target.value)} style={s.input}>
                <option value="">Select technician</option>
                {technicians.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </select>
              <button style={s.secondaryBtn} disabled={saving || !selectedTechnicianId}>Assign</button>
            </form>
            {!technicians.length && <div style={s.emptyInline}>No active technicians in dealer staff.</div>}
          </section>

          <section style={s.panel}>
            <h2 style={s.panelTitle}><Send size={16} /> Approval</h2>
            <form onSubmit={requestApproval} style={s.stack}>
              <Field label="Title" value={approvalForm.title} onChange={value => setApprovalForm({ ...approvalForm, title: value })} />
              <Field label="Estimate Amount" value={approvalForm.estimate_amount} type="number" onChange={value => setApprovalForm({ ...approvalForm, estimate_amount: value })} />
              <label style={s.fullField}>
                Description
                <textarea value={approvalForm.description} onChange={event => setApprovalForm({ ...approvalForm, description: event.target.value })} style={s.textarea} />
              </label>
              <button style={s.primaryBtn} disabled={saving}>Request Approval</button>
            </form>
            <div style={s.historyList}>
              {selectedApprovals.map(item => (
                <div key={item.id} style={s.historyItem}>
                  <div><strong>{item.title}</strong><div style={s.recordMeta}>INR {Number(item.estimate_amount || 0).toLocaleString('en-IN')}</div></div>
                  <span style={s.smallBadge}>{labelWipStatus(item.status)}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={s.panel}>
            <h2 style={s.panelTitle}><ImageIcon size={16} /> Photos</h2>
            <form onSubmit={savePhoto} style={s.stack}>
              <select value={photoForm.photo_type} onChange={event => setPhotoForm({ ...photoForm, photo_type: event.target.value as WipPhoto['photo_type'] })} style={s.input}>
                {['received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'delivery', 'damage', 'other'].map(type => <option key={type} value={type}>{labelWipStatus(type)}</option>)}
              </select>
              <Field label="Photo URL" value={photoForm.photo_url} onChange={value => setPhotoForm({ ...photoForm, photo_url: value })} />
              <Field label="Caption" value={photoForm.caption} onChange={value => setPhotoForm({ ...photoForm, caption: value })} />
              <label style={s.checkLine}><input type="checkbox" checked={photoForm.customer_visible} onChange={event => setPhotoForm({ ...photoForm, customer_visible: event.target.checked })} /> Customer visible</label>
              <button style={s.secondaryBtn} disabled={saving || !photoForm.photo_url}>Add Photo</button>
            </form>
            <div style={s.photoList}>
              {selectedPhotos.slice(0, 4).map(item => (
                <a key={item.id} href={item.photo_url} target="_blank" rel="noreferrer" style={s.photoItem}>{labelWipStatus(item.photo_type)}</a>
              ))}
            </div>
          </section>

          <section style={s.panelWide}>
            <h2 style={s.panelTitle}><ClipboardList size={16} /> Status History</h2>
            <div style={s.timeline}>
              {selectedHistory.map(item => (
                <div key={item.id} style={s.timelineItem}>
                  <span style={{ ...s.timelineDot, background: WIP_STATUS_COPY[item.status_to]?.color || '#94A3B8' }} />
                  <div>
                    <strong>{labelWipStatus(item.status_to)}</strong>
                    <p>{item.note || item.status_detail || WIP_STATUS_COPY[item.status_to]?.description}</p>
                    <small>{formatDateTime(item.created_at)} {item.customer_visible ? '- customer visible' : '- internal'}</small>
                  </div>
                </div>
              ))}
              {!selectedHistory.length && <div style={s.emptyInline}>No history yet.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label style={s.field}>
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} type={type} required={required} style={s.input} />
    </label>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={s.metric}>
      <div style={{ ...s.metricValue, color }}>{value}</div>
      <div style={s.metricLabel}>{label}</div>
    </div>
  )
}

function StatusPill({ status }: { status: WipStatus }) {
  const copy = WIP_STATUS_COPY[status]
  return <span style={{ ...s.statusPill, background: `${copy.color}18`, color: copy.color }}>{copy.label}</span>
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'grid', gap: '18px', fontFamily: '"Inter", system-ui, sans-serif', color: '#0F172A' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  headerActions: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  title: { margin: 0, color: '#0B1F4D', fontSize: '24px', fontWeight: 900 },
  subTitle: { margin: '5px 0 0', color: '#64748B', fontSize: '13px' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' },
  success: { display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' },
  warning: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 10px', fontSize: '12px', fontWeight: 700 },
  empty: { minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748B', background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: '8px' },
  emptyInline: { padding: '14px', color: '#64748B', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', fontSize: '13px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' },
  metric: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  metricValue: { fontSize: '26px', fontWeight: 900, lineHeight: 1 },
  metricLabel: { marginTop: '4px', fontSize: '12px', color: '#64748B', fontWeight: 700 },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', alignItems: 'start' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  walkInPanel: { background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '10px', padding: '16px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' },
  panelWide: { gridColumn: '1 / -1', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  panelHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' },
  panelTitle: { margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#0B1F4D' },
  panelHint: { margin: '4px 0 0', color: '#64748B', fontSize: '12px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', alignItems: 'end' },
  stack: { display: 'grid', gap: '10px' },
  field: { display: 'grid', gap: '6px', color: '#475569', fontSize: '12px', fontWeight: 800 },
  fullField: { display: 'grid', gap: '6px', color: '#475569', fontSize: '12px', fontWeight: 800, gridColumn: '1 / -1' },
  input: { width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 10px', font: 'inherit', fontSize: '13px', outline: 'none', background: '#FFFFFF' },
  select: { border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 10px', font: 'inherit', fontSize: '13px', background: '#FFFFFF' },
  textarea: { width: '100%', minHeight: '72px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 10px', font: 'inherit', fontSize: '13px', resize: 'vertical' },
  fileHint: { color: '#64748B', fontSize: '11px', fontWeight: 700 },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 0, borderRadius: '8px', background: '#0B1F4D', color: '#FFFFFF', padding: '9px 13px', font: 'inherit', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', background: '#FFFFFF', color: '#0B1F4D', padding: '8px 12px', font: 'inherit', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
  whatsAppBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid #BBF7D0', borderRadius: '8px', background: '#DCFCE7', color: '#15803D', padding: '8px 12px', font: 'inherit', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
  searchRow: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  searchBox: { flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0 10px', background: '#F8FAFC' },
  searchInput: { border: 0, outline: 'none', background: 'transparent', padding: '9px 0', width: '100%', font: 'inherit', fontSize: '13px' },
  recordList: { display: 'grid', gap: '8px', maxHeight: '470px', overflow: 'auto' },
  recordCard: { textAlign: 'left', border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '8px', padding: '11px', cursor: 'pointer', font: 'inherit' },
  recordCardActive: { borderColor: '#FFD600', background: '#FFFDF0', boxShadow: '0 0 0 3px rgba(255,214,0,0.18)' },
  recordTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  recordVehicle: { display: 'flex', alignItems: 'center', gap: '5px', color: '#0F172A', fontSize: '13px', fontWeight: 700 },
  recordMeta: { marginTop: '3px', color: '#64748B', fontSize: '12px' },
  statusPill: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '4px 9px', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' },
  smallBadge: { display: 'inline-flex', background: '#F1F5F9', color: '#334155', borderRadius: '999px', padding: '4px 8px', fontSize: '11px', fontWeight: 900 },
  detailHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  detailTitle: { margin: 0, color: '#0B1F4D', fontSize: '20px' },
  flowRow: { display: 'grid', gridTemplateColumns: 'repeat(8, minmax(70px, 1fr))', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' },
  flowStep: { display: 'grid', justifyItems: 'center', gap: '6px', minWidth: '70px' },
  flowDot: { width: '30px', height: '30px', borderRadius: '50%', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 },
  flowLabel: { fontSize: '11px', fontWeight: 800, textAlign: 'center' },
  actionGrid: { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 0.9fr)', gap: '14px' },
  actionPanel: { border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', display: 'grid', gap: '10px', alignContent: 'start' },
  sectionTitle: { margin: 0, color: '#0B1F4D', fontSize: '14px' },
  qrWrap: { display: 'grid', gridTemplateColumns: '112px 1fr', gap: '10px', alignItems: 'center' },
  qrImg: { width: '112px', height: '112px', border: '1px solid #E2E8F0', borderRadius: '8px' },
  linkText: { wordBreak: 'break-all', color: '#475569', fontSize: '12px', lineHeight: 1.45 },
  buttonRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  checkLine: { display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '13px', fontWeight: 700 },
  historyList: { display: 'grid', gap: '8px', marginTop: '12px' },
  historyItem: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 0', borderTop: '1px solid #F1F5F9' },
  photoList: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  photoItem: { textDecoration: 'none', color: '#0B1F4D', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', fontWeight: 800 },
  timeline: { display: 'grid', gap: '10px' },
  timelineItem: { display: 'grid', gridTemplateColumns: '12px 1fr', gap: '10px', padding: '10px 0', borderTop: '1px solid #F1F5F9', fontSize: '13px' },
  timelineDot: { width: '9px', height: '9px', borderRadius: '50%', marginTop: '5px' },
  info: {gridColumn: '1 / -1',background: '#EFF6FF',border: '1px solid #BFDBFE',  color: '#1D4ED8',  borderRadius: '8px',  padding: '9px 10px',  fontSize: '12px',  fontWeight: 700,},
}
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  ClipboardCheck,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react'
import AIChatWidget from '../components/AIChatWidget'
import { api, safeGet } from '../lib/api'
import { useDealerAuth } from '../hooks/useDealerAuth'
import DealerRevenueWidgets from './DealerRevenueWidgets'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

type JobStatus =
  | 'booked'
  | 'confirmed'
  | 'pickup_assigned'
  | 'en_route'
  | 'picked_up'
  | 'arrived_workshop'
  | 'diagnosis'
  | 'awaiting_approval'
  | 'in_progress'
  | 'qc_washing'
  | 'ready_for_delivery'
  | 'delivered'
  | 'completed'

type TabId = 'jobs' | 'intake' | 'approvals' | 'tracking' | 'memory'

interface DealerCenter {
  id: string
  name: string
  city: string
  phone?: string
}

interface ProfileRow {
  id: string
  full_name: string
  phone: string
  whatsapp_number?: string | null
  email?: string | null
}

interface VehicleRow {
  id: string
  registration_number: string
  odometer_km: number | null
  vehicle_oems?: { name: string } | null
  vehicle_models?: { name: string } | null
}

interface CustomerBooking {
  id: string
  customer_id: string
  vehicle_id: string | null
  service_center_id: string | null
  service_type: string
  service_category: string
  scheduled_date: string
  scheduled_time: string
  pickup_required: boolean
  drop_required: boolean
  status: string
  notes: string
  reported_issues?: string | null
  estimated_cost?: number | null
  profiles?: ProfileRow | null
  customer_vehicles?: VehicleRow | null
}

interface JobCard {
  id: string
  job_number: string
  booking_id: string | null
  tracking_token?: string | null
  booking_source: string
  customer_id: string
  vehicle_id: string | null
  service_center_id: string
  status: JobStatus
  odometer_km: number | null
  fuel_level: string
  customer_complaints: string
  recommended_services: string[]
  estimated_delivery_at: string | null
  technician_id: string | null
  technician_name: string
  pickup_required: boolean
  drop_required: boolean
  internal_remarks: string
  is_delayed: boolean
  delay_reason: string
  escalation_level: number
  last_status_at: string
  created_at: string
  profiles?: ProfileRow | null
  customer_vehicles?: VehicleRow | null
}

interface TimelineRow {
  id: string
  job_card_id: string
  status: string
  title: string
  notes: string
  visibility: 'customer' | 'internal'
  created_at: string
}

interface Technician {
  id: string
  service_center_id: string
  name: string
  phone: string
  skills: string[]
  is_active: boolean
}

interface Rider {
  id: string
  name: string
  phone: string
  is_available: boolean
  service_center_id: string | null
}

interface InspectionRow {
  id: string
  job_card_id: string
  photo_front: string
  photo_rear: string
  photo_left: string
  photo_right: string
  scratch_dent_notes: string
  complaint_notes: string
  accessories: Record<string, boolean>
  acknowledgement_method: string
  acknowledgement_otp: string
  acknowledged_at: string | null
  created_at: string
}

interface ApprovalRow {
  id: string
  job_card_id: string
  title: string
  requested_work: string[]
  estimate_amount: number
  approval_token: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  customer_note: string
  expires_at: string | null
  created_at: string
}

interface ChatMemoryRow {
  id: string
  job_card_id: string | null
  customer_id: string
  conversation_source: string
  visibility: 'customer' | 'internal'
  tags: string[]
  summary: string
  sentiment: string
  created_at: string
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'jobs', label: 'Job Cards' },
  { id: 'intake', label: 'Inspection' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'tracking', label: 'Live Tracking' },
  { id: 'memory', label: 'CRM Memory' },
]

const STATUS_FLOW: JobStatus[] = [
  'booked',
  'confirmed',
  'pickup_assigned',
  'en_route',
  'picked_up',
  'arrived_workshop',
  'diagnosis',
  'awaiting_approval',
  'in_progress',
  'qc_washing',
  'ready_for_delivery',
  'delivered',
  'completed',
]

const ACTION_LABELS: Record<JobStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirm Booking',
  pickup_assigned: 'Assign Pickup',
  en_route: 'Rider En Route',
  picked_up: 'Mark Picked Up',
  arrived_workshop: 'Arrived Workshop',
  diagnosis: 'Start Diagnosis',
  awaiting_approval: 'Request Approval',
  in_progress: 'Start Work',
  qc_washing: 'QC / Washing',
  ready_for_delivery: 'Ready Delivery',
  delivered: 'Mark Delivered',
  completed: 'Complete Job',
}

const STATUS_COLORS: Record<JobStatus, string> = {
  booked: '#64748B',
  confirmed: '#2563EB',
  pickup_assigned: '#7C3AED',
  en_route: '#0891B2',
  picked_up: '#0D9488',
  arrived_workshop: '#0284C7',
  diagnosis: '#F59E0B',
  awaiting_approval: '#DC2626',
  in_progress: '#9333EA',
  qc_washing: '#EA580C',
  ready_for_delivery: '#16A34A',
  delivered: '#15803D',
  completed: '#334155',
}

const EMPTY_INSPECTION = {
  photo_front: '',
  photo_rear: '',
  photo_left: '',
  photo_right: '',
  damage_photos: '',
  scratch_dent_notes: '',
  complaint_notes: '',
  acknowledgement_otp: '',
  accessories: {
    helmet: false,
    mirrors: true,
    tool_kit: false,
    rc_copy: false,
    battery_ok: true,
  },
}

const CHAT_TAGS = ['complaint', 'dissatisfaction', 'repeated_issue', 'retention_risk', 'urgent', 'breakdown']
const SERVICE_PUBLIC_BASE = 'https://service.bikeai.in'

export default function ServiceManagerDashboardPage() {
  const { user } = useDealerAuth()
  const [center, setCenter] = useState<DealerCenter | null>(null)
  const [bookings, setBookings] = useState<CustomerBooking[]>([])
  const [jobs, setJobs] = useState<JobCard[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [approvals, setApprovals] = useState<ApprovalRow[]>([])
  const [memories, setMemories] = useState<ChatMemoryRow[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [tab, setTab] = useState<TabId>('jobs')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [jobForm, setJobForm] = useState({
    odometer_km: '',
    fuel_level: 'half',
    technician_name: '',
    estimated_delivery_at: '',
    recommended_services: 'General service',
    customer_complaints: '',
    internal_remarks: '',
    pickup_required: false,
    drop_required: false,
  })
  const [inspectionForm, setInspectionForm] = useState(EMPTY_INSPECTION)
  const [approvalForm, setApprovalForm] = useState({
    title: 'Additional work approval',
    requested_work: 'Brake pad replacement',
    estimate_amount: '0',
  })
  const [memoryForm, setMemoryForm] = useState({
    summary: '',
    raw_excerpt: '',
    sentiment: 'neutral',
    visibility: 'internal' as 'customer' | 'internal',
    tags: [] as string[],
  })

  useEffect(() => {
    if (!user) return
    loadInitial()
  }, [user?.id])

  const loadInitial = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const { center: dealerCenter, error: centerError } = await resolveDealerServiceCenter(user, 'id,name,city,phone')

    if (centerError) {
      setError(centerError)
      setLoading(false)
      return
    }

    if (!dealerCenter) {
      setCenter(null)
      setLoading(false)
      return
    }

    const resolvedCenter = dealerCenter as DealerCenter
    setCenter(resolvedCenter)
    await loadOperations(resolvedCenter.id)
    setLoading(false)
  }

  const loadOperations = async (centerId: string) => {
    // TODO: Confirm backend endpoints for service manager operational data.
    const [
      bookingsData,
      jobsData,
      techData,
      riderData,
      inspectionData,
      approvalData,
      memoryData,
    ] = await Promise.all([
      safeGet<any[]>(`/api/bookings?dealerId=${encodeURIComponent(centerId)}&limit=200`, []),
      safeGet<JobCard[]>(`/api/service-manager/job-cards?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<Technician[]>(`/api/service-manager/technicians?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<Rider[]>(`/api/service-manager/riders?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<InspectionRow[]>(`/api/service-manager/inspections?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<ApprovalRow[]>(`/api/service-manager/approval-requests?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<ChatMemoryRow[]>(`/api/service-manager/chat-memory?serviceCenterId=${encodeURIComponent(centerId)}`, []),
    ])

    const loadedJobs = (jobsData || []) as JobCard[]
    setBookings(
      (bookingsData || []).map((booking: any) => ({
        id: booking.id,
        customer_id: booking.customer_id || booking.customerId || booking.customer?.id || '',
        vehicle_id: booking.vehicle_id || booking.vehicleId || booking.vehicle?.id || null,
        service_center_id: booking.service_center_id || booking.dealer_id || booking.dealerId || null,
        service_type: booking.service_type || booking.serviceType || '',
        service_category: booking.service_category || booking.serviceType || 'General service',
        scheduled_date: booking.scheduled_date || '',
        scheduled_time: booking.scheduled_time || '',
        pickup_required: Boolean(booking.pickup_required),
        drop_required: Boolean(booking.drop_required),
        status: booking.status,
        notes: booking.notes || '',
        reported_issues: booking.reported_issues || booking.reportedIssues || '',
        estimated_cost: booking.estimated_cost || booking.estimatedCost || null,
        profiles: booking.customer
          ? {
              id: booking.customer.id,
              full_name: booking.customer.fullName || booking.customer.full_name || 'Customer',
              phone: booking.customer.phone || '',
              email: booking.customer.email || '',
            }
          : null,
        customer_vehicles: booking.vehicle
          ? {
              id: booking.vehicle.id,
              registration_number: booking.vehicle.registrationNo || booking.vehicle.registration_number || '',
              odometer_km: booking.vehicle.odometerKm || booking.vehicle.odometer_km || null,
              vehicle_oems: booking.vehicle.oem ? { name: booking.vehicle.oem.name } : null,
              vehicle_models: booking.vehicle.model ? { name: booking.vehicle.model.name } : null,
            }
          : null,
      }))
    )
    setJobs(loadedJobs)
    setTechnicians((techData || []) as Technician[])
    setRiders((riderData || []) as Rider[])
    setInspections((inspectionData || []) as InspectionRow[])
    setApprovals((approvalData || []) as ApprovalRow[])
    setMemories((memoryData || []) as ChatMemoryRow[])

    if (loadedJobs.length && !selectedJobId) {
      setSelectedJobId(loadedJobs[0].id)
      await loadTimeline(loadedJobs[0].id)
    } else if (selectedJobId) {
      await loadTimeline(selectedJobId)
    }
  }

  const loadTimeline = async (jobId: string) => {
    // TODO: Confirm backend endpoint for job timeline.
    const data = await safeGet<TimelineRow[]>(
      `/api/service-manager/job-timeline?jobCardId=${encodeURIComponent(jobId)}`,
      [],
    )
    setTimeline((data || []) as TimelineRow[])
  }

  const selectedJob = jobs.find(job => job.id === selectedJobId) || null
  const selectedInspection = selectedJob ? inspections.find(item => item.job_card_id === selectedJob.id) : null
  const selectedApprovals = selectedJob ? approvals.filter(item => item.job_card_id === selectedJob.id) : []
  const selectedMemories = selectedJob ? memories.filter(item => item.job_card_id === selectedJob.id || item.customer_id === selectedJob.customer_id) : []

  const jobBookingIds = new Set(jobs.map(job => job.booking_id).filter(Boolean))
  const readyBookings = bookings.filter(booking =>
    !jobBookingIds.has(booking.id) &&
    ['confirmed', 'booking_confirmed', 'pending'].includes(booking.status)
  )

  const filteredJobs = jobs.filter(job => {
    const text = `${job.job_number} ${job.profiles?.full_name || ''} ${vehicleName(job.customer_vehicles)} ${job.status}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

  const delayedJobs = jobs.filter(isJobDelayed)
  const pendingApprovals = approvals.filter(item => item.status === 'pending')
  const activeJobs = jobs.filter(job => !['delivered', 'completed'].includes(job.status))
  const availableRiders = riders.filter(rider => rider.is_available).length

  const technicianLoad = useMemo(() => {
    const load: Record<string, number> = {}
    jobs.forEach(job => {
      if (!['delivered', 'completed'].includes(job.status)) {
        const name = job.technician_name || 'Unassigned'
        load[name] = (load[name] || 0) + 1
      }
    })
    return Object.entries(load).map(([name, count]) => ({ name, count }))
  }, [jobs])

  const fillJobForm = (booking: CustomerBooking) => {
    setJobForm({
      odometer_km: String(booking.customer_vehicles?.odometer_km || ''),
      fuel_level: 'half',
      technician_name: technicians[0]?.name || '',
      estimated_delivery_at: toInputDateTime(daysFromNow(1)),
      recommended_services: booking.service_category || 'General service',
      customer_complaints: booking.reported_issues || booking.notes || '',
      internal_remarks: '',
      pickup_required: Boolean(booking.pickup_required),
      drop_required: Boolean(booking.drop_required),
    })
  }

  const createJobCard = async (booking: CustomerBooking) => {
    if (!center || !user) return
    setSaving(true)
    setError('')
    const recommended = toList(jobForm.recommended_services || booking.service_category)
    const trackingToken = newToken()
    try {
      // TODO: Confirm backend endpoint for creating a service job card.
      const job = await api.post<JobCard>('/api/service-manager/job-cards', {
        booking_id: booking.id,
        booking_source: 'customer_bookings',
        customer_id: booking.customer_id,
        vehicle_id: booking.vehicle_id,
        service_center_id: center.id,
        status: 'booked',
        odometer_km: Number(jobForm.odometer_km || booking.customer_vehicles?.odometer_km || 0),
        fuel_level: jobForm.fuel_level,
        customer_complaints: jobForm.customer_complaints || booking.reported_issues || booking.notes || '',
        recommended_services: recommended,
        estimated_delivery_at: jobForm.estimated_delivery_at ? new Date(jobForm.estimated_delivery_at).toISOString() : null,
        technician_name: jobForm.technician_name,
        pickup_required: jobForm.pickup_required,
        drop_required: jobForm.drop_required,
        internal_remarks: jobForm.internal_remarks,
        advisor_id: user.id,
        tracking_token: trackingToken,
      })

      // TODO: Confirm backend endpoint for updating booking after job card creation.
      await api.patch(`/api/bookings/${booking.id}`, {
        status: 'confirmed',
        current_stage: 'job_card_created',
        tracking_token: trackingToken,
        stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(() => {})

      await createCustomerToken('tracking', trackingToken, booking.customer_id, booking.id, job.id)
      await createCustomerToken('feedback', newToken(), booking.customer_id, booking.id, job.id)

      // TODO: Confirm backend endpoint for charging dealer once per booking.
      await api.post('/api/dealer/charge-booking-once', { booking_id: booking.id, job_card_id: job.id, actor_id: user.id }).catch(() => {})

      await addTimeline(job.id, booking.customer_id, 'booked', 'Job card created', `Service intake opened for ${booking.service_category}.`, 'customer')
      await recordCrmEvent(booking.customer_id, 'job_card_created', 'Service job card created', job.job_number, job.id, 'service_job_card', booking.vehicle_id)
      await queueNotification(
        booking.customer_id,
        booking.profiles?.phone || '',
        'Job card created',
        `Hi ${booking.profiles?.full_name || 'there'}, your BikeAI job card ${job.job_number} has been created at ${center.name}. Track live updates: ${SERVICE_PUBLIC_BASE}/track/${trackingToken}`,
        'service_job_card',
        job.id,
      )

      await loadOperations(center.id)
      setSelectedJobId(job.id)
      await loadTimeline(job.id)
      setSaving(false)
    } catch (e) {
      setError((e as Error).message || 'Could not create job card.')
      setSaving(false)
    }
  }

  const updateJobDetails = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedJob) return
    setSaving(true)
    try {
      // TODO: Confirm backend endpoint for updating job card details.
      await api.patch(`/api/service-manager/job-cards/${selectedJob.id}`, {
        odometer_km: Number(jobForm.odometer_km || selectedJob.odometer_km || 0),
        fuel_level: jobForm.fuel_level,
        customer_complaints: jobForm.customer_complaints,
        recommended_services: toList(jobForm.recommended_services),
        estimated_delivery_at: jobForm.estimated_delivery_at ? new Date(jobForm.estimated_delivery_at).toISOString() : null,
        technician_name: jobForm.technician_name,
        pickup_required: jobForm.pickup_required,
        drop_required: jobForm.drop_required,
        internal_remarks: jobForm.internal_remarks,
        updated_at: new Date().toISOString(),
      })
      await addTimeline(selectedJob.id, selectedJob.customer_id, selectedJob.status, 'Job card details updated', 'Advisor updated operational intake fields.', 'internal')
      await loadOperations(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const advanceStatus = async (targetStatus: JobStatus) => {
    if (!center || !selectedJob) return
    setSaving(true)
    const notes = targetStatus === 'awaiting_approval'
      ? 'Estimate approval requested from customer.'
      : `Service status moved to ${labelize(targetStatus)}.`
    try {
      // TODO: Confirm backend endpoint for advancing job status.
      await api.patch(`/api/service-manager/job-cards/${selectedJob.id}`, {
        status: targetStatus,
        last_status_at: new Date().toISOString(),
        is_delayed: false,
        delay_reason: '',
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
      return
    }

    if (selectedJob.booking_id) {
      // TODO: Confirm backend endpoint for updating booking stage/status from job status.
      await api.patch(`/api/bookings/${selectedJob.booking_id}`, {
        current_stage: targetStatus,
        status: targetStatus === 'completed' ? 'completed' : 'confirmed',
        completed_at: targetStatus === 'completed' ? new Date().toISOString() : null,
        stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(() => {})
    }

    await addTimeline(selectedJob.id, selectedJob.customer_id, targetStatus, labelize(targetStatus), notes, isInternalStatus(targetStatus) ? 'internal' : 'customer')
    await recordCrmEvent(selectedJob.customer_id, 'service_status_update', labelize(targetStatus), notes, selectedJob.id, 'service_job_card', selectedJob.vehicle_id)
    await queueNotification(selectedJob.customer_id, selectedJob.profiles?.phone || '', labelize(targetStatus), buildStatusMessage(selectedJob, targetStatus), 'service_job_card', selectedJob.id)
    if (targetStatus === 'delivered' || targetStatus === 'completed') {
      const feedbackToken = newToken()
      await createCustomerToken('feedback', feedbackToken, selectedJob.customer_id, selectedJob.booking_id, selectedJob.id)
      await queueNotification(selectedJob.customer_id, selectedJob.profiles?.phone || '', 'Feedback request', `Hi ${selectedJob.profiles?.full_name || 'there'}, thanks for choosing BikeAI. Please rate your service: ${SERVICE_PUBLIC_BASE}/feedback/${feedbackToken}`, 'service_feedback', selectedJob.id)
    }
    await loadOperations(center.id)
    await loadTimeline(selectedJob.id)
    setSaving(false)
  }

  const assignRider = async () => {
    if (!center || !selectedJob) return
    const rider = riders.find(item => item.is_available)
    await addTimeline(selectedJob.id, selectedJob.customer_id, 'pickup_assigned', rider ? `Pickup assigned to ${rider.name}` : 'Pickup assignment pending', rider ? `Rider phone: ${rider.phone}` : 'No available rider found.', 'customer')
    if (rider) {
      try {
        // TODO: Confirm backend endpoint for reserving a rider.
        await api.patch(`/api/service-manager/riders/${rider.id}`, { is_available: false, current_job_id: selectedJob.id, updated_at: new Date().toISOString() })
      } catch {
        // non-fatal
      }
    }
    await advanceStatus('pickup_assigned')
  }

  const markDelayed = async (job: JobCard) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for marking a job card delayed.
      await api.patch(`/api/service-manager/job-cards/${job.id}`, {
        is_delayed: true,
        delay_reason: 'No operational update within expected SLA.',
        escalation_level: (job.escalation_level || 0) + 1,
        updated_at: new Date().toISOString(),
      })
    } catch {
      // still record timeline/notification best-effort
    }
    await addTimeline(job.id, job.customer_id, job.status, 'Escalation warning', 'No-update monitoring marked this workflow as delayed.', 'internal')
    await queueNotification(job.customer_id, job.profiles?.phone || '', 'Service delay alert', `Your service job ${job.job_number} needs an update from the workshop. Our service manager has been alerted.`, 'service_job_card', job.id)
    await loadOperations(center.id)
  }

  const saveInspection = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedJob || !user) return
    const required = [inspectionForm.photo_front, inspectionForm.photo_rear, inspectionForm.photo_left, inspectionForm.photo_right]
    if (required.some(value => !value.trim())) {
      setError('Front, rear, left, and right photos are mandatory.')
      return
    }
    setSaving(true)
    const payload = {
      job_card_id: selectedJob.id,
      customer_id: selectedJob.customer_id,
      vehicle_id: selectedJob.vehicle_id,
      service_center_id: center.id,
      photo_front: inspectionForm.photo_front,
      photo_rear: inspectionForm.photo_rear,
      photo_left: inspectionForm.photo_left,
      photo_right: inspectionForm.photo_right,
      damage_photos: toList(inspectionForm.damage_photos),
      scratch_dent_notes: inspectionForm.scratch_dent_notes,
      accessories: inspectionForm.accessories,
      complaint_notes: inspectionForm.complaint_notes,
      acknowledgement_method: 'otp',
      acknowledgement_otp: inspectionForm.acknowledgement_otp,
      acknowledged_at: inspectionForm.acknowledgement_otp ? new Date().toISOString() : null,
      advisor_id: user.id,
      updated_at: new Date().toISOString(),
    }
    try {
      // TODO: Confirm backend endpoint for upserting an inspection.
      if (selectedInspection) await api.patch(`/api/service-manager/inspections/${selectedInspection.id}`, payload)
      else await api.post('/api/service-manager/inspections', payload)
      await addTimeline(selectedJob.id, selectedJob.customer_id, selectedJob.status, 'Digital inspection saved', 'Four-angle vehicle inspection and acknowledgement captured.', 'customer')
      await recordCrmEvent(selectedJob.customer_id, 'vehicle_inspection', 'Vehicle inspection saved', inspectionForm.scratch_dent_notes, selectedJob.id, 'service_inspection', selectedJob.vehicle_id)
      await queueNotification(selectedJob.customer_id, selectedJob.profiles?.phone || '', 'Inspection shared', buildLinkMessage(selectedJob, 'inspection'), 'service_inspection', selectedJob.id)
      await loadOperations(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const requestApproval = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedJob || !user) return
    setSaving(true)
    const token = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
    let approval: ApprovalRow | null = null
    try {
      // TODO: Confirm backend endpoint for creating an approval request.
      approval = await api.post<ApprovalRow>('/api/service-manager/approval-requests', {
        job_card_id: selectedJob.id,
        customer_id: selectedJob.customer_id,
        service_center_id: center.id,
        title: approvalForm.title,
        requested_work: toList(approvalForm.requested_work),
        estimate_amount: Number(approvalForm.estimate_amount || 0),
        approval_token: token,
        requested_by: user.id,
      })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
      return
    }
    await advanceStatus('awaiting_approval')
    await createCustomerToken('approval', approval.approval_token, selectedJob.customer_id, selectedJob.booking_id || null, selectedJob.id, approval.id)
    const approvalLink = `${SERVICE_PUBLIC_BASE}/approval/${approval.approval_token}`
    const body = `Hi ${selectedJob.profiles?.full_name || 'there'}, ${center.name} needs approval for ${approval.title} on ${selectedJob.job_number}. Estimate: INR ${approval.estimate_amount}. Approve here: ${approvalLink}`
    await queueNotification(selectedJob.customer_id, selectedJob.profiles?.phone || '', 'Approval needed', body, 'service_approval_request', approval.id)
    await recordCrmEvent(selectedJob.customer_id, 'approval_requested', approval.title, body, approval.id, 'service_approval_request', selectedJob.vehicle_id)
    await loadOperations(center.id)
    setSaving(false)
  }

  const saveChatMemory = async (event: FormEvent) => {
    event.preventDefault()
    if (!center || !selectedJob || !user || !memoryForm.summary.trim()) return
    setSaving(true)
    try {
      // TODO: Confirm backend endpoint for storing service chat memory.
      await api.post('/api/service-manager/chat-memory', {
        job_card_id: selectedJob.id,
        customer_id: selectedJob.customer_id,
        service_center_id: center.id,
        conversation_source: 'chatbot',
        visibility: memoryForm.visibility,
        tags: memoryForm.tags,
        summary: memoryForm.summary,
        raw_excerpt: memoryForm.raw_excerpt,
        sentiment: memoryForm.sentiment,
        created_by: user.id,
      })
      await addTimeline(selectedJob.id, selectedJob.customer_id, selectedJob.status, 'CRM memory stored', memoryForm.summary, memoryForm.visibility)
      await recordCrmEvent(selectedJob.customer_id, 'chat_memory', 'Chatbot memory stored', memoryForm.summary, selectedJob.id, 'service_chat_memory', selectedJob.vehicle_id)
      setMemoryForm({ summary: '', raw_excerpt: '', sentiment: 'neutral', visibility: 'internal', tags: [] })
      await loadOperations(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const addTimeline = async (
    jobId: string,
    customerId: string,
    status: string,
    title: string,
    notes: string,
    visibility: 'customer' | 'internal',
  ) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for adding a job timeline entry.
      await api.post('/api/service-manager/job-timeline', {
        job_card_id: jobId,
        customer_id: customerId,
        service_center_id: center.id,
        status,
        title,
        notes,
        visibility,
        actor_id: user?.id || null,
      })
    } catch {
      // non-fatal
    }
  }

  const recordCrmEvent = async (
    customerId: string,
    eventType: string,
    title: string,
    body: string,
    entityId: string,
    entityType: string,
    vehicleId?: string | null,
  ) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for recording CRM interaction events.
      await api.post('/api/crm/interaction-events', {
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        service_center_id: center.id,
        event_type: eventType,
        title,
        body,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: user?.id || null,
      })
    } catch {
      // non-fatal
    }
  }

  const queueNotification = async (
    customerId: string,
    phone: string,
    subject: string,
    body: string,
    entityType: string,
    entityId: string,
  ) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for queueing notifications.
      await api.post('/api/notifications/queue', {
        user_id: customerId,
        customer_id: customerId,
        service_center_id: center.id,
        channel: 'whatsapp',
        recipient: phone.replace(/[^0-9]/g, ''),
        subject,
        body,
        status: 'pending',
        entity_type: entityType,
        entity_id: entityId,
      })
    } catch {
      // non-fatal
    }
  }

  const createCustomerToken = async (
    tokenType: 'booking' | 'tracking' | 'approval' | 'inspection' | 'invoice' | 'feedback',
    token: string,
    customerId: string,
    bookingId: string | null,
    jobCardId: string | null,
    approvalId?: string,
  ) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for storing customer tokens (tracking/approval/feedback).
      await api.post('/api/service-manager/customer-tokens', {
        token,
        token_type: tokenType,
        customer_id: customerId,
        booking_id: bookingId,
        job_card_id: jobCardId,
        approval_id: approvalId || null,
        service_center_id: center.id,
      })
    } catch {
      // non-fatal
    }
  }

  const openWhatsApp = (body: string) => {
    if (!selectedJob) return
    const phone = (selectedJob.profiles?.whatsapp_number || selectedJob.profiles?.phone || '').replace(/[^0-9]/g, '')
    if (!phone) {
      setError('No customer phone found for WhatsApp.')
      return
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer')
  }

  const nextStatus = selectedJob ? STATUS_FLOW[STATUS_FLOW.indexOf(selectedJob.status) + 1] : undefined

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Service Operations</h1>
          <p style={s.subtitle}>{center ? `${center.name} - ${center.city}` : 'Dealer-scoped operational workflow'}</p>
        </div>
        <button onClick={loadInitial} style={s.secondaryBtn}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <div style={s.error}><AlertTriangle size={15} /> {error}</div>}
      {!center && !loading && <div style={s.empty}>No dealer service center is linked to this account yet.</div>}

      <div style={s.kpiRow}>
        <Kpi label="Active Jobs" value={activeJobs.length} icon={Wrench} color="#2563EB" />
        <Kpi label="Pending Approvals" value={pendingApprovals.length} icon={ShieldCheck} color="#DC2626" />
        <Kpi label="Delayed Updates" value={delayedJobs.length} icon={AlertTriangle} color="#F59E0B" />
        <Kpi label="Free Riders" value={availableRiders} icon={Truck} color="#0D9488" />
        <Kpi label="Inspections" value={inspections.length} icon={Camera} color="#7C3AED" />
      </div>

      <DealerRevenueWidgets serviceCenterId={center?.id || null} compact />

      <div style={s.tabRow}>
        {TABS.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{ ...s.tab, ...(tab === item.id ? s.tabActive : {}) }}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div style={s.grid}>
          <section style={s.panel}>
            <div style={s.panelHead}>
              <div>
                <h2 style={s.panelTitle}>Operational Job Cards</h2>
                <p style={s.panelHint}>Confirmed bookings become controlled workshop jobs.</p>
              </div>
              <div style={s.searchWrap}>
                <Search size={14} color="#64748B" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search job/customer/vehicle" style={s.searchInput} />
              </div>
            </div>

            <div style={s.jobList}>
              {filteredJobs.map(job => (
                <button key={job.id} onClick={() => { setSelectedJobId(job.id); loadTimeline(job.id) }} style={{ ...s.jobCard, ...(selectedJobId === job.id ? s.jobCardActive : {}) }}>
                  <div style={s.jobTop}>
                    <strong>{job.job_number}</strong>
                    <StatusBadge status={job.status} />
                  </div>
                  <div style={s.jobVehicle}>{vehicleName(job.customer_vehicles)}</div>
                  <div style={s.jobMeta}>{job.profiles?.full_name || 'Customer'} - {job.technician_name || 'Unassigned'}</div>
                  {isJobDelayed(job) && <span style={s.warningInline}><AlertTriangle size={12} /> Update overdue</span>}
                </button>
              ))}
              {!filteredJobs.length && <div style={s.empty}>No job cards yet. Create one from confirmed bookings below.</div>}
            </div>
          </section>

          <section style={s.panel}>
            <h2 style={s.panelTitle}>Confirmed Bookings</h2>
            <div style={s.bookingList}>
              {readyBookings.slice(0, 8).map(booking => (
                <div key={booking.id} style={s.bookingCard}>
                  <div>
                    <strong>{booking.profiles?.full_name || 'Customer'}</strong>
                    <div style={s.jobMeta}>{vehicleName(booking.customer_vehicles)} - {booking.service_category}</div>
                    <div style={s.jobMeta}>{booking.scheduled_date} {booking.scheduled_time}</div>
                  </div>
                  <div style={s.bookingActions}>
                    <button onClick={() => fillJobForm(booking)} style={s.secondaryBtn}>Prefill</button>
                    <button onClick={() => createJobCard(booking)} disabled={saving} style={s.primaryBtn}><Plus size={14} /> Create Job</button>
                  </div>
                </div>
              ))}
              {!readyBookings.length && <div style={s.empty}>No confirmed bookings waiting for job card conversion.</div>}
            </div>
          </section>

          {selectedJob && (
            <section style={{ ...s.panel, gridColumn: '1 / -1' }}>
              <div style={s.detailHead}>
                <div>
                  <h2 style={s.panelTitle}>{selectedJob.job_number} - {selectedJob.profiles?.full_name}</h2>
                  <p style={s.panelHint}>{vehicleName(selectedJob.customer_vehicles)} - {selectedJob.pickup_required ? 'Pickup required' : 'Workshop visit'} - {selectedJob.drop_required ? 'Drop required' : 'Self pickup'}</p>
                </div>
                <div style={s.actionStrip}>
                  {nextStatus && (
                    <button onClick={nextStatus === 'pickup_assigned' ? assignRider : () => advanceStatus(nextStatus)} disabled={saving} style={s.primaryBtn}>
                      <ChevronRight size={14} /> {ACTION_LABELS[nextStatus]}
                    </button>
                  )}
                  <button onClick={() => openWhatsApp(buildStatusMessage(selectedJob, selectedJob.status))} style={s.whatsappBtn}><Phone size={14} /> WhatsApp</button>
                </div>
              </div>

              <form onSubmit={updateJobDetails} style={s.formGrid}>
                <Field label="Odometer KM" value={jobForm.odometer_km || String(selectedJob.odometer_km || '')} onChange={value => setJobForm({ ...jobForm, odometer_km: value })} />
                <Field label="Fuel Level" value={jobForm.fuel_level || selectedJob.fuel_level} onChange={value => setJobForm({ ...jobForm, fuel_level: value })} />
                <Field label="Technician" value={jobForm.technician_name || selectedJob.technician_name} onChange={value => setJobForm({ ...jobForm, technician_name: value })} list="technicians" />
                <Field label="Estimated Delivery" type="datetime-local" value={jobForm.estimated_delivery_at || toInputDateTime(selectedJob.estimated_delivery_at)} onChange={value => setJobForm({ ...jobForm, estimated_delivery_at: value })} />
                <label style={s.fullField}>Customer Complaints<textarea value={jobForm.customer_complaints || selectedJob.customer_complaints} onChange={event => setJobForm({ ...jobForm, customer_complaints: event.target.value })} style={s.textarea} /></label>
                <label style={s.fullField}>Recommended Services<textarea value={jobForm.recommended_services || selectedJob.recommended_services.join(', ')} onChange={event => setJobForm({ ...jobForm, recommended_services: event.target.value })} style={s.textarea} /></label>
                <label style={s.fullField}>Internal Remarks<textarea value={jobForm.internal_remarks || selectedJob.internal_remarks} onChange={event => setJobForm({ ...jobForm, internal_remarks: event.target.value })} style={s.textarea} /></label>
                <div style={s.checkRow}>
                  <label><input type="checkbox" checked={jobForm.pickup_required || selectedJob.pickup_required} onChange={event => setJobForm({ ...jobForm, pickup_required: event.target.checked })} /> Pickup required</label>
                  <label><input type="checkbox" checked={jobForm.drop_required || selectedJob.drop_required} onChange={event => setJobForm({ ...jobForm, drop_required: event.target.checked })} /> Drop required</label>
                </div>
                <button type="submit" disabled={saving} style={s.primaryBtn}><Save size={14} /> Save Job Card</button>
              </form>
              <datalist id="technicians">{technicians.map(tech => <option key={tech.id} value={tech.name} />)}</datalist>
            </section>
          )}
        </div>
      )}

      {tab === 'intake' && selectedJob && (
        <section style={s.panel}>
          <h2 style={s.panelTitle}>Digital Vehicle Inspection</h2>
          <p style={s.panelHint}>Mandatory four-angle capture with damage notes, accessories, and OTP acknowledgement.</p>
          <form onSubmit={saveInspection} style={s.formGrid}>
            <Field label="Front Photo URL" value={inspectionForm.photo_front || selectedInspection?.photo_front || ''} onChange={value => setInspectionForm({ ...inspectionForm, photo_front: value })} />
            <Field label="Rear Photo URL" value={inspectionForm.photo_rear || selectedInspection?.photo_rear || ''} onChange={value => setInspectionForm({ ...inspectionForm, photo_rear: value })} />
            <Field label="Left Photo URL" value={inspectionForm.photo_left || selectedInspection?.photo_left || ''} onChange={value => setInspectionForm({ ...inspectionForm, photo_left: value })} />
            <Field label="Right Photo URL" value={inspectionForm.photo_right || selectedInspection?.photo_right || ''} onChange={value => setInspectionForm({ ...inspectionForm, photo_right: value })} />
            <label style={s.fullField}>Optional Damage Closeups<textarea value={inspectionForm.damage_photos} onChange={event => setInspectionForm({ ...inspectionForm, damage_photos: event.target.value })} placeholder="Comma separated image URLs" style={s.textarea} /></label>
            <label style={s.fullField}>Scratch / Dent Notes<textarea value={inspectionForm.scratch_dent_notes || selectedInspection?.scratch_dent_notes || ''} onChange={event => setInspectionForm({ ...inspectionForm, scratch_dent_notes: event.target.value })} style={s.textarea} /></label>
            <label style={s.fullField}>Complaint Notes<textarea value={inspectionForm.complaint_notes || selectedInspection?.complaint_notes || ''} onChange={event => setInspectionForm({ ...inspectionForm, complaint_notes: event.target.value })} style={s.textarea} /></label>
            <div style={s.checkRow}>
              {Object.entries(inspectionForm.accessories).map(([key, checked]) => (
                <label key={key}><input type="checkbox" checked={checked} onChange={event => setInspectionForm({ ...inspectionForm, accessories: { ...inspectionForm.accessories, [key]: event.target.checked } })} /> {labelize(key)}</label>
              ))}
            </div>
            <Field label="OTP / Digital Confirmation" value={inspectionForm.acknowledgement_otp || selectedInspection?.acknowledgement_otp || ''} onChange={value => setInspectionForm({ ...inspectionForm, acknowledgement_otp: value })} />
            <button type="submit" disabled={saving} style={s.primaryBtn}><ClipboardCheck size={14} /> Save Inspection</button>
          </form>
        </section>
      )}

      {tab === 'approvals' && selectedJob && (
        <div style={s.grid}>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Additional Work Approval</h2>
            <form onSubmit={requestApproval} style={s.stack}>
              <Field label="Approval Title" value={approvalForm.title} onChange={value => setApprovalForm({ ...approvalForm, title: value })} />
              <label style={s.fullField}>Requested Work<textarea value={approvalForm.requested_work} onChange={event => setApprovalForm({ ...approvalForm, requested_work: event.target.value })} style={s.textarea} /></label>
              <Field label="Estimate Amount" value={approvalForm.estimate_amount} onChange={value => setApprovalForm({ ...approvalForm, estimate_amount: value })} />
              <button type="submit" disabled={saving} style={s.primaryBtn}><Send size={14} /> Send Approval Link</button>
            </form>
          </section>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Approval History</h2>
            {selectedApprovals.map(item => (
              <div key={item.id} style={s.historyItem}>
                <div><strong>{item.title}</strong><div style={s.jobMeta}>{item.requested_work.join(', ')}</div></div>
                <span style={s.money}>INR {item.estimate_amount}</span>
                <StatusPill label={item.status} color={item.status === 'pending' ? '#F59E0B' : item.status === 'approved' ? '#16A34A' : '#DC2626'} />
                <button onClick={() => openWhatsApp(`Approval link: ${SERVICE_PUBLIC_BASE}/approval/${item.approval_token}`)} style={s.secondaryBtn}>Share</button>
              </div>
            ))}
            {!selectedApprovals.length && <div style={s.empty}>No approval requests created for this job.</div>}
          </section>
        </div>
      )}

      {tab === 'tracking' && (
        <div style={s.grid}>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>No-Update Monitoring</h2>
            {activeJobs.map(job => (
              <div key={job.id} style={s.historyItem}>
                <div><strong>{job.job_number}</strong><div style={s.jobMeta}>{job.profiles?.full_name} - Last update {timeAgo(job.last_status_at)}</div></div>
                <StatusBadge status={job.status} />
                {isJobDelayed(job)
                  ? <button onClick={() => markDelayed(job)} style={s.dangerBtn}><AlertTriangle size={14} /> Escalate</button>
                  : <StatusPill label="On track" color="#16A34A" />}
              </div>
            ))}
          </section>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Technician Workload</h2>
            {technicianLoad.map(item => (
              <div key={item.name} style={s.loadRow}>
                <span>{item.name}</span>
                <strong>{item.count} active</strong>
              </div>
            ))}
            {!technicianLoad.length && <div style={s.empty}>No active technician assignments.</div>}
          </section>
        </div>
      )}

      {tab === 'memory' && selectedJob && (
        <div style={s.grid}>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Persistent Chatbot + CRM Memory</h2>
            <form onSubmit={saveChatMemory} style={s.stack}>
              <label style={s.fullField}>Conversation Summary<textarea value={memoryForm.summary} onChange={event => setMemoryForm({ ...memoryForm, summary: event.target.value })} style={s.textarea} /></label>
              <label style={s.fullField}>Raw Excerpt<textarea value={memoryForm.raw_excerpt} onChange={event => setMemoryForm({ ...memoryForm, raw_excerpt: event.target.value })} style={s.textarea} /></label>
              <Field label="Sentiment" value={memoryForm.sentiment} onChange={value => setMemoryForm({ ...memoryForm, sentiment: value })} />
              <div style={s.checkRow}>
                {CHAT_TAGS.map(tag => (
                  <label key={tag}><input type="checkbox" checked={memoryForm.tags.includes(tag)} onChange={() => setMemoryForm({ ...memoryForm, tags: toggle(memoryForm.tags, tag) })} /> {labelize(tag)}</label>
                ))}
              </div>
              <div style={s.checkRow}>
                <label><input type="radio" checked={memoryForm.visibility === 'internal'} onChange={() => setMemoryForm({ ...memoryForm, visibility: 'internal' })} /> Internal dealer-only</label>
                <label><input type="radio" checked={memoryForm.visibility === 'customer'} onChange={() => setMemoryForm({ ...memoryForm, visibility: 'customer' })} /> Customer-visible</label>
              </div>
              <button type="submit" disabled={saving} style={s.primaryBtn}><MessageSquare size={14} /> Store Memory</button>
            </form>
          </section>
          <section style={s.panel}>
            <h2 style={s.panelTitle}>Timeline + Memory</h2>
            {[...timeline.map(item => ({ id: item.id, title: item.title, body: item.notes, meta: `${labelize(item.status)} - ${item.visibility}`, date: item.created_at })), ...selectedMemories.map(item => ({ id: item.id, title: item.summary, body: item.tags.map(labelize).join(', '), meta: `${item.sentiment} - ${item.visibility}`, date: item.created_at }))].map(item => (
              <div key={item.id} style={s.timelineItem}>
                <div style={s.timelineDot} />
                <div>
                  <strong>{item.title}</strong>
                  <div style={s.jobMeta}>{item.body}</div>
                  <div style={s.jobMeta}>{item.meta} - {timeAgo(item.date)}</div>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      <AIChatWidget role="service_manager" />
    </div>
  )
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div style={s.kpi}>
      <div style={{ ...s.kpiIcon, background: `${color}18` }}><Icon size={18} color={color} /></div>
      <div><div style={{ ...s.kpiValue, color }}>{value}</div><div style={s.kpiLabel}>{label}</div></div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', list }: { label: string; value: string; onChange: (value: string) => void; type?: string; list?: string }) {
  return (
    <label style={s.field}>
      {label}
      <input type={type} value={value} onChange={event => onChange(event.target.value)} list={list} style={s.input} />
    </label>
  )
}

function StatusBadge({ status }: { status: JobStatus }) {
  return <StatusPill label={labelize(status)} color={STATUS_COLORS[status]} />
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return <span style={{ ...s.statusPill, background: `${color}18`, color }}>{label}</span>
}

function vehicleName(vehicle?: VehicleRow | null) {
  if (!vehicle) return 'Vehicle not linked'
  const model = `${vehicle.vehicle_oems?.name || ''} ${vehicle.vehicle_models?.name || ''}`.trim()
  return model ? `${model} (${vehicle.registration_number})` : vehicle.registration_number
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function toList(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function toInputDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function isJobDelayed(job: JobCard) {
  if (['ready_for_delivery', 'delivered', 'completed'].includes(job.status)) return false
  const last = new Date(job.last_status_at || job.created_at).getTime()
  return Date.now() - last > 4 * 60 * 60 * 1000 || job.is_delayed
}

function isInternalStatus(status: JobStatus) {
  return ['diagnosis', 'in_progress', 'qc_washing'].includes(status)
}

function buildStatusMessage(job: JobCard, status: JobStatus) {
  const trackingLink = `${SERVICE_PUBLIC_BASE}/track/${job.tracking_token || job.booking_id || job.id}`
  return `Hi ${job.profiles?.full_name || 'there'}, your BikeAI job ${job.job_number} is now ${labelize(status)}. Track live updates here: ${trackingLink}`
}

function buildLinkMessage(job: JobCard, kind: string) {
  const token = job.tracking_token || job.booking_id || job.id
  const path = kind === 'inspection' ? 'track' : kind
  return `Hi ${job.profiles?.full_name || 'there'}, your BikeAI ${kind} update for ${job.job_number} is ready. View it here: ${SERVICE_PUBLIC_BASE}/${path}/${token}`
}

function newToken() {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
}

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

const s: Record<string, React.CSSProperties> = {
  root: { padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#0F172A' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '28px', color: '#0B1F4D' },
  subtitle: { margin: '5px 0 0', color: '#64748B', fontSize: '13px' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px' },
  empty: { padding: '18px', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#64748B', fontSize: '13px', background: '#F8FAFC' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '18px' },
  kpi: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  kpiIcon: { width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: '24px', fontWeight: 800, lineHeight: 1 },
  kpiLabel: { fontSize: '12px', color: '#64748B', marginTop: '3px' },
  tabRow: { display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '18px', overflowX: 'auto' },
  tab: { padding: '9px 14px', background: 'transparent', border: 0, borderBottom: '2px solid transparent', color: '#64748B', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tabActive: { color: '#0B1F4D', borderBottomColor: '#FFD600' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '16px' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' },
  panelTitle: { margin: 0, fontSize: '17px', color: '#0B1F4D' },
  panelHint: { margin: '4px 0 0', fontSize: '12px', color: '#64748B' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: '7px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '7px 10px', background: '#F8FAFC' },
  searchInput: { border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '13px', minWidth: '190px' },
  jobList: { display: 'grid', gap: '10px' },
  jobCard: { textAlign: 'left', border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '9px', padding: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  jobCardActive: { borderColor: '#FFD600', boxShadow: '0 0 0 3px rgba(255,214,0,0.2)', background: '#FFFDF0' },
  jobTop: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginBottom: '6px' },
  jobVehicle: { fontSize: '13px', color: '#0F172A', fontWeight: 600 },
  jobMeta: { fontSize: '12px', color: '#64748B', marginTop: '3px' },
  warningInline: { display: 'inline-flex', gap: '4px', alignItems: 'center', color: '#B45309', fontSize: '12px', marginTop: '7px', fontWeight: 700 },
  bookingList: { display: 'grid', gap: '10px' },
  bookingCard: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '9px', alignItems: 'center', flexWrap: 'wrap' },
  bookingActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  detailHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  actionStrip: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#0B1F4D', color: '#FFFFFF', border: 0, borderRadius: '8px', padding: '9px 13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#FFFFFF', color: '#0B1F4D', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
  whatsappBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
  dangerBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' },
  stack: { display: 'grid', gap: '12px' },
  field: { display: 'grid', gap: '6px', fontSize: '12px', color: '#475569', fontWeight: 700 },
  fullField: { display: 'grid', gap: '6px', fontSize: '12px', color: '#475569', fontWeight: 700, gridColumn: '1 / -1' },
  input: { border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 10px', font: 'inherit', fontSize: '13px', outline: 'none' },
  textarea: { border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 10px', font: 'inherit', fontSize: '13px', minHeight: '72px', resize: 'vertical' },
  checkRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#334155', gridColumn: '1 / -1' },
  statusPill: { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' },
  historyItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid #F1F5F9', padding: '11px 0', flexWrap: 'wrap' },
  money: { color: '#0B1F4D', fontSize: '13px' },
  loadRow: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', padding: '10px 0', fontSize: '13px' },
  timelineItem: { display: 'grid', gridTemplateColumns: '12px 1fr', gap: '10px', padding: '11px 0', borderBottom: '1px solid #F1F5F9' },
  timelineDot: { width: '9px', height: '9px', borderRadius: '50%', background: '#FFD600', marginTop: '4px' },
}
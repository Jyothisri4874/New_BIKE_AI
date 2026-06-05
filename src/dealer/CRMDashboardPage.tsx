import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Edit2,
  MessageSquare,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import AIChatWidget from '../components/AIChatWidget'
import { api, safeGet } from '../lib/api'
import { useDealerAuth } from '../hooks/useDealerAuth'
import DealerRevenueWidgets from './DealerRevenueWidgets'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

type TabId = 'customers' | 'reminders' | 'followups' | 'retention' | 'timeline' | 'communication_center' | 'templates' | 'service_due_master' | 'interval_rules' | 'exports'
type LeadStatus = 'new' | 'active' | 'warm' | 'cold' | 'converted' | 'lost' | 'archived'
type FollowupStatus = 'pending' | 'contacted' | 'completed' | 'cancelled'
type ServiceType = 'free' | 'paid' | 'periodic' | 'repair' | 'accidental'
type CustomerVehicleStatus = 'active' | 'inactive' | 'lost' | 'vehicle_sold'
type TemplateKey =
  | 'n_7_reminder'
  | 'n_3_reminder'
  | 'n_1_reminder'
  | 'due_today'
  | 'overdue_followup'
  | 'booking_confirmation'
  | 'approval_request'
  | 'ready_for_delivery'
  | 'invoice_payment_link'
  | 'feedback_request'
  | 'retention_followup'
  | 'live_tracking_link'
  | 'inspection_report'
  | 'delivery_confirmation'

interface DealerCenter {
  id: string
  name: string
  city: string
}

interface Customer {
  id: string
  full_name: string
  phone: string
  whatsapp_number: string | null
  email: string | null
  city: string | null
  pincode: string | null
  customer_notes: string | null
  lead_status: LeadStatus
  is_active: boolean
  created_at: string
  last_contacted_at: string | null
  preferred_center_id: string | null
  tags?: string[]
}

interface Vehicle {
  id: string
  customer_id: string
  nickname: string | null
  registration_number: string
  oem_id: string | null
  model_id: string | null
  manufacturing_year: number | null
  fuel_type: string | null
  odometer_km: number | null
  next_service_date: string | null
  next_service_km: number | null
  date_of_sale?: string | null
  last_service_date?: string | null
  last_service_odometer_km?: number | null
  last_service_type?: ServiceType | null
  service_interval_days?: number | null
  service_interval_km?: number | null
  original_dealership?: string | null
  last_serviced_dealership?: string | null
  customer_status?: CustomerVehicleStatus | null
  is_active: boolean
  vehicle_oems?: { name: string } | null
  vehicle_models?: { name: string; segment?: string } | null
}

interface Booking {
  id: string
  customer_id: string
  vehicle_id: string | null
  service_type: string
  service_category?: string
  scheduled_date: string
  scheduled_time?: string
  status: string
  estimated_cost?: number
  final_cost?: number
  service_centers?: { name: string; city: string } | null
}

interface Followup {
  id: string
  customer_id: string
  service_center_id: string | null
  title: string
  follow_up_type: string
  lead_status: LeadStatus
  scheduled_at: string
  completed_at: string | null
  status: FollowupStatus
  channel: string
  notes: string | null
  profiles?: { full_name: string; phone: string; whatsapp_number?: string | null } | null
}

interface BookingLink {
  id: string
  token: string
  customer_id: string
  vehicle_id: string | null
  service_center_id: string | null
  service_type: string
  due_date: string | null
  due_km: number | null
  expires_at: string
  used_at: string | null
  created_at: string
}

interface RetentionFeedback {
  id: string
  customer_id: string
  vehicle_id: string | null
  service_center_id: string | null
  reason: string
  details: string | null
  competitor_name: string | null
  status: string
  next_action_at: string | null
  created_at: string
  profiles?: { full_name: string; phone: string } | null
}

interface TimelineEvent {
  id: string
  customer_id: string
  vehicle_id: string | null
  service_center_id: string | null
  event_type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

interface NotificationRow {
  id: string
  user_id: string | null
  channel: string
  body: string
  status: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

interface ServiceIntervalRule {
  id: string
  service_center_id: string
  name: string
  rule_type: string
  service_type: ServiceType
  interval_days: number | null
  interval_km: number | null
  trigger_mode: 'date' | 'km' | 'whichever_first'
  is_active: boolean
  notes: string | null
}

interface MessageTemplate {
  id: string
  service_center_id: string | null
  template_key: TemplateKey | string
  name: string
  category: string
  channel: string
  language: string
  subject: string | null
  body: string
  is_active: boolean
}

interface ChatMemory {
  id: string
  customer_id: string
  service_center_id: string
  tags: string[]
  summary: string
  raw_excerpt: string
  sentiment: string
  visibility: string
  created_at: string
}

interface FeedbackResponse {
  id: string
  customer_id: string | null
  rating: number
  comments: string | null
  tags: string[]
  requires_escalation: boolean
  created_at: string
}

interface ReminderCandidate {
  customer: Customer
  vehicle: Vehicle
  stage: typeof REMINDER_STAGES[number]
  reason: string
  urgency: string
  urgencyColor: string
  dueDate: string | null
  dueKm: number | null
  lastServiceType: string
}

interface TimelineItem {
  id: string
  source: string
  type: string
  title: string
  body: string
  created_at: string
  color: string
}

interface OEM { id: string; name: string }
interface Model { id: string; name: string; oem_id: string }

const LEAD_OPTIONS: LeadStatus[] = ['new', 'active', 'warm', 'cold', 'converted', 'lost', 'archived']
const FOLLOWUP_TYPES = ['service_due', 'lead_callback', 'estimate_shared', 'feedback', 'insurance', 'custom']
const REMINDER_STAGES = ['N-7', 'N-3', 'N-1', 'Due Today', 'Overdue'] as const
const RETENTION_REASONS = ['too_far', 'high_cost', 'poor_experience', 'serviced_elsewhere', 'busy_no_time', 'vehicle_sold', 'other']
const SERVICE_TYPES: ServiceType[] = ['free', 'paid', 'periodic', 'repair', 'accidental']
const VEHICLE_CUSTOMER_STATUSES: CustomerVehicleStatus[] = ['active', 'inactive', 'lost', 'vehicle_sold']
const TEMPLATE_KEYS: { key: TemplateKey; label: string; defaultBody: string }[] = [
  { key: 'n_7_reminder', label: 'N-7 Reminder', defaultBody: 'Hi {{customer_name}}, your {{vehicle_model}} ({{vehicle_number}}) is due for service at {{dealer_name}} on {{service_due_date}} or {{service_due_km}} km. Book here: {{booking_link}}' },
  { key: 'n_3_reminder', label: 'N-3 Reminder', defaultBody: 'Reminder: {{vehicle_number}} is due soon for {{last_service_type}} service. Choose your BikeAI slot: {{booking_link}}' },
  { key: 'n_1_reminder', label: 'N-1 Reminder', defaultBody: 'Hi {{customer_name}}, your service is due tomorrow. {{dealer_name}} can reserve your slot here: {{booking_link}}' },
  { key: 'due_today', label: 'Due Today', defaultBody: 'Your {{vehicle_model}} service is due today at {{dealer_name}}. Book now: {{booking_link}}' },
  { key: 'overdue_followup', label: 'Overdue Follow-up', defaultBody: 'Hi {{customer_name}}, your {{vehicle_number}} service is overdue. Avoid breakdown risk and book here: {{booking_link}}' },
  { key: 'booking_confirmation', label: 'Booking Confirmation', defaultBody: 'Your booking with {{dealer_name}} is confirmed. Track updates here: {{tracking_link}}' },
  { key: 'approval_request', label: 'Approval Request', defaultBody: 'Approval needed for {{vehicle_number}}. Review estimate here: {{approval_link}}' },
  { key: 'ready_for_delivery', label: 'Ready for Delivery', defaultBody: '{{vehicle_number}} is ready for delivery at {{dealer_name}}. Track here: {{tracking_link}}' },
  { key: 'invoice_payment_link', label: 'Invoice / Payment Link', defaultBody: 'Invoice for {{vehicle_number}} is ready. Pay/view here: {{invoice_link}}. Support: info@bikeai.in' },
  { key: 'feedback_request', label: 'Feedback Request', defaultBody: 'Thanks for visiting {{dealer_name}}. Please share feedback for {{vehicle_number}}: {{tracking_link}}' },
  { key: 'retention_followup', label: 'Retention Follow-up', defaultBody: 'Hi {{customer_name}}, we would love to service your {{vehicle_model}} again. Book with {{dealer_name}}: {{booking_link}}' },
  { key: 'live_tracking_link', label: 'Live Tracking Link', defaultBody: 'Track your {{vehicle_number}} service live here: {{tracking_link}}' },
  { key: 'inspection_report', label: 'Inspection Report', defaultBody: 'Your {{vehicle_number}} inspection report is ready. View it here: {{tracking_link}}' },
  { key: 'delivery_confirmation', label: 'Delivery Confirmation', defaultBody: '{{vehicle_number}} has been delivered. Please confirm and rate your experience: {{tracking_link}}' },
]
const TEMPLATE_VARIABLES = ['customer_name', 'vehicle_number', 'vehicle_model', 'dealer_name', 'service_due_date', 'service_due_km', 'last_service_date', 'last_service_type', 'booking_link', 'approval_link', 'tracking_link', 'invoice_link']
const SERVICE_PUBLIC_BASE = 'https://service.bikeai.in'

const EMPTY_CUSTOMER = {
  full_name: '',
  phone: '',
  whatsapp_number: '',
  email: '',
  city: '',
  pincode: '',
  lead_status: 'new' as LeadStatus,
  customer_notes: '',
}

const EMPTY_VEHICLE = {
  nickname: '',
  registration_number: '',
  oem_id: '',
  model_id: '',
  manufacturing_year: new Date().getFullYear(),
  fuel_type: 'petrol',
  odometer_km: 0,
  next_service_date: '',
  next_service_km: 0,
  date_of_sale: '',
  last_service_date: '',
  last_service_odometer_km: 0,
  last_service_type: 'periodic' as ServiceType,
  service_interval_days: 90,
  service_interval_km: 3000,
  original_dealership: '',
  last_serviced_dealership: '',
  customer_status: 'active' as CustomerVehicleStatus,
}

export default function CRMDashboardPage() {
  const { user, profile } = useDealerAuth()
  const [center, setCenter] = useState<DealerCenter | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [retention, setRetention] = useState<RetentionFeedback[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [intervalRules, setIntervalRules] = useState<ServiceIntervalRule[]>([])
  const [chatMemories, setChatMemories] = useState<ChatMemory[]>([])
  const [feedbackResponses, setFeedbackResponses] = useState<FeedbackResponse[]>([])
  const [oems, setOems] = useState<OEM[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('customers')
  const [search, setSearch] = useState('')
  const [leadFilter, setLeadFilter] = useState<LeadStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [customerModal, setCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER)

  const [vehicleModal, setVehicleModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE)

  const [followupModal, setFollowupModal] = useState(false)
  const [followupCustomerId, setFollowupCustomerId] = useState('')
  const [followupForm, setFollowupForm] = useState({
    title: 'Service reminder',
    follow_up_type: 'service_due',
    lead_status: 'active' as LeadStatus,
    scheduled_at: toInputDateTime(daysFromNow(1)),
    channel: 'whatsapp',
    notes: '',
  })
  const [retentionModal, setRetentionModal] = useState(false)
  const [retentionCustomerId, setRetentionCustomerId] = useState('')
  const [retentionVehicleId, setRetentionVehicleId] = useState('')
  const [retentionForm, setRetentionForm] = useState({
    reason: 'serviced_elsewhere',
    details: '',
    competitor_name: '',
    status: 'open',
    next_action_at: toInputDateTime(daysFromNow(2)),
  })
  const [intervalForm, setIntervalForm] = useState({
    name: 'Periodic service',
    rule_type: 'periodic',
    service_type: 'periodic' as ServiceType,
    interval_days: 90,
    interval_km: 3000,
    trigger_mode: 'whichever_first' as 'date' | 'km' | 'whichever_first',
    notes: '',
  })
  const [templateForm, setTemplateForm] = useState({
    template_key: 'n_7_reminder' as TemplateKey,
    name: 'N-7 Reminder',
    body: TEMPLATE_KEYS[0].defaultBody,
  })

  useEffect(() => {
    loadBootstrap()
  }, [user?.id, profile?.role])

  useEffect(() => {
    if (!center) return
    loadCrm(center.id)
  }, [center?.id])

  const loadBootstrap = async () => {
    if (!user) return
    if (!profile) {
      setError('Dealer profile was not found for this account.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')

    const [oemsList, templatesList] = await Promise.all([
      safeGet<OEM[]>('/api/vehicle-oems', []),
      safeGet<MessageTemplate[]>('/api/crm/templates?category=crm&isActive=true', []),
    ])

    const resolved = await resolveDealerServiceCenter(user)
    let dealerCenter = resolved.center as DealerCenter | null
    if (!dealerCenter && profile?.role === 'admin') {
      // TODO: Confirm backend endpoint for fetching a default active service center for admin.
      const data = await safeGet<DealerCenter | null>('/api/service-centers/active?limit=1', null)
      dealerCenter = data as DealerCenter | null
    }

    if (!dealerCenter && profile?.role !== 'admin') {
      setError(resolved.error || 'No dealer workshop is linked to this account yet.')
      setLoading(false)
      return
    }

    setCenter(dealerCenter)
    setOems(oemsList)
    setTemplates(templatesList)
    if (!dealerCenter) setLoading(false)
  }

  const loadCrm = async (centerId: string) => {
    setLoading(true)
    setError('')
    // TODO: Confirm backend endpoints for CRM dashboard data.
    const [
      bookingsData,
      jobsData,
      followupsData,
      linksData,
      retentionData,
      eventsData,
      rulesData,
      templatesData,
      memoryData,
      feedbackData,
    ] = await Promise.all([
      safeGet<Booking[]>(`/api/crm/bookings?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<Array<{ customer_id: string; vehicle_id: string | null }>>(`/api/crm/job-cards/keys?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<Followup[]>(`/api/crm/followups?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<any[]>(`/api/crm/booking-links?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<any[]>(`/api/crm/retention-feedback?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<any[]>(`/api/crm/interaction-events?serviceCenterId=${encodeURIComponent(centerId)}&limit=200`, []),
      safeGet<any[]>(`/api/crm/interval-rules?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<MessageTemplate[]>(`/api/crm/templates?serviceCenterId=${encodeURIComponent(centerId)}`, []),
      safeGet<any[]>(`/api/crm/chat-memory?serviceCenterId=${encodeURIComponent(centerId)}&limit=100`, []),
      safeGet<any[]>(`/api/crm/feedback-responses?serviceCenterId=${encodeURIComponent(centerId)}&limit=100`, []),
    ])

    const bookings = bookingsData
    const followups = followupsData
    const retentionRows = retentionData as RetentionFeedback[]
    const events = eventsData as TimelineEvent[]
    const memories = memoryData as ChatMemory[]
    const feedbackRows = feedbackData as FeedbackResponse[]
    const scopedCustomerIds = new Set<string>()
    const scopedVehicleIds = new Set<string>()

    bookings.forEach(row => {
      if (row.customer_id) scopedCustomerIds.add(row.customer_id)
      if (row.vehicle_id) scopedVehicleIds.add(row.vehicle_id)
    })
    jobsData.forEach(row => {
      if (row.customer_id) scopedCustomerIds.add(row.customer_id)
      if (row.vehicle_id) scopedVehicleIds.add(row.vehicle_id)
    })
    followups.forEach(row => row.customer_id && scopedCustomerIds.add(row.customer_id))
    retentionRows.forEach(row => row.customer_id && scopedCustomerIds.add(row.customer_id))
    events.forEach(row => row.customer_id && scopedCustomerIds.add(row.customer_id))
    memories.forEach(row => row.customer_id && scopedCustomerIds.add(row.customer_id))
    feedbackRows.forEach(row => row.customer_id && scopedCustomerIds.add(row.customer_id))

    const scopedIds = [...scopedCustomerIds]
    const scopedVehicleIdList = [...scopedVehicleIds]
    const customerQs = new URLSearchParams({ serviceCenterId: centerId })
    if (scopedIds.length) customerQs.set('scopedCustomerIds', scopedIds.join(','))
    const vehicleQs = new URLSearchParams({ serviceCenterId: centerId })
    if (scopedVehicleIdList.length) vehicleQs.set('scopedVehicleIds', scopedVehicleIdList.join(','))

    const [loadedCustomers, loadedVehicles, notificationRows] = await Promise.all([
      safeGet<Customer[]>(`/api/crm/customers?${customerQs.toString()}`, []),
      safeGet<Vehicle[]>(`/api/crm/vehicles?${vehicleQs.toString()}`, []),
      safeGet<NotificationRow[]>(`/api/crm/notifications?serviceCenterId=${encodeURIComponent(centerId)}&limit=150`, []),
    ])

    const ids = new Set(loadedCustomers.map(c => c.id))
    setCustomers(loadedCustomers)
    setVehicles(loadedVehicles.filter(v => ids.has(v.customer_id)))
    setBookings(bookings)
    setFollowups(followups)
    setBookingLinks(linksData as BookingLink[])
    setRetention(retentionRows)
    setEvents(events)
    setIntervalRules(rulesData as ServiceIntervalRule[])
    setTemplates(templatesData)
    setChatMemories(memories)
    setFeedbackResponses(feedbackRows)
    setNotifications(
      ids.size > 0
        ? notificationRows.filter(n => !n.user_id || ids.has(n.user_id))
        : [],
    )
    setSelectedId(current => current && ids.has(current) ? current : loadedCustomers[0]?.id || '')
    setLoading(false)
  }

  const selectedCustomer = customers.find(c => c.id === selectedId) || null
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const hay = `${c.full_name} ${c.phone} ${c.email || ''} ${c.city || ''}`.toLowerCase()
      const matchSearch = !search || hay.includes(search.toLowerCase())
      const matchLead = leadFilter === 'all' || c.lead_status === leadFilter
      return matchSearch && matchLead && c.lead_status !== 'archived'
    })
  }, [customers, search, leadFilter])

  const metrics = useMemo(() => {
    const today = startOfToday()
    const activeCustomers = customers.filter(c => c.is_active && c.lead_status !== 'archived').length
    const dueVehicleCustomerIds = new Set(
      vehicles
        .filter(v => v.is_active && v.next_service_date && new Date(v.next_service_date) <= addDays(today, 14))
        .map(v => v.customer_id),
    )
    const pendingFollowups = followups.filter(f => f.status === 'pending').length
    const overdueFollowups = followups.filter(f => f.status === 'pending' && new Date(f.scheduled_at) < new Date()).length
    const converted = customers.filter(c => c.lead_status === 'converted').length
    const leads = customers.filter(c => ['new', 'warm', 'cold', 'converted', 'lost'].includes(c.lead_status)).length
    const retained = customers.filter(c => c.lead_status === 'converted' || bookings.some(b => b.customer_id === c.id && b.status === 'completed')).length
    const retentionScore = activeCustomers ? Math.round((retained / activeCustomers) * 100) : 0
    const activeLinks = bookingLinks.filter(l => !l.used_at && new Date(l.expires_at) > new Date()).length
    return {
      activeCustomers,
      serviceDue: dueVehicleCustomerIds.size,
      pendingFollowups,
      overdueFollowups,
      conversionRate: leads ? Math.round((converted / leads) * 100) : 0,
      retentionScore,
      activeLinks,
    }
  }, [customers, vehicles, followups, bookings, bookingLinks])

  const reminderCandidates = useMemo(() => {
    return buildReminderCandidates(customers, vehicles, bookings, notifications, intervalRules)
  }, [customers, vehicles, bookings, notifications, intervalRules])

  const timeline = useMemo(() => {
    return buildTimeline(selectedId, events, notifications, followups, bookings, retention)
  }, [selectedId, events, notifications, followups, bookings, retention])

  const customerVehicles = selectedCustomer ? vehicles.filter(v => v.customer_id === selectedCustomer.id) : []
  const customerBookings = selectedCustomer ? bookings.filter(b => b.customer_id === selectedCustomer.id) : []
  const customerFollowups = selectedCustomer ? followups.filter(f => f.customer_id === selectedCustomer.id) : []

  const openCustomerCreate = () => {
    setEditingCustomer(null)
    setCustomerForm(EMPTY_CUSTOMER)
    setCustomerModal(true)
  }

  const openCustomerEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setCustomerForm({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      whatsapp_number: customer.whatsapp_number || '',
      email: customer.email || '',
      city: customer.city || '',
      pincode: customer.pincode || '',
      lead_status: customer.lead_status || 'active',
      customer_notes: customer.customer_notes || '',
    })
    setCustomerModal(true)
  }

  const saveCustomer = async (e: FormEvent) => {
    e.preventDefault()
    if (!center) return
    if (!customerForm.full_name.trim() || !customerForm.phone.trim()) {
      setError('Customer name and phone are required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      full_name: customerForm.full_name.trim(),
      phone: customerForm.phone.trim(),
      whatsapp_number: customerForm.whatsapp_number || null,
      email: customerForm.email || null,
      city: customerForm.city || null,
      pincode: customerForm.pincode || null,
      customer_notes: customerForm.customer_notes || '',
      lead_status: customerForm.lead_status,
      preferred_center_id: center.id,
      role: 'customer',
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    try {
      // TODO: Confirm backend endpoints for CRM customer create/update.
      if (editingCustomer) await api.patch(`/api/crm/customers/${editingCustomer.id}`, payload)
      else await api.post('/api/crm/customers', { id: crypto.randomUUID(), ...payload })
      setCustomerModal(false)
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const archiveCustomer = async (customer: Customer) => {
    if (!center) return
    const ok = window.confirm(`Archive ${customer.full_name}? Their history remains available but they leave active CRM lists.`)
    if (!ok) return
    try {
      // TODO: Confirm backend endpoint for archiving a customer.
      await api.patch(`/api/crm/customers/${customer.id}`, {
        lead_status: 'archived',
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const openVehicleCreate = (customerId: string) => {
    setEditingVehicle(null)
    setVehicleForm(EMPTY_VEHICLE)
    setFollowupCustomerId(customerId)
    setVehicleModal(true)
    setModels([])
  }

  const openVehicleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFollowupCustomerId(vehicle.customer_id)
    setVehicleForm({
      nickname: vehicle.nickname || '',
      registration_number: vehicle.registration_number || '',
      oem_id: vehicle.oem_id || '',
      model_id: vehicle.model_id || '',
      manufacturing_year: vehicle.manufacturing_year || new Date().getFullYear(),
      fuel_type: vehicle.fuel_type || 'petrol',
      odometer_km: vehicle.odometer_km || 0,
      next_service_date: vehicle.next_service_date || '',
      next_service_km: vehicle.next_service_km || 0,
      date_of_sale: vehicle.date_of_sale || '',
      last_service_date: vehicle.last_service_date || '',
      last_service_odometer_km: vehicle.last_service_odometer_km || 0,
      last_service_type: vehicle.last_service_type || 'periodic',
      service_interval_days: vehicle.service_interval_days || 90,
      service_interval_km: vehicle.service_interval_km || 3000,
      original_dealership: vehicle.original_dealership || '',
      last_serviced_dealership: vehicle.last_serviced_dealership || '',
      customer_status: vehicle.customer_status || 'active',
    })
    if (vehicle.oem_id) loadModels(vehicle.oem_id)
    setVehicleModal(true)
  }

  const loadModels = async (oemId: string) => {
    if (!oemId) {
      setModels([])
      return
    }
    // TODO: Confirm backend endpoint for vehicle models by OEM.
    const data = await safeGet<Model[]>(`/api/vehicle-models?oemId=${encodeURIComponent(oemId)}`, [])
    setModels((data || []) as Model[])
  }

  const saveVehicle = async (e: FormEvent) => {
    e.preventDefault()
    if (!center || !followupCustomerId) return
    if (!vehicleForm.registration_number.trim()) {
      setError('Vehicle registration number is required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      customer_id: followupCustomerId,
      nickname: vehicleForm.nickname,
      registration_number: vehicleForm.registration_number.trim().toUpperCase(),
      oem_id: vehicleForm.oem_id || null,
      model_id: vehicleForm.model_id || null,
      manufacturing_year: vehicleForm.manufacturing_year || null,
      fuel_type: vehicleForm.fuel_type,
      odometer_km: vehicleForm.odometer_km || 0,
      preferred_center_id: center.id,
      next_service_date: vehicleForm.next_service_date || null,
      next_service_km: vehicleForm.next_service_km || null,
      date_of_sale: vehicleForm.date_of_sale || null,
      last_service_date: vehicleForm.last_service_date || null,
      last_service_odometer_km: vehicleForm.last_service_odometer_km || 0,
      last_service_type: vehicleForm.last_service_type,
      service_interval_days: vehicleForm.service_interval_days || 90,
      service_interval_km: vehicleForm.service_interval_km || 3000,
      original_dealership: vehicleForm.original_dealership || '',
      last_serviced_dealership: vehicleForm.last_serviced_dealership || '',
      customer_status: vehicleForm.customer_status,
      updated_at: new Date().toISOString(),
      is_active: vehicleForm.customer_status !== 'vehicle_sold',
    }
    try {
      // TODO: Confirm backend endpoints for CRM vehicle create/update.
      if (editingVehicle) await api.patch(`/api/crm/vehicles/${editingVehicle.id}`, payload)
      else await api.post('/api/crm/vehicles', payload)
      setVehicleModal(false)
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const archiveVehicle = async (vehicle: Vehicle) => {
    if (!center) return
    try {
      // TODO: Confirm backend endpoint for archiving a vehicle.
      await api.patch(`/api/crm/vehicles/${vehicle.id}`, { is_active: false, updated_at: new Date().toISOString() })
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const openFollowupCreate = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    setFollowupCustomerId(customerId)
    setFollowupForm({
      title: customer ? `Follow up with ${customer.full_name}` : 'Follow-up',
      follow_up_type: 'service_due',
      lead_status: customer?.lead_status || 'active',
      scheduled_at: toInputDateTime(daysFromNow(1)),
      channel: 'whatsapp',
      notes: '',
    })
    setFollowupModal(true)
  }

  const saveFollowup = async (e: FormEvent) => {
    e.preventDefault()
    if (!center || !followupCustomerId || !user) return
    setSaving(true)
    try {
      // TODO: Confirm backend endpoint for creating CRM followup.
      await api.post('/api/crm/followups', {
        customer_id: followupCustomerId,
        service_center_id: center.id,
      title: followupForm.title,
      follow_up_type: followupForm.follow_up_type,
      lead_status: followupForm.lead_status,
      scheduled_at: new Date(followupForm.scheduled_at).toISOString(),
      channel: followupForm.channel,
      notes: followupForm.notes,
      created_by: user.id,
      })
      await api.patch(`/api/crm/customers/${followupCustomerId}`, { lead_status: followupForm.lead_status, updated_at: new Date().toISOString() }).catch(() => {})
      setFollowupModal(false)
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const completeFollowup = async (followup: Followup) => {
    if (!center) return
    try {
      await api.patch(`/api/crm/followups/${followup.id}`, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      await recordEvent(followup.customer_id, 'followup_completed', 'Follow-up completed', followup.title, followup.id, 'crm_followup')
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const recordEvent = async (
    customerId: string,
    eventType: string,
    title: string,
    body = '',
    entityId?: string,
    entityType = 'crm',
    vehicleId?: string | null,
  ) => {
    if (!center) return
    await api.post('/api/crm/interaction-events', {
      customer_id: customerId,
      vehicle_id: vehicleId || null,
      service_center_id: center.id,
      event_type: eventType,
      title,
      body,
      entity_type: entityType,
      entity_id: entityId || null,
      actor_id: user?.id || null,
    }).catch(() => {})
  }

  const createBookingLink = async (customer: Customer, vehicle?: Vehicle | null, stage = 'service_due') => {
    if (!center || !user) return ''
    const token = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
    const dueDate = vehicle?.next_service_date || null
    const dueKm = vehicle?.next_service_km || null
    let linkToken = token
    try {
      const created = await api.post<{ token?: string }>('/api/crm/booking-links', {
        token,
        customer_id: customer.id,
        vehicle_id: vehicle?.id || null,
        service_center_id: center.id,
        service_type: 'general_service',
        due_date: dueDate,
        due_km: dueKm,
        metadata: { stage, source: 'dealer_crm' },
        created_by: user.id,
      })
      linkToken = created?.token || token
    } catch (e) {
      setError((e as Error).message)
      return ''
    }
    const qs = new URLSearchParams({
      service: 'general_service',
      center: center.id,
      source: 'crm',
    })
    if (vehicle?.id) qs.set('vehicle', vehicle.id)
    if (dueDate) qs.set('due_date', dueDate)
    if (dueKm) qs.set('due_km', String(dueKm))
    return `${SERVICE_PUBLIC_BASE}/customer/book/${encodeURIComponent(linkToken)}?${qs.toString()}`
  }

  const sendWhatsappReminder = async (customer: Customer, templateBody?: string, vehicleOverride?: Vehicle | null, stage = 'service_due') => {
    if (!center) return
    const vehicle = vehicleOverride || vehicles.find(v => v.customer_id === customer.id && v.is_active)
    const phone = (customer.whatsapp_number || customer.phone || '').replace(/[^0-9]/g, '')
    if (!phone) {
      setError('No WhatsApp number found for this customer.')
      return
    }
    const bookingLink = await createBookingLink(customer, vehicle, stage)
    const template = templateBody || getTemplateBody(templates, templateKeyForStage(stage)) || 'Hi {{customer_name}}, your {{vehicle_model}} is due for service at {{dealer_name}}. Book directly here: {{booking_link}}'
    const body = interpolate(template, templateVars(customer, vehicle, center, bookingLink))
    await api.post('/api/crm/notifications', {
      user_id: customer.id,
      customer_id: customer.id,
      service_center_id: center.id,
      channel: 'whatsapp',
      recipient: phone,
      body,
      status: 'pending',
      entity_type: 'crm_service_due',
      entity_id: vehicle?.id || customer.id,
    }).catch(() => {})
    await api.patch(`/api/crm/customers/${customer.id}`, {
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(() => {})
    await recordEvent(customer.id, 'whatsapp_reminder', `WhatsApp ${labelize(stage)} sent`, body, vehicle?.id || customer.id, 'notification_queue', vehicle?.id)
    if (vehicle) {
      await api.post('/api/crm/chat-memory', {
        customer_id: customer.id,
        service_center_id: center.id,
        conversation_source: 'crm_reminder_engine',
        visibility: 'internal',
        tags: ['service_due', stage.toLowerCase().replace(/\W+/g, '_')],
        summary: `${labelize(stage)} reminder queued for ${vehicle.registration_number}`,
        raw_excerpt: body,
        sentiment: stage === 'Overdue' ? 'risk' : 'neutral',
        created_by: user?.id || null,
      }).catch(() => {})
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer')
    if (center) await loadCrm(center.id)
  }

  const saveIntervalRule = async (e: FormEvent) => {
    e.preventDefault()
    if (!center || !user) return
    setSaving(true)
    try {
      await api.post('/api/crm/interval-rules', {
        service_center_id: center.id,
        name: intervalForm.name,
        rule_type: intervalForm.rule_type,
        service_type: intervalForm.service_type,
        interval_days: intervalForm.interval_days,
        interval_km: intervalForm.interval_km,
        trigger_mode: intervalForm.trigger_mode,
        notes: intervalForm.notes,
        created_by: user.id,
      })
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const deactivateIntervalRule = async (rule: ServiceIntervalRule) => {
    if (!center) return
    try {
      await api.patch(`/api/crm/interval-rules/${rule.id}`, { is_active: false, updated_at: new Date().toISOString() })
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const saveTemplate = async (e: FormEvent) => {
    e.preventDefault()
    if (!center) return
    setSaving(true)
    const existing = templates.find(t => t.service_center_id === center.id && t.template_key === templateForm.template_key)
    const payload = {
      service_center_id: center.id,
      template_key: templateForm.template_key,
      name: templateForm.name,
      category: 'crm',
      channel: 'whatsapp',
      language: 'en',
      body: templateForm.body,
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    try {
      if (existing) await api.patch(`/api/crm/templates/${existing.id}`, payload)
      else await api.post('/api/crm/templates', payload)
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const exportCsv = (kind: string) => {
    const rows = exportRows(kind, customers, vehicles, bookings, retention, reminderCandidates)
    downloadCsv(`bikeai-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const openRetentionCreate = (customerId: string, vehicleId = '') => {
    setRetentionCustomerId(customerId)
    setRetentionVehicleId(vehicleId)
    setRetentionForm({
      reason: 'serviced_elsewhere',
      details: '',
      competitor_name: '',
      status: 'open',
      next_action_at: toInputDateTime(daysFromNow(2)),
    })
    setRetentionModal(true)
  }

  const saveRetention = async (e: FormEvent) => {
    e.preventDefault()
    if (!center || !user || !retentionCustomerId) return
    setSaving(true)
    try {
      await api.post('/api/crm/retention-feedback', {
        customer_id: retentionCustomerId,
        vehicle_id: retentionVehicleId || null,
        service_center_id: center.id,
        reason: retentionForm.reason,
        details: retentionForm.details,
        competitor_name: retentionForm.competitor_name,
        status: retentionForm.status,
        next_action_at: retentionForm.next_action_at ? new Date(retentionForm.next_action_at).toISOString() : null,
        created_by: user.id,
      })
      await recordEvent(retentionCustomerId, 'retention_feedback', `Retention reason: ${labelize(retentionForm.reason)}`, retentionForm.details, undefined, 'crm_retention_feedback', retentionVehicleId)
      await api.patch(`/api/crm/customers/${retentionCustomerId}`, {
        lead_status: retentionForm.status === 'lost' ? 'lost' : 'warm',
        updated_at: new Date().toISOString(),
      }).catch(() => {})
      setRetentionModal(false)
      await loadCrm(center.id)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  return (
    <div style={S.root}>
      <style>{`
        .crm-card:hover { box-shadow: 0 8px 24px rgba(15,32,68,0.08); transform: translateY(-1px); }
        .crm-row:hover { background: #f8fafc; }
        .crm-input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12); outline: none; }
        @media (max-width: 980px) {
          .crm-layout { grid-template-columns: 1fr !important; }
          .crm-detail { position: static !important; }
          .crm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 620px) {
          .crm-kpis { grid-template-columns: 1fr !important; }
          .crm-toolbar { flex-direction: column !important; align-items: stretch !important; }
          .crm-actions { width: 100%; justify-content: stretch !important; }
          .crm-actions > * { flex: 1; justify-content: center; }
        }
      `}</style>

      <header style={S.header}>
        <div>
          <h1 style={S.title}>CRM Dashboard</h1>
          <p style={S.sub}>{center ? `${center.name}, ${center.city}` : 'Customer engagement and follow-up workflows'}</p>
        </div>
        <div style={S.headerActions} className="crm-actions">
          <Link to="/dealer/crm/service-due-upload" style={{ ...S.outlineBtn, textDecoration: 'none' }}><Upload size={14} /> Service Due Upload</Link>
          <button style={S.outlineBtn} onClick={() => loadBootstrap()}><Activity size={14} /> Refresh</button>
          <button style={S.primaryBtn} onClick={openCustomerCreate}><Plus size={14} /> Add Customer</button>
        </div>
      </header>

      {error && <div style={S.error}>{error}</div>}

      <section style={S.kpiGrid} className="crm-kpis">
        <MetricCard label="Service Due" value={metrics.serviceDue} sub="Due within 14 days" icon={<Calendar size={18} />} color="#2563eb" />
        <MetricCard label="Pending Follow-ups" value={metrics.pendingFollowups} sub={`${metrics.overdueFollowups} overdue`} icon={<Clock size={18} />} color="#d97706" />
        <MetricCard label="Active Customers" value={metrics.activeCustomers} sub={`${vehicles.length} linked vehicles`} icon={<Users size={18} />} color="#059669" />
        <MetricCard label="Retention" value={`${metrics.retentionScore}%`} sub={`${metrics.activeLinks} active booking links`} icon={<CheckCircle size={18} />} color="#7c3aed" />
      </section>

      <DealerRevenueWidgets serviceCenterId={center?.id || null} compact />

      <nav style={S.tabs}>
        {(['customers', 'reminders', 'followups', 'retention', 'timeline', 'communication_center', 'service_due_master', 'interval_rules', 'templates', 'exports'] as TabId[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            ...S.tab,
            background: activeTab === tab ? '#059669' : 'white',
            color: activeTab === tab ? 'white' : '#6b7280',
            borderColor: activeTab === tab ? '#059669' : '#e5e7eb',
          }}>
            {labelize(tab)}
          </button>
        ))}
      </nav>

      {loading ? <Loader /> : (
        <>
          {activeTab === 'customers' && (
            <div style={S.layout} className="crm-layout">
              <section style={S.listCard}>
                <div style={S.toolbar} className="crm-toolbar">
                  <div style={S.searchBox}>
                    <Search size={14} color="#9aa3b8" />
                    <input className="crm-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, phone, city..." style={S.searchInput} />
                  </div>
                  <select className="crm-input" value={leadFilter} onChange={e => setLeadFilter(e.target.value as LeadStatus | 'all')} style={S.select}>
                    <option value="all">All leads</option>
                    {LEAD_OPTIONS.filter(s => s !== 'archived').map(s => <option key={s} value={s}>{labelize(s)}</option>)}
                  </select>
                </div>

                {filteredCustomers.length === 0 ? <EmptyState label="No active customers found" /> : (
                  <div style={S.customerList}>
                    {filteredCustomers.map(c => {
                      const due = vehicles.some(v => v.customer_id === c.id && v.next_service_date && new Date(v.next_service_date) <= addDays(startOfToday(), 14))
                      const pending = followups.filter(f => f.customer_id === c.id && f.status === 'pending').length
                      return (
                        <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                          ...S.customerRow,
                          borderColor: selectedId === c.id ? '#059669' : '#e5e7eb',
                          background: selectedId === c.id ? '#f0fdf4' : 'white',
                        }} className="crm-row">
                          <Avatar name={c.full_name} color={leadColor(c.lead_status)} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.rowTop}>
                              <span style={S.customerName}>{c.full_name}</span>
                              <LeadBadge status={c.lead_status} />
                            </div>
                            <div style={S.customerMeta}>{c.phone}{c.city ? ` | ${c.city}` : ''}</div>
                            <div style={S.miniTags}>
                              {due && <span style={{ ...S.miniTag, color: '#2563eb', background: '#eff6ff' }}>service due</span>}
                              {pending > 0 && <span style={{ ...S.miniTag, color: '#d97706', background: '#fffbeb' }}>{pending} follow-up</span>}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <CustomerProfile
                customer={selectedCustomer}
                vehicles={customerVehicles}
                bookings={customerBookings}
                followups={customerFollowups}
                onEdit={openCustomerEdit}
                onArchive={archiveCustomer}
                onAddVehicle={openVehicleCreate}
                onEditVehicle={openVehicleEdit}
                onArchiveVehicle={archiveVehicle}
                onFollowup={openFollowupCreate}
                onRetention={openRetentionCreate}
                onWhatsapp={sendWhatsappReminder}
              />
            </div>
          )}

          {activeTab === 'reminders' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>Smart Service Reminders</h2>
                  <p style={S.sectionSub}>N-7, N-3, N-1, due today, and overdue reminders based on date or odometer, whichever comes first.</p>
                </div>
              </div>
              <ReminderBoard
                reminders={reminderCandidates}
                onSend={(item) => sendWhatsappReminder(item.customer, undefined, item.vehicle, item.stage)}
              />
            </section>
          )}

          {activeTab === 'followups' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <h2 style={S.sectionTitle}>Follow-up Queue</h2>
                <button style={S.primaryBtn} onClick={() => selectedCustomer && openFollowupCreate(selectedCustomer.id)} disabled={!selectedCustomer}><Plus size={14} /> Schedule</button>
              </div>
              <FollowupTable followups={followups} customers={customers} onComplete={completeFollowup} onWhatsapp={sendWhatsappReminder} />
            </section>
          )}

          {activeTab === 'retention' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>Retention Reporting</h2>
                  <p style={S.sectionSub}>Track why customers do not return and queue win-back actions.</p>
                </div>
                <button style={S.primaryBtn} onClick={() => selectedCustomer && openRetentionCreate(selectedCustomer.id)} disabled={!selectedCustomer}><Plus size={14} /> Log Reason</button>
              </div>
              <RetentionPanel retention={retention} customers={customers} />
            </section>
          )}

          {activeTab === 'timeline' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>Communication Timeline</h2>
                  <p style={S.sectionSub}>{selectedCustomer ? selectedCustomer.full_name : 'Select a customer to inspect interactions'}</p>
                </div>
              </div>
              <TimelinePanel timeline={timeline} />
            </section>
          )}

          {activeTab === 'communication_center' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>Dealer Communication Center</h2>
                  <p style={S.sectionSub}>WhatsApp queue, failed notifications, chatbot conversations, unresolved complaints, and overdue follow-ups.</p>
                </div>
              </div>
              <CommunicationCenter
                notifications={notifications}
                memories={chatMemories}
                feedback={feedbackResponses}
                followups={followups}
                customers={customers}
              />
            </section>
          )}

          {activeTab === 'service_due_master' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>Service Due Master</h2>
                  <p style={S.sectionSub}>Customer, vehicle, sale, last service, interval, and dealership data used by reminders and chatbot memory.</p>
                </div>
              </div>
              <ServiceDueMasterTable customers={customers} vehicles={vehicles} onEditVehicle={openVehicleEdit} />
            </section>
          )}

          {activeTab === 'interval_rules' && (
            <div style={S.layoutWide}>
              <section style={S.listCard}>
                <div style={S.sectionHeader}>
                  <div>
                    <h2 style={S.sectionTitle}>Service Interval Rules</h2>
                    <p style={S.sectionSub}>Configure date/KM triggers. The reminder engine uses whichever comes first when selected.</p>
                  </div>
                </div>
                <form onSubmit={saveIntervalRule} style={S.form}>
                  <FormGrid>
                    <Field label="Rule name"><input className="crm-input" style={S.input} value={intervalForm.name} onChange={e => setIntervalForm({ ...intervalForm, name: e.target.value })} /></Field>
                    <Field label="Rule type"><select className="crm-input" style={S.input} value={intervalForm.rule_type} onChange={e => setIntervalForm({ ...intervalForm, rule_type: e.target.value })}>
                      {['first_service', 'second_service', 'third_service', 'periodic', 'free_service', 'paid_service'].map(t => <option key={t} value={t}>{labelize(t)}</option>)}
                    </select></Field>
                    <Field label="Service type"><select className="crm-input" style={S.input} value={intervalForm.service_type} onChange={e => setIntervalForm({ ...intervalForm, service_type: e.target.value as ServiceType })}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{labelize(t)}</option>)}</select></Field>
                    <Field label="Interval days"><input className="crm-input" style={S.input} type="number" value={intervalForm.interval_days} onChange={e => setIntervalForm({ ...intervalForm, interval_days: parseInt(e.target.value) || 0 })} /></Field>
                    <Field label="Interval KM"><input className="crm-input" style={S.input} type="number" value={intervalForm.interval_km} onChange={e => setIntervalForm({ ...intervalForm, interval_km: parseInt(e.target.value) || 0 })} /></Field>
                    <Field label="Trigger"><select className="crm-input" style={S.input} value={intervalForm.trigger_mode} onChange={e => setIntervalForm({ ...intervalForm, trigger_mode: e.target.value as 'date' | 'km' | 'whichever_first' })}>
                      <option value="whichever_first">Whichever comes first</option>
                      <option value="date">Date based</option>
                      <option value="km">KM based</option>
                    </select></Field>
                  </FormGrid>
                  <Field label="Notes"><textarea className="crm-input" style={S.textarea} value={intervalForm.notes} onChange={e => setIntervalForm({ ...intervalForm, notes: e.target.value })} /></Field>
                  <button style={S.primaryBtn} disabled={saving}><Save size={13} /> Save Rule</button>
                </form>
              </section>
              <section style={S.listCard}>
                <h2 style={S.sectionTitle}>Active Rules</h2>
                <IntervalRulesList rules={intervalRules} onDeactivate={deactivateIntervalRule} />
              </section>
            </div>
          )}

          {activeTab === 'templates' && (
            <div style={S.layoutWide}>
              <section style={S.listCard}>
                <div style={S.sectionHeader}>
                  <div>
                    <h2 style={S.sectionTitle}>WhatsApp Template Manager</h2>
                    <p style={S.sectionSub}>Queue-based templates only. Provider delivery remains abstract through notification_queue.</p>
                  </div>
                </div>
                <form onSubmit={saveTemplate} style={S.form}>
                  <FormGrid>
                    <Field label="Template key"><select className="crm-input" style={S.input} value={templateForm.template_key} onChange={e => {
                      const selected = TEMPLATE_KEYS.find(t => t.key === e.target.value)
                      setTemplateForm({ template_key: e.target.value as TemplateKey, name: selected?.label || '', body: selected?.defaultBody || '' })
                    }}>{TEMPLATE_KEYS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
                    <Field label="Template name"><input className="crm-input" style={S.input} value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} /></Field>
                  </FormGrid>
                  <Field label="Message body"><textarea className="crm-input" style={S.textarea} rows={6} value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} /></Field>
                  <p style={S.sectionSub}>Variables: {TEMPLATE_VARIABLES.map(v => `{{${v}}}`).join(', ')}</p>
                  <button style={S.primaryBtn} disabled={saving}><Save size={13} /> Save Template</button>
                </form>
              </section>
              <section style={S.templateGrid}>
                {TEMPLATE_KEYS.map(def => {
                  const t = templates.find(item => item.service_center_id === center?.id && item.template_key === def.key) || templates.find(item => item.template_key === def.key)
                  return (
                    <article key={def.key} style={S.templateCard} className="crm-card">
                      <div style={S.templateTop}>
                        <div>
                          <h3 style={S.templateTitle}>{def.label}</h3>
                          <p style={S.templateChannel}>{t ? `${t.channel} | ${t.language}` : 'Not configured'}</p>
                        </div>
                        <MessageSquare size={17} color="#059669" />
                      </div>
                      <p style={S.templateBody}>{t?.body || def.defaultBody}</p>
                      <div style={S.actionRow}>
                        <button style={S.outlineBtn} onClick={() => setTemplateForm({ template_key: def.key, name: t?.name || def.label, body: t?.body || def.defaultBody })}><Edit2 size={13} /> Edit</button>
                        <button style={S.outlineBtn} onClick={() => selectedCustomer && sendWhatsappReminder(selectedCustomer, t?.body || def.defaultBody)} disabled={!selectedCustomer}>
                          <MessageSquare size={13} /> Test Send
                        </button>
                      </div>
                    </article>
                  )
                })}
              </section>
            </div>
          )}

          {activeTab === 'exports' && (
            <section style={S.listCard}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionTitle}>CRM Exports</h2>
                  <p style={S.sectionSub}>CSV exports for dealer reporting. Google Sheets sync is reserved as a future integration placeholder.</p>
                </div>
              </div>
              <div style={S.exportGrid}>
                {[
                  ['service-due-list', 'Customer service due list'],
                  ['due-reminders', 'Due reminders'],
                  ['upcoming-bookings', 'Upcoming bookings'],
                  ['completed-bookings', 'Completed bookings'],
                  ['retention-followups', 'Retention follow-ups'],
                ].map(([kind, label]) => (
                  <button key={kind} style={S.exportCard} onClick={() => exportCsv(kind)}>
                    <Download size={18} color="#059669" />
                    <strong>{label}</strong>
                    <span>Download CSV</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {customerModal && (
        <Modal title={editingCustomer ? 'Edit Customer' : 'Create Customer'} onClose={() => setCustomerModal(false)}>
          <form onSubmit={saveCustomer} style={S.form}>
            <FormGrid>
              <Field label="Full name *"><input className="crm-input" style={S.input} value={customerForm.full_name} onChange={e => setCustomerForm({ ...customerForm, full_name: e.target.value })} /></Field>
              <Field label="Phone *"><input className="crm-input" style={S.input} value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} /></Field>
              <Field label="WhatsApp"><input className="crm-input" style={S.input} value={customerForm.whatsapp_number} onChange={e => setCustomerForm({ ...customerForm, whatsapp_number: e.target.value })} /></Field>
              <Field label="Email"><input className="crm-input" style={S.input} type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /></Field>
              <Field label="City"><input className="crm-input" style={S.input} value={customerForm.city} onChange={e => setCustomerForm({ ...customerForm, city: e.target.value })} /></Field>
              <Field label="Pincode"><input className="crm-input" style={S.input} value={customerForm.pincode} onChange={e => setCustomerForm({ ...customerForm, pincode: e.target.value })} /></Field>
              <Field label="Lead status"><select className="crm-input" style={S.input} value={customerForm.lead_status} onChange={e => setCustomerForm({ ...customerForm, lead_status: e.target.value as LeadStatus })}>{LEAD_OPTIONS.filter(s => s !== 'archived').map(s => <option key={s} value={s}>{labelize(s)}</option>)}</select></Field>
            </FormGrid>
            <Field label="Notes"><textarea className="crm-input" style={S.textarea} rows={4} value={customerForm.customer_notes} onChange={e => setCustomerForm({ ...customerForm, customer_notes: e.target.value })} /></Field>
            <ModalActions saving={saving} onCancel={() => setCustomerModal(false)} />
          </form>
        </Modal>
      )}

      {vehicleModal && (
        <Modal title={editingVehicle ? 'Edit Vehicle' : 'Attach Vehicle'} onClose={() => setVehicleModal(false)}>
          <form onSubmit={saveVehicle} style={S.form}>
            <FormGrid>
              <Field label="Registration *"><input className="crm-input" style={S.input} value={vehicleForm.registration_number} onChange={e => setVehicleForm({ ...vehicleForm, registration_number: e.target.value.toUpperCase() })} /></Field>
              <Field label="Nickname"><input className="crm-input" style={S.input} value={vehicleForm.nickname} onChange={e => setVehicleForm({ ...vehicleForm, nickname: e.target.value })} /></Field>
              <Field label="OEM"><select className="crm-input" style={S.input} value={vehicleForm.oem_id} onChange={e => { setVehicleForm({ ...vehicleForm, oem_id: e.target.value, model_id: '' }); loadModels(e.target.value) }}><option value="">Select OEM</option>{oems.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
              <Field label="Model"><select className="crm-input" style={S.input} value={vehicleForm.model_id} onChange={e => setVehicleForm({ ...vehicleForm, model_id: e.target.value })} disabled={!vehicleForm.oem_id}><option value="">Select model</option>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
              <Field label="Year"><input className="crm-input" style={S.input} type="number" value={vehicleForm.manufacturing_year} onChange={e => setVehicleForm({ ...vehicleForm, manufacturing_year: parseInt(e.target.value) || new Date().getFullYear() })} /></Field>
              <Field label="Fuel"><select className="crm-input" style={S.input} value={vehicleForm.fuel_type} onChange={e => setVehicleForm({ ...vehicleForm, fuel_type: e.target.value })}><option value="petrol">Petrol</option><option value="electric">Electric</option><option value="cng">CNG</option></select></Field>
              <Field label="Odometer km"><input className="crm-input" style={S.input} type="number" value={vehicleForm.odometer_km} onChange={e => setVehicleForm({ ...vehicleForm, odometer_km: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Date of sale"><input className="crm-input" style={S.input} type="date" value={vehicleForm.date_of_sale} onChange={e => setVehicleForm({ ...vehicleForm, date_of_sale: e.target.value })} /></Field>
              <Field label="Last service date"><input className="crm-input" style={S.input} type="date" value={vehicleForm.last_service_date} onChange={e => setVehicleForm({ ...vehicleForm, last_service_date: e.target.value })} /></Field>
              <Field label="Last service KM"><input className="crm-input" style={S.input} type="number" value={vehicleForm.last_service_odometer_km} onChange={e => setVehicleForm({ ...vehicleForm, last_service_odometer_km: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Last service type"><select className="crm-input" style={S.input} value={vehicleForm.last_service_type} onChange={e => setVehicleForm({ ...vehicleForm, last_service_type: e.target.value as ServiceType })}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{labelize(t)}</option>)}</select></Field>
              <Field label="Interval days"><input className="crm-input" style={S.input} type="number" value={vehicleForm.service_interval_days} onChange={e => setVehicleForm({ ...vehicleForm, service_interval_days: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Interval KM"><input className="crm-input" style={S.input} type="number" value={vehicleForm.service_interval_km} onChange={e => setVehicleForm({ ...vehicleForm, service_interval_km: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Next due date"><input className="crm-input" style={S.input} type="date" value={vehicleForm.next_service_date} onChange={e => setVehicleForm({ ...vehicleForm, next_service_date: e.target.value })} /></Field>
              <Field label="Next due km"><input className="crm-input" style={S.input} type="number" value={vehicleForm.next_service_km} onChange={e => setVehicleForm({ ...vehicleForm, next_service_km: parseInt(e.target.value) || 0 })} /></Field>
              <Field label="Original dealership"><input className="crm-input" style={S.input} value={vehicleForm.original_dealership} onChange={e => setVehicleForm({ ...vehicleForm, original_dealership: e.target.value })} /></Field>
              <Field label="Last serviced dealership"><input className="crm-input" style={S.input} value={vehicleForm.last_serviced_dealership} onChange={e => setVehicleForm({ ...vehicleForm, last_serviced_dealership: e.target.value })} /></Field>
              <Field label="Customer status"><select className="crm-input" style={S.input} value={vehicleForm.customer_status} onChange={e => setVehicleForm({ ...vehicleForm, customer_status: e.target.value as CustomerVehicleStatus })}>{VEHICLE_CUSTOMER_STATUSES.map(t => <option key={t} value={t}>{labelize(t)}</option>)}</select></Field>
            </FormGrid>
            <ModalActions saving={saving} onCancel={() => setVehicleModal(false)} />
          </form>
        </Modal>
      )}

      {followupModal && (
        <Modal title="Schedule Follow-up" onClose={() => setFollowupModal(false)}>
          <form onSubmit={saveFollowup} style={S.form}>
            <FormGrid>
              <Field label="Title"><input className="crm-input" style={S.input} value={followupForm.title} onChange={e => setFollowupForm({ ...followupForm, title: e.target.value })} /></Field>
              <Field label="Type"><select className="crm-input" style={S.input} value={followupForm.follow_up_type} onChange={e => setFollowupForm({ ...followupForm, follow_up_type: e.target.value })}>{FOLLOWUP_TYPES.map(t => <option key={t} value={t}>{labelize(t)}</option>)}</select></Field>
              <Field label="Lead status"><select className="crm-input" style={S.input} value={followupForm.lead_status} onChange={e => setFollowupForm({ ...followupForm, lead_status: e.target.value as LeadStatus })}>{LEAD_OPTIONS.filter(s => s !== 'archived').map(s => <option key={s} value={s}>{labelize(s)}</option>)}</select></Field>
              <Field label="Scheduled at"><input className="crm-input" style={S.input} type="datetime-local" value={followupForm.scheduled_at} onChange={e => setFollowupForm({ ...followupForm, scheduled_at: e.target.value })} /></Field>
              <Field label="Channel"><select className="crm-input" style={S.input} value={followupForm.channel} onChange={e => setFollowupForm({ ...followupForm, channel: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="call">Call</option><option value="sms">SMS</option><option value="email">Email</option></select></Field>
            </FormGrid>
            <Field label="Notes"><textarea className="crm-input" style={S.textarea} rows={4} value={followupForm.notes} onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })} /></Field>
            <ModalActions saving={saving} onCancel={() => setFollowupModal(false)} />
          </form>
        </Modal>
      )}

      {retentionModal && (
        <Modal title="Log Retention Reason" onClose={() => setRetentionModal(false)}>
          <form onSubmit={saveRetention} style={S.form}>
            <FormGrid>
              <Field label="Reason">
                <select className="crm-input" style={S.input} value={retentionForm.reason} onChange={e => setRetentionForm({ ...retentionForm, reason: e.target.value })}>
                  {RETENTION_REASONS.map(r => <option key={r} value={r}>{labelize(r)}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="crm-input" style={S.input} value={retentionForm.status} onChange={e => setRetentionForm({ ...retentionForm, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="winback_scheduled">Win-back Scheduled</option>
                  <option value="resolved">Resolved</option>
                  <option value="lost">Lost</option>
                </select>
              </Field>
              <Field label="Competitor / Other workshop">
                <input className="crm-input" style={S.input} value={retentionForm.competitor_name} onChange={e => setRetentionForm({ ...retentionForm, competitor_name: e.target.value })} />
              </Field>
              <Field label="Next action">
                <input className="crm-input" style={S.input} type="datetime-local" value={retentionForm.next_action_at} onChange={e => setRetentionForm({ ...retentionForm, next_action_at: e.target.value })} />
              </Field>
            </FormGrid>
            <Field label="Details">
              <textarea className="crm-input" style={S.textarea} rows={4} value={retentionForm.details} onChange={e => setRetentionForm({ ...retentionForm, details: e.target.value })} />
            </Field>
            <ModalActions saving={saving} onCancel={() => setRetentionModal(false)} />
          </form>
        </Modal>
      )}

      <AIChatWidget role="crm" />
    </div>
  )
}

function ReminderBoard({ reminders, onSend }: {
  reminders: ReminderCandidate[]
  onSend: (item: ReminderCandidate) => void
}) {
  if (reminders.length === 0) return <EmptyState label="No reminder candidates right now" />
  return (
    <div style={S.reminderGrid}>
      {REMINDER_STAGES.map(stage => {
        const items = reminders.filter(r => r.stage === stage)
        return (
          <section key={stage} style={S.reminderLane}>
            <div style={S.laneHeader}>
              <strong>{stage}</strong>
              <span>{items.length}</span>
            </div>
            {items.length === 0 ? <p style={S.emptyText}>Clear</p> : items.map(item => (
              <div key={`${item.customer.id}-${item.vehicle.id}-${item.stage}`} style={S.reminderCard}>
                <div style={S.rowTop}>
                  <strong>{item.customer.full_name}</strong>
                  <span style={{ ...S.badge, color: item.urgencyColor, background: `${item.urgencyColor}15` }}>{item.urgency}</span>
                </div>
                <p>{vehicleName(item.vehicle)}</p>
                <span>{item.reason}</span>
                <button style={S.smallBtn} onClick={() => onSend(item)}><MessageSquare size={11} /> Send</button>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function ServiceDueMasterTable({ customers, vehicles, onEditVehicle }: {
  customers: Customer[]
  vehicles: Vehicle[]
  onEditVehicle: (vehicle: Vehicle) => void
}) {
  if (vehicles.length === 0) return <EmptyState label="No vehicles available for service due master" />
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>{['Customer', 'Mobile', 'WhatsApp', 'Vehicle', 'Sale / Last Service', 'Interval', 'Next Due', 'Dealership', 'Status', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {vehicles.map(vehicle => {
            const customer = customers.find(c => c.id === vehicle.customer_id)
            return (
              <tr key={vehicle.id} style={S.tr}>
                <td style={S.td}><strong>{customer?.full_name || 'Customer'}</strong></td>
                <td style={S.td}>{customer?.phone || '-'}</td>
                <td style={S.td}>{customer?.whatsapp_number || customer?.phone || '-'}</td>
                <td style={S.td}><strong>{vehicle.registration_number}</strong><div style={S.muted}>{vehicle.vehicle_oems?.name || '-'} {vehicle.vehicle_models?.name || ''}</div></td>
                <td style={S.td}>
                  <div>Sale: {vehicle.date_of_sale ? dateLabel(vehicle.date_of_sale) : '-'}</div>
                  <div style={S.muted}>Last: {vehicle.last_service_date ? dateLabel(vehicle.last_service_date) : '-'} / {(vehicle.last_service_odometer_km || 0).toLocaleString()} km / {labelize(vehicle.last_service_type || 'periodic')}</div>
                </td>
                <td style={S.td}>{vehicle.service_interval_days || 90} days<div style={S.muted}>{(vehicle.service_interval_km || 3000).toLocaleString()} km</div></td>
                <td style={S.td}>{vehicle.next_service_date ? dateLabel(vehicle.next_service_date) : '-'}<div style={S.muted}>{vehicle.next_service_km ? `${vehicle.next_service_km.toLocaleString()} km` : '-'}</div></td>
                <td style={S.td}>{vehicle.original_dealership || '-'}<div style={S.muted}>Last: {vehicle.last_serviced_dealership || '-'}</div></td>
                <td style={S.td}><StatusBadge status={vehicle.customer_status || 'active'} /></td>
                <td style={S.td}><button style={S.smallBtn} onClick={() => onEditVehicle(vehicle)}><Edit2 size={11} /> Update</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IntervalRulesList({ rules, onDeactivate }: { rules: ServiceIntervalRule[]; onDeactivate: (rule: ServiceIntervalRule) => void }) {
  if (rules.length === 0) return <EmptyState label="No interval rules configured yet" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '12px' }}>
      {rules.map(rule => (
        <article key={rule.id} style={S.ruleCard}>
          <div>
            <strong>{rule.name}</strong>
            <div style={S.muted}>{labelize(rule.rule_type)} | {labelize(rule.service_type)} | {labelize(rule.trigger_mode)}</div>
            {rule.notes && <div style={S.muted}>{rule.notes}</div>}
          </div>
          <div style={S.ruleRight}>
            <span>{rule.interval_days || 0} days</span>
            <span>{(rule.interval_km || 0).toLocaleString()} km</span>
            <button style={S.dangerIconBtn} onClick={() => onDeactivate(rule)} title="Deactivate"><Archive size={13} /></button>
          </div>
        </article>
      ))}
    </div>
  )
}

function RetentionPanel({ retention, customers }: { retention: RetentionFeedback[]; customers: Customer[] }) {
  const byReason = RETENTION_REASONS.map(reason => ({
    reason,
    count: retention.filter(r => r.reason === reason).length,
  })).filter(r => r.count > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={S.retentionSummary}>
        {byReason.length === 0 ? <EmptyState label="No retention feedback logged yet" /> : byReason.map(r => (
          <div key={r.reason} style={S.retentionReason}>
            <span>{labelize(r.reason)}</span>
            <strong>{r.count}</strong>
          </div>
        ))}
      </div>
      {retention.map(r => {
        const customer = customers.find(c => c.id === r.customer_id)
        return (
          <div key={r.id} style={S.historyRow}>
            <div>
              <div style={S.historyTitle}>{customer?.full_name || r.profiles?.full_name || 'Customer'} | {labelize(r.reason)}</div>
              <div style={S.historyMeta}>{r.details || 'No details'}{r.competitor_name ? ` | ${r.competitor_name}` : ''}</div>
            </div>
            <StatusBadge status={r.status} />
          </div>
        )
      })}
    </div>
  )
}

function TimelinePanel({ timeline }: { timeline: TimelineItem[] }) {
  if (timeline.length === 0) return <EmptyState label="No interactions for this customer yet" />
  return (
    <div style={S.timeline}>
      {timeline.map(item => (
        <div key={`${item.source}-${item.id}`} style={S.timelineItem}>
          <div style={{ ...S.timelineDot, background: item.color }} />
          <div>
            <div style={S.noteTop}>
              <strong>{item.title}</strong>
              <span>{dateTimeLabel(item.created_at)}</span>
            </div>
            {item.body && <p>{item.body}</p>}
            <span style={{ ...S.badge, color: item.color, background: `${item.color}15` }}>{labelize(item.type)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommunicationCenter({ notifications, memories, feedback, followups, customers }: {
  notifications: NotificationRow[]
  memories: ChatMemory[]
  feedback: FeedbackResponse[]
  followups: Followup[]
  customers: Customer[]
}) {
  const failed = notifications.filter(n => n.status === 'failed')
  const pending = notifications.filter(n => n.status === 'pending')
  const complaints = memories.filter(m => (m.tags || []).some(tag => ['complaint', 'delay_frustration', 'repeat_issue', 'breakdown_risk', 'retention_risk', 'escalation_required', 'unhappy_customer', 'urgent_support'].includes(tag)))
  const overdue = followups.filter(f => f.status === 'pending' && new Date(f.scheduled_at) < new Date())
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={S.commGrid}>
        <MetricCard label="WhatsApp Pending" value={pending.length} sub="notification_queue" icon={<MessageSquare size={18} />} color="#059669" />
        <MetricCard label="Failed Notifications" value={failed.length} sub="needs retry" icon={<AlertIcon />} color="#dc2626" />
        <MetricCard label="Chatbot Risks" value={complaints.length} sub="tagged conversations" icon={<MessageSquare size={18} />} color="#d97706" />
        <MetricCard label="Overdue Follow-ups" value={overdue.length} sub="customer replies pending" icon={<Clock size={18} />} color="#7c3aed" />
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>{['Type', 'Customer', 'Detail', 'Status / Tags', 'Time'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ...notifications.slice(0, 30).map(n => ({ id: n.id, type: 'WhatsApp', customerId: n.user_id || '', detail: n.body, status: n.status, time: n.created_at })),
              ...complaints.slice(0, 30).map(m => ({ id: m.id, type: 'Chatbot', customerId: m.customer_id, detail: m.summary, status: (m.tags || []).join(', '), time: m.created_at })),
              ...feedback.filter(f => f.requires_escalation).slice(0, 30).map(f => ({ id: f.id, type: 'Feedback', customerId: f.customer_id || '', detail: f.comments || `Rating ${f.rating}`, status: (f.tags || []).join(', '), time: f.created_at })),
            ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 60).map(row => {
              const customer = customers.find(c => c.id === row.customerId)
              return (
                <tr key={`${row.type}-${row.id}`} style={S.tr}>
                  <td style={S.td}><strong>{row.type}</strong></td>
                  <td style={S.td}>{customer?.full_name || 'Customer'}</td>
                  <td style={S.td}>{row.detail}</td>
                  <td style={S.td}><StatusBadge status={row.status || 'pending'} /></td>
                  <td style={S.td}>{dateTimeLabel(row.time)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AlertIcon() {
  return <span style={{ fontWeight: 900 }}>!</span>
}

function CustomerProfile({
  customer,
  vehicles,
  bookings,
  followups,
  onEdit,
  onArchive,
  onAddVehicle,
  onEditVehicle,
  onArchiveVehicle,
  onFollowup,
  onRetention,
  onWhatsapp,
}: {
  customer: Customer | null
  vehicles: Vehicle[]
  bookings: Booking[]
  followups: Followup[]
  onEdit: (c: Customer) => void
  onArchive: (c: Customer) => void
  onAddVehicle: (id: string) => void
  onEditVehicle: (v: Vehicle) => void
  onArchiveVehicle: (v: Vehicle) => void
  onFollowup: (id: string) => void
  onRetention: (id: string, vehicleId?: string) => void
  onWhatsapp: (c: Customer) => void
}) {
  if (!customer) return <section style={S.detailCard} className="crm-detail"><EmptyState label="Select a customer to view profile" /></section>

  return (
    <aside style={S.detailCard} className="crm-detail">
      <div style={S.profileHeader}>
        <Avatar name={customer.full_name} color={leadColor(customer.lead_status)} large />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={S.profileName}>{customer.full_name}</h2>
          <p style={S.profileMeta}>{customer.phone}{customer.city ? ` | ${customer.city}` : ''}</p>
          <LeadBadge status={customer.lead_status} />
        </div>
      </div>

      <div style={S.actionRow}>
        <button style={S.primaryBtn} onClick={() => onWhatsapp(customer)}><MessageSquare size={13} /> WhatsApp</button>
        <button style={S.outlineBtn} onClick={() => onFollowup(customer.id)}><Clock size={13} /> Follow-up</button>
        <button style={S.outlineBtn} onClick={() => onRetention(customer.id)}><Archive size={13} /> Retention</button>
        <button style={S.iconBtn} onClick={() => onEdit(customer)} title="Edit"><Edit2 size={14} /></button>
        <button style={S.dangerIconBtn} onClick={() => onArchive(customer)} title="Archive"><Archive size={14} /></button>
      </div>

      <Section title="Vehicles" action={<button style={S.smallBtn} onClick={() => onAddVehicle(customer.id)}><Plus size={12} /> Add</button>}>
        {vehicles.length === 0 ? <p style={S.emptyText}>No vehicles attached.</p> : vehicles.map(v => (
          <div key={v.id} style={{ ...S.vehicleCard, opacity: v.is_active ? 1 : 0.55 }}>
            <div style={{ flex: 1 }}>
              <div style={S.vehicleTitle}>{vehicleName(v)}</div>
              <div style={S.vehicleMeta}>{v.registration_number} | {v.manufacturing_year || 'Year n/a'} | {v.odometer_km || 0} km</div>
              {v.next_service_date && <div style={S.dueLine}>Next due: {dateLabel(v.next_service_date)}{v.next_service_km ? ` / ${v.next_service_km.toLocaleString()} km` : ''}</div>}
            </div>
            <button style={S.iconBtn} onClick={() => onEditVehicle(v)}><Edit2 size={12} /></button>
            {v.is_active && <button style={S.dangerIconBtn} onClick={() => onArchiveVehicle(v)}><Trash2 size={12} /></button>}
          </div>
        ))}
      </Section>

      <Section title="Service History">
        {bookings.length === 0 ? <p style={S.emptyText}>No service history yet.</p> : bookings.slice(0, 6).map(b => (
          <div key={b.id} style={S.historyRow}>
            <div>
              <div style={S.historyTitle}>{labelize(b.service_category || b.service_type)}</div>
              <div style={S.historyMeta}>{dateLabel(b.scheduled_date)} | {b.service_centers?.name || 'Workshop'}</div>
            </div>
            <StatusBadge status={b.status} />
          </div>
        ))}
      </Section>

      <Section title="Follow-up Notes">
        {followups.length === 0 ? <p style={S.emptyText}>No follow-up notes yet.</p> : followups.slice(0, 6).map(f => (
          <div key={f.id} style={S.noteRow}>
            <div style={S.noteTop}>
              <strong>{f.title}</strong>
              <StatusBadge status={f.status} />
            </div>
            <p>{f.notes || labelize(f.follow_up_type)}</p>
            <span>{dateTimeLabel(f.scheduled_at)}</span>
          </div>
        ))}
      </Section>
    </aside>
  )
}

function FollowupTable({ followups, customers, onComplete, onWhatsapp }: {
  followups: Followup[]
  customers: Customer[]
  onComplete: (f: Followup) => void
  onWhatsapp: (c: Customer) => void
}) {
  if (followups.length === 0) return <EmptyState label="No follow-ups scheduled" />
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{['Customer', 'Task', 'Due', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {followups.map(f => {
            const customer = customers.find(c => c.id === f.customer_id)
            const overdue = f.status === 'pending' && new Date(f.scheduled_at) < new Date()
            return (
              <tr key={f.id} style={{ ...S.tr, background: overdue ? '#fff7ed' : 'white' }}>
                <td style={S.td}>{f.profiles?.full_name || customer?.full_name || 'Customer'}</td>
                <td style={S.td}><strong>{f.title}</strong><div style={S.muted}>{labelize(f.follow_up_type)} | {f.channel}</div></td>
                <td style={S.td}>{dateTimeLabel(f.scheduled_at)}{overdue && <div style={{ ...S.muted, color: '#dc2626' }}>Overdue</div>}</td>
                <td style={S.td}><StatusBadge status={f.status} /></td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {customer && <button style={S.smallBtn} onClick={() => onWhatsapp(customer)}><MessageSquare size={11} /> Remind</button>}
                    {f.status === 'pending' && <button style={S.smallBtn} onClick={() => onComplete(f)}><CheckCircle size={11} /> Done</button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MetricCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <article style={S.kpiCard} className="crm-card">
      <div style={{ ...S.kpiIcon, background: `${color}15`, color }}>{icon}</div>
      <div>
        <div style={{ ...S.kpiValue, color }}>{value}</div>
        <div style={S.kpiLabel}>{label}</div>
        <div style={S.kpiSub}>{sub}</div>
      </div>
    </article>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={S.modalBackdrop}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>{title}</h2>
          <button style={S.iconBtn} onClick={onClose}><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div style={S.modalActions}>
      <button type="button" style={S.outlineBtn} onClick={onCancel}>Cancel</button>
      <button type="submit" style={{ ...S.primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}><Save size={13} /> {saving ? 'Saving...' : 'Save'}</button>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={S.profileSection}>
      <div style={S.profileSectionHeader}><h3>{title}</h3>{action}</div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={S.field}><span>{label}</span>{children}</label>
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div style={S.formGrid}>{children}</div>
}

function Avatar({ name, color, large = false }: { name: string; color: string; large?: boolean }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  return <div style={{ ...S.avatar, width: large ? 52 : 38, height: large ? 52 : 38, background: `${color}18`, color }}>{initials}</div>
}

function LeadBadge({ status }: { status: string }) {
  const color = leadColor(status)
  return <span style={{ ...S.badge, background: `${color}15`, color }}>{labelize(status)}</span>
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'completed' || status === 'contacted' ? '#059669' : status === 'pending' ? '#d97706' : status === 'cancelled' ? '#dc2626' : '#2563eb'
  return <span style={{ ...S.badge, background: `${color}15`, color }}>{labelize(status)}</span>
}

function EmptyState({ label }: { label: string }) {
  return <div style={S.empty}><User size={30} color="#d1d5db" /><p>{label}</p></div>
}

function Loader() {
  return <div style={S.empty}><div style={S.loader} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
}

function buildReminderCandidates(customers: Customer[], vehicles: Vehicle[], bookings: Booking[], notifications: NotificationRow[], rules: ServiceIntervalRule[]): ReminderCandidate[] {
  const activeBookings = new Set(bookings.filter(b => ['pending', 'confirmed', 'in_progress'].includes(b.status)).map(b => b.vehicle_id))
  return vehicles
    .filter(v => v.is_active && (v.customer_status || 'active') === 'active' && !activeBookings.has(v.id))
    .map(vehicle => {
      const customer = customers.find(c => c.id === vehicle.customer_id)
      if (!customer || customer.lead_status === 'archived') return null
      const due = calculateVehicleDue(vehicle, rules)
      const dateStage = stageFromDueDate(due.nextDate)
      const kmGap = due.nextKm && vehicle.odometer_km ? due.nextKm - vehicle.odometer_km : null
      const kmStage = stageFromKmGap(kmGap)
      const stage = pickUrgentStage(dateStage, kmStage)
      if (!stage) return null
      const recentlySent = notifications.some(n =>
        n.user_id === customer.id &&
        (n.entity_type === 'crm_customer' || n.entity_type === 'crm_service_due') &&
        daysBetween(new Date(n.created_at), new Date()) < 1,
      )
      const reasonParts = [
        due.nextDate ? `date ${dateLabel(due.nextDate)}` : '',
        kmGap != null ? `${kmGap <= 0 ? 'overdue by' : 'due in'} ${Math.abs(kmGap).toLocaleString()} km` : '',
        recentlySent ? 'sent today' : '',
      ].filter(Boolean)
      return {
        customer,
        vehicle,
        stage,
        reason: reasonParts.join(' | ') || 'service interval matched',
        urgency: stage === 'Overdue' ? 'High risk' : stage === 'Due Today' ? 'Due today' : 'Upcoming',
        urgencyColor: stage === 'Overdue' ? '#dc2626' : stage === 'Due Today' ? '#d97706' : '#2563eb',
        dueDate: due.nextDate,
        dueKm: due.nextKm,
        lastServiceType: vehicle.last_service_type || due.rule?.service_type || 'periodic',
      }
    })
    .filter(Boolean) as ReminderCandidate[]
}

function buildTimeline(
  customerId: string,
  events: TimelineEvent[],
  notifications: NotificationRow[],
  followups: Followup[],
  bookings: Booking[],
  retention: RetentionFeedback[],
): TimelineItem[] {
  if (!customerId) return []
  const items: TimelineItem[] = [
    ...events.filter(e => e.customer_id === customerId).map(e => ({
      id: e.id,
      source: 'event',
      type: e.event_type,
      title: e.title,
      body: e.body || '',
      created_at: e.created_at,
      color: eventColor(e.event_type),
    })),
    ...notifications.filter(n => n.user_id === customerId).map(n => ({
      id: n.id,
      source: 'notification',
      type: n.status === 'pending' ? 'reminder_sent' : n.status,
      title: `${labelize(n.channel)} reminder ${n.status}`,
      body: n.body,
      created_at: n.created_at,
      color: '#059669',
    })),
    ...followups.filter(f => f.customer_id === customerId).map(f => ({
      id: f.id,
      source: 'followup',
      type: f.status,
      title: f.title,
      body: f.notes || labelize(f.follow_up_type),
      created_at: f.completed_at || f.scheduled_at,
      color: f.status === 'completed' ? '#059669' : '#d97706',
    })),
    ...bookings.filter(b => b.customer_id === customerId).map(b => ({
      id: b.id,
      source: 'booking',
      type: b.status,
      title: `Booking ${labelize(b.status)}`,
      body: `${labelize(b.service_category || b.service_type)} on ${dateLabel(b.scheduled_date)}`,
      created_at: b.scheduled_date,
      color: '#2563eb',
    })),
    ...retention.filter(r => r.customer_id === customerId).map(r => ({
      id: r.id,
      source: 'retention',
      type: r.reason,
      title: `Retention feedback: ${labelize(r.reason)}`,
      body: r.details || '',
      created_at: r.created_at,
      color: '#dc2626',
    })),
  ]
  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 80)
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function leadColor(status: string) {
  return ({
    new: '#2563eb',
    active: '#059669',
    warm: '#d97706',
    cold: '#64748b',
    converted: '#7c3aed',
    lost: '#dc2626',
    archived: '#6b7280',
  } as Record<string, string>)[status] || '#6b7280'
}

function vehicleName(v: Vehicle) {
  return [v.nickname, v.vehicle_oems?.name, v.vehicle_models?.name].filter(Boolean).join(' ') || 'Vehicle'
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDate(b).getTime() - startOfDate(a).getTime()) / (24 * 60 * 60 * 1000))
}

function startOfDate(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function calculateVehicleDue(vehicle: Vehicle, rules: ServiceIntervalRule[]) {
  const rule = pickIntervalRule(vehicle, rules)
  const intervalDays = vehicle.service_interval_days || rule?.interval_days || 90
  const intervalKm = vehicle.service_interval_km || rule?.interval_km || 3000
  const baseDate = vehicle.last_service_date || vehicle.date_of_sale || null
  const nextDate = vehicle.next_service_date || (baseDate ? isoDate(addDays(new Date(baseDate), intervalDays)) : null)
  const baseKm = vehicle.last_service_odometer_km || 0
  const nextKm = vehicle.next_service_km || (baseKm + intervalKm)
  return { nextDate, nextKm, rule }
}

function pickIntervalRule(vehicle: Vehicle, rules: ServiceIntervalRule[]) {
  const serviceType = vehicle.last_service_type || 'periodic'
  return rules.find(rule => rule.service_type === serviceType && rule.is_active) ||
    rules.find(rule => rule.rule_type === 'periodic' && rule.is_active) ||
    null
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function stageFromDueDate(date: string | null): ReminderCandidate['stage'] | null {
  if (!date) return null
  const gap = daysBetween(startOfToday(), new Date(date))
  if (gap < 0) return 'Overdue'
  if (gap === 0) return 'Due Today'
  if (gap <= 1) return 'N-1'
  if (gap <= 3) return 'N-3'
  if (gap <= 7) return 'N-7'
  return null
}

function stageFromKmGap(kmGap: number | null): ReminderCandidate['stage'] | null {
  if (kmGap == null) return null
  if (kmGap <= 0) return 'Overdue'
  if (kmGap <= 50) return 'Due Today'
  if (kmGap <= 150) return 'N-1'
  if (kmGap <= 300) return 'N-3'
  if (kmGap <= 700) return 'N-7'
  return null
}

function pickUrgentStage(a: ReminderCandidate['stage'] | null, b: ReminderCandidate['stage'] | null) {
  const priority = ['Overdue', 'Due Today', 'N-1', 'N-3', 'N-7']
  return priority.find(stage => a === stage || b === stage) as ReminderCandidate['stage'] | undefined
}

function eventColor(type: string) {
  if (type.includes('retention')) return '#dc2626'
  if (type.includes('whatsapp') || type.includes('reminder')) return '#059669'
  if (type.includes('followup')) return '#d97706'
  return '#2563eb'
}

function daysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(10, 0, 0, 0)
  return d
}

function toInputDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dateLabel(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dateTimeLabel(date: string) {
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

function templateKeyForStage(stage: string): TemplateKey {
  return ({
    'N-7': 'n_7_reminder',
    'N-3': 'n_3_reminder',
    'N-1': 'n_1_reminder',
    'Due Today': 'due_today',
    Overdue: 'overdue_followup',
  } as Record<string, TemplateKey>)[stage] || 'n_7_reminder'
}

function getTemplateBody(templates: MessageTemplate[], key: TemplateKey) {
  return templates.find(t => t.template_key === key)?.body || TEMPLATE_KEYS.find(t => t.key === key)?.defaultBody || ''
}

function templateVars(customer: Customer, vehicle: Vehicle | null | undefined, center: DealerCenter, bookingLink: string) {
  const vehicleModel = vehicle ? `${vehicle.vehicle_oems?.name || ''} ${vehicle.vehicle_models?.name || ''}`.trim() || vehicle.registration_number : 'your vehicle'
  return {
    customer_name: customer.full_name,
    vehicle_number: vehicle?.registration_number || '',
    vehicle_model: vehicleModel,
    dealer_name: center.name,
    service_due_date: vehicle?.next_service_date ? dateLabel(vehicle.next_service_date) : '',
    service_due_km: vehicle?.next_service_km ? String(vehicle.next_service_km) : '',
    last_service_date: vehicle?.last_service_date ? dateLabel(vehicle.last_service_date) : '',
    last_service_type: labelize(vehicle?.last_service_type || 'periodic'),
    booking_link: bookingLink,
    approval_link: `${SERVICE_PUBLIC_BASE}/approval/{{approval_token}}`,
    tracking_link: `${SERVICE_PUBLIC_BASE}/track/{{tracking_token}}`,
    invoice_link: `${SERVICE_PUBLIC_BASE}/invoice/{{invoice_token}}`,
  }
}

function exportRows(
  kind: string,
  customers: Customer[],
  vehicles: Vehicle[],
  bookings: Booking[],
  retention: RetentionFeedback[],
  reminders: ReminderCandidate[],
) {
  if (kind === 'service-due-list') {
    return vehicles.map(v => {
      const c = customers.find(customer => customer.id === v.customer_id)
      return {
        customer_name: c?.full_name || '',
        mobile_number: c?.phone || '',
        whatsapp_number: c?.whatsapp_number || c?.phone || '',
        vehicle_number: v.registration_number,
        vehicle_brand: v.vehicle_oems?.name || '',
        vehicle_model: v.vehicle_models?.name || '',
        date_of_sale: v.date_of_sale || '',
        last_service_date: v.last_service_date || '',
        last_service_odometer_km: v.last_service_odometer_km || '',
        last_service_type: v.last_service_type || '',
        service_interval_days: v.service_interval_days || '',
        service_interval_km: v.service_interval_km || '',
        next_service_due_date: v.next_service_date || '',
        next_service_due_km: v.next_service_km || '',
        original_dealership: v.original_dealership || '',
        last_serviced_dealership: v.last_serviced_dealership || '',
        customer_status: v.customer_status || 'active',
        internal_notes: c?.customer_notes || '',
      }
    })
  }
  if (kind === 'due-reminders') {
    return reminders.map(r => ({
      customer_name: r.customer.full_name,
      mobile_number: r.customer.phone,
      whatsapp_number: r.customer.whatsapp_number || r.customer.phone,
      vehicle_number: r.vehicle.registration_number,
      vehicle_model: vehicleName(r.vehicle),
      reminder_stage: r.stage,
      due_date: r.dueDate || '',
      due_km: r.dueKm || '',
      reason: r.reason,
    }))
  }
  if (kind === 'upcoming-bookings' || kind === 'completed-bookings') {
    const completed = kind === 'completed-bookings'
    return bookings
      .filter(b => completed ? b.status === 'completed' : b.status !== 'completed')
      .map(b => {
        const c = customers.find(customer => customer.id === b.customer_id)
        return {
          customer_name: c?.full_name || '',
          mobile_number: c?.phone || '',
          service_type: b.service_category || b.service_type,
          scheduled_date: b.scheduled_date,
          scheduled_time: b.scheduled_time || '',
          status: b.status,
          estimated_cost: b.estimated_cost || '',
          final_cost: b.final_cost || '',
        }
      })
  }
  return retention.map(r => {
    const c = customers.find(customer => customer.id === r.customer_id)
    return {
      customer_name: c?.full_name || r.profiles?.full_name || '',
      mobile_number: c?.phone || r.profiles?.phone || '',
      reason: r.reason,
      details: r.details || '',
      competitor_name: r.competitor_name || '',
      status: r.status,
      next_action_at: r.next_action_at || '',
      created_at: r.created_at,
    }
  })
}

function downloadCsv(filename: string, rows: Record<string, string | number | null>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number | null) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1180px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: '900', color: '#0f2044', margin: 0, letterSpacing: '-0.2px' },
  sub: { fontSize: '13px', color: '#6b7280', marginTop: '3px' },
  headerActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: '#059669', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  outlineBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  smallBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '7px', color: '#059669', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#6b7280', cursor: 'pointer' },
  dangerIconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', cursor: 'pointer' },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '13px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' },
  kpiCard: { display: 'flex', alignItems: 'center', gap: '13px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', transition: 'all 0.14s' },
  kpiIcon: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiValue: { fontSize: '24px', fontWeight: '900', lineHeight: 1 },
  kpiLabel: { fontSize: '12.5px', color: '#0f2044', fontWeight: '700', marginTop: '4px' },
  kpiSub: { fontSize: '11px', color: '#9ca3af', marginTop: '2px' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tab: { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: '16px', alignItems: 'start' },
  layoutWide: { display: 'grid', gridTemplateColumns: 'minmax(320px, 0.85fr) minmax(360px, 1.15fr)', gap: '16px', alignItems: 'start' },
  listCard: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' },
  toolbar: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' },
  searchBox: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 11px', border: '1px solid #e5e7eb', borderRadius: '9px', minHeight: '38px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: '13px', fontFamily: 'inherit', color: '#0f2044', minWidth: 0 },
  select: { padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', color: '#0f2044', fontFamily: 'inherit', background: 'white' },
  customerList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  customerRow: { display: 'flex', gap: '11px', width: '100%', padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: '11px', background: 'white', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  avatar: { borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '900', flexShrink: 0 },
  rowTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  customerName: { fontSize: '14px', fontWeight: '800', color: '#0f2044', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  customerMeta: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
  miniTags: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '7px' },
  miniTag: { fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '999px' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' },
  detailCard: { position: 'sticky', top: '14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  profileHeader: { display: 'flex', gap: '12px', alignItems: 'center' },
  profileName: { fontSize: '18px', fontWeight: '900', color: '#0f2044', margin: '0 0 3px' },
  profileMeta: { fontSize: '12px', color: '#6b7280', margin: '0 0 6px' },
  actionRow: { display: 'flex', gap: '7px', flexWrap: 'wrap' },
  profileSection: { borderTop: '1px solid #f1f5f9', paddingTop: '13px' },
  profileSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' },
  vehicleCard: { display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '7px' },
  vehicleTitle: { fontSize: '13px', fontWeight: '800', color: '#0f2044' },
  vehicleMeta: { fontSize: '11.5px', color: '#6b7280', marginTop: '2px' },
  dueLine: { fontSize: '11.5px', color: '#2563eb', fontWeight: '700', marginTop: '5px' },
  historyRow: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderBottom: '1px solid #f1f5f9' },
  historyTitle: { fontSize: '13px', fontWeight: '700', color: '#0f2044' },
  historyMeta: { fontSize: '11.5px', color: '#6b7280', marginTop: '2px' },
  noteRow: { padding: '9px 0', borderBottom: '1px solid #f1f5f9' },
  noteTop: { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#0f2044' },
  emptyText: { margin: 0, fontSize: '13px', color: '#9ca3af' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '16px', fontWeight: '900', color: '#0f2044', margin: 0 },
  sectionSub: { fontSize: '12.5px', color: '#6b7280', margin: '3px 0 0' },
  reminderGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' },
  reminderLane: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px', minHeight: '150px' },
  laneHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#0f2044', marginBottom: '8px' },
  reminderCard: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', fontSize: '12px', color: '#4b5563' },
  retentionSummary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' },
  commGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  retentionReason: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '12.5px', color: '#374151' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '0' },
  timelineItem: { display: 'grid', gridTemplateColumns: '14px 1fr', gap: '10px', padding: '12px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12.5px', color: '#4b5563' },
  timelineDot: { width: '10px', height: '10px', borderRadius: '50%', marginTop: '4px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '11px 12px', fontSize: '13px', color: '#374151', verticalAlign: 'middle' },
  muted: { fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  templateCard: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px', transition: 'all 0.14s' },
  templateTop: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
  templateTitle: { fontSize: '14px', fontWeight: '900', color: '#0f2044', margin: 0 },
  templateChannel: { fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' },
  templateBody: { fontSize: '12.5px', color: '#4b5563', lineHeight: 1.55, minHeight: '70px' },
  ruleCard: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#f8fafc', fontSize: '13px', color: '#0f2044' },
  ruleRight: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap', justifyContent: 'flex-end' },
  exportGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  exportCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '7px', minHeight: '120px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f8fafc', color: '#0f2044', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', zIndex: 1000 },
  modal: { width: 'min(720px, 100%)', maxHeight: '88vh', overflow: 'auto', background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 24px 80px rgba(15,23,42,0.28)', padding: '18px' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  modalTitle: { fontSize: '18px', fontWeight: '900', color: '#0f2044', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: '700', color: '#6b7280' },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: '#0f2044', boxSizing: 'border-box', background: 'white' },
  textarea: { width: '100%', padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: '#0f2044', resize: 'vertical', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' },
  empty: { padding: '46px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '13px', textAlign: 'center' },
  loader: { width: '28px', height: '28px', borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#059669', animation: 'spin 0.8s linear infinite' },
}

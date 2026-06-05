import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCustomerAuth } from '../hooks/useCustomerAuth'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck as CheckCircle,
  Bike,
  Wrench,
  MapPin,
  Calendar,
  Truck,
  Check,
  Star,
} from 'lucide-react'
import { api, dealerSearch, getBrowserLocation, DealerResult, safeGet } from '../lib/api'

interface Vehicle {
  id: string
  nickname: string
  registration_number: string
  registrationNo?: string | null
  registration_no?: string | null
  vehicle_oems?: { name: string; slug?: string }
  vehicle_models?: { name: string; slug?: string }
  oem?: { name?: string; slug?: string } | null
  model?: { name?: string; slug?: string } | null
  brand?: string | null
  brand_name?: string | null
  model_name?: string | null
}

interface ExistingBooking {
  id: string
  vehicleId?: string | null
  vehicle_id?: string | null
  serviceType?: string | null
  service_type?: string | null
  dealerId?: string | null
  dealer_id?: string | null
  service_center_id?: string | null
  scheduledAt?: string | null
  scheduled_at?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  status?: string | null
}

type ServiceCenter = Pick<
  DealerResult,
  | 'id'
  | 'name'
  | 'address'
  | 'city'
  | 'rating'
  | 'phone'
  | 'lat'
  | 'lng'
  | 'is_pickup_available'
  | 'brands'
  | 'distance_km'
  | 'workshop_type'
  | 'next_available_slot'
  | 'total_reviews'
>

const SERVICE_TYPES = [
  { id: 'free_service', label: 'Free Service', desc: 'Manufacturer-covered free service', price: '₹0', color: '#16a34a' },
  { id: 'general_service', label: 'General Service', desc: 'Oil, filter, basic check-up', price: '₹399+', color: '#2563eb' },
  { id: 'paid_service', label: 'Paid Service', desc: 'Specific repair or replacement', price: 'Custom', color: '#0891b2' },
  { id: 'breakdown', label: 'Breakdown Assistance', desc: 'Immediate on-road support / RSA', price: '₹299+', color: '#ea580c' },
  { id: 'accident_repair', label: 'Accident / Insurance', desc: 'Bodywork, panels, insurance claim', price: 'Custom', color: '#dc2626' },
  { id: 'minor_repairs', label: 'Minor Repairs', desc: 'Battery, brakes, tyres, bulbs', price: '₹199+', color: '#ca8a04' },
  { id: 'complaint', label: 'Customer Complaint', desc: 'Performance issue diagnosis', price: '₹399+', color: '#7c3aed' },
  { id: 'specific_complaint', label: 'Specific Issue', desc: 'Know exactly what needs fixing', price: 'Custom', color: '#0d9488' },
]

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const STEPS = ['Vehicle', 'Service', 'Workshop', 'Schedule', 'Pickup', 'Confirm']

const OEM_SLUG_ALIASES: Record<string, string> = {
  royalenfield: 'royal-enfield',
  olaelectric: 'ola-electric',
  pureev: 'pure-ev',
}

function normalizeOemSlug(value: string) {
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (OEM_SLUG_ALIASES[compact]) return OEM_SLUG_ALIASES[compact]
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

function getAllowedBookingDates() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = addDays(today, 2)

  return Array.from({ length: 8 }, (_, i) => addDays(start, i))
    .filter(date => date.getDay() !== 0)
    .map(date => ({
      value: toDateInputValue(date),
      label: date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      fullLabel: date.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }))
}

function isCancelledStatus(status?: string | null) {
  return String(status || '').toLowerCase() === 'cancelled'
}

function getBookingDateValue(booking: ExistingBooking) {
  const raw = booking.scheduled_date || booking.scheduledAt || booking.scheduled_at || ''
  return String(raw).slice(0, 10)
}

function toLocalDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function getDateDiffInDays(a: string, b: string) {
  const dateA = toLocalDateOnly(a)
  const dateB = toLocalDateOnly(b)

  if (!dateA || !dateB) return Number.POSITIVE_INFINITY

  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((dateA.getTime() - dateB.getTime()) / oneDay)
}

function getVehicleRegistration(vehicle?: Vehicle) {
  if (!vehicle) return ''
  return vehicle.registration_number || vehicle.registrationNo || vehicle.registration_no || ''
}

function getVehicleBrand(vehicle?: Vehicle) {
  if (!vehicle) return ''
  return vehicle.vehicle_oems?.name || vehicle.oem?.name || vehicle.brand || vehicle.brand_name || ''
}

function getVehicleModel(vehicle?: Vehicle) {
  if (!vehicle) return ''
  return vehicle.vehicle_models?.name || vehicle.model?.name || vehicle.model_name || ''
}

function getVehicleName(vehicle?: Vehicle) {
  if (!vehicle) return 'Vehicle'
  return vehicle.nickname || getVehicleBrand(vehicle) || getVehicleModel(vehicle) || 'Vehicle'
}

export default function BookingWizardPage() {
  const { user } = useCustomerAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { token: routeToken = '' } = useParams<{ token: string }>()

  const crmToken = routeToken || params.get('token') || ''
  const urlLat = Number(params.get('lat'))
  const urlLng = Number(params.get('lng'))
  const hasUrlCoords = Number.isFinite(urlLat) && Number.isFinite(urlLng)
  const urlOemSlug = normalizeOemSlug(params.get('oem') || params.get('oem_slug') || '')
  const urlModel = params.get('model') || ''
  const urlLocation = params.get('location') || ''
  const urlCity = params.get('city') || ''
  const urlState = params.get('state') || ''
  const openWorkshopResults = params.get('flow') === 'service-centers' || params.get('step') === 'workshop'

  const allowedDates = getAllowedBookingDates()

  const [step, setStep] = useState(openWorkshopResults ? 2 : 0)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [centers, setCenters] = useState<ServiceCenter[]>([])
  const [loadingCenters, setLoadingCenters] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([])
  const [workshopBookings, setWorkshopBookings] = useState<ExistingBooking[]>([])
  const [bookingError, setBookingError] = useState('')

  const [selectedVehicle, setSelectedVehicle] = useState(params.get('vehicle') || '')
  const [selectedService, setSelectedService] = useState(params.get('service') || params.get('type') || '')
  const [selectedCenter, setSelectedCenter] = useState(params.get('center') || '')
  const [selectedDate, setSelectedDate] = useState(allowedDates[0]?.value || '')
  const [selectedTime, setSelectedTime] = useState('10:00')
  const [pickupRequired, setPickupRequired] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [odometerKm, setOdometerKm] = useState('')

  const [notes] = useState(() => {
    const issuesParam = params.get('issues')
    const dueDate = params.get('due_date')
    const dueKm = params.get('due_km')
    const dueNote = [
      dueDate ? `Service due date: ${dueDate}` : '',
      dueKm ? `Service due km: ${dueKm}` : '',
    ].filter(Boolean).join('. ')

    if (!issuesParam) return dueNote

    const labels = issuesParam
      .split(',')
      .map(s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))

    return [`Reported issues: ${labels.join(', ')}`, dueNote].filter(Boolean).join('. ')
  })

  useEffect(() => {
    safeGet<Vehicle[]>('/api/vehicles?isActive=true', [])
      .then(data => setVehicles(data || []))
  }, [])

  useEffect(() => {
    safeGet<ExistingBooking[]>('/api/bookings?scope=customer&limit=200', [])
      .then(data => setExistingBookings(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => {
    if (!selectedCenter || !selectedDate) {
      setWorkshopBookings([])
      return
    }

    const from = `${selectedDate}T00:00:00.000Z`
    const to = `${selectedDate}T23:59:59.999Z`

    safeGet<ExistingBooking[]>(
      `/api/bookings?dealerId=${encodeURIComponent(selectedCenter)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`,
      [],
    ).then(data => {
      setWorkshopBookings(Array.isArray(data) ? data : [])
    })
  }, [selectedCenter, selectedDate])

  useEffect(() => {
    if (step === 2) loadCenters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const loadCenters = async () => {
    setLoadingCenters(true)

    try {
      const urlCoords = hasUrlCoords
        ? { latitude: urlLat, longitude: urlLng }
        : null

      const loc = urlCoords ?? (urlCity ? null : await getBrowserLocation().catch(() => null))

      const vehicle = vehicles.find(v => v.id === selectedVehicle)
      const oemSlug = vehicle?.vehicle_oems?.slug || vehicle?.oem?.slug || urlOemSlug || undefined

      const searchParams: Parameters<typeof dealerSearch>[0] = {
        oem: oemSlug,
        service_category: selectedService || undefined,
        limit: 12,
      }

      if (loc) {
        searchParams.lat = loc.latitude
        searchParams.lng = loc.longitude
        searchParams.radius_km = 40
      } else if (urlCity) {
        searchParams.city = urlCity
        searchParams.state = urlState || undefined
      }

      const res = await dealerSearch(searchParams) as unknown

      let results: ServiceCenter[] = Array.isArray(res)
        ? res as ServiceCenter[]
        : Array.isArray((res as { results?: ServiceCenter[] })?.results)
          ? (res as { results: ServiceCenter[] }).results
          : []

      const linkedCenter = params.get('center')
      if (linkedCenter && !results.some(c => c.id === linkedCenter)) {
        const data = await safeGet<ServiceCenter | null>(
          `/api/service-centers/${encodeURIComponent(linkedCenter)}?columns=${encodeURIComponent('id,name,address,city,rating,total_reviews,phone,lat,lng,is_pickup_available,brands,supported_oems,workshop_type,next_available_slot')}`,
          null,
        )

        if (data) results = [data, ...results]
      }

      setCenters(Array.isArray(results) ? results : [])
    } catch {
      const qs = new URLSearchParams({
        status: 'active',
        limit: '12',
        columns: 'id,name,address,city,rating,total_reviews,phone,lat,lng,is_pickup_available,brands,supported_oems,workshop_type,next_available_slot,distance_km',
      })

      if (urlCity) qs.set('city', urlCity)
      if (urlState) qs.set('state', urlState)

      const data = await safeGet<ServiceCenter[]>(`/api/service-centers?${qs.toString()}`, [])
      setCenters(Array.isArray(data) ? data : [])
    } finally {
      setLoadingCenters(false)
    }
  }

  const selectedServiceObj = SERVICE_TYPES.find(s => s.id === selectedService)
  const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle)
  const selectedCenterObj = centers.find(c => c.id === selectedCenter)

  const nearDuplicateBooking = existingBookings.find(b => {
    if (isCancelledStatus(b.status)) return false

    const bookingVehicleId = b.vehicle_id || b.vehicleId
    const bookingDate = getBookingDateValue(b)

    if (!bookingDate) return false

    const diff = Math.abs(getDateDiffInDays(selectedDate, bookingDate))

    return (
      bookingVehicleId === selectedVehicle &&
      diff <= 2
    )
  })

  const isDuplicateSlot = Boolean(nearDuplicateBooking)

  const isWorkshopSlotBooked = (time: string) => {
    return workshopBookings.some(b => {
      if (isCancelledStatus(b.status)) return false

      return (
        b.scheduled_date === selectedDate &&
        b.scheduled_time === time
      )
    })
  }

  const isSelectedWorkshopSlotBooked = selectedTime ? isWorkshopSlotBooked(selectedTime) : false

  const canNext = () => {
    if (step === 0) return !!selectedVehicle
    if (step === 1) return !!selectedService
    if (step === 2) return !!selectedCenter
    if (step === 3) {
      const km = Number(odometerKm)
      return !!selectedDate && !!selectedTime && km > 0 && !isDuplicateSlot && !isSelectedWorkshopSlotBooked
    }
    
    if (step === 4) return true
    return true
  }

  const handleSubmit = async () => {
    if (!user) return

    setSubmitting(true)
    setBookingError('')

    const parsedOdometerKm = Number(odometerKm)
    if (!Number.isFinite(parsedOdometerKm) || parsedOdometerKm <= 0) {
      setSubmitting(false)
      setStep(3)
      setBookingError('Odometer reading is required before booking service.')
      return
    }

    if (isDuplicateSlot) {
      setSubmitting(false)
      setStep(3)
      setBookingError('You already have this vehicle booked within 2 days of this date. Please choose a later date.')
      return
    }

    if (isSelectedWorkshopSlotBooked) {
      setSubmitting(false)
      setStep(3)
      setBookingError('This workshop slot is already booked. Please choose another time.')
      return
    }

    const leadSource = crmToken || params.get('lead_source') === 'service_bikeai' || params.get('source') === 'service_bikeai'
      ? 'service_bikeai'
      : 'bikeai'

    try {
      const data = await api.post<{ id: string }>('/api/bookings', {
        customer_id: user.id,
        vehicle_id: selectedVehicle || null,
        service_center_id: selectedCenter || null,
        service_type: selectedService,
        service_category: selectedServiceObj?.label || selectedService,
        lead_source: leadSource,
        reported_issues: {
          issues: params.get('issues') || null,
          odometer_km: parsedOdometerKm,
        },
        odometer_km: parsedOdometerKm,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        pickup_required: pickupRequired,
        pickup_address: pickupAddress,
        notes,
        status: 'pending',
      })

      if (!data?.id) throw new Error('Booking failed.')

      if (crmToken) {
        await api.patch('/api/crm/booking-links/mark-used', {
          token: crmToken,
          customer_id: user.id,
          used_at: new Date().toISOString(),
        }).catch(() => {})
      }

      setBookingId(data.id)
      setStep(6)
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Booking failed. Please try again.'

      const friendlyMessage = rawMessage.includes('workshop slot')
        ? 'This workshop slot is already booked. Please choose another time.'
        : rawMessage.includes('within 2 days') || rawMessage.includes('vehicle booked')
          ? 'You already have this vehicle booked within 2 days of this date. Please choose a later date.'
          : rawMessage

      setBookingError(friendlyMessage)

      if (
        friendlyMessage.includes('workshop slot') ||
        friendlyMessage.includes('vehicle booked') ||
        friendlyMessage.includes('within 2 days')
      ) {
        setStep(3)
      } else {
        alert(friendlyMessage)
      }

      return
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 6) return <SuccessScreen bookingId={bookingId} navigate={navigate} />

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}>
          <ArrowLeft size={18} />
        </button>

        <div>
          <h1 style={s.title}>Book a Service</h1>
          <p style={s.sub}>Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>

      <div style={s.progress}>
        {STEPS.map((label, i) => (
          <div key={label} style={s.progressStep}>
            <div style={{ ...s.progressDot, ...(i < step ? s.progressDone : i === step ? s.progressActive : {}) }}>
              {i < step ? <Check size={12} color="white" /> : <span>{i + 1}</span>}
            </div>

            <span style={{ ...s.progressLabel, color: i <= step ? '#0f2044' : '#9aa3b8', fontWeight: i === step ? '700' : '400' }}>
              {label}
            </span>

            {i < STEPS.length - 1 && <div style={{ ...s.progressLine, background: i < step ? '#f5a623' : '#e2e6f0' }} />}
          </div>
        ))}
      </div>

      <div style={s.content}>
        {step === 0 && (
          <StepCard title="Select Your Vehicle" sub="Which vehicle needs service?">
            {vehicles.length === 0 ? (
              <div style={s.noVehicle}>
                <Bike size={40} color="#d1d5db" />
                <p>No vehicles in garage.</p>
                <button style={s.addVehicleBtn} onClick={() => navigate('/my/garage/add')}>
                  Add Vehicle First
                </button>
              </div>
            ) : (
              <div style={s.vehicleGrid}>
                {vehicles.map(v => (
                  <button
                    key={v.id}
                    style={{ ...s.vehicleCard, ...(selectedVehicle === v.id ? s.vehicleCardActive : {}) }}
                    onClick={() => {
                      setSelectedVehicle(v.id)
                      setBookingError('')
                    }}
                  >
                    <Bike size={24} color={selectedVehicle === v.id ? '#f5a623' : '#9aa3b8'} />

                    <div style={s.vehicleCardInfo}>
                      <span style={s.vehicleCardName}>{getVehicleName(v)}</span>
                      <span style={s.vehicleCardReg}>{getVehicleRegistration(v)}</span>
                      {[getVehicleBrand(v), getVehicleModel(v)].filter(Boolean).length > 0 && (
                        <span style={s.vehicleCardModel}>
                          {[getVehicleBrand(v), getVehicleModel(v)].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>

                    {selectedVehicle === v.id && <CheckCircle size={18} color="#f5a623" />}
                  </button>
                ))}

                <button style={s.addOther} onClick={() => navigate('/my/garage/add')}>
                  <span style={{ fontSize: '20px', color: '#9aa3b8' }}>+</span>
                  <span style={{ fontSize: '13px', color: '#9aa3b8' }}>Add Vehicle</span>
                </button>
              </div>
            )}
          </StepCard>
        )}

        {step === 1 && (
          <StepCard title="Select Service Type" sub="What type of service do you need?">
            <div style={s.serviceGrid}>
              {SERVICE_TYPES.map(svc => (
                <button
                  key={svc.id}
                  style={{
                    ...s.serviceCard,
                    border: selectedService === svc.id ? `2px solid ${svc.color}` : '2px solid #e2e6f0',
                    background: selectedService === svc.id ? `${svc.color}10` : 'white',
                  }}
                  onClick={() => {
                    setSelectedService(svc.id)
                    setBookingError('')
                  }}
                >
                  <div style={s.svcTop}>
                    <Wrench size={18} color={svc.color} />
                    {selectedService === svc.id && <CheckCircle size={16} color={svc.color} />}
                  </div>

                  <span style={{ ...s.svcLabel, color: svc.color }}>{svc.label}</span>
                  <span style={s.svcDesc}>{svc.desc}</span>
                  <span style={{ ...s.svcPrice, color: svc.color }}>{svc.price}</span>
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard title="Choose Workshop" sub="Select the nearest or preferred service center">
            {loadingCenters ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', background: '#f3f4f6', borderRadius: '12px' }} />)}
              </div>
            ) : centers.length === 0 ? (
              <div style={s.noVehicle}>
                <MapPin size={36} color="#d1d5db" />
                <p>No service centers found nearby.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {centers.map(c => (
                  <button
                    key={c.id}
                    style={{
                      ...s.centerCard,
                      border: selectedCenter === c.id ? '2px solid #f5a623' : '2px solid #e2e6f0',
                      background: selectedCenter === c.id ? '#fffbeb' : 'white',
                    }}
                    onClick={() => {
                      setSelectedCenter(c.id)
                      setBookingError('')
                    }}
                  >
                    <div style={s.centerLeft}>
                      <div style={s.centerIcon}>
                        <MapPin size={18} color="#f5a623" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={s.centerName}>{c.name}</p>
                        <p style={s.centerAddr}>{[c.address, c.city].filter(Boolean).join(', ')}</p>

                        <div style={s.centerTags}>
                          {c.rating > 0 && (
                            <span style={s.tag}>
                              <Star size={10} />{c.rating.toFixed(1)} ({c.total_reviews ?? 0})
                            </span>
                          )}

                          {c.is_pickup_available && <span style={{ ...s.tag, color: '#16a34a', background: '#f0fdf4' }}>Pickup</span>}

                          {c.distance_km != null && (
                            <span style={{ ...s.tag, color: '#2563eb', background: '#eff6ff' }}>
                              {c.distance_km < 1 ? `${(c.distance_km * 1000).toFixed(0)}m` : `${c.distance_km.toFixed(1)}km`}
                            </span>
                          )}

                          {c.workshop_type === 'oem_authorized' && (
                            <span style={{ ...s.tag, color: '#7c3aed', background: '#f5f3ff' }}>OEM Auth</span>
                          )}

                          {c.next_available_slot && (
                            <span style={{ ...s.tag, color: '#0891b2', background: '#ecfeff' }}>
                              {c.next_available_slot}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedCenter === c.id && <CheckCircle size={20} color="#f5a623" style={{ flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </StepCard>
        )}

        {step === 3 && (
          <StepCard title="Schedule Service" sub="Bookings are available from day-after-tomorrow for the next 7 days, excluding Sundays.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {bookingError && <div style={s.errorBox}>{bookingError}</div>}

              <div>
                <label style={s.fieldLabel}>
                  <Calendar size={14} />
                  Preferred Date
                </label>

                <div style={s.dateGrid}>
                  {allowedDates.map(date => {
                    const lockedDate = existingBookings.some(b => {
                      if (isCancelledStatus(b.status)) return false

                      const bookingVehicleId = b.vehicle_id || b.vehicleId
                      const bookingDate = getBookingDateValue(b)

                      if (!bookingDate) return false

                      const diff = Math.abs(getDateDiffInDays(date.value, bookingDate))

                      return (
                        bookingVehicleId === selectedVehicle &&
                        diff <= 2
                      )
                    })

                    return (
                      <button
                        key={date.value}
                        type="button"
                        disabled={lockedDate}
                        style={{
                          ...s.dateSlot,
                          ...(selectedDate === date.value ? s.dateSlotActive : {}),
                          ...(lockedDate ? s.timeSlotDisabled : {}),
                        }}
                        onClick={() => {
                          if (lockedDate) {
                            setBookingError('You already have this vehicle booked within 2 days of this date. Please choose a later date.')
                            return
                          }

                          setSelectedDate(date.value)
                          setBookingError('')
                        }}
                        title={date.fullLabel}
                      >
                        {date.label}
                      </button>
                    )
                  })}
                </div>

                <p style={s.helpText}>Sunday is not available for booking.</p>
              </div>

              <div>
                <label style={s.fieldLabel}>
                  <Calendar size={14} />
                  Time Slot
                </label>

                <div style={s.timeGrid}>
                  {TIME_SLOTS.map(t => {
                    const duplicateForTime = existingBookings.some(b => {
                      if (isCancelledStatus(b.status)) return false

                      const bookingVehicleId = b.vehicle_id || b.vehicleId
                      const bookingDate = getBookingDateValue(b)

                      if (!bookingDate) return false

                      const diff = Math.abs(getDateDiffInDays(selectedDate, bookingDate))

                      return (
                        bookingVehicleId === selectedVehicle &&
                        diff <= 2
                      )
                    })

                    const workshopBookedForTime = isWorkshopSlotBooked(t)
                    const disabledForTime = duplicateForTime || workshopBookedForTime

                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabledForTime}
                        style={{
                          ...s.timeSlot,
                          ...(selectedTime === t ? s.timeSlotActive : {}),
                          ...(disabledForTime ? s.timeSlotDisabled : {}),
                        }}
                        onClick={() => {
                          if (duplicateForTime) {
                            setBookingError('You already have this vehicle booked within 2 days of this date. Please choose a later date.')
                            return
                          }

                          if (workshopBookedForTime) {
                            setBookingError('This workshop slot is already booked. Please choose another time.')
                            return
                          }

                          setSelectedTime(t)
                          setBookingError('')
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>

                {isDuplicateSlot && (
                  <p style={s.errorText}>
                    You already have this vehicle booked within 2 days of this date. Please choose a later date.
                  </p>
                )}

                {isSelectedWorkshopSlotBooked && (
                  <p style={s.errorText}>
                    This workshop slot is already booked. Please choose another time.
                  </p>
                )}
              </div>

              <div>
                <label style={s.fieldLabel}>
                  Odometer Reading (KMS) *
                </label>
                <input
                style={s.input}
                type="number"
                min={1}
                value={odometerKm}
                onChange={e => {
                setOdometerKm(e.target.value)
                setBookingError('')
              }}
              placeholder="Enter current odometer reading"
              />
              {!odometerKm && (
                <p style={s.errorText}>
                  Odometer reading is required to book service.
                </p>
              )}
              </div>

            </div>
          </StepCard>
        )}

        {step === 4 && (
          <StepCard title="Pickup & Drop" sub="Want us to pick up your vehicle from your location?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={s.pickupToggle}>
                <div>
                  <p style={s.pickupTitle}>Free Doorstep Pickup</p>
                  <p style={s.pickupSub}>Our rider will collect your vehicle and return it after service</p>
                </div>

                <label style={s.toggle}>
                  <input type="checkbox" checked={pickupRequired} onChange={e => setPickupRequired(e.target.checked)} style={{ display: 'none' }} />

                  <div style={{ ...s.toggleTrack, background: pickupRequired ? '#f5a623' : '#e2e6f0' }}>
                    <div style={{ ...s.toggleThumb, transform: pickupRequired ? 'translateX(22px)' : 'translateX(2px)' }} />
                  </div>
                </label>
              </div>

              {pickupRequired && (
                <div>
                  <label style={s.fieldLabel}>
                    <Truck size={14} />
                    Pickup Address
                  </label>

                  <textarea
                    style={s.textarea}
                    value={pickupAddress}
                    onChange={e => setPickupAddress(e.target.value)}
                    placeholder="Enter your full address for pickup..."
                    rows={3}
                  />
                </div>
              )}

              {!pickupRequired && (
                <div style={s.dropOffInfo}>
                  <MapPin size={18} color="#2563eb" />
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '14px', color: '#0f2044' }}>Drop-off at Workshop</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#9aa3b8' }}>{selectedCenterObj?.name} · {selectedCenterObj?.address}</p>
                  </div>
                </div>
              )}
            </div>
          </StepCard>
        )}

        {step === 5 && (
          <StepCard title="Confirm Booking" sub="Review your booking details before confirming">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookingError && <div style={s.errorBox}>{bookingError}</div>}

              {[
                {
                  label: 'Vehicle',
                  value: selectedVehicleObj
                    ? [
                        selectedVehicleObj.nickname,
                        getVehicleRegistration(selectedVehicleObj),
                        getVehicleBrand(selectedVehicleObj),
                        getVehicleModel(selectedVehicleObj),
                      ].filter(Boolean).join(' · ')
                    : [params.get('oem_name'), urlModel, urlLocation || urlCity].filter(Boolean).join(' · '),
                },
                { label: 'Service', value: selectedServiceObj?.label },
                { label: 'Workshop', value: `${selectedCenterObj?.name}, ${selectedCenterObj?.city}` },
                { label: 'Date & Time', value: `${selectedDate} at ${selectedTime}` },
                { label: 'Odometer', value: `${Number(odometerKm || 0).toLocaleString('en-IN')} km` },
                { label: 'Pickup', value: pickupRequired ? `Yes — ${pickupAddress}` : 'No (drop-off at workshop)' },
              ].map(item => (
                <div key={item.label} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{item.label}</span>
                  <span style={s.summaryVal}>{item.value}</span>
                </div>
              ))}

              {selectedServiceObj && (
                <div style={{ ...s.summaryRow, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
                  <span style={{ ...s.summaryLabel, color: '#16a34a' }}>Estimated Cost</span>
                  <span style={{ ...s.summaryVal, color: '#16a34a', fontWeight: '800' }}>{selectedServiceObj.price}</span>
                </div>
              )}
            </div>
          </StepCard>
        )}
      </div>

      <div style={s.footer}>
        {step > 0 && (
          <button style={s.prevBtn} onClick={() => setStep(s => s - 1)}>
            <ArrowLeft size={16} /> Back
          </button>
        )}

        <div style={{ flex: 1 }} />

        {step < 5 ? (
          <button
            style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4 }}
            onClick={() => canNext() && setStep(s => s + 1)}
            disabled={!canNext()}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button style={s.confirmBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Confirming...' : <><CheckCircle size={16} /> Confirm Booking</>}
          </button>
        )}
      </div>
    </div>
  )
}

function StepCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f2044', margin: '0 0 4px' }}>{title}</h2>
      <p style={{ fontSize: '13px', color: '#9aa3b8', margin: '0 0 20px' }}>{sub}</p>
      {children}
    </div>
  )
}

function SuccessScreen({ bookingId, navigate }: { bookingId: string; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
      <div style={{ width: '80px', height: '80px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CheckCircle size={40} color="#16a34a" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 8px' }}>Booking Confirmed!</h2>
        <p style={{ fontSize: '14px', color: '#9aa3b8', margin: 0 }}>Your service has been scheduled. You'll receive a confirmation shortly.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          style={{ padding: '11px 24px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          onClick={() => navigate(`/my/bookings/${bookingId}`)}
        >
          Track Booking
        </button>

        <button
          style={{ padding: '11px 24px', background: '#f5f7fa', color: '#0f2044', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          onClick={() => navigate('/my/dashboard')}
        >
          Go Home
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '700px' },
  header: { display: 'flex', alignItems: 'center', gap: '14px' },
  backBtn: { background: '#f5f7fa', border: 'none', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  title: { fontSize: '22px', fontWeight: '800', color: '#0f2044', margin: '0 0 2px' },
  sub: { fontSize: '13px', color: '#9aa3b8', margin: 0 },
  progress: { display: 'flex', alignItems: 'center', background: 'white', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  progressStep: { display: 'flex', alignItems: 'center', gap: '6px', flex: 1 },
  progressDot: { width: '28px', height: '28px', borderRadius: '50%', background: '#e2e6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#9aa3b8', fontWeight: '700', flexShrink: 0 },
  progressDone: { background: '#f5a623', color: 'white' },
  progressActive: { background: '#0f2044', color: 'white' },
  progressLabel: { fontSize: '11px', whiteSpace: 'nowrap' },
  progressLine: { flex: 1, height: '2px', marginLeft: '6px' },
  content: {},
  vehicleGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  vehicleCard: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '2px solid #e2e6f0', borderRadius: '12px', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  vehicleCardActive: { border: '2px solid #f5a623', background: '#fffbeb' },
  vehicleCardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  vehicleCardName: { fontSize: '14px', fontWeight: '600', color: '#0f2044' },
  vehicleCardReg: { fontSize: '12px', color: '#9aa3b8' },
  vehicleCardModel: { fontSize: '12px', color: '#6b7280' },
  addOther: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', border: '2px dashed #e2e6f0', borderRadius: '12px', background: 'white', cursor: 'pointer' },
  serviceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  serviceCard: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  svcTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  svcLabel: { fontSize: '13px', fontWeight: '700' },
  svcDesc: { fontSize: '11px', color: '#9aa3b8', lineHeight: '1.4' },
  svcPrice: { fontSize: '13px', fontWeight: '700', marginTop: '2px' },
  centerCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  centerLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  centerIcon: { width: '38px', height: '38px', background: '#fffbeb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  centerName: { fontSize: '14px', fontWeight: '600', color: '#0f2044', margin: '0 0 2px' },
  centerAddr: { fontSize: '12px', color: '#9aa3b8', margin: '0 0 6px' },
  centerTags: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tag: { display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '600', padding: '2px 8px', background: '#fffbeb', color: '#d97706', borderRadius: '20px' },
  fieldLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '8px' },
  dateGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
  dateSlot: { padding: '10px 6px', border: '1.5px solid #e2e6f0', borderRadius: '9px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#555', cursor: 'pointer', transition: 'all 0.15s' },
  dateSlotActive: { border: '1.5px solid #f5a623', background: '#fffbeb', color: '#f5a623' },
  timeGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' },
  timeSlot: { padding: '10px 4px', border: '1.5px solid #e2e6f0', borderRadius: '9px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#555', cursor: 'pointer', transition: 'all 0.15s' },
  timeSlotActive: { border: '1.5px solid #f5a623', background: '#fffbeb', color: '#f5a623' },
  timeSlotDisabled: { opacity: 0.4, cursor: 'not-allowed', background: '#f3f4f6', color: '#9ca3af' },
  helpText: { fontSize: '12px', color: '#9aa3b8', margin: '8px 0 0' },
  errorText: { fontSize: '12px', color: '#dc2626', margin: '8px 0 0', fontWeight: '600' },
  errorBox: { padding: '10px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '13px', fontWeight: '600' },
  textarea: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e6f0', borderRadius: '10px', fontSize: '14px', color: '#0f2044', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  pickupToggle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9ff', borderRadius: '12px', padding: '16px' },
  pickupTitle: { fontSize: '15px', fontWeight: '600', color: '#0f2044', margin: '0 0 3px' },
  pickupSub: { fontSize: '12px', color: '#9aa3b8', margin: 0 },
  toggle: { cursor: 'pointer' },
  toggleTrack: { width: '46px', height: '26px', borderRadius: '13px', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' },
  toggleThumb: { position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform 0.2s' },
  dropOffInfo: { display: 'flex', alignItems: 'flex-start', gap: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' },
  summaryRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f8' },
  summaryLabel: { fontSize: '13px', color: '#9aa3b8', fontWeight: '500' },
  summaryVal: { fontSize: '13px', color: '#0f2044', fontWeight: '600', textAlign: 'right', maxWidth: '60%' },
  footer: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'white', borderRadius: '14px', boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' },
  prevBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 20px', background: '#f5f7fa', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#555', cursor: 'pointer' },
  nextBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 28px', background: '#0f2044', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', color: 'white', cursor: 'pointer', transition: 'opacity 0.15s' },
  confirmBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 28px', background: '#16a34a', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', color: 'white', cursor: 'pointer' },
  noVehicle: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px', color: '#9aa3b8', fontSize: '14px' },
  addVehicleBtn: { padding: '10px 20px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dealer } from '../types'
import { VehicleSelection, SERVICE_CATEGORIES } from '../types/vehicle'
import VehicleSelector from '../components/VehicleSelector'
import { ArrowLeft, ArrowRight, MapPin, Clock, Star, Check, CalendarDays, Bike, Truck, Navigation } from 'lucide-react'
import { api, getStoredAuth, safeGet, sendBookingConfirmation, dealerSearch, getBrowserLocation, DealerResult } from '../lib/api'

const STEPS = [
  { id: 'vehicle', label: 'Vehicle', icon: Bike },
  { id: 'service-center', label: 'Service Center', icon: MapPin },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'confirm', label: 'Confirm', icon: Check },
]

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '13:00', '13:30', '14:00',
  '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
]

const EMPTY_VEHICLE: VehicleSelection = {
  oem: null, model: null, year: null, fuelType: null,
  serviceType: null, vehicleNumber: '', odometerKm: '',
}

export default function BookingWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [vehicle, setVehicle] = useState<VehicleSelection>(EMPTY_VEHICLE)
  const [centers, setCenters] = useState<Dealer[]>([])
  const [selectedCenter, setSelectedCenter] = useState<Dealer | null>(null)
  const [centerSearch, setCenterSearch] = useState('')
  const [loadingCenters, setLoadingCenters] = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingId, setBookingId] = useState('')

  useEffect(() => {
    if (step === 1) loadCenters()
  }, [step])

  const loadCenters = async () => {
    setLoadingCenters(true)
    try {
      const loc = await getBrowserLocation().catch(() => null)
      if (loc) setUserCoords({ lat: loc.latitude, lng: loc.longitude })

      const oemSlug = vehicle.oem?.name?.toLowerCase().replace(/\s+/g, '') ?? undefined
      const params: Parameters<typeof dealerSearch>[0] = {
        oem: oemSlug,
        service_category: vehicle.serviceType ?? undefined,
        limit: 20,
      }
      if (loc) {
        params.lat = loc.latitude
        params.lng = loc.longitude
        params.radius_km = 50
      }
      const res = await dealerSearch(params)
      setCenters(res.results as unknown as Dealer[])
    } catch {
      // TODO: Confirm backend endpoint for listing active service centers (fallback path).
      const data = await safeGet<Dealer[]>('/api/service-centers?status=active&limit=200', [])
      setCenters((data || []) as Dealer[])
    } finally {
      setLoadingCenters(false)
    }
  }

  const filteredCenters = centers.filter(c =>
    !centerSearch ||
    c.name?.toLowerCase().includes(centerSearch.toLowerCase()) ||
    c.city?.toLowerCase().includes(centerSearch.toLowerCase())
  )

  const vehicleReady = !!(vehicle.oem && vehicle.model && vehicle.year && vehicle.fuelType && vehicle.serviceType && vehicle.vehicleNumber)

  const canNext = [
    vehicleReady,
    !!selectedCenter,
    !!(scheduledDate && scheduledTime),
    true,
  ][step]

  const serviceLabel = SERVICE_CATEGORIES.find(s => s.value === vehicle.serviceType)?.label || vehicle.serviceType

  const submit = async () => {
    setSubmitting(true)
    try {
      const stored = getStoredAuth()
      const customerId = stored?.user?.id || null
      // TODO: Confirm backend endpoint for creating a booking from admin wizard.
      const created = await api.post<{ id: string }>('/api/bookings', {
        customer_id: customerId,
        oem_id: vehicle.oem?.id,
        model_id: vehicle.model?.id,
        service_center_id: selectedCenter?.id,
        service_type: vehicle.serviceType,
        manufacturing_year: vehicle.year,
        fuel_type: vehicle.fuelType,
        vehicle_number: vehicle.vehicleNumber,
        odometer_km: vehicle.odometerKm ? parseInt(vehicle.odometerKm) : null,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes,
        status: 'pending',
        estimated_cost: 0,
      })

      if (created?.id) {
        setBookingId(created.id)
        setSubmitted(true)

        // Optional confirmation; ignore failures.
        const me = await safeGet<any>('/api/profile', null)
        const phone = me?.phone || me?.whatsapp_number || null
        if (phone) {
          sendBookingConfirmation(
            phone,
            {
              service_type: serviceLabel ?? '',
              date: scheduledDate,
              time: scheduledTime,
              center: selectedCenter?.name ?? '',
              booking_id: created.id.slice(0, 8).toUpperCase(),
            },
            { customer_id: customerId || undefined, booking_id: created.id },
          ).catch(() => {})
        }
      }
    } catch {
      // keep UI unchanged; no global toast here
    }
    setSubmitting(false)
  }

  if (submitted) {
    return <SuccessScreen bookingId={bookingId} vehicle={vehicle} center={selectedCenter} date={scheduledDate} time={scheduledTime} onNew={() => { setStep(0); setVehicle(EMPTY_VEHICLE); setSelectedCenter(null); setScheduledDate(''); setScheduledTime(''); setSubmitted(false) }} onView={() => navigate('/bookings')} />
  }

  return (
    <div style={pageStyles.page}>
      {/* Header */}
      <div style={pageStyles.pageHeader}>
        <div>
          <h2 style={pageStyles.pageTitle}>New Booking</h2>
          <p style={pageStyles.pageSub}>Create a service booking for a customer</p>
        </div>
        <button onClick={() => navigate('/bookings')} style={pageStyles.backBtn}>
          <ArrowLeft size={15} /> Back to Bookings
        </button>
      </div>

      {/* Progress bar */}
      <div style={pageStyles.progressWrap}>
        {STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? '1' : 'auto' }}>
              <button
                onClick={() => done ? setStep(i) : undefined}
                disabled={!done}
                style={{
                  ...pageStyles.stepBtn,
                  opacity: done || active ? 1 : 0.4,
                  cursor: done ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  ...pageStyles.stepCircle,
                  background: done ? '#0f2044' : active ? '#0f2044' : '#f1f3f8',
                  color: done || active ? (done ? '#f5e019' : 'white') : '#9aa3b8',
                }}>
                  {done ? <Check size={13} /> : <s.icon size={13} />}
                </div>
                <span style={{ ...pageStyles.stepLabel, color: active ? '#0f2044' : done ? '#6b7595' : '#c8cfdf', fontWeight: active ? '600' : '400' }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: '2px', background: done ? '#0f2044' : '#e2e6f0', margin: '0 6px', borderRadius: '2px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div style={pageStyles.content}>
        {step === 0 && (
          <div style={pageStyles.card}>
            <h3 style={pageStyles.cardTitle}>Vehicle Information</h3>
            <p style={pageStyles.cardSub}>Select the vehicle details for this service booking</p>
            <div style={{ marginTop: '20px' }}>
              <VehicleSelector value={vehicle} onChange={setVehicle} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={pageStyles.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <h3 style={pageStyles.cardTitle}>Choose Service Center</h3>
                <p style={pageStyles.cardSub}>
                  {loadingCenters ? 'Searching nearby centers…' :
                    centers.length > 0
                      ? `${centers.length} centers found${userCoords ? ' near you' : ''} · sorted by ${userCoords ? 'distance' : 'rating'}`
                      : 'No active service centers found'}
                </p>
              </div>
              <button
                onClick={loadCenters}
                disabled={loadingCenters}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: '#f1f3f8', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '12px', color: '#4a5270', cursor: 'pointer', fontFamily: 'inherit', opacity: loadingCenters ? 0.5 : 1 }}
              >
                <Navigation size={12} /> Refresh
              </button>
            </div>
            <div style={{ marginTop: '16px' }}>
              <input
                value={centerSearch}
                onChange={e => setCenterSearch(e.target.value)}
                placeholder="Filter by name or city…"
                style={pageStyles.searchInput}
              />
            </div>
            {loadingCenters ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ height: '110px', background: '#f3f4f6', borderRadius: '12px', animation: 'pulse 1.5s ease infinite' }} />
                ))}
              </div>
            ) : (
              <div style={pageStyles.centerGrid}>
                {filteredCenters.map(c => {
                  const sel = selectedCenter?.id === c.id
                  const d = (c as unknown as DealerResult)
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCenter(c)}
                      style={{
                        ...pageStyles.centerCard,
                        borderColor: sel ? '#0f2044' : '#e2e6f0',
                        background: sel ? '#eef2f8' : 'white',
                        boxShadow: sel ? '0 0 0 2px rgba(15,32,68,0.1)' : '0 1px 3px rgba(15,32,68,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={pageStyles.centerAvatar}>{c.name?.[0]}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          {sel && <Check size={15} color="#0f2044" />}
                          {d.distance_km != null && (
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb' }}>
                              {d.distance_km < 1 ? `${(d.distance_km * 1000).toFixed(0)}m` : `${d.distance_km.toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={pageStyles.centerName}>{c.name}</div>
                      <div style={pageStyles.centerMeta}>
                        <MapPin size={11} /> {c.city}{c.state ? `, ${c.state}` : ''}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {c.rating > 0 && (
                          <span style={pageStyles.badge}>
                            <Star size={9} color="#f59e0b" fill="#f59e0b" />{c.rating?.toFixed(1)}
                          </span>
                        )}
                        {d.workshop_type === 'oem_authorized' && (
                          <span style={{ ...pageStyles.badge, color: '#1d4ed8', background: '#eff6ff' }}>OEM Auth</span>
                        )}
                        {d.is_pickup_available && (
                          <span style={{ ...pageStyles.badge, color: '#16a34a', background: '#f0fdf4' }}>
                            <Truck size={9} />Pickup
                          </span>
                        )}
                      </div>
                      {d.next_available_slot && (
                        <div style={pageStyles.centerHours}>
                          <Clock size={11} /> {d.next_available_slot}
                        </div>
                      )}
                    </button>
                  )
                })}
                {filteredCenters.length === 0 && (
                  <p style={{ color: '#9aa3b8', fontSize: '13px', gridColumn: '1/-1', padding: '20px 0' }}>No service centers match your search</p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={pageStyles.card}>
            <h3 style={pageStyles.cardTitle}>Schedule Appointment</h3>
            <p style={pageStyles.cardSub}>Pick a date and time slot</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div style={pageStyles.fieldWrap}>
                <label style={pageStyles.fieldLabel}>Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={pageStyles.input}
                />
              </div>
              <div style={pageStyles.fieldWrap}>
                <label style={pageStyles.fieldLabel}>Notes (optional)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any specific concerns..."
                  style={pageStyles.input}
                />
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <label style={pageStyles.fieldLabel}>Time Slot</label>
              <div style={pageStyles.timeGrid}>
                {TIME_SLOTS.map(t => (
                  <button
                    key={t}
                    onClick={() => setScheduledTime(t)}
                    style={{
                      ...pageStyles.timeBtn,
                      background: scheduledTime === t ? '#0f2044' : 'white',
                      color: scheduledTime === t ? 'white' : '#333a52',
                      borderColor: scheduledTime === t ? '#0f2044' : '#e2e6f0',
                      fontWeight: scheduledTime === t ? '600' : '400',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={pageStyles.card}>
            <h3 style={pageStyles.cardTitle}>Confirm Booking</h3>
            <p style={pageStyles.cardSub}>Review all details before submitting</p>
            <div style={pageStyles.summaryGrid}>
              <SummaryBlock title="Vehicle">
                <SummaryRow label="Brand" value={vehicle.oem?.name} />
                <SummaryRow label="Model" value={vehicle.model?.name} />
                <SummaryRow label="Year" value={vehicle.year?.toString()} />
                <SummaryRow label="Fuel Type" value={vehicle.fuelType === 'electric' ? 'Electric (EV)' : vehicle.fuelType} />
                <SummaryRow label="Reg. Number" value={vehicle.vehicleNumber} />
                {vehicle.odometerKm && <SummaryRow label="Odometer" value={`${parseInt(vehicle.odometerKm).toLocaleString()} km`} />}
              </SummaryBlock>
              <SummaryBlock title="Service">
                <SummaryRow label="Type" value={serviceLabel} />
                <SummaryRow label="Center" value={selectedCenter?.name} />
                <SummaryRow label="Location" value={selectedCenter ? `${selectedCenter.city}, ${selectedCenter.state}` : ''} />
                <SummaryRow label="Date" value={scheduledDate} />
                <SummaryRow label="Time" value={scheduledTime} />
                {notes && <SummaryRow label="Notes" value={notes} />}
              </SummaryBlock>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div style={pageStyles.footer}>
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/bookings')}
          style={pageStyles.prevBtn}
        >
          <ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext} style={{ ...pageStyles.nextBtn, opacity: canNext ? 1 : 0.45 }}>
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={submit} disabled={submitting} style={pageStyles.submitBtn}>
            {submitting ? 'Submitting...' : 'Confirm Booking'}
          </button>
        )}
      </div>
    </div>
  )
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e2e6f0', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#f8f9fc', borderBottom: '1px solid #e2e6f0' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f2044' }}>{title}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '12.5px', color: '#9aa3b8' }}>{label}</span>
      <span style={{ fontSize: '12.5px', fontWeight: '500', color: '#1e2438', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function SuccessScreen({ bookingId, vehicle, center, date, time, onNew, onView }: {
  bookingId: string; vehicle: VehicleSelection; center: Dealer | null; date: string; time: string; onNew: () => void; onView: () => void
}) {
  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.successWrap}>
        <div style={pageStyles.successIcon}>
          <Check size={32} color="white" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0f2044' }}>Booking Confirmed!</h2>
        <p style={{ color: '#9aa3b8', fontSize: '14px', textAlign: 'center', maxWidth: '360px' }}>
          Service booking has been created and is pending confirmation from the service center.
        </p>
        <div style={pageStyles.successCard}>
          <SummaryRow label="Booking ID" value={`#${bookingId.slice(0, 8).toUpperCase()}`} />
          <SummaryRow label="Vehicle" value={`${vehicle.oem?.name} ${vehicle.model?.name} (${vehicle.year})`} />
          <SummaryRow label="Service" value={SERVICE_CATEGORIES.find(s => s.value === vehicle.serviceType)?.label} />
          <SummaryRow label="Center" value={center?.name} />
          <SummaryRow label="Appointment" value={`${date} at ${time}`} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button onClick={onNew} style={pageStyles.prevBtn}>New Booking</button>
          <button onClick={onView} style={pageStyles.nextBtn}>View All Bookings <ArrowRight size={14} /></button>
        </div>
      </div>
    </div>
  )
}

const pageStyles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#0f2044', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7595' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', color: '#4a5270', cursor: 'pointer', fontFamily: 'inherit' },
  progressWrap: { display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e6f0' },
  stepBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'default', padding: '0', fontFamily: 'inherit' },
  stepCircle: { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepLabel: { fontSize: '13px', whiteSpace: 'nowrap' },
  content: {},
  card: { background: 'white', borderRadius: '14px', border: '1px solid #e2e6f0', padding: '24px' },
  cardTitle: { fontSize: '17px', fontWeight: '700', color: '#0f2044', marginBottom: '4px' },
  cardSub: { fontSize: '13px', color: '#9aa3b8' },
  searchInput: { width: '100%', padding: '9px 12px', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: '#f8f9fc', outline: 'none', marginBottom: '14px' },
  centerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '4px' },
  centerCard: { padding: '14px', border: '1.5px solid', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', display: 'flex', flexDirection: 'column' },
  centerAvatar: { width: '36px', height: '36px', borderRadius: '9px', background: '#0f2044', color: '#f5e019', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700' },
  centerName: { fontSize: '14px', fontWeight: '600', color: '#0f2044', marginBottom: '4px' },
  centerMeta: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#9aa3b8' },
  centerRating: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#6b7595', marginTop: '4px' },
  centerHours: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c8cfdf', marginTop: '6px' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: '600', padding: '2px 7px', background: '#fffbeb', color: '#d97706', borderRadius: '20px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '5px' },
  fieldLabel: { fontSize: '12.5px', fontWeight: '600', color: '#333a52', marginBottom: '2px' },
  input: { padding: '9px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  timeGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  timeBtn: { padding: '7px 14px', border: '1px solid', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' },
  footer: { display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e6f0' },
  prevBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '9px', fontSize: '13.5px', color: '#4a5270', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' },
  nextBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  submitBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  successWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '48px 24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e6f0' },
  successIcon: { width: '64px', height: '64px', background: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  successCard: { width: '100%', maxWidth: '400px', background: '#f8f9fc', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e6f0' },
}

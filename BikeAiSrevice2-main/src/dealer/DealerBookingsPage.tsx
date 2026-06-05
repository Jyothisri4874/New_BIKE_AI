import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, RefreshCw, CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import { api, safeGet } from '../lib/api'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

type JobCardRef = {
  id: string
  number?: string
  status?: string
}

type ReportedIssues = {
  issues?: string | null
  odometer_km?: number | string | null
  odometerKm?: number | string | null
  [key: string]: unknown
}

type BookingRow = {
  id: string
  customerId?: string
  customer_id?: string
  dealerId?: string
  dealer_id?: string
  vehicleId?: string
  vehicle_id?: string
  status: string
  service_type?: string
  serviceType?: string
  service_category?: string
  scheduled_date?: string
  scheduled_time?: string
  scheduled_at?: string
  scheduledAt?: string
  notes?: string | null
  reportedIssues?: ReportedIssues | string | null
  reported_issues?: ReportedIssues | string | null
  odometer_km?: number | string | null
  odometerKm?: number | string | null
  jobCard?: JobCardRef | null
  job_card?: JobCardRef | null
  customer?: {
    id?: string
    fullName?: string
    full_name?: string
    phone?: string
    email?: string
  } | null
  vehicle?: {
    id?: string
    registrationNo?: string
    registration_number?: string
    nickname?: string
    displayName?: string
    display_name?: string
    brand?: string | null
    brand_name?: string | null
    model_name?: string | null
    odometerKm?: number | string | null
    odometer_km?: number | string | null
    oem?: { name?: string } | null
    model?: { name?: string } | null
  } | null
  dealer?: {
    id?: string
    name?: string
    city?: string
  } | null
}

type BookingDetail = BookingRow & {
  jobCard?: JobCardRef | null
  customerId?: string
  dealerId?: string
  vehicleId?: string
}

type CreatedJobCard = {
  id: string
  number?: string
  status?: string
}

function formatServiceLabel(value?: string | null) {
  if (!value) return 'Service'

  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function formatStatus(value?: string | null) {
  return formatServiceLabel(value || 'pending')
}

function customerName(b: BookingRow) {
  return b.customer?.fullName || b.customer?.full_name || 'Customer'
}

function vehicleName(b: BookingRow) {
  const nickname = b.vehicle?.nickname || b.vehicle?.displayName || b.vehicle?.display_name || ''
  const oem = b.vehicle?.oem?.name || b.vehicle?.brand || b.vehicle?.brand_name || ''
  const model = b.vehicle?.model?.name || b.vehicle?.model_name || ''

  return [nickname, oem, model].filter(Boolean).join(' · ') || 'Vehicle'
}

function registrationNumber(b: BookingRow) {
  return b.vehicle?.registrationNo || b.vehicle?.registration_number || '-'
}

function bookingDateTime(b: BookingRow) {
  if (b.scheduled_date || b.scheduled_time) {
    return [b.scheduled_date, b.scheduled_time].filter(Boolean).join(' ')
  }

  const raw = b.scheduled_at || b.scheduledAt
  if (!raw) return '-'

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)

  return `${d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} ${d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

function serviceLabel(b: BookingRow) {
  return formatServiceLabel(b.service_category || b.service_type || b.serviceType)
}

function statusStyle(status?: string | null): React.CSSProperties {
  const normalized = String(status || 'pending').toLowerCase()

  if (normalized === 'confirmed') {
    return { background: '#ecfdf5', color: '#16a34a' }
  }

  if (normalized === 'cancelled') {
    return { background: '#fef2f2', color: '#dc2626' }
  }

  if (normalized === 'in_progress') {
    return { background: '#eff6ff', color: '#2563eb' }
  }

  if (normalized === 'completed' || normalized === 'delivered' || normalized === 'ready_for_delivery') {
    return { background: '#f0fdf4', color: '#15803d' }
  }

  return { background: '#fff7ed', color: '#ea580c' }
}

function getExistingJobCardId(b: BookingRow) {
  return b.jobCard?.id || b.job_card?.id || ''
}

function getBookingIds(b: BookingRow) {
  return {
    dealerId: b.dealerId || b.dealer_id || b.dealer?.id || '',
    customerId: b.customerId || b.customer_id || b.customer?.id || '',
    vehicleId: b.vehicleId || b.vehicle_id || b.vehicle?.id || '',
  }
}

function getReportedIssuesObject(b: BookingRow): ReportedIssues {
  const reported = b.reportedIssues || b.reported_issues

  if (typeof reported === 'string') {
    try {
      const parsed = JSON.parse(reported)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return { issues: reported }
    }
  }

  if (reported && typeof reported === 'object') {
    return reported
  }

  return {}
}

function getBookingOdometerKm(b: BookingRow) {
  const reported = getReportedIssuesObject(b)

  const raw =
    b.odometerKm ??
    b.odometer_km ??
    reported.odometer_km ??
    reported.odometerKm ??
    b.vehicle?.odometerKm ??
    b.vehicle?.odometer_km

  const value = Number(raw)

  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

export default function DealerBookingsPage() {
  const navigate = useNavigate()
  const { user } = useDealerAuth()

  const [centerName, setCenterName] = useState('')
  const [centerCity, setCenterCity] = useState('')
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    const resolved = await resolveDealerServiceCenter(user, 'id,name,city,phone')

    if (!resolved.center) {
      setBookings([])
      setError(resolved.error || 'No dealer workshop is linked to this account yet.')
      setLoading(false)
      return
    }

    setCenterName(resolved.center.name)
    setCenterCity(resolved.center.city || '')

    const data = await safeGet<BookingRow[]>(
      `/api/bookings?dealerId=${encodeURIComponent(resolved.center.id)}&limit=200`,
      [],
    )

    setBookings(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const updateStatus = async (bookingId: string, status: string, note: string) => {
    setActionLoading(`${bookingId}:${status}`)
    setError('')

    try {
      await api.patch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
        status,
        note,
      })

      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update booking status.')
    } finally {
      setActionLoading('')
    }
  }

  const cancelBooking = async (bookingId: string) => {
    const ok = window.confirm('Cancel this booking?')
    if (!ok) return

    setActionLoading(`${bookingId}:cancelled`)
    setError('')

    try {
      await api.post(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {})
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking.')
    } finally {
      setActionLoading('')
    }
  }

  const openJobCard = async (booking: BookingRow) => {
    setActionLoading(`${booking.id}:jobcard`)
    setError('')

    try {
      const bookingDetail = await safeGet<BookingDetail | null>(
        `/api/bookings/${encodeURIComponent(booking.id)}`,
        null,
      )

      const fullBooking = bookingDetail || booking
      const existingJobCardId = getExistingJobCardId(fullBooking)

      if (existingJobCardId) {
        navigate(`/dealer/job-cards/${encodeURIComponent(existingJobCardId)}`)
        return
      }

      const ids = getBookingIds(fullBooking)

      if (!ids.dealerId || !ids.customerId || !ids.vehicleId) {
        throw new Error('Booking is missing dealer/customer/vehicle details. Refresh and try again.')
      }

      const odometerKm = getBookingOdometerKm(fullBooking)

      const createdJob = await api.post<CreatedJobCard>('/api/job-cards', {
        bookingId: fullBooking.id,
        dealerId: ids.dealerId,
        customerId: ids.customerId,
        vehicleId: ids.vehicleId,
        complaint: fullBooking.notes || `${serviceLabel(fullBooking)} job card`,
        odometerKm,
        priority: 3,
      })

      if (String(fullBooking.status || '').toLowerCase() !== 'in_progress') {
        await api.patch(`/api/bookings/${encodeURIComponent(fullBooking.id)}/status`, {
          status: 'in_progress',
          note: 'BikeAI tracking opened by dealer',
        })
      }

      await load()
      navigate(`/dealer/job-cards/${encodeURIComponent(createdJob.id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open job card.')
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Bookings</h1>
          <p style={s.sub}>
            {centerName ? `${centerName}${centerCity ? ` · ${centerCity}` : ''}` : 'Dealer booking queue'}
          </p>
        </div>

        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.card}>
        <div style={s.cardHead}>
          <div style={s.icon}>
            <Calendar size={20} />
          </div>

          <div>
            <h2 style={s.cardTitle}>Workshop Bookings</h2>
            <p style={s.cardSub}>{loading ? 'Loading...' : `${bookings.length} bookings found`}</p>
          </div>
        </div>

        {!loading && bookings.length === 0 ? (
          <div style={s.empty}>No bookings found for this workshop yet.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Customer</th>
                  <th style={s.th}>Phone</th>
                  <th style={s.th}>Vehicle</th>
                  <th style={s.th}>Registration</th>
                  <th style={s.th}>Service</th>
                  <th style={s.th}>Schedule</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((b) => {
                  const normalizedStatus = String(b.status || 'pending').toLowerCase()
                  const isPending = normalizedStatus === 'pending'
                  const isCancelled = normalizedStatus === 'cancelled'
                  const isConfirmed = normalizedStatus === 'confirmed'
                  const isInProgress = normalizedStatus === 'in_progress'
                  const canOpenJob = isConfirmed || isInProgress

                  const busyConfirm = actionLoading === `${b.id}:confirmed`
                  const busyCancel = actionLoading === `${b.id}:cancelled`
                  const busyJob = actionLoading === `${b.id}:jobcard`

                  return (
                    <tr key={b.id}>
                      <td style={s.td}>
                        <div style={s.primaryText}>{customerName(b)}</div>
                        {b.customer?.email && <div style={s.mutedText}>{b.customer.email}</div>}
                      </td>

                      <td style={s.td}>{b.customer?.phone || '-'}</td>

                      <td style={s.td}>
                        <div style={s.primaryText}>{vehicleName(b)}</div>
                      </td>

                      <td style={s.td}>{registrationNumber(b)}</td>

                      <td style={s.td}>{serviceLabel(b)}</td>

                      <td style={s.td}>{bookingDateTime(b)}</td>

                      <td style={s.td}>
                        <span style={{ ...s.badge, ...statusStyle(b.status) }}>
                          {formatStatus(b.status)}
                        </span>
                      </td>

                      <td style={s.td}>
                        <div style={s.actions}>
                          {isPending && (
                            <button
                              style={{ ...s.actionBtn, ...s.confirmBtn }}
                              disabled={Boolean(actionLoading)}
                              onClick={() => updateStatus(b.id, 'confirmed', 'Confirmed by dealer')}
                            >
                              <CheckCircle size={14} />
                              {busyConfirm ? 'Confirming...' : 'Confirm'}
                            </button>
                          )}

                          {canOpenJob && (
                            <button
                              style={{ ...s.actionBtn, ...s.jobBtn }}
                              disabled={Boolean(actionLoading)}
                              onClick={() => openJobCard(b)}
                            >
                              <ClipboardList size={14} />
                              {busyJob ? 'Opening...' : getExistingJobCardId(b) ? 'Open Tracking' : 'Create Tracking'}
                            </button>
                          )}

                          {!isCancelled && !isInProgress && (
                            <button
                              style={{ ...s.actionBtn, ...s.cancelBtn }}
                              disabled={Boolean(actionLoading)}
                              onClick={() => cancelBooking(b.id)}
                            >
                              <XCircle size={14} />
                              {busyCancel ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#071b4d',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '30px',
    fontWeight: 900,
  },
  sub: {
    margin: '8px 0 0',
    color: '#64748b',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: 'white',
    fontWeight: 800,
    cursor: 'pointer',
  },
  error: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    padding: '14px 16px',
    borderRadius: '10px',
    marginBottom: '18px',
  },
  card: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '22px',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
  },
  icon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#2563eb',
    display: 'grid',
    placeItems: 'center',
  },
  cardTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 900,
  },
  cardSub: {
    margin: '4px 0 0',
    color: '#64748b',
  },
  empty: {
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    padding: '28px',
    color: '#64748b',
  },
  tableWrap: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    minWidth: '980px',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 12px',
    borderTop: '1px solid #e2e8f0',
    fontSize: '14px',
    verticalAlign: 'top',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  primaryText: {
    fontWeight: 700,
    color: '#071b4d',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.35,
  },
  mutedText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#64748b',
  },
  badge: {
    display: 'inline-flex',
    padding: '5px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 10px',
    borderRadius: '9px',
    border: 'none',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  confirmBtn: {
    background: '#ecfdf5',
    color: '#16a34a',
  },
  jobBtn: {
    background: '#eff6ff',
    color: '#2563eb',
  },
  cancelBtn: {
    background: '#fef2f2',
    color: '#dc2626',
  },
}
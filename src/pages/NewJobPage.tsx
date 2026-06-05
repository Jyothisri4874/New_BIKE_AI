import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck, Navigation, Save, Search, MapPin, User, Phone } from 'lucide-react'
import { api, safeGet } from '../lib/api'

interface FormState {
  job_type: 'pickup' | 'delivery'
  customer_id: string
  booking_id: string
  rider_id: string
  customer_address: string
  customer_lat: string
  customer_lng: string
  scheduled_at: string
  eta_minutes: string
  notes: string
}

const EMPTY: FormState = {
  job_type: 'pickup',
  customer_id: '',
  booking_id: '',
  rider_id: '',
  customer_address: '',
  customer_lat: '',
  customer_lng: '',
  scheduled_at: '',
  eta_minutes: '',
  notes: '',
}

export default function NewJobPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [customers, setCustomers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    // TODO: Confirm backend endpoint for active riders list.
    const data = await safeGet<any[]>('/api/riders?isActive=true', [])
    setRiders(data || [])
  }

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q)
    if (q.length < 2) { setCustomers([]); return }
    // TODO: Confirm backend endpoint for searching customers by name/phone.
    const data = await safeGet<any[]>(
      `/api/crm/customers/search?q=${encodeURIComponent(q)}&limit=8`,
      [],
    )
    setCustomers(data || [])
  }

  const selectCustomer = async (c: any) => {
    setSelectedCustomer(c)
    setForm(prev => ({ ...prev, customer_id: c.id }))
    setCustomers([])
    setCustomerSearch(c.full_name)
    // TODO: Confirm backend endpoint for customer active bookings.
    const data = await safeGet<any[]>(
      `/api/bookings?customerId=${encodeURIComponent(c.id)}&status=confirmed,in_progress&order=scheduled_date.desc`,
      [],
    )
    setBookings(data || [])
  }

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer_id) { setError('Please select a customer'); return }
    setSaving(true)
    setError('')

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    try {
      // TODO: Confirm backend endpoint for creating pickup/delivery jobs.
      const data = await api.post<any>('/api/live-ops/jobs', {
        job_type: form.job_type,
        customer_id: form.customer_id,
        booking_id: form.booking_id || null,
        rider_id: form.rider_id || null,
        status: form.rider_id ? 'assigned' : 'pending',
        customer_address: form.customer_address || null,
        customer_lat: form.customer_lat ? parseFloat(form.customer_lat) : null,
        customer_lng: form.customer_lng ? parseFloat(form.customer_lng) : null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        eta_minutes: form.eta_minutes ? parseInt(form.eta_minutes) : null,
        otp_code: otp,
      })

      if (form.rider_id && data?.id) {
        // TODO: Confirm backend endpoint for updating rider availability.
        await api.patch(`/api/riders/${encodeURIComponent(form.rider_id)}`, { is_available: false, current_job_id: data.id }).catch(() => {})
      }
      navigate(data?.id ? `/live-ops/job/${data.id}` : '/live-ops')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
      return
    }
  }

  const availableRiders = riders.filter(r => r.is_available)

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button onClick={() => navigate('/live-ops')} style={S.backBtn}>
          <ArrowLeft size={15} /> Live Operations
        </button>
        <h2 style={S.title}>Create New Job</h2>
      </div>

      <form onSubmit={handleSubmit} style={S.form}>
        {error && <div style={S.errorBanner}>{error}</div>}

        {/* Job type */}
        <div style={S.section}>
          <div style={S.secHdr}>Job Type</div>
          <div style={S.secBody}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['pickup', 'delivery'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('job_type', t)}
                  style={{
                    ...S.typeBtn,
                    background: form.job_type === t ? '#0f2044' : 'white',
                    color: form.job_type === t ? 'white' : '#6b7595',
                    border: form.job_type === t ? '2px solid #0f2044' : '2px solid #e2e6f0',
                  }}
                >
                  {t === 'pickup' ? <Truck size={16} /> : <Navigation size={16} />}
                  <span style={{ fontWeight: '700', textTransform: 'capitalize' }}>{t}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{t === 'pickup' ? 'Collect from customer' : 'Deliver to customer'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customer */}
        <div style={S.section}>
          <div style={S.secHdr}><User size={13} /> Customer</div>
          <div style={S.secBody}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9aa3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                value={customerSearch}
                onChange={e => searchCustomers(e.target.value)}
                placeholder="Search customer by name or phone..."
                style={{ ...S.input, paddingLeft: '32px' }}
              />
            </div>
            {customers.length > 0 && (
              <div style={S.dropdown}>
                {customers.map(c => (
                  <div key={c.id} onClick={() => selectCustomer(c)} style={S.dropdownItem}>
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044' }}>{c.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#9aa3b8' }}>{c.phone} {c.city ? `· ${c.city}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div style={S.selectedCustomer}>
                <User size={13} color="#16a34a" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f2044' }}>{selectedCustomer.full_name}</span>
                <span style={{ fontSize: '12px', color: '#9aa3b8' }}>{selectedCustomer.phone}</span>
              </div>
            )}
            {bookings.length > 0 && (
              <div>
                <label style={S.label}>Link to Booking (optional)</label>
                <select value={form.booking_id} onChange={e => set('booking_id', e.target.value)} style={S.select}>
                  <option value="">No booking linked</option>
                  {bookings.map(b => (
                    <option key={b.id} value={b.id}>{b.service_type?.replace(/_/g, ' ')} — {b.scheduled_date} ({b.status})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div style={S.section}>
          <div style={S.secHdr}><MapPin size={13} /> {form.job_type === 'pickup' ? 'Pickup' : 'Delivery'} Location</div>
          <div style={S.secBody}>
            <div>
              <label style={S.label}>Address</label>
              <input value={form.customer_address} onChange={e => set('customer_address', e.target.value)} placeholder="Full address" style={S.input} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Latitude (optional)</label>
                <input value={form.customer_lat} onChange={e => set('customer_lat', e.target.value)} placeholder="12.9716" style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Longitude (optional)</label>
                <input value={form.customer_lng} onChange={e => set('customer_lng', e.target.value)} placeholder="77.5946" style={S.input} />
              </div>
            </div>
          </div>
        </div>

        {/* Rider assignment */}
        <div style={S.section}>
          <div style={S.secHdr}><Navigation size={13} /> Rider Assignment</div>
          <div style={S.secBody}>
            <div>
              <label style={S.label}>Assign Rider (optional — can assign later)</label>
              <select value={form.rider_id} onChange={e => set('rider_id', e.target.value)} style={S.select}>
                <option value="">Unassigned (assign later)</option>
                {availableRiders.map(r => (
                  <option key={r.id} value={r.id}>{r.name} — {r.rider_type.replace(/_/g, ' ')} · {r.vehicle_number}</option>
                ))}
              </select>
              {availableRiders.length === 0 && <p style={{ fontSize: '12px', color: '#9aa3b8', marginTop: '4px' }}>No available riders right now</p>}
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div style={S.section}>
          <div style={S.secHdr}><Phone size={13} /> Schedule & ETA</div>
          <div style={S.secBody}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={S.label}>Scheduled At</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} style={S.input} />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={S.label}>ETA (minutes)</label>
                <input type="number" value={form.eta_minutes} onChange={e => set('eta_minutes', e.target.value)} placeholder="30" style={S.input} min={1} />
              </div>
            </div>
          </div>
        </div>

        <div style={S.actions}>
          <button type="button" onClick={() => navigate('/live-ops')} style={S.cancelBtn}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '700px' },
  topBar:     { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn:    { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  title:      { fontSize: '20px', fontWeight: '800', color: '#0f2044', margin: 0 },
  form:       { display: 'flex', flexDirection: 'column', gap: '12px' },
  errorBanner:{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13.5px' },
  section:    { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden' },
  secHdr:     { display: 'flex', alignItems: 'center', gap: '7px', padding: '13px 16px', background: '#fafbfd', borderBottom: '1px solid #f1f3f8', fontSize: '13.5px', fontWeight: '700', color: '#0f2044' },
  secBody:    { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  label:      { display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#6b7595', marginBottom: '5px' },
  input:      { width: '100%', padding: '8px 11px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', boxSizing: 'border-box' },
  select:     { width: '100%', padding: '8px 11px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  typeBtn:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '16px 12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  dropdown:   { background: 'white', border: '1.5px solid #e2e6f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(15,32,68,0.08)' },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f3f8' },
  selectedCustomer: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '8px' },
  actions:    { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn:  { padding: '10px 20px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn:    { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', background: '#0f2044', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
}

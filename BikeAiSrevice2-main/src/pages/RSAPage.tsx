import { useEffect, useState } from 'react'
import {
  Shield, Plus, Phone, MapPin, Truck,
  Clock, Navigation, X, Search
} from 'lucide-react'
import { api, safeGet } from '../lib/api'

const BREAKDOWN_TYPES = [
  { value: 'breakdown',   label: 'Breakdown',     color: '#dc2626' },
  { value: 'puncture',    label: 'Puncture',      color: '#d97706' },
  { value: 'battery_dead',label: 'Battery Dead',  color: '#7c3aed' },
  { value: 'fuel_empty',  label: 'Fuel Empty',    color: '#0284c7' },
  { value: 'accident',    label: 'Accident',      color: '#dc2626' },
  { value: 'other',       label: 'Other',         color: '#6b7595' },
]

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  open:     { label: 'Open',     bg: '#fef2f2', color: '#dc2626' },
  assigned: { label: 'Assigned', bg: '#eef2f8', color: '#0f2044' },
  en_route: { label: 'En Route', bg: '#eff6ff', color: '#2563eb' },
  arrived:  { label: 'Arrived',  bg: '#f0f9ff', color: '#0284c7' },
  resolved: { label: 'Resolved', bg: '#f0fdf4', color: '#16a34a' },
  cancelled:{ label: 'Cancelled',bg: '#f9fafb', color: '#6b7595' },
}

interface NewRSAForm {
  customer_name: string
  customer_phone: string
  breakdown_type: string
  customer_address: string
  complaint: string
  towing_required: boolean
  rider_id: string
}

export default function RSAPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  useEffect(() => { load() }, [])

  const load = async () => {
    // TODO: Confirm backend endpoints for RSA requests list + RSA riders list.
    const [rsaData, ridersData] = await Promise.all([
      safeGet<any[]>('/api/rsa/requests?order=created_at.desc', []),
      safeGet<any[]>('/api/riders?riderType=rsa&isActive=true', []),
    ])
    setRequests(rsaData || [])
    setRiders(ridersData || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }
    if (status === 'assigned') updates.assigned_at = new Date().toISOString()
    if (status === 'arrived')  updates.arrived_at = new Date().toISOString()
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()
    // TODO: Confirm backend endpoint for updating RSA request status.
    await api.patch(`/api/rsa/requests/${encodeURIComponent(id)}`, updates).catch(() => {})
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const assignRider = async (rsaId: string, riderId: string) => {
    if (!riderId) return
    // TODO: Confirm backend endpoints for assigning RSA rider + updating rider availability.
    await api.patch(`/api/rsa/requests/${encodeURIComponent(rsaId)}`, {
      rider_id: riderId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(() => {})
    await api.patch(`/api/riders/${encodeURIComponent(riderId)}`, { is_available: false }).catch(() => {})
    load()
  }

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) || r.profiles?.phone?.includes(search)
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !['resolved', 'cancelled'].includes(r.status) : r.status === statusFilter)
    return matchSearch && matchStatus
  })

  const openCount = requests.filter(r => r.status === 'open').length
  const activeCount = requests.filter(r => !['resolved', 'cancelled'].includes(r.status)).length
  const availableRSARiders = riders.filter(r => r.is_available)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {openCount > 0 && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', animation: 'ping 1.5s infinite' }} />}
            <h2 style={S.title}>Roadside Assistance</h2>
          </div>
          <p style={S.sub}>RSA requests, breakdown support & emergency coordination</p>
        </div>
        <button onClick={() => setShowNew(true)} style={S.addBtn}>
          <Plus size={14} /> New RSA Request
        </button>
      </div>
      <style>{`@keyframes ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.8)}}`}</style>

      {/* KPIs */}
      <div style={S.kpiRow}>
        <RSAKpi label="Open" value={openCount} color="#dc2626" bg="#fef2f2" />
        <RSAKpi label="Active" value={activeCount} color="#d97706" bg="#fffbeb" />
        <RSAKpi label="RSA Riders" value={riders.length} color="#0f2044" bg="#eef2f8" />
        <RSAKpi label="Available" value={availableRSARiders.length} color="#16a34a" bg="#f0fdf4" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={13} color="#9aa3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer..." style={S.searchInput} />
        </div>
        {['active', 'open', 'assigned', 'en_route', 'resolved', 'all'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            ...S.filterBtn,
            background: statusFilter === s ? '#0f2044' : 'white',
            color: statusFilter === s ? 'white' : '#6b7595',
            border: statusFilter === s ? '1px solid #0f2044' : '1px solid #e2e6f0',
          }}>
            {s === 'active' ? 'Active' : STATUS_META[s]?.label || s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa3b8' }}>
              <Shield size={32} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
              <p>No RSA requests found</p>
            </div>
          )}
          {filtered.map(r => (
            <RSACard key={r.id} request={r} riders={riders} onStatusChange={updateStatus} onAssignRider={assignRider} />
          ))}
        </div>
      )}

      {/* New RSA modal */}
      {showNew && <NewRSAModal riders={availableRSARiders} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

function RSACard({ request: r, riders, onStatusChange, onAssignRider }: {
  request: any; riders: any[];
  onStatusChange: (id: string, status: string) => void;
  onAssignRider: (rsaId: string, riderId: string) => void;
}) {
  const [selectedRider, setSelectedRider] = useState('')
  const meta = STATUS_META[r.status] || STATUS_META.open
  const btypes = BREAKDOWN_TYPES.find(b => b.value === r.breakdown_type)
  const NEXT: Record<string, string[]> = {
    open:     ['assigned', 'cancelled'],
    assigned: ['en_route'],
    en_route: ['arrived'],
    arrived:  ['resolved'],
  }
  const nextOps = NEXT[r.status] || []

  return (
    <div style={{ background: 'white', border: `1px solid ${r.status === 'open' ? '#fecaca' : '#e2e6f0'}`, borderRadius: '12px', padding: '14px 16px', borderLeft: `3px solid ${meta.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044' }}>{r.profiles?.full_name || 'Customer'}</span>
            <span style={{ ...S.pill, background: meta.bg, color: meta.color }}>{meta.label}</span>
            {btypes && <span style={{ ...S.pill, background: `${btypes.color}12`, color: btypes.color }}>{btypes.label}</span>}
            {r.towing_required && <span style={{ ...S.pill, background: '#fef2f2', color: '#dc2626' }}>Towing Required</span>}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7595' }}>
            {r.profiles?.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{r.profiles.phone}</span>}
            {r.customer_address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} />{r.customer_address}</span>}
            {r.riders?.name && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={11} />Rider: {r.riders.name}</span>}
            {r.eta_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} />ETA: {r.eta_minutes} min</span>}
          </div>
          {r.complaint && <p style={{ fontSize: '12.5px', color: '#6b7595', marginTop: '5px', fontStyle: 'italic' }}>"{r.complaint}"</p>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {r.profiles?.phone && (
            <a href={`tel:${r.profiles.phone}`} style={S.callBtn}><Phone size={12} /></a>
          )}
          {r.profiles?.phone && (
            <a href={`https://wa.me/${r.profiles.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ ...S.callBtn, background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
              <span style={{ fontSize: '11px', fontWeight: '700' }}>WA</span>
            </a>
          )}
        </div>
      </div>

      {/* Rider assignment */}
      {!r.rider_id && r.status === 'open' && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f3f8' }}>
          <select value={selectedRider} onChange={e => setSelectedRider(e.target.value)} style={S.select}>
            <option value="">Assign RSA rider</option>
            {riders.filter(rd => rd.is_available).map(rd => (
              <option key={rd.id} value={rd.id}>{rd.name} · {rd.vehicle_number}</option>
            ))}
          </select>
          <button onClick={() => selectedRider && onAssignRider(r.id, selectedRider)} disabled={!selectedRider} style={{ ...S.assignBtn, opacity: selectedRider ? 1 : 0.5 }}>
            Assign
          </button>
        </div>
      )}

      {/* Status actions */}
      {nextOps.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f3f8', flexWrap: 'wrap' }}>
          {nextOps.map(ns => (
            <button key={ns} onClick={() => onStatusChange(r.id, ns)} style={{
              padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
              background: STATUS_META[ns]?.bg || '#f9fafb',
              color: STATUS_META[ns]?.color || '#6b7595',
              border: `1px solid ${STATUS_META[ns]?.color || '#e2e6f0'}30`,
            }}>
              {STATUS_META[ns]?.label || ns.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NewRSAModal({ riders, onClose, onCreated }: { riders: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<NewRSAForm>({
    customer_name: '', customer_phone: '', breakdown_type: 'breakdown',
    customer_address: '', complaint: '', towing_required: false, rider_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q)
    if (q.length < 2) { setCustomers([]); return }
    // TODO: Confirm backend endpoint for searching customers in RSA modal.
    const data = await safeGet<any[]>(
      `/api/crm/customers/search?q=${encodeURIComponent(q)}&limit=6`,
      [],
    )
    setCustomers(data || [])
  }

  const set = (field: keyof NewRSAForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer_phone && !selectedCustomerId) { setError('Customer phone or selection required'); return }
    setSaving(true)
    setError('')
    try {
      // TODO: Confirm backend endpoint for creating RSA request.
      await api.post('/api/rsa/requests', {
        customer_id: selectedCustomerId || null,
        customer_phone: form.customer_phone || null,
        customer_name: form.customer_name || null,
        rider_id: form.rider_id || null,
        status: form.rider_id ? 'assigned' : 'open',
        breakdown_type: form.breakdown_type,
        customer_address: form.customer_address || null,
        complaint: form.complaint || null,
        towing_required: form.towing_required,
        assigned_at: form.rider_id ? new Date().toISOString() : null,
      })
      if (form.rider_id) await api.patch(`/api/riders/${encodeURIComponent(form.rider_id)}`, { is_available: false }).catch(() => {})
      onCreated()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
      return
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} color="#dc2626" />
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f2044' }}>New RSA Request</span>
          </div>
          <button onClick={onClose} style={S.closeBtn}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

          <div>
            <label style={S.label}>Find Customer</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9aa3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={customerSearch} onChange={e => searchCustomers(e.target.value)} placeholder="Search by name or phone..." style={{ ...S.input, paddingLeft: '30px' }} />
            </div>
            {customers.length > 0 && (
              <div style={{ border: '1px solid #e2e6f0', borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                {customers.map(c => (
                  <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.full_name); set('customer_phone', c.phone); setCustomers([]) }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f8', fontSize: '13px' }}>
                    <span style={{ fontWeight: '600', color: '#0f2044' }}>{c.full_name}</span> · <span style={{ color: '#9aa3b8' }}>{c.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={S.label}>Breakdown Type *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {BREAKDOWN_TYPES.map(bt => (
                <button key={bt.value} type="button" onClick={() => set('breakdown_type', bt.value)}
                  style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', background: form.breakdown_type === bt.value ? bt.color : 'white', color: form.breakdown_type === bt.value ? 'white' : '#6b7595', border: `1px solid ${form.breakdown_type === bt.value ? bt.color : '#e2e6f0'}` }}>
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={S.label}>Customer Location</label>
            <input value={form.customer_address} onChange={e => set('customer_address', e.target.value)} placeholder="Address or landmark" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Complaint / Details</label>
            <textarea value={form.complaint} onChange={e => set('complaint', e.target.value)} placeholder="Describe the issue..." rows={3} style={{ ...S.input, resize: 'vertical' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.towing_required} onChange={e => set('towing_required', e.target.checked)} />
            <Truck size={14} color="#dc2626" /> Towing Required
          </label>

          <div>
            <label style={S.label}>Assign RSA Rider (optional)</label>
            <select value={form.rider_id} onChange={e => set('rider_id', e.target.value)} style={S.select}>
              <option value="">Assign later</option>
              {riders.map(r => <option key={r.id} value={r.id}>{r.name} · {r.vehicle_number}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating...' : 'Create RSA Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RSAKpi({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '14px 20px', flex: 1, minWidth: '100px' }}>
      <div style={{ fontSize: '26px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: '#9aa3b8', marginTop: '3px' }}>{label}</div>
      <div style={{ height: '3px', borderRadius: '2px', background: bg, marginTop: '8px' }} />
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
      <div style={{ width: '26px', height: '26px', border: '3px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', flexDirection: 'column', gap: '18px' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  title:      { fontSize: '22px', fontWeight: '800', color: '#0f2044', letterSpacing: '-0.3px', margin: 0 },
  sub:        { fontSize: '12.5px', color: '#9aa3b8', marginTop: '2px' },
  addBtn:     { display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  kpiRow:     { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  searchInput:{ width: '100%', padding: '8px 12px 8px 32px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', boxSizing: 'border-box' },
  filterBtn:  { padding: '7px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  pill:       { fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px' },
  callBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0284c7', textDecoration: 'none', cursor: 'pointer', flexShrink: 0 },
  select:     { flex: 1, padding: '8px 10px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  assignBtn:  { padding: '8px 14px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,32,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' },
  modal:      { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(15,32,68,0.2)' },
  modalHdr:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f1f3f8' },
  closeBtn:   { width: '32px', height: '32px', background: '#f9fafb', border: '1px solid #e2e6f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7595', fontFamily: 'inherit' },
  label:      { display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#6b7595', marginBottom: '5px' },
  input:      { width: '100%', padding: '8px 11px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', boxSizing: 'border-box' },
  cancelBtn:  { padding: '9px 18px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn:    { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#dc2626', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
}

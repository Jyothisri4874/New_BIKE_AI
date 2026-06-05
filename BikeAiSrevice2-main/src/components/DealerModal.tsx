import { useState, FormEvent } from 'react'
import { Dealer } from '../types'
import { X, Building2, MapPin, Wrench } from 'lucide-react'
import WorkshopConfig, { WorkshopConfigValue } from './WorkshopConfig'
import { api } from '../lib/api'

interface Props {
  dealer: Dealer | null
  onClose: () => void
  onSave: () => void
}

const TABS = [
  { id: 'basic',    label: 'Basic Info',      icon: Building2 },
  { id: 'services', label: 'Workshop Config', icon: Wrench },
  { id: 'location', label: 'Location',        icon: MapPin },
]

function dealerToConfig(dealer: Dealer | null): WorkshopConfigValue {
  return {
    workshopServices:  dealer?.workshop_services  ?? {},
    facilities:        dealer?.facilities         ?? [],
    capabilityTags:    dealer?.capability_tags    ?? [],
    supportedOems:     dealer?.supported_oems     ?? dealer?.brands ?? [],
    supportedSegments: dealer?.supported_segments ?? [],
    workshopType:      dealer?.workshop_type      ?? 'multi_brand',
  }
}

export default function DealerModal({ dealer, onClose, onSave }: Props) {
  const isEdit = !!dealer
  const [tab, setTab] = useState('basic')
  const [form, setForm] = useState({
    name:        dealer?.name        || '',
    address:     dealer?.address     || '',
    city:        dealer?.city        || '',
    state:       dealer?.state       || '',
    pincode:     dealer?.pincode     || '',
    phone:       dealer?.phone       || '',
    email:       dealer?.email       || '',
    gst_number:  dealer?.gst_number  || '',
    description: dealer?.description || '',
    open_time:   dealer?.open_time   || '09:00',
    close_time:  dealer?.close_time  || '18:00',
    status:      dealer?.status      || 'pending',
    lat:         String(dealer?.lat  ?? ''),
    lng:         String(dealer?.lng  ?? ''),
  })
  const [config, setConfig] = useState<WorkshopConfigValue>(dealerToConfig(dealer))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const allServices = Object.values(config.workshopServices).flat()
    const payload = {
      ...form,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      brands:             config.supportedOems,
      services:           allServices,
      workshop_services:  config.workshopServices,
      facilities:         config.facilities,
      capability_tags:    config.capabilityTags,
      supported_oems:     config.supportedOems,
      supported_segments: config.supportedSegments,
      workshop_type:      config.workshopType,
      is_ev_capable:
        config.capabilityTags.includes('ev-certified') ||
        config.supportedOems.some(o => ['ola','ather','ultraviolette','revolt'].includes(o)),
      is_rsa_enabled:       config.capabilityTags.includes('rsa-enabled'),
      is_pickup_available:
        config.facilities.includes('pickup-drop') ||
        config.capabilityTags.includes('pickup-available'),
      is_express_center:    config.capabilityTags.includes('express-center'),
    }

    try {
      // TODO: Confirm backend endpoints for service center create/update.
      if (isEdit) await api.patch(`/api/service-centers/${dealer!.id}`, payload)
      else await api.post('/api/service-centers', payload)
      onSave()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  const totalServices = Object.values(config.workshopServices).reduce((s, a) => s + a.length, 0)

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>{isEdit ? 'Edit Dealer' : 'Add New Dealer'}</h3>
            <p style={styles.modalSub}>Configure complete workshop profile</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Tab nav */}
        <div style={styles.tabNav}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                ...styles.tabBtn,
                borderBottom: tab === t.id ? '2px solid #0f2044' : '2px solid transparent',
                color: tab === t.id ? '#0f2044' : '#6b7280',
                fontWeight: tab === t.id ? '600' : '400',
              }}
            >
              <t.icon size={14} />
              {t.label}
              {t.id === 'services' && totalServices > 0 && (
                <span style={styles.tabBadge}>{totalServices}</span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.modalBody}>
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* ── Basic Info ── */}
          {tab === 'basic' && (
            <div style={styles.formSection}>
              <div style={styles.grid2}>
                <Field label="Dealer Name *" value={form.name} onChange={v => set('name', v)} required />
                <Field label="Phone *" value={form.phone} onChange={v => set('phone', v)} required />
                <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
                <Field label="GST Number" value={form.gst_number} onChange={v => set('gst_number', v)} />
              </div>
              <div style={styles.grid2}>
                <Field label="Opening Time" value={form.open_time} onChange={v => set('open_time', v)} type="time" />
                <Field label="Closing Time" value={form.close_time} onChange={v => set('close_time', v)} type="time" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={styles.select}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={3}
                  style={styles.textarea}
                  placeholder="Brief description of the dealer..."
                />
              </div>
            </div>
          )}

          {/* ── Workshop Config ── */}
          {tab === 'services' && (
            <WorkshopConfig value={config} onChange={setConfig} />
          )}

          {/* ── Location ── */}
          {tab === 'location' && (
            <div style={styles.formSection}>
              <Field label="Address" value={form.address} onChange={v => set('address', v)} />
              <div style={styles.grid3}>
                <Field label="City *" value={form.city} onChange={v => set('city', v)} required />
                <Field label="State" value={form.state} onChange={v => set('state', v)} />
                <Field label="Pincode" value={form.pincode} onChange={v => set('pincode', v)} />
              </div>
              <div style={styles.grid2}>
                <Field label="Latitude" value={form.lat} onChange={v => set('lat', v)} placeholder="e.g. 17.3850" />
                <Field label="Longitude" value={form.lng} onChange={v => set('lng', v)} placeholder="e.g. 78.4867" />
              </div>
              <div style={styles.mapHint}>
                <MapPin size={14} color="#9ca3af" />
                <span>Coordinates are used for live maps, RSA dispatch, and nearby workshop discovery.</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              {tab !== 'location' && (
                <button
                  type="button"
                  onClick={() => setTab(tab === 'basic' ? 'services' : 'location')}
                  style={styles.nextBtn}
                >
                  Next
                </button>
              )}
              <button type="submit" disabled={loading} style={styles.saveBtn}>
                {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Dealer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, required, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modal:       { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalTitle:  { fontSize: '17px', fontWeight: '700', color: '#111827', marginBottom: '2px' },
  modalSub:    { fontSize: '12.5px', color: '#9ca3af' },
  closeBtn:    { width: '32px', height: '32px', background: '#f3f4f6', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0 },
  tabNav:      { display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px', gap: '0', flexShrink: 0 },
  tabBtn:      { display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '13.5px', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tabBadge:    { padding: '1px 6px', background: '#0f2044', color: 'white', borderRadius: '10px', fontSize: '10px', fontWeight: '700' },
  modalBody:   { padding: '20px 24px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0', flex: 1 },
  formSection: { display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' },
  errorBox:    { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '12px' },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  grid3:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' },
  field:       { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:       { fontSize: '13px', fontWeight: '500', color: '#374151' },
  input:       { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#111827' },
  select:      { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#111827', background: 'white' },
  textarea:    { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#111827', resize: 'vertical' },
  mapHint:     { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', lineHeight: '1.5' },
  modalFooter: { display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e5e7eb', marginTop: 'auto', flexShrink: 0 },
  cancelBtn:   { padding: '9px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontWeight: '500', cursor: 'pointer', color: '#374151' },
  nextBtn:     { padding: '9px 18px', background: '#f1f3f8', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontWeight: '500', cursor: 'pointer', color: '#0f2044' },
  saveBtn:     { padding: '9px 20px', background: '#0f2044', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', color: 'white' },
}

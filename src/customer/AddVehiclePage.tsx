import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { useCustomerAuth } from '../hooks/useCustomerAuth'
import { ArrowLeft, Save } from 'lucide-react'

interface OEM { id: string; name: string }
interface Model { id: string; name: string; oem_id: string; fuel_types?: string[] }

export default function AddVehiclePage() {
  const { user } = useCustomerAuth()
  const navigate = useNavigate()
  const [oems, setOems] = useState<OEM[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [loadingOems, setLoadingOems] = useState(true)
  const [loadingModels, setLoadingModels] = useState(false)

  const [form, setForm] = useState({
    nickname: '',
    registration_number: '',
    oem_id: '',
    model_id: '',
    manufacturing_year: new Date().getFullYear(),
    fuel_type: 'petrol',
    color: '',
    odometer_km: 0,
    purchase_date: '',
    insurance_expiry: '',
    puc_expiry: '',
    warranty_expiry: '',
    amc_expiry: '',
    is_primary: false,
  })

  useEffect(() => {
    let active = true
    setLoadingOems(true)
    apiGet<OEM[]>('/api/vehicle-oems')
      .then((data) => {
        if (!active) return
        setOems(data || [])
        setDataError(data?.length ? '' : 'Vehicle OEM data missing: seed active vehicle_oems rows.')
      })
      .catch((e: unknown) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setDataError(`Vehicle OEM data unavailable: ${msg}`)
        setOems([])
      })
      .finally(() => {
        if (!active) return
        setLoadingOems(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!form.oem_id) { setModels([]); return }
    let active = true
    setModels([])
    setLoadingModels(true)
    apiGet<Model[]>(`/api/vehicle-models?oemId=${encodeURIComponent(form.oem_id)}`)
      .then((data) => {
        if (!active) return
        setModels(data || [])
        setDataError(data?.length ? '' : 'Vehicle model data missing: seed active vehicle_models rows for the selected OEM.')
      })
      .catch((e: unknown) => {
        if (!active) return
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setDataError(`Vehicle model data unavailable: ${msg}`)
        setModels([])
      })
      .finally(() => {
        if (!active) return
        setLoadingModels(false)
      })
    return () => { active = false }
  }, [form.oem_id])

  const set = (key: string, value: string | number | boolean) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!form.registration_number.trim()) { setError('Registration number is required'); return }
    setSaving(true)
    setError('')

    const { error: err } = await apiPost('/api/customer-vehicles', {
      customerId: user.id,
      nickname: form.nickname,
      registrationNumber: form.registration_number,
      oemId: form.oem_id || null,
      modelId: form.model_id || null,
      manufacturingYear: form.manufacturing_year,
      fuelType: form.fuel_type,
      color: form.color,
      odometerKm: Number(form.odometer_km || 0),
    })

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      navigate('/my/garage')
    }
  }

  const years = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div>
          <h1 style={s.title}>Add Vehicle</h1>
          <p style={s.sub}>Add your bike to your personal garage</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>
        {(error || dataError) && <div style={s.errorBox}>{error || dataError}</div>}

        <Section title="Basic Information">
          <Row>
            <Field label="Nickname (optional)">
              <input style={s.input} value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="My Splendor, Wifey's Scooty..." />
            </Field>
            <Field label="Registration Number *">
              <input style={s.input} value={form.registration_number} onChange={e => set('registration_number', e.target.value.toUpperCase())} placeholder="MH12AB1234" required />
            </Field>
          </Row>
          <Row>
            <Field label="Brand / OEM">
              <select style={s.input} value={form.oem_id} onChange={e => { set('oem_id', e.target.value); set('model_id', '') }} disabled={loadingOems || oems.length === 0}>
                <option value="">{loadingOems ? 'Loading brands...' : oems.length ? 'Select Brand' : 'No active brands available'}</option>
                {oems.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Model">
              <select style={s.input} value={form.model_id} onChange={e => set('model_id', e.target.value)} disabled={!form.oem_id || loadingModels || models.length === 0}>
                <option value="">
                  {!form.oem_id ? 'Select brand first' : loadingModels ? 'Loading models...' : models.length ? 'Select Model' : 'No active models available'}
                </option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Year of Manufacture">
              <select style={s.input} value={form.manufacturing_year} onChange={e => set('manufacturing_year', parseInt(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Fuel Type">
              <select style={s.input} value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)}>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="cng">CNG</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Color">
              <input style={s.input} value={form.color} onChange={e => set('color', e.target.value)} placeholder="Red, Black, White..." />
            </Field>
            <Field label="Current Odometer (km)">
              <input style={s.input} type="number" min={0} value={form.odometer_km} onChange={e => set('odometer_km', parseInt(e.target.value) || 0)} />
            </Field>
          </Row>
          <Row>
            <Field label="Purchase Date">
              <input style={s.input} type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
            </Field>
            <div />
          </Row>
        </Section>

        <Section title="Documents & Expiry Dates">
          <Row>
            <Field label="Insurance Expiry">
              <input style={s.input} type="date" value={form.insurance_expiry} onChange={e => set('insurance_expiry', e.target.value)} />
            </Field>
            <Field label="PUC Expiry">
              <input style={s.input} type="date" value={form.puc_expiry} onChange={e => set('puc_expiry', e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Warranty Expiry">
              <input style={s.input} type="date" value={form.warranty_expiry} onChange={e => set('warranty_expiry', e.target.value)} />
            </Field>
            <Field label="AMC Expiry">
              <input style={s.input} type="date" value={form.amc_expiry} onChange={e => set('amc_expiry', e.target.value)} />
            </Field>
          </Row>
        </Section>

        <Section title="Preferences">
          <label style={s.checkLabel}>
            <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} style={s.checkbox} />
            Set as primary vehicle (used by default for bookings)
          </label>
        </Section>

        <div style={s.actions}>
          <button type="button" style={s.cancelBtn} onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving...' : <><Save size={15} /> Save Vehicle</>}
          </button>
        </div>
      </form>

      <style>{`input:focus, select:focus { outline:none!important; border-color:#f5a623!important; box-shadow:0 0 0 3px rgba(245,166,35,0.15)!important; }`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f2044', margin: 0, paddingBottom: '10px', borderBottom: '1px solid #f0f2f8' }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px' },
  header: { display: 'flex', alignItems: 'center', gap: '14px' },
  backBtn: { background: '#f5f7fa', border: 'none', borderRadius: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  title: { fontSize: '22px', fontWeight: '800', color: '#0f2044', margin: '0 0 2px' },
  sub: { fontSize: '13px', color: '#9aa3b8', margin: 0 },
  form: { background: 'white', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
  errorBox: { padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9px', color: '#dc2626', fontSize: '13px' },
  input: { padding: '10px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', color: '#0f2044', background: 'white', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxSizing: 'border-box' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#333', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#f5a623' },
  actions: { display: 'flex', gap: '12px', paddingTop: '8px' },
  cancelBtn: { padding: '11px 24px', background: '#f5f7fa', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#555', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 28px', background: '#0f2044', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', color: 'white', cursor: 'pointer' },
}

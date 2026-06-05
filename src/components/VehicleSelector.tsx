import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { VehicleOEM, VehicleModel, VehicleSelection, OEM_COLORS, FUEL_TYPE_LABELS, getYearRange, SERVICE_CATEGORIES } from '../types/vehicle'
import { Search, ChevronDown, Zap, CircleCheck as CheckCircle } from 'lucide-react'

interface Props {
  value: VehicleSelection
  onChange: (v: VehicleSelection) => void
}

export default function VehicleSelector({ value, onChange }: Props) {
  const [oems, setOems] = useState<VehicleOEM[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [oemSearch, setOemSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [loadingOems, setLoadingOems] = useState(true)
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    apiGet<VehicleOEM[]>('/api/vehicle-oems')
  .then((data) => setOems(data || []))
  .catch(() => setOems([]))
  .finally(() => setLoadingOems(false))
  }, [])

  useEffect(() => {
    if (!value.oem) { setModels([]); return }
    setLoadingModels(true)
    apiGet<VehicleModel[]>(`/api/vehicle-models?oemId=${value.oem.id}`)
    .then((data) => setModels(data || []))
    .catch(() => setModels([]))
    .finally(() => setLoadingModels(false))
  }, [value.oem?.id])

  const filteredOems = oems.filter(o =>
    !oemSearch || o.name.toLowerCase().includes(oemSearch.toLowerCase())
  )
  const filteredModels = models.filter(m =>
    !modelSearch || m.name.toLowerCase().includes(modelSearch.toLowerCase())
  )

  const set = (patch: Partial<VehicleSelection>) => onChange({ ...value, ...patch })

  const selectOem = (oem: VehicleOEM) => {
    set({ oem, model: null, year: null, fuelType: null })
    setModelSearch('')
  }

  const selectModel = (model: VehicleModel) => {
    const fuelTypes = (model.fuel_types || []).filter(ft => ft !== 'diesel')
    const ft = fuelTypes.length === 1 ? fuelTypes[0] : null
    set({ model, year: null, fuelType: ft })
  }

  const years = value.model ? getYearRange(value.model.start_year, value.model.end_year) : []

  return (
    <div style={styles.wrap}>
      {/* Step 1: OEM Brand */}
      <StepSection
        step={1}
        title="Select Brand"
        complete={!!value.oem}
        summary={value.oem?.name}
      >
        <SearchInput
          value={oemSearch}
          onChange={setOemSearch}
          placeholder="Search brand..."
        />
        {loadingOems ? (
          <Loader />
        ) : (
          <div style={styles.brandGrid}>
            {filteredOems.map(oem => {
              const colors = OEM_COLORS[oem.slug] || { primary: '#0f2044', bg: '#eef2f8' }
              const selected = value.oem?.id === oem.id
              return (
                <button
                  key={oem.id}
                  onClick={() => selectOem(oem)}
                  style={{
                    ...styles.brandCard,
                    borderColor: selected ? colors.primary : '#e2e6f0',
                    background: selected ? colors.bg : 'white',
                    boxShadow: selected ? `0 0 0 2px ${colors.primary}30` : '0 1px 3px rgba(15,32,68,0.06)',
                  }}
                >
                  {oem.is_ev_brand && (
                    <span style={styles.evPill}>
                      <Zap size={9} /> EV
                    </span>
                  )}
                  <div style={{ ...styles.brandInitial, background: selected ? colors.primary : '#f1f3f8', color: selected ? 'white' : '#0f2044' }}>
                    {oem.name[0]}
                  </div>
                  <span style={{ ...styles.brandName, color: selected ? colors.primary : '#1e2438', fontWeight: selected ? '700' : '500' }}>
                    {oem.name}
                  </span>
                  {selected && <CheckCircle size={13} color={colors.primary} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        )}
      </StepSection>

      {/* Step 2: Model */}
      {value.oem && (
        <StepSection
          step={2}
          title={`Select Model`}
          complete={!!value.model}
          summary={value.model?.name}
          subtitle={`${value.oem.name} models`}
        >
          <SearchInput value={modelSearch} onChange={setModelSearch} placeholder="Search model..." />
          {loadingModels ? <Loader /> : (
            <div style={styles.modelGrid}>
              {filteredModels.map(m => {
                const selected = value.model?.id === m.id
                const isEV = m.fuel_types?.includes('electric')
                return (
                  <button
                    key={m.id}
                    onClick={() => selectModel(m)}
                    style={{
                      ...styles.modelCard,
                      borderColor: selected ? '#0f2044' : '#e2e6f0',
                      background: selected ? '#eef2f8' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ ...styles.modelName, color: selected ? '#0f2044' : '#1e2438' }}>{m.name}</span>
                      {isEV && <span style={styles.evTag}><Zap size={9} /> EV</span>}
                    </div>
                    <div style={styles.modelMeta}>
                      <span style={styles.segmentTag}>{m.segment}</span>
                      <span style={{ color: '#9aa3b8', fontSize: '11px' }}>from {m.start_year}</span>
                    </div>
                  </button>
                )
              })}
              {filteredModels.length === 0 && (
                <p style={{ color: '#9aa3b8', fontSize: '13px', padding: '8px' }}>No models found</p>
              )}
            </div>
          )}
        </StepSection>
      )}

      {/* Step 3: Year + Fuel */}
      {value.model && (
        <StepSection
          step={3}
          title="Year & Fuel Type"
          complete={!!(value.year && value.fuelType)}
          summary={value.year ? `${value.year} · ${FUEL_TYPE_LABELS[value.fuelType!] || value.fuelType}` : undefined}
        >
          <div style={styles.row2}>
            <SelectBox
              label="Manufacturing Year"
              value={value.year?.toString() || ''}
              onChange={v => set({ year: parseInt(v) })}
              options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
              placeholder="Select year"
            />
            <SelectBox
              label="Fuel Type"
              value={value.fuelType || ''}
              onChange={v => set({ fuelType: v })}
              options={(value.model.fuel_types || ['petrol']).filter(ft => ft !== 'diesel').map(ft => ({
                value: ft, label: FUEL_TYPE_LABELS[ft] || ft
              }))}
              placeholder="Select fuel type"
            />
          </div>
        </StepSection>
      )}

      {/* Step 4: Service Type */}
      {value.year && value.fuelType && (
        <StepSection
          step={4}
          title="Service Type"
          complete={!!value.serviceType}
          summary={SERVICE_CATEGORIES.find(s => s.value === value.serviceType)?.label}
        >
          <div style={styles.serviceGrid}>
            {SERVICE_CATEGORIES.map(svc => {
              const selected = value.serviceType === svc.value
              return (
                <button
                  key={svc.value}
                  onClick={() => set({ serviceType: svc.value })}
                  style={{
                    ...styles.serviceCard,
                    borderColor: selected ? '#0f2044' : '#e2e6f0',
                    background: selected ? '#0f2044' : 'white',
                  }}
                >
                  <span style={{ ...styles.serviceLabel, color: selected ? 'white' : '#1e2438' }}>
                    {svc.label}
                  </span>
                  <span style={{ ...styles.serviceDesc, color: selected ? 'rgba(255,255,255,0.65)' : '#9aa3b8' }}>
                    {svc.description}
                  </span>
                </button>
              )
            })}
          </div>
        </StepSection>
      )}

      {/* Step 5: Vehicle details */}
      {value.serviceType && (
        <StepSection
          step={5}
          title="Vehicle Details"
          complete={!!value.vehicleNumber}
          summary={value.vehicleNumber || undefined}
        >
          <div style={styles.row2}>
            <div style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>Registration Number</label>
              <input
                value={value.vehicleNumber}
                onChange={e => set({ vehicleNumber: e.target.value.toUpperCase() })}
                placeholder="e.g. MH01AB1234"
                style={styles.input}
                maxLength={10}
              />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>Current Odometer (km)</label>
              <input
                value={value.odometerKm}
                onChange={e => set({ odometerKm: e.target.value.replace(/\D/g, '') })}
                placeholder="e.g. 12500"
                style={styles.input}
                type="number"
                min="0"
              />
            </div>
          </div>
        </StepSection>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function StepSection({ step, title, subtitle, complete, summary, children }: {
  step: number; title: string; subtitle?: string; complete: boolean; summary?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div style={sectionStyles.wrap}>
      <button onClick={() => setOpen(o => !o)} style={sectionStyles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ ...sectionStyles.stepNum, background: complete ? '#0f2044' : '#f1f3f8', color: complete ? '#f5e019' : '#9aa3b8' }}>
            {complete ? <CheckCircle size={14} /> : step}
          </div>
          <div>
            <div style={sectionStyles.title}>{title}</div>
            {subtitle && <div style={sectionStyles.subtitle}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {complete && summary && (
            <span style={sectionStyles.summary}>{summary}</span>
          )}
          <ChevronDown size={15} color="#9aa3b8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </button>
      {open && <div style={sectionStyles.body}>{children}</div>}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: '12px' }}>
      <Search size={13} color="#9aa3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid #e2e6f0', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', color: '#1e2438', background: '#f8f9fc', outline: 'none' }}
      />
    </div>
  )
}

function SelectBox({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.fieldLabel}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.select}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} color="#9aa3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '20px', height: '20px', border: '2px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '12px' },
  brandGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' },
  brandCard: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
    border: '1.5px solid', borderRadius: '10px', cursor: 'pointer',
    transition: 'all 0.15s', background: 'white', position: 'relative', textAlign: 'left',
  },
  brandInitial: { width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
  brandName: { fontSize: '13px', lineHeight: '1.3', flex: 1, minWidth: 0 },
  evPill: { position: 'absolute', top: '5px', right: '5px', display: 'flex', alignItems: 'center', gap: '2px', background: '#dcfce7', color: '#16a34a', fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '10px' },
  modelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' },
  modelCard: { padding: '12px', border: '1.5px solid', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' },
  modelName: { fontSize: '13.5px', fontWeight: '600', lineHeight: '1.3' },
  modelMeta: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  segmentTag: { fontSize: '10px', fontWeight: '500', color: '#6b7595', background: '#f1f3f8', padding: '2px 7px', borderRadius: '10px', textTransform: 'capitalize' },
  evTag: { display: 'flex', alignItems: 'center', gap: '2px', background: '#dcfce7', color: '#16a34a', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' },
  serviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' },
  serviceCard: { padding: '14px', border: '1.5px solid', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' },
  serviceLabel: { fontSize: '13.5px', fontWeight: '600' },
  serviceDesc: { fontSize: '11.5px', lineHeight: '1.4' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '5px' },
  fieldLabel: { fontSize: '12px', fontWeight: '600', color: '#333a52' },
  input: { padding: '9px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', transition: 'border-color 0.15s' },
  select: { width: '100%', padding: '9px 32px 9px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', appearance: 'none', cursor: 'pointer' },
}

const sectionStyles: Record<string, React.CSSProperties> = {
  wrap: { border: '1px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden', background: 'white' },
  header: { width: '100%', padding: '14px 16px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  stepNum: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 },
  title: { fontSize: '14px', fontWeight: '600', color: '#0f2044', textAlign: 'left' },
  subtitle: { fontSize: '11.5px', color: '#9aa3b8', textAlign: 'left' },
  summary: { fontSize: '12px', fontWeight: '600', color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: '20px' },
  body: { padding: '0 16px 16px', borderTop: '1px solid #f1f3f8' },
}

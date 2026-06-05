import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, X, ChevronRight, Search, ChevronDown, Zap, TriangleAlert as AlertTriangle, Sparkles, Star, Clock, Truck } from 'lucide-react'
import LocationPicker, { LocationValue } from './LocationPicker'
import { dealerSearch, DealerResult, safeGet } from '../lib/api'
import type { VehicleModel, VehicleOEM } from '../types/vehicle'

// ── DATA ──────────────────────────────────────────────────────────────────────

type FlowOEM = Pick<VehicleOEM, 'id' | 'name' | 'slug' | 'sort_order'>
type FlowModel = Pick<VehicleModel, 'id' | 'name' | 'slug' | 'oem_id' | 'sort_order'>

const POPULAR_OEM_SLUGS = new Set(['honda', 'hero', 'tvs', 'bajaj', 'royal-enfield', 'yamaha'])

const FALLBACK_OEMS: FlowOEM[] = [
  { id: 'hero', name: 'Hero', slug: 'hero', sort_order: 1 },
  { id: 'honda', name: 'Honda', slug: 'honda', sort_order: 2 },
  { id: 'tvs', name: 'TVS', slug: 'tvs', sort_order: 3 },
  { id: 'bajaj', name: 'Bajaj', slug: 'bajaj', sort_order: 4 },
  { id: 'royal-enfield', name: 'Royal Enfield', slug: 'royal-enfield', sort_order: 5 },
  { id: 'yamaha', name: 'Yamaha', slug: 'yamaha', sort_order: 6 },
  { id: 'suzuki', name: 'Suzuki', slug: 'suzuki', sort_order: 7 },
  { id: 'ktm', name: 'KTM', slug: 'ktm', sort_order: 8 },
  { id: 'jawa', name: 'Jawa', slug: 'jawa', sort_order: 9 },
  { id: 'ola-electric', name: 'Ola Electric', slug: 'ola-electric', sort_order: 10 },
  { id: 'ather', name: 'Ather', slug: 'ather', sort_order: 11 },
  { id: 'revolt', name: 'Revolt', slug: 'revolt', sort_order: 12 },
]

const FALLBACK_MODEL_NAMES_BY_SLUG: Record<string, string[]> = {
  hero: ['Splendor Plus', 'HF Deluxe', 'Passion Plus', 'Glamour', 'Xtreme 125R', 'Xtreme 160R', 'Xpulse 200'],
  honda: ['Activa 6G', 'Activa 125', 'Dio', 'Shine 100', 'Shine 125', 'Unicorn', 'SP 125', 'Hornet 2.0'],
  tvs: ['Jupiter', 'Ntorq 125', 'Apache RTR 160', 'Apache RTR 200', 'Raider 125', 'Ronin', 'iQube'],
  bajaj: ['Pulsar 125', 'Pulsar 150', 'Pulsar N160', 'Pulsar NS200', 'Platina 110', 'Avenger 160', 'Chetak'],
  'royal-enfield': ['Hunter 350', 'Classic 350', 'Bullet 350', 'Meteor 350', 'Himalayan 450', 'Interceptor 650'],
  yamaha: ['FZ-S FI', 'FZ-X', 'MT-15', 'R15 V4', 'RayZR 125', 'Fascino 125'],
  suzuki: ['Access 125', 'Avenis 125', 'Burgman Street', 'Gixxer', 'Gixxer SF', 'V-Strom SX'],
  ktm: ['Duke 125', 'Duke 200', 'Duke 250', 'Duke 390', 'RC 200', 'RC 390', 'Adventure 390'],
  jawa: ['Jawa 350', 'Jawa 42', '42 Bobber', 'Perak'],
  'ola-electric': ['S1 X', 'S1 Air', 'S1 Pro'],
  ather: ['450S', '450X', '450 Apex', 'Rizta'],
  revolt: ['RV400', 'RV400 BRZ'],
}

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const fallbackModelsFor = (oem: FlowOEM): FlowModel[] =>
  (FALLBACK_MODEL_NAMES_BY_SLUG[oem.slug] || []).map((name, index) => ({
    id: `${oem.id}-${slugify(name)}`,
    name,
    slug: slugify(name),
    oem_id: oem.id,
    sort_order: index + 1,
  }))

// Priority: emergency = red urgent, medium = amber, low = green-grey
type Priority = 'emergency' | 'medium' | 'low'

interface ServiceCategory {
  id: string
  label: string
  icon: string
  desc: string
  priority: Priority
  issues?: ServiceIssue[]
  aiRecommends?: string[]   // shown after issue selection
}

interface ServiceIssue {
  id: string
  label: string
  priority: Priority
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'free_service',
    label: 'Free Service',
    icon: 'FS',
    desc: 'Manufacturer-covered service',
    priority: 'low',
  },
  {
    id: 'general_service',
    label: 'General Service',
    icon: 'GS',
    desc: 'Oil, filter & routine check',
    priority: 'low',
  },
  {
    id: 'paid_service',
    label: 'Paid Service',
    icon: 'PS',
    desc: 'Specific part or repair job',
    priority: 'low',
  },
  {
    id: 'breakdown',
    label: 'Breakdown Assistance',
    icon: 'RSA',
    desc: 'Immediate on-road support',
    priority: 'emergency',
    issues: [
      { id: 'not_starting',     label: 'Bike Not Starting',   priority: 'emergency' },
      { id: 'battery_dead',     label: 'Battery Dead',        priority: 'emergency' },
      { id: 'puncture',         label: 'Puncture / Tyre Burst', priority: 'emergency' },
      { id: 'brake_failure',    label: 'Brake Failure',       priority: 'emergency' },
      { id: 'clutch_issue',     label: 'Clutch Issue',        priority: 'medium' },
      { id: 'engine_shutdown',  label: 'Engine Shut Down',    priority: 'emergency' },
      { id: 'chain_problem',    label: 'Chain Problem',       priority: 'medium' },
      { id: 'fuel_issue',       label: 'Fuel Issue',          priority: 'medium' },
      { id: 'accident_break',   label: 'Accident Breakdown',  priority: 'emergency' },
    ],
    aiRecommends: ['RSA dispatch', 'Nearest open workshop', 'Towing support'],
  },
  {
    id: 'accident_repair',
    label: 'Accident / Insurance',
    icon: 'INS',
    desc: 'Body repair, insurance claim',
    priority: 'medium',
    issues: [
      { id: 'body_damage',        label: 'Body Damage',          priority: 'medium' },
      { id: 'insurance_claim',    label: 'Insurance Claim',      priority: 'medium' },
      { id: 'panel_replacement',  label: 'Panel Replacement',    priority: 'medium' },
      { id: 'paint_work',         label: 'Paint Work',           priority: 'low' },
      { id: 'fork_damage',        label: 'Fork Damage',          priority: 'medium' },
      { id: 'chassis_inspection', label: 'Chassis Inspection',   priority: 'medium' },
      { id: 'wheel_alignment',    label: 'Wheel Alignment',      priority: 'medium' },
    ],
    aiRecommends: ['Insurance-approved workshops', 'Body repair specialists'],
  },
  {
    id: 'minor_repairs',
    label: 'Minor Repairs',
    icon: 'FIX',
    desc: 'Quick fixes & replacements',
    priority: 'low',
    issues: [
      { id: 'battery_repl',   label: 'Battery Replacement', priority: 'medium' },
      { id: 'brake_repair',   label: 'Brake Repair',        priority: 'medium' },
      { id: 'oil_change',     label: 'Oil Change',          priority: 'low' },
      { id: 'tyre_repl',      label: 'Tyre Replacement',    priority: 'medium' },
      { id: 'indicator',      label: 'Indicator Issue',     priority: 'low' },
      { id: 'headlight',      label: 'Headlight Problem',   priority: 'low' },
      { id: 'horn',           label: 'Horn Not Working',    priority: 'low' },
      { id: 'mirror',         label: 'Mirror Replacement',  priority: 'low' },
      { id: 'accelerator',    label: 'Accelerator Tightness', priority: 'low' },
    ],
    aiRecommends: ['Available same-day slots', 'Parts in stock near you'],
  },
  {
    id: 'complaint',
    label: 'Customer Complaint',
    icon: 'DX',
    desc: 'Describe a performance issue',
    priority: 'medium',
    issues: [
      { id: 'engine_noise',   label: 'Engine Noise',          priority: 'medium' },
      { id: 'low_pickup',     label: 'Low Pickup',            priority: 'medium' },
      { id: 'low_mileage',    label: 'Low Mileage',           priority: 'low' },
      { id: 'wobbling',       label: 'Wobbling',              priority: 'medium' },
      { id: 'side_pull',      label: 'Side Pulling',          priority: 'medium' },
      { id: 'vibration',      label: 'Vibration',             priority: 'medium' },
      { id: 'start_trouble',  label: 'Starting Trouble',      priority: 'medium' },
      { id: 'excess_smoke',   label: 'Excess Smoke',          priority: 'medium' },
      { id: 'overheating',    label: 'Overheating',           priority: 'emergency' },
      { id: 'brake_noise',    label: 'Brake Noise',           priority: 'medium' },
      { id: 'susp_noise',     label: 'Suspension Noise',      priority: 'low' },
      { id: 'gear_prob',      label: 'Gear Shifting Problem', priority: 'medium' },
      { id: 'handle_tight',   label: 'Handle Tightness',      priority: 'medium' },
      { id: 'self_start',     label: 'Self Start Failure',    priority: 'medium' },
    ],
    aiRecommends: ['AI diagnostic', 'Carburetor check', 'Air filter', 'Fuel system'],
  },
  {
    id: 'specific_complaint',
    label: 'Specific Issue',
    icon: 'SI',
    desc: 'Know exactly what needs fixing',
    priority: 'low',
  },
]

// AI diagnostic mapping: issue combos → probable cause
const AI_DIAGNOSES: Record<string, { cause: string; inspection: string[]; urgency: 'immediate' | 'soon' | 'routine' }> = {
  low_pickup_low_mileage:    { cause: 'Fuel system / air filter clog', inspection: ['Carburetor cleaning', 'Air filter inspection', 'Injector check', 'General tuning'], urgency: 'soon' },
  engine_noise_vibration:    { cause: 'Engine wear / loose mounts',    inspection: ['Engine oil check', 'Mount bolt inspection', 'Crankshaft check'], urgency: 'soon' },
  start_trouble_battery_dead:{ cause: 'Electrical / battery fault',    inspection: ['Battery voltage test', 'Starter motor', 'Ignition coil'], urgency: 'immediate' },
  overheating_excess_smoke:  { cause: 'Coolant / oil burning',         inspection: ['Coolant level', 'Head gasket', 'Oil quality check'], urgency: 'immediate' },
  wobbling_side_pull:        { cause: 'Wheel alignment / tyre issue',  inspection: ['Tyre pressure', 'Wheel balancing', 'Steering alignment'], urgency: 'soon' },
  brake_noise_brake_failure: { cause: 'Brake pad wear / fluid leak',   inspection: ['Brake pad thickness', 'Brake fluid level', 'Disc condition'], urgency: 'immediate' },
}

function getAIDiagnosis(issues: string[]) {
  for (const [key, diag] of Object.entries(AI_DIAGNOSES)) {
    const matched = issues.filter(i => key.includes(i.replace(/_/g, '').slice(0, 6)))
    if (matched.length >= 2) return diag
  }
  if (issues.includes('overheating') || issues.includes('brake_failure') || issues.includes('engine_shutdown')) {
    return { cause: 'Urgent safety issue detected', inspection: ['Immediate workshop inspection recommended'], urgency: 'immediate' as const }
  }
  if (issues.length >= 2) {
    return { cause: 'Multiple symptoms detected', inspection: ['Full vehicle diagnostic', 'Pre-service inspection'], urgency: 'soon' as const }
  }
  return null
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function BookingFlow() {
  const navigate = useNavigate()

  const [oems, setOems]           = useState<FlowOEM[]>(FALLBACK_OEMS)
  const [modelsByOem, setModelsByOem] = useState<Record<string, FlowModel[]>>({})
  const [oemsLoading, setOemsLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [vehicleDataError, setVehicleDataError] = useState('')
  const [oem, setOem]             = useState<FlowOEM | null>(null)
  const [oemQuery, setOemQuery]   = useState('')
  const [model, setModel]         = useState('')
  const [category, setCategory]   = useState<ServiceCategory | null>(null)
  const [issues, setIssues]       = useState<string[]>([])
  const [location, setLocation]   = useState<LocationValue | null>(null)
  const [locAutoFocus, setLocAutoFocus] = useState(false)
  const [catOpen, setCatOpen]     = useState(false)

  const [dealers, setDealers]         = useState<DealerResult[]>([])
  const [dealersLoading, setDealersLoading] = useState(false)
  const dealerFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [modelOpen, setModelOpen]   = useState(false)
  const [modelQuery, setModelQuery] = useState('')

  const modelSearchRef = useRef<HTMLInputElement>(null)
  const modelPanelRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (modelPanelRef.current && !modelPanelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await safeGet<FlowOEM[]>('/api/vehicle-oems', FALLBACK_OEMS)
        if (!active) return
        const next = data?.length ? data : FALLBACK_OEMS
        setOems(next as FlowOEM[])
        setVehicleDataError('')
      } catch (e) {
        if (!active) return
        setVehicleDataError(`Vehicle OEM data unavailable: ${(e as Error).message}`)
        setOems(FALLBACK_OEMS)
      } finally {
        if (active) setOemsLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!oem) { setModelsLoading(false); return }
    if (modelsByOem[oem.id]) return
    let active = true
    setModelsLoading(true)
    ;(async () => {
      try {
        const data = await safeGet<FlowModel[]>(
          `/api/vehicle-models?oemId=${encodeURIComponent(oem.id)}`,
          fallbackModelsFor(oem),
        )
        if (!active) return
        const fallback = fallbackModelsFor(oem)
        const next = ((data && data.length ? data : fallback) || []) as FlowModel[]
        setModelsByOem(prev => ({ ...prev, [oem.id]: next }))
        setVehicleDataError(next.length ? '' : `No models found for ${oem.name}.`)
      } catch (e) {
        if (!active) return
        setVehicleDataError(`Vehicle model data unavailable: ${(e as Error).message}`)
        setModelsByOem(prev => ({ ...prev, [oem.id]: fallbackModelsFor(oem) }))
      } finally {
        if (active) setModelsLoading(false)
      }
    })()
    return () => { active = false }
  }, [modelsByOem, oem])

  const fetchDealers = useCallback(async (loc: LocationValue, oemSlug: string | null) => {
    setDealersLoading(true)
    setDealers([])
    try {
      // Try GPS coords first; fall back to city
      let params: Parameters<typeof dealerSearch>[0] = {
        oem: oemSlug ?? undefined,
        service_category: category?.id ?? undefined,
        limit: 3,
      }
      if (loc.lat != null && loc.lng != null) {
        params = { ...params, lat: loc.lat, lng: loc.lng, radius_km: 25 }
      } else if (loc.city) {
        params = { ...params, city: loc.city, state: loc.state || undefined }
      }
      const res = await dealerSearch(params)
      setDealers(res.results.slice(0, 3))
    } catch {
      // Silently fail — preview is non-critical
      setDealers([])
    }
    setDealersLoading(false)
  }, [category?.id])

  useEffect(() => {
    if (!location?.city && location?.lat == null) { setDealers([]); return }
    if (dealerFetchRef.current) clearTimeout(dealerFetchRef.current)
    dealerFetchRef.current = setTimeout(() => {
      fetchDealers(location, oem?.slug ?? null)
    }, 400)
  }, [location, oem, fetchDealers])

  const selectOem = (o: FlowOEM) => {
    setOem(o)
    setOemQuery(o.name)
    setModel('')
    setModelQuery('')
    setModelOpen(true)
    setTimeout(() => modelSearchRef.current?.focus(), 60)
  }

  const selectModel = (m: string) => {
    setModel(m)
    setModelOpen(false)
    setModelQuery('')
    setCatOpen(true)
    setTimeout(() => {
      modelPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }, 80)
  }

  const selectCategory = (cat: ServiceCategory) => {
    setCategory(cat)
    setIssues([])
    setCatOpen(false)
    if (!cat.issues?.length) {
      setLocAutoFocus(true)
      setTimeout(() => setLocAutoFocus(false), 500)
    }
  }

  const toggleIssue = (id: string) => {
    setIssues(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSearch = () => {
    if (!canSearch) return
    const params = new URLSearchParams({
      flow: 'service-centers',
      step: 'workshop',
      oem: oem!.slug,
      oem_id: oem!.id,
      oem_name: oem!.name,
      model,
      service: category!.id,
      issues: issues.join(','),
    })
    if (location?.label) params.set('location', location.label)
    if (location?.city) params.set('city', location.city)
    if (location?.state) params.set('state', location.state)
    if (location?.lat != null && location?.lng != null) {
      params.set('lat', String(location.lat))
      params.set('lng', String(location.lng))
    }
    navigate(`/my/book?${params.toString()}`)
  }

  const normalizedOemQuery = oemQuery.trim().toLowerCase()
  const filteredOems = normalizedOemQuery
    ? oems.filter(o =>
        o.name.toLowerCase().includes(normalizedOemQuery) ||
        o.slug.toLowerCase().includes(normalizedOemQuery.replace(/\s+/g, '-')),
      )
    : oems
  const modelsForOem = (brand: FlowOEM) => {
    const loaded = modelsByOem[brand.id]
    return loaded?.length ? loaded : fallbackModelsFor(brand)
  }
  const previewOem = normalizedOemQuery ? filteredOems[0] || null : oem
  const previewModels = previewOem ? modelsForOem(previewOem).map(m => m.name).slice(0, 8) : []
  const canSearch = !!(oem && model && category && (location?.label || location?.city || (location?.lat != null && location?.lng != null)))
  const filteredModels = (oem ? modelsForOem(oem) : [])
    .map(m => m.name)
    .filter(name => name.toLowerCase().includes(modelQuery.toLowerCase()))
  const aiDiag = category?.id === 'complaint' || category?.id === 'breakdown'
    ? getAIDiagnosis(issues)
    : null

  const priorityColor = (p: Priority) =>
    p === 'emergency' ? '#EF4444' : p === 'medium' ? '#F59E0B' : 'rgba(255,255,255,0.35)'

  const priorityBg = (p: Priority) =>
    p === 'emergency' ? 'rgba(239,68,68,0.12)' : p === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)'

  return (
    <div style={bf.card}>
      <style>{`
        .bf-oem:hover   { border-color: rgba(255,214,0,0.65) !important; background: rgba(255,214,0,0.1) !important; }
        .bf-oem.sel     { border-color: #FFD600 !important; background: rgba(255,214,0,0.16) !important; }
        .bf-oem.sel .bf-oemtxt { color: #FFD600 !important; }
        .bf-cat:hover   { border-color: rgba(255,214,0,0.5) !important; background: rgba(255,214,0,0.07) !important; }
        .bf-cat.sel     { border-color: #FFD600 !important; background: rgba(255,214,0,0.13) !important; }
        .bf-issue:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.09) !important; }
        .bf-issue.sel-em  { border-color: #EF4444 !important; background: rgba(239,68,68,0.16) !important; }
        .bf-issue.sel-med { border-color: #F59E0B !important; background: rgba(245,158,11,0.14) !important; }
        .bf-issue.sel-low { border-color: #FFD600 !important; background: rgba(255,214,0,0.13) !important; }
        .bf-minp:focus  { border-color: rgba(255,214,0,0.7) !important; outline: none !important; box-shadow: 0 0 0 3px rgba(255,214,0,0.14) !important; }
        .bf-minp::placeholder { color: rgba(255,255,255,0.38) !important; font-weight: 400; }
        .bf-ditem:hover { background: rgba(255,214,0,0.09) !important; color: white !important; }
        .bf-go:not(:disabled):hover { background: #e6c200 !important; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.22) !important; }
        .bf-go:disabled { opacity: 0.38 !important; cursor: not-allowed !important; }
        @keyframes bfDrop  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bfSlide { from{opacity:0;transform:translateY(6px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes bfPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @media (max-width: 640px) {
          .bf-oems { grid-template-columns: repeat(5,1fr) !important; }
          .bf-row2 { grid-template-columns: 1fr !important; }
          .bf-cats { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 400px) {
          .bf-oems { grid-template-columns: repeat(4,1fr) !important; }
        }
      `}</style>

      {/* ── 1. Brand ── */}
      <div style={bf.section}>
        <div style={bf.label}>Bike brand</div>
        <div style={bf.brandSearchWrap}>
          <Search size={14} color="rgba(255,255,255,0.42)" style={{ flexShrink: 0 }} />
          <input
            style={bf.brandSearchInput}
            className="bf-minp"
            placeholder="Search bike brand"
            value={oemQuery}
            onChange={e => {
              const nextQuery = e.target.value
              setOemQuery(nextQuery)
              if (!nextQuery.trim() || (oem && nextQuery.trim().toLowerCase() !== oem.name.toLowerCase())) {
                setOem(null)
                setModel('')
                setModelOpen(false)
              }
            }}
          />
          {oemQuery && (
            <button
              style={bf.clearInline}
              onClick={() => {
                setOemQuery('')
                setOem(null)
                setModel('')
                setModelOpen(false)
              }}
            >
              <X size={12} color="rgba(255,255,255,0.42)" />
            </button>
          )}
        </div>
        {normalizedOemQuery && previewModels.length > 0 && previewOem && (
          <div style={bf.relatedModels}>
            <span style={bf.relatedLabel}>Related models for {previewOem.name}</span>
            <div style={bf.relatedModelList}>
              {previewModels.map(name => (
                <button
                  key={name}
                  style={bf.relatedModelChip}
                  onClick={() => {
                    selectOem(previewOem)
                    selectModel(name)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={bf.oems} className="bf-oems">
          {oemsLoading ? (
            <div style={bf.emptyHint}>Loading brands...</div>
          ) : filteredOems.length ? filteredOems.map(o => (
            <button
              key={o.id}
              style={bf.oem}
              className={`bf-oem${oem?.id === o.id ? ' sel' : ''}`}
              onClick={() => selectOem(o)}
            >
              {POPULAR_OEM_SLUGS.has(o.slug) && oem?.id !== o.id && <span style={bf.popDot} />}
              <span className="bf-oemtxt" style={{ ...bf.oemTxt, ...(oem?.id === o.id ? { color: '#FFD600' } : {}) }}>
                {o.name}
              </span>
            </button>
          )) : (
            <div style={bf.emptyHint}>{vehicleDataError || `No brands match "${oemQuery}"`}</div>
          )}
        </div>
      </div>

      {/* ── 2. Model + Location ── */}
      <div style={bf.section} ref={modelPanelRef}>
        <div style={bf.row2} className="bf-row2">

          {/* Model */}
          <div style={{ position: 'relative' }}>
            <div style={bf.label}>Model</div>
            <button
              style={{ ...bf.selectTrigger, ...(modelOpen ? bf.selectTriggerOpen : {}), opacity: oem ? 1 : 0.45 }}
              onClick={() => { if (oem) { setModelOpen(v => !v); setTimeout(() => modelSearchRef.current?.focus(), 40) } }}
              disabled={!oem}
            >
              <span style={{ color: model ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '13px', fontWeight: model ? 600 : 400, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {!oem ? 'Select brand first' : (model || 'Choose model')}
              </span>
              {model
                ? <button style={bf.clearInline} onClick={e => { e.stopPropagation(); setModel('') }}><X size={12} color="rgba(255,255,255,0.4)" /></button>
                : <ChevronDown size={14} color="rgba(255,255,255,0.35)" style={{ transition: 'transform 0.18s', transform: modelOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
              }
            </button>

            {modelOpen && (
              <div style={bf.modelDropdown}>
                <div style={bf.modelSearch}>
                  <Search size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                  <input
                    ref={modelSearchRef}
                    style={bf.modelSearchInput}
                    className="bf-minp"
                    placeholder={`Search ${oem?.name} models…`}
                    value={modelQuery}
                    onChange={e => setModelQuery(e.target.value)}
                  />
                  {modelQuery && <button style={bf.clearInline} onClick={() => setModelQuery('')}><X size={11} color="rgba(255,255,255,0.35)" /></button>}
                </div>
                <div style={bf.modelList}>
                  {modelsLoading ? (
                    <div style={bf.emptyHint}>Loading models...</div>
                  ) : filteredModels.length ? filteredModels.map(m => (
                    <button
                      key={m}
                      style={{ ...bf.ditem, ...(model === m ? bf.ditemSel : {}) }}
                      className="bf-ditem"
                      onClick={() => selectModel(m)}
                    >
                      {m}
                      {model === m && <span style={{ color: '#FFD600', marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
                    </button>
                  )) : (
                    <div style={bf.emptyHint}>{vehicleDataError || `No models match "${modelQuery}"`}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <div style={bf.label}>Your location <span style={{ color: '#EF4444' }}>*</span></div>
            <LocationPicker
              value={location}
              onChange={setLocation}
              onClear={() => setLocation(null)}
              placeholder="Select state, city & area"
              autoFocus={locAutoFocus}
            />
          </div>
        </div>
      </div>

      {/* ── 3. Service Category ── */}
      <div style={bf.section}>
        {/* Collapsed trigger */}
        <button
          style={{ ...bf.catToggle, ...(catOpen ? bf.catToggleOpen : {}) }}
          onClick={() => setCatOpen(v => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {category ? (
              <>
                <span style={bf.catIcon}>{category.icon}</span>
                <span style={bf.catSelectedTxt}>{category.label}</span>
                {issues.length > 0 && (
                  <span style={bf.issueCount}>{issues.length} issue{issues.length > 1 ? 's' : ''}</span>
                )}
              </>
            ) : (
              <span style={bf.label}>Service type <span style={{ color: '#EF4444' }}>*</span></span>
            )}
          </div>
          <ChevronDown size={14} color="rgba(255,255,255,0.4)" style={{ transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }} />
        </button>

        {/* Category grid */}
        {catOpen && (
          <div style={bf.catGrid} className="bf-cats">
            {SERVICE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                style={{
                  ...bf.catCard,
                  ...(category?.id === cat.id ? bf.catCardSel : {}),
                  borderColor: category?.id === cat.id
                    ? '#FFD600'
                    : cat.priority === 'emergency'
                    ? 'rgba(239,68,68,0.3)'
                    : 'rgba(255,255,255,0.14)',
                }}
                className={`bf-cat${category?.id === cat.id ? ' sel' : ''}`}
                onClick={() => selectCategory(cat)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={bf.catIcon}>{cat.icon}</span>
                  {cat.priority === 'emergency' && (
                    <span style={bf.emergencyBadge}><Zap size={8} />SOS</span>
                  )}
                  {category?.id === cat.id && (
                    <span style={bf.selCheck}>✓</span>
                  )}
                </div>
                <span style={{ ...bf.catLabel, color: category?.id === cat.id ? '#FFD600' : 'rgba(255,255,255,0.9)' }}>
                  {cat.label}
                </span>
                <span style={bf.catDesc}>{cat.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Issue selection (when category has sub-issues) ── */}
      {category?.issues && category.issues.length > 0 && (
        <div style={{ ...bf.section, animation: 'bfSlide 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={bf.label}>
              {category.id === 'complaint' ? 'What symptoms are you experiencing?' : 'Select the issue(s)'}
            </div>
            {issues.length > 0 && (
              <button style={bf.clearAllBtn} onClick={() => setIssues([])}>Clear all</button>
            )}
          </div>

          <div style={bf.issueGrid}>
            {category.issues.map(issue => {
              const selected = issues.includes(issue.id)
              const selClass = selected
                ? issue.priority === 'emergency' ? 'sel-em'
                : issue.priority === 'medium' ? 'sel-med'
                : 'sel-low'
                : ''
              return (
                <button
                  key={issue.id}
                  style={{
                    ...bf.issueChip,
                    borderColor: selected ? priorityColor(issue.priority) : 'rgba(255,255,255,0.14)',
                    background: selected ? priorityBg(issue.priority) : 'rgba(255,255,255,0.05)',
                    color: selected
                      ? issue.priority === 'emergency' ? '#FCA5A5'
                      : issue.priority === 'medium' ? '#FCD34D'
                      : '#FFD600'
                      : 'rgba(255,255,255,0.75)',
                  }}
                  className={`bf-issue ${selClass}`}
                  onClick={() => toggleIssue(issue.id)}
                >
                  {issue.priority === 'emergency' && (
                    <AlertTriangle size={10} style={{ flexShrink: 0, marginRight: '3px' }} />
                  )}
                  {issue.label}
                  {selected && <span style={{ marginLeft: '4px', opacity: 0.8 }}>×</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. AI Diagnosis strip ── */}
      {aiDiag && issues.length >= 1 && (
        <div style={{ ...bf.aiStrip, animation: 'bfSlide 0.22s ease' }}>
          <div style={bf.aiHeader}>
            <Sparkles size={13} color="#FFD600" />
            <span style={bf.aiTitle}>AI Diagnosis</span>
            <span style={{ ...bf.urgencyBadge, background: aiDiag.urgency === 'immediate' ? 'rgba(239,68,68,0.2)' : aiDiag.urgency === 'soon' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.15)', color: aiDiag.urgency === 'immediate' ? '#FCA5A5' : aiDiag.urgency === 'soon' ? '#FCD34D' : '#86EFAC' }}>
              {aiDiag.urgency === 'immediate' ? '⚡ Urgent' : aiDiag.urgency === 'soon' ? '⏱ Soon' : '✓ Routine'}
            </span>
          </div>
          <p style={bf.aiCause}>Probable: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{aiDiag.cause}</strong></p>
          <div style={bf.aiInspections}>
            {aiDiag.inspection.map(i => (
              <span key={i} style={bf.aiChip}>{i}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Live Dealer Preview ── */}
      {(dealersLoading || dealers.length > 0) && (
        <div style={{ ...bf.section, animation: 'bfSlide 0.22s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={bf.label}>
              {dealersLoading ? 'Finding nearby service centers…' : `${dealers.length} service center${dealers.length !== 1 ? 's' : ''} nearby`}
            </div>
            {!dealersLoading && dealers.length > 0 && (
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '500' }}>
                {location?.city}
              </span>
            )}
          </div>
          {dealersLoading ? (
            <div style={bf.dealerSkeleton}>
              {[1,2,3].map(i => <div key={i} style={bf.skeletonCard} />)}
            </div>
          ) : (
            <div style={bf.dealerList}>
              {dealers.map(d => (
                <div key={d.id} style={bf.dealerCard}>
                  <div style={bf.dealerTop}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={bf.dealerName}>{d.name}</div>
                      <div style={bf.dealerAddr}>{d.address}</div>
                    </div>
                    <div style={bf.dealerMeta}>
                      {d.distance_km != null && (
                        <span style={bf.dealerDist}>{d.distance_km < 1 ? `${(d.distance_km * 1000).toFixed(0)}m` : `${d.distance_km.toFixed(1)}km`}</span>
                      )}
                    </div>
                  </div>
                  <div style={bf.dealerTags}>
                    <span style={bf.dealerTag}>
                      <Star size={9} />{d.rating?.toFixed(1) ?? '—'} ({d.total_reviews ?? 0})
                    </span>
                    <span style={bf.dealerTag}>
                      <Clock size={9} />{d.next_available_slot || 'Call to book'}
                    </span>
                    {d.is_pickup_available && (
                      <span style={{ ...bf.dealerTag, color: '#86efac', borderColor: 'rgba(134,239,172,0.3)' }}>
                        <Truck size={9} />Pickup available
                      </span>
                    )}
                    <span style={{ ...bf.dealerTag, color: d.workshop_type === 'oem_authorized' ? '#93c5fd' : 'rgba(255,255,255,0.45)', borderColor: d.workshop_type === 'oem_authorized' ? 'rgba(147,197,253,0.3)' : 'rgba(255,255,255,0.12)' }}>
                      {d.workshop_type === 'oem_authorized' ? 'OEM Authorized' : d.workshop_type === 'multi_brand' ? 'Multi-brand' : 'EV Specialist'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 7. CTA ── */}
      <button style={bf.go} className="bf-go" disabled={!canSearch} onClick={handleSearch}>
        <MapPin size={15} />
        Find Service Centers
        <ChevronRight size={15} />
      </button>

      {/* Summary strip */}
      {(oem || category) && (
        <div style={bf.summary}>
          {[
            oem?.name,
            model,
            category?.label,
            issues.length > 0 ? `${issues.length} issue${issues.length > 1 ? 's' : ''}` : null,
            location?.city || location?.label,
          ].filter(Boolean).map((s, i, arr) => (
            <span key={i} style={bf.sumItem}>
              {s}{i < arr.length - 1 && <span style={bf.sumDot}>·</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const bf: Record<string, React.CSSProperties> = {
  card: {
    background: '#102a56',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 18px 42px rgba(0,0,0,0.22)',
  },

  section: { display: 'flex', flexDirection: 'column', gap: '9px' },
  label: {
    fontSize: '11px', fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },

  brandSearchWrap: {
    width: 'min(100%, 320px)',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 13px',
    background: '#16325f',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '8px',
  },
  brandSearchInput: {
    flex: 1,
    minWidth: 0,
    background: 'none',
    border: 'none',
    fontSize: '13px',
    fontWeight: '500',
    color: 'white',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
  },
  relatedModels: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' },
  relatedLabel: { fontSize: '10.5px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  relatedModelList: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' },
  relatedModelChip: {
    border: '1px solid rgba(255,214,0,0.28)',
    background: 'rgba(255,214,0,0.08)',
    color: '#FFD600',
    borderRadius: '20px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '11px',
    fontWeight: '700',
  },

  // OEM
  oems: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '7px' },
  oem: {
    position: 'relative', padding: '9px 5px',
    background: '#16325f', border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  oemTxt: { fontSize: '11.5px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', textAlign: 'center' as const, lineHeight: 1.2 },
  popDot: { position: 'absolute', top: '5px', right: '5px', width: '4px', height: '4px', borderRadius: '50%', background: '#FFD600' },

  // 2-col row
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },

  // Model dropdown
  selectTrigger: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 12px', background: '#16325f',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s',
  },
  selectTriggerOpen: { borderColor: 'rgba(255,214,0,0.7)', background: 'rgba(255,214,0,0.06)' },
  clearInline: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  modelDropdown: {
    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 400,
    background: '#0c1d40', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px',
    boxShadow: '0 14px 30px rgba(0,0,0,0.42)', overflow: 'hidden',
    maxHeight: '240px', display: 'flex', flexDirection: 'column', animation: 'bfDrop 0.17s ease',
  },
  modelSearch: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 13px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 },
  modelSearchInput: { flex: 1, background: 'none', border: 'none', fontSize: '13px', fontWeight: '500', color: 'white', fontFamily: 'inherit' },
  modelList: { overflowY: 'auto', flex: 1 },
  ditem: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.88)', textAlign: 'left', transition: 'background 0.1s' },
  ditemSel: { background: 'rgba(255,214,0,0.12)', color: '#FFD600', fontWeight: '700' },
  emptyHint: { padding: '14px', fontSize: '13px', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  // Service category toggle
  catToggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 13px', background: '#16325f',
    border: '1px solid rgba(255,255,255,0.16)', borderRadius: '8px',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s', width: '100%',
  },
  catToggleOpen: { borderColor: 'rgba(255,214,0,0.6)', background: 'rgba(255,214,0,0.05)' },
  catSelectedTxt: { fontSize: '13px', fontWeight: '700', color: '#FFD600' },
  catIcon: {
    minWidth: '26px',
    height: '22px',
    padding: '0 5px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#071530',
    background: '#FFD600',
    borderRadius: '5px',
    fontSize: '9px',
    lineHeight: 1,
    fontWeight: '900',
    letterSpacing: 0,
  },
  issueCount: {
    fontSize: '10px', fontWeight: '700', color: '#071530',
    background: '#FFD600', borderRadius: '20px', padding: '1px 7px',
  },

  // Category 4-col grid
  catGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px',
    animation: 'bfSlide 0.18s ease',
  },
  catCard: {
    display: 'flex', flexDirection: 'column', gap: '3px',
    padding: '10px 9px',
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.14)',
    borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s',
    textAlign: 'left',
  },
  catCardSel: { background: 'rgba(255,214,0,0.12)' },
  catLabel: { fontSize: '11px', fontWeight: '700', lineHeight: 1.25 },
  catDesc: { fontSize: '9.5px', color: 'rgba(255,255,255,0.42)', lineHeight: 1.3 },
  emergencyBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '2px',
    fontSize: '8px', fontWeight: '800', color: '#FCA5A5',
    background: 'rgba(239,68,68,0.18)', borderRadius: '4px', padding: '1px 4px',
  },
  selCheck: { fontSize: '10px', color: '#FFD600', fontWeight: '700' },

  // Issue chips
  issueGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  issueChip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '5px 11px',
    border: '1.5px solid rgba(255,255,255,0.14)',
    borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '11.5px', fontWeight: '600', lineHeight: 1,
    transition: 'all 0.13s',
  },
  clearAllBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.38)',
    fontFamily: 'inherit', padding: 0,
  },

  // AI strip
  aiStrip: {
    background: 'rgba(255,214,0,0.06)',
    border: '1px solid rgba(255,214,0,0.22)',
    borderRadius: '8px', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: '7px',
  },
  aiHeader: { display: 'flex', alignItems: 'center', gap: '6px' },
  aiTitle: { fontSize: '12px', fontWeight: '700', color: '#FFD600', flex: 1 },
  urgencyBadge: { fontSize: '10px', fontWeight: '700', borderRadius: '20px', padding: '2px 8px' },
  aiCause: { fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 },
  aiInspections: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  aiChip: {
    fontSize: '10.5px', fontWeight: '600', color: 'rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px', padding: '3px 8px',
  },

  // CTA
  go: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '15px 20px', background: '#FFD600', color: '#071530',
    border: 'none', borderRadius: '8px',
    fontSize: '15px', fontWeight: '800', letterSpacing: '-0.1px',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', width: '100%',
  },

  // Dealer preview
  dealerSkeleton: { display: 'flex', flexDirection: 'column', gap: '6px' },
  skeletonCard:   { height: '52px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'bfPulse 1.4s ease infinite' },
  dealerList:     { display: 'flex', flexDirection: 'column', gap: '6px' },
  dealerCard:     { background: '#16325f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  dealerTop:      { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  dealerName:     { fontSize: '12.5px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dealerAddr:     { fontSize: '11px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dealerMeta:     { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  dealerDist:     { fontSize: '11px', fontWeight: '800', color: '#FFD600', whiteSpace: 'nowrap' },
  dealerTags:     { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  dealerTag:      { display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '2px 7px' },

  // Summary
  summary: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px' },
  sumItem: { fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '3px' },
  sumDot: { color: 'rgba(255,255,255,0.22)', margin: '0 2px' },
}

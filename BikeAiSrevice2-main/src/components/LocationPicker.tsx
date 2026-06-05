import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Locate, X, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { mapsPlacesAutocomplete, mapsPlaceDetails, mapsReverseGeocode, mapsGeocode, PlacesPrediction } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocationValue {
  label: string
  city: string
  state: string
  locality: string
  lat: number | null
  lng: number | null
  placeId: string
  formattedAddress: string
}

interface Props {
  value: LocationValue | null
  onChange: (loc: LocationValue) => void
  onClear: () => void
  placeholder?: string
  autoFocus?: boolean
}

// ── India offline data ─────────────────────────────────────────────────────────

interface StateData {
  state: string
  cities: string[]
}

const INDIA_STATES: StateData[] = [
  { state: 'Andhra Pradesh',      cities: ['Visakhapatnam', 'Vijayawada', 'Tirupati', 'Guntur', 'Kakinada', 'Nellore', 'Kurnool', 'Rajahmundry', 'Eluru', 'Anantapur'] },
  { state: 'Arunachal Pradesh',   cities: ['Itanagar', 'Naharlagun', 'Pasighat'] },
  { state: 'Assam',               cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur'] },
  { state: 'Bihar',               cities: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Munger'] },
  { state: 'Chhattisgarh',        cities: ['Raipur', 'Bilaspur', 'Durg', 'Bhilai', 'Korba', 'Rajnandgaon'] },
  { state: 'Goa',                 cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'] },
  { state: 'Gujarat',             cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Nadiad'] },
  { state: 'Haryana',             cities: ['Faridabad', 'Gurugram', 'Hisar', 'Rohtak', 'Panipat', 'Karnal', 'Ambala', 'Yamunanagar', 'Panchkula'] },
  { state: 'Himachal Pradesh',    cities: ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'] },
  { state: 'Jharkhand',           cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar'] },
  { state: 'Karnataka',           cities: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Ballari', 'Shivamogga', 'Tumakuru', 'Davangere'] },
  { state: 'Kerala',              cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Palakkad', 'Alappuzha', 'Kannur', 'Malappuram'] },
  { state: 'Madhya Pradesh',      cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Ratlam', 'Satna', 'Dewas', 'Rewa'] },
  { state: 'Maharashtra',         cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Amravati', 'Thane', 'Navi Mumbai', 'Pimpri-Chinchwad', 'Mira-Bhayandar', 'Vasai-Virar', 'Bhiwandi', 'Sangli', 'Jalgaon', 'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur'] },
  { state: 'Manipur',             cities: ['Imphal'] },
  { state: 'Meghalaya',           cities: ['Shillong', 'Tura'] },
  { state: 'Mizoram',             cities: ['Aizawl', 'Lunglei'] },
  { state: 'Nagaland',            cities: ['Kohima', 'Dimapur'] },
  { state: 'Odisha',              cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Brahmapur', 'Sambalpur', 'Puri', 'Balasore'] },
  { state: 'Punjab',              cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Gurdaspur'] },
  { state: 'Rajasthan',           cities: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar'] },
  { state: 'Sikkim',              cities: ['Gangtok', 'Namchi'] },
  { state: 'Tamil Nadu',          cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Vellore', 'Thoothukudi', 'Erode'] },
  { state: 'Telangana',           cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Secunderabad'] },
  { state: 'Tripura',             cities: ['Agartala', 'Udaipur'] },
  { state: 'Uttar Pradesh',       cities: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Allahabad', 'Ghaziabad', 'Noida', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Firozabad', 'Jhansi', 'Mathura', 'Muzaffarnagar'] },
  { state: 'Uttarakhand',         cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Rishikesh', 'Nainital'] },
  { state: 'West Bengal',         cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Habra'] },
  { state: 'Delhi',               cities: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Dwarka', 'Rohini', 'Pitampura', 'Laxmi Nagar', 'Saket', 'Hauz Khas', 'Janakpuri'] },
  { state: 'Chandigarh',          cities: ['Chandigarh'] },
  { state: 'Jammu & Kashmir',     cities: ['Srinagar', 'Jammu', 'Baramulla', 'Anantnag', 'Sopore'] },
  { state: 'Ladakh',              cities: ['Leh', 'Kargil'] },
  { state: 'Puducherry',          cities: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'] },
  { state: 'Andaman & Nicobar',   cities: ['Port Blair'] },
  { state: 'Lakshadweep',         cities: ['Kavaratti'] },
  { state: 'Dadra & Nagar Haveli', cities: ['Silvassa', 'Daman', 'Diu'] },
]

type Step = 'state' | 'city' | 'area'

function extractComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
) {
  return components.find(c => c.types.includes(type))?.long_name ?? ''
}

function compactAddressLabel(formattedAddress = '') {
  return formattedAddress.split(',').map(p => p.trim()).filter(Boolean).slice(0, 3).join(', ')
}

function areaLabel(locality: string, city: string, formattedAddress = '') {
  return [locality, city].filter(Boolean).join(', ') || compactAddressLabel(formattedAddress) || 'Current location detected'
}

function newSessionToken() { return Math.random().toString(36).slice(2) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocationPicker({ value, onChange, onClear, placeholder = 'Select location', autoFocus }: Props) {
  const [open, setOpen]               = useState(false)
  const [step, setStep]               = useState<Step>('state')
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity]   = useState('')
  const [stateQuery, setStateQuery]   = useState('')
  const [cityQuery, setCityQuery]     = useState('')
  const [areaQuery, setAreaQuery]     = useState('')
  const [areaSugs, setAreaSugs]       = useState<PlacesPrediction[]>([])
  const [areaLoading, setAreaLoading] = useState(false)
  const [detecting, setDetecting]     = useState(false)
  const [sessionToken]                = useState(newSessionToken)

  const wrapRef   = useRef<HTMLDivElement>(null)
  const areaRef   = useRef<HTMLInputElement>(null)
  const debRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => { if (autoFocus) setOpen(true) }, [autoFocus])

  useEffect(() => {
    if (open && step === 'area') setTimeout(() => areaRef.current?.focus(), 80)
  }, [open, step])

  // When panel opens, reset to beginning if no value
  const openPanel = () => {
    if (!open) {
      if (!value) {
        setStep('state')
        setSelectedState('')
        setSelectedCity('')
        setStateQuery('')
        setCityQuery('')
        setAreaQuery('')
        setAreaSugs([])
      }
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  const pickState = (s: string) => {
    setSelectedState(s)
    setSelectedCity('')
    setCityQuery('')
    setStep('city')
  }

  const pickCity = (c: string) => {
    setSelectedCity(c)
    setAreaQuery('')
    setAreaSugs([])
    setStep('area')
  }

  const commitCity = (city: string, state: string) => {
    const label = `${city}, ${state}`
    onChange({ label, city, state, locality: '', lat: null, lng: null, placeId: '', formattedAddress: label })
    setOpen(false)
  }

  const handleAreaInput = useCallback((v: string) => {
    setAreaQuery(v)
    if (!v.trim()) { setAreaSugs([]); return }
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(async () => {
      setAreaLoading(true)
      try {
        const res = await mapsPlacesAutocomplete(`${v}, ${selectedCity}, ${selectedState}`, { sessionToken })
        setAreaSugs(res.predictions?.slice(0, 6) ?? [])
      } catch { setAreaSugs([]) }
      setAreaLoading(false)
    }, 280)
  }, [selectedCity, selectedState, sessionToken])

  const selectAreaPrediction = async (pred: PlacesPrediction) => {
    setAreaLoading(true)
    try {
      const res   = await mapsPlaceDetails(pred.place_id, sessionToken)
      const d     = res.detail
      const comps = d.address_components ?? []
      const locality = extractComponent(comps, 'sublocality_level_1') ||
                       extractComponent(comps, 'neighborhood') ||
                       extractComponent(comps, 'locality') ||
                       pred.structured_formatting.main_text
      const city  = extractComponent(comps, 'locality') || selectedCity
      const state = extractComponent(comps, 'administrative_area_level_1') || selectedState
      const label = areaLabel(locality, city, d.formatted_address)
      onChange({
        label, city, state, locality,
        lat:  d.geometry?.location.lat ?? null,
        lng:  d.geometry?.location.lng ?? null,
        placeId: pred.place_id,
        formattedAddress: d.formatted_address,
      })
    } catch {
      const label = `${areaQuery}, ${selectedCity}`
      onChange({ label, city: selectedCity, state: selectedState, locality: areaQuery, lat: null, lng: null, placeId: '', formattedAddress: label })
    }
    setAreaLoading(false)
    setOpen(false)
  }

  const handlePincode = async (pin: string) => {
    if (!/^\d{6}$/.test(pin)) return
    setAreaLoading(true)
    try {
      const res = await mapsGeocode(`${pin}, India`)
      const loc = res.locations?.[0]
      if (loc) {
        const comps    = loc.address_components
        const locality = extractComponent(comps, 'sublocality_level_1') || extractComponent(comps, 'locality')
        const city     = extractComponent(comps, 'locality') || extractComponent(comps, 'administrative_area_level_2')
        const state    = extractComponent(comps, 'administrative_area_level_1')
        const label    = areaLabel(locality, city, loc.formatted_address)
        onChange({ label, city, state, locality, lat: loc.geometry.location.lat, lng: loc.geometry.location.lng, placeId: loc.place_id, formattedAddress: loc.formatted_address })
        setOpen(false)
      }
    } catch { /* silent */ }
    setAreaLoading(false)
  }

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setDetecting(true)
    setOpen(false)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await mapsReverseGeocode(lat, lng)
          const loc = res.locations?.[0]
          if (loc) {
            const comps    = loc.address_components
            const locality = extractComponent(comps, 'sublocality_level_1') || extractComponent(comps, 'neighborhood') || extractComponent(comps, 'locality')
            const city     = extractComponent(comps, 'locality') || extractComponent(comps, 'administrative_area_level_2')
            const state    = extractComponent(comps, 'administrative_area_level_1')
            const label    = areaLabel(locality, city, loc.formatted_address)
            onChange({ label, city, state, locality, lat, lng, placeId: loc.place_id, formattedAddress: loc.formatted_address })
          } else {
            const fallback = 'Current location detected'
            onChange({ label: fallback, city: '', state: '', locality: 'Current location', lat, lng, placeId: '', formattedAddress: fallback })
          }
        } catch {
          const fallback = 'Current location detected'
          onChange({ label: fallback, city: '', state: '', locality: 'Current location', lat, lng, placeId: '', formattedAddress: fallback })
        }
        setDetecting(false)
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const filteredStates = INDIA_STATES.filter(s =>
    s.state.toLowerCase().includes(stateQuery.toLowerCase())
  )
  const filteredCities = (INDIA_STATES.find(s => s.state === selectedState)?.cities ?? []).filter(c =>
    c.toLowerCase().includes(cityQuery.toLowerCase())
  )

  const displayLabel = value?.label || ''
  const hasValue = !!value?.label

  const breadcrumb = [selectedState, selectedCity].filter(Boolean).join(' › ')

  return (
    <div style={lp.wrap} ref={wrapRef}>
      <style>{`
        .lp-trigger:focus-within { border-color: rgba(255,214,0,0.7) !important; box-shadow: 0 0 0 3px rgba(255,214,0,0.14) !important; }
        .lp-row:hover { background: rgba(255,214,0,0.09) !important; }
        .lp-row-active { background: rgba(255,214,0,0.13) !important; color: #FFD600 !important; }
        .lp-detect:hover:not(:disabled) { background: rgba(255,214,0,0.26) !important; border-color: rgba(255,214,0,0.55) !important; }
        .lp-area-inp::placeholder { color: rgba(255,255,255,0.38) !important; }
        .lp-area-inp:focus { outline: none !important; }
        .lp-sug:hover { background: rgba(255,214,0,0.09) !important; }
        @keyframes lpDrop { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lpSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Trigger row */}
      <div style={{ ...lp.trigger, ...(hasValue ? lp.triggerFilled : {}) }} className="lp-trigger" onClick={openPanel}>
        <MapPin size={14} color={hasValue ? '#FFD600' : 'rgba(255,255,255,0.35)'} style={{ flexShrink: 0 }} />
        <span style={{ ...lp.triggerText, color: hasValue ? 'white' : 'rgba(255,255,255,0.38)', fontWeight: hasValue ? 500 : 400, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {detecting ? 'Detecting…' : (displayLabel || placeholder)}
        </span>
        {hasValue && !detecting ? (
          <button style={lp.clearBtn} onClick={e => { e.stopPropagation(); onClear(); setSelectedState(''); setSelectedCity('') }}>
            <X size={12} color="rgba(255,255,255,0.45)" />
          </button>
        ) : !detecting ? (
          <button style={lp.detectBtn} className="lp-detect" onClick={e => { e.stopPropagation(); detectLocation() }} disabled={detecting}>
            <Locate size={11} style={{ flexShrink: 0 }} />
            <span>Detect</span>
          </button>
        ) : (
          <span style={lp.spinner} />
        )}
      </div>

      {/* Resolved pill */}
      {hasValue && value?.city && (
        <div style={lp.pill}>
          <MapPin size={10} color="#FFD600" />
          <span style={lp.pillText}>{[value.locality, value.city, value.state].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div style={lp.panel}>
          {/* Panel header with breadcrumb */}
          <div style={lp.panelHeader}>
            {breadcrumb ? (
              <button style={lp.backBtn} onClick={() => {
                if (step === 'area') setStep('city')
                else if (step === 'city') { setStep('state'); setSelectedState('') }
              }}>
                ← {breadcrumb}
              </button>
            ) : (
              <span style={lp.panelTitle}>Select State</span>
            )}
            <div style={lp.stepDots}>
              {(['state', 'city', 'area'] as Step[]).map(s => (
                <span key={s} style={{ ...lp.dot, background: step === s ? '#FFD600' : (
                  (s === 'city' && (step === 'area')) || (s === 'state' && step !== 'state') ? 'rgba(255,214,0,0.4)' : 'rgba(255,255,255,0.15)'
                )}} />
              ))}
            </div>
          </div>

          {/* STATE step */}
          {step === 'state' && (
            <>
              <div style={lp.searchRow}>
                <Search size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                <input
                  style={lp.searchInput}
                  className="lp-area-inp"
                  placeholder="Search state…"
                  value={stateQuery}
                  onChange={e => setStateQuery(e.target.value)}
                  autoFocus
                />
                {stateQuery && <button style={lp.clearInline} onClick={() => setStateQuery('')}><X size={11} color="rgba(255,255,255,0.3)" /></button>}
              </div>
              <div style={lp.list}>
                {filteredStates.map(s => (
                  <button key={s.state} style={lp.row} className="lp-row" onClick={() => pickState(s.state)}>
                    <span style={lp.rowLabel}>{s.state}</span>
                    <span style={lp.rowMeta}>{s.cities.length} cities</span>
                    <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* CITY step */}
          {step === 'city' && (
            <>
              <div style={lp.searchRow}>
                <Search size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                <input
                  style={lp.searchInput}
                  className="lp-area-inp"
                  placeholder={`Search city in ${selectedState}…`}
                  value={cityQuery}
                  onChange={e => setCityQuery(e.target.value)}
                  autoFocus
                />
                {cityQuery && <button style={lp.clearInline} onClick={() => setCityQuery('')}><X size={11} color="rgba(255,255,255,0.3)" /></button>}
              </div>
              <div style={lp.list}>
                {filteredCities.map(c => (
                  <button key={c} style={lp.row} className="lp-row" onClick={() => pickCity(c)}>
                    <MapPin size={12} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
                    <span style={{ ...lp.rowLabel, flex: 1 }}>{c}</span>
                    <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
                {filteredCities.length === 0 && (
                  <div style={lp.emptyHint}>No cities match "{cityQuery}"</div>
                )}
              </div>
              <button style={lp.skipBtn} onClick={() => commitCity(selectedState, selectedState)}>
                Skip — use {selectedState} <ChevronDown size={11} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </>
          )}

          {/* AREA step */}
          {step === 'area' && (
            <>
              <div style={lp.searchRow}>
                <Search size={13} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                <input
                  ref={areaRef}
                  style={lp.searchInput}
                  className="lp-area-inp"
                  placeholder={`Area, locality or 6-digit pincode in ${selectedCity}…`}
                  value={areaQuery}
                  onChange={e => {
                    handleAreaInput(e.target.value)
                    if (/^\d{6}$/.test(e.target.value)) handlePincode(e.target.value)
                  }}
                />
                {areaLoading && <span style={lp.spinner} />}
                {areaQuery && !areaLoading && <button style={lp.clearInline} onClick={() => { setAreaQuery(''); setAreaSugs([]) }}><X size={11} color="rgba(255,255,255,0.3)" /></button>}
              </div>

              {areaSugs.length > 0 ? (
                <div style={lp.list}>
                  {areaSugs.map(p => (
                    <button key={p.place_id} style={lp.row} className="lp-sug" onClick={() => selectAreaPrediction(p)}>
                      <MapPin size={12} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={lp.rowLabel}>{p.structured_formatting.main_text}</div>
                        {p.structured_formatting.secondary_text && (
                          <div style={lp.rowMeta}>{p.structured_formatting.secondary_text}</div>
                        )}
                      </div>
                      <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              ) : areaQuery.length === 0 ? (
                <div style={lp.areaHint}>Type an area name or 6-digit pincode</div>
              ) : null}

              <button style={lp.skipBtn} onClick={() => commitCity(selectedCity, selectedState)}>
                Skip — use {selectedCity} only <ChevronDown size={11} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const lp: Record<string, React.CSSProperties> = {
  wrap:    { position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px' },

  trigger: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.08)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: '10px', cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit', minWidth: 0,
  },
  triggerFilled: { borderColor: 'rgba(255,214,0,0.4)' },
  triggerText: { fontSize: '13px', fontFamily: 'inherit' },

  clearBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  detectBtn: {
    display: 'flex', alignItems: 'center', gap: '3px',
    padding: '5px 9px',
    background: 'rgba(255,214,0,0.16)', border: '1px solid rgba(255,214,0,0.35)',
    borderRadius: '7px',
    fontSize: '11px', fontWeight: '700', color: '#FFD600',
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    transition: 'all 0.13s',
  },
  spinner: {
    display: 'inline-block', width: '12px', height: '12px',
    border: '2px solid rgba(255,214,0,0.2)', borderTopColor: '#FFD600',
    borderRadius: '50%', animation: 'lpSpin 0.7s linear infinite', flexShrink: 0,
  },
  pill: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '4px 9px',
    background: 'rgba(255,214,0,0.08)', border: '1px solid rgba(255,214,0,0.22)',
    borderRadius: '7px', width: 'fit-content',
  },
  pillText: { fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  panel: {
    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 500,
    background: '#0c1d40', border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '14px', boxShadow: '0 12px 48px rgba(0,0,0,0.65)',
    overflow: 'hidden', animation: 'lpDrop 0.17s ease',
    display: 'flex', flexDirection: 'column', maxHeight: '320px',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  panelTitle: { fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    fontSize: '12.5px', fontWeight: '600', color: '#FFD600', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  stepDots: { display: 'flex', gap: '4px', alignItems: 'center' },
  dot:      { width: '6px', height: '6px', borderRadius: '50%', transition: 'background 0.2s' },

  searchRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 13px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none',
    fontSize: '13px', fontWeight: '500', color: 'white', fontFamily: 'inherit',
  },
  clearInline: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },

  list: { overflowY: 'auto', flex: 1 },
  row:  {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', background: 'none', border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
    textAlign: 'left',
  },
  rowLabel: { fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.88)', flex: 1, textAlign: 'left' },
  rowMeta:  { fontSize: '11px', color: 'rgba(255,255,255,0.38)', flexShrink: 0 },
  emptyHint:{ padding: '16px', fontSize: '12.5px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  areaHint: { padding: '14px 16px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  skipBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
    padding: '9px', borderTop: '1px solid rgba(255,255,255,0.07)',
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.45)',
    flexShrink: 0, transition: 'color 0.1s',
  },
}

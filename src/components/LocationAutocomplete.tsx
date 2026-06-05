import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Locate, X, Search, ChevronRight } from 'lucide-react'
import { mapsPlacesAutocomplete, mapsPlaceDetails, mapsReverseGeocode, mapsGeocode, PlacesPrediction } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocationValue {
  label: string        // display string shown in input
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
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
) {
  return components.find(c => c.types.includes(type))?.long_name ?? ''
}

function isPincode(s: string) { return /^\d{6}$/.test(s.trim()) }

function compactAddressLabel(formattedAddress = '') {
  return formattedAddress.split(',').map(p => p.trim()).filter(Boolean).slice(0, 3).join(', ')
}

function areaLabel(locality: string, city: string, formattedAddress = '') {
  return [locality, city].filter(Boolean).join(', ') || compactAddressLabel(formattedAddress) || 'Current location detected'
}

// Session token refreshes per autocomplete session (billing optimization)
function newSessionToken() { return Math.random().toString(36).slice(2) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocationAutocomplete({ value, onChange, onClear, placeholder = 'Area, city or pincode', autoFocus, className }: Props) {
  const [query, setQuery]           = useState(value?.label ?? '')
  const [suggestions, setSugs]      = useState<PlacesPrediction[]>([])
  const [loading, setLoading]       = useState(false)
  const [detecting, setDetecting]   = useState(false)
  const [open, setOpen]             = useState(false)
  const [sessionToken]              = useState(newSessionToken)
  const [apiAvailable, setApiAvail] = useState(true)  // false when NO_KEY returned

  const inputRef    = useRef<HTMLInputElement>(null)
  const dropRef     = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync query when value changes externally (e.g. detect button fills it)
  useEffect(() => {
    if (value?.label && value.label !== query) setQuery(value.label)
  }, [value?.label])

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Auto-focus when prop set
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!apiAvailable) return
    if (q.length < 2) { setSugs([]); setOpen(false); return }

    // Pincode: resolve directly via geocode, no autocomplete needed
    if (isPincode(q)) {
      setLoading(true)
      try {
        const res = await mapsGeocode(`${q}, India`)
        const loc = res.locations?.[0]
        if (loc) {
          const comps = loc.address_components
          const locality = extractComponent(comps, 'sublocality_level_1') ||
                           extractComponent(comps, 'locality')
          const city     = extractComponent(comps, 'locality') ||
                           extractComponent(comps, 'administrative_area_level_2')
          const state    = extractComponent(comps, 'administrative_area_level_1')
          const label    = [locality, city, state].filter(Boolean).join(', ')
          onChange({
            label, city, state, locality,
            lat: loc.geometry.location.lat,
            lng: loc.geometry.location.lng,
            placeId: loc.place_id,
            formattedAddress: loc.formatted_address,
          })
          setQuery(label)
          setSugs([])
          setOpen(false)
        }
      } catch { /* silent — API may not be configured */ }
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await mapsPlacesAutocomplete(q, { sessionToken })
      if (res.status === 'REQUEST_DENIED' || (res as unknown as { code?: string }).code === 'NO_KEY') {
        setApiAvail(false)
        setSugs([])
        setOpen(false)
      } else {
        setSugs(res.predictions ?? [])
        setOpen((res.predictions?.length ?? 0) > 0)
      }
    } catch { setSugs([]); setOpen(false) }
    setLoading(false)
  }, [apiAvailable, sessionToken, onChange])

  const handleInput = (v: string) => {
    setQuery(v)
    if (!v.trim()) { setSugs([]); setOpen(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 280)
  }

  const selectPrediction = async (pred: PlacesPrediction) => {
    setOpen(false)
    setSugs([])
    setQuery(pred.description)
    setLoading(true)
    try {
      const res = await mapsPlaceDetails(pred.place_id, sessionToken)
      const d   = res.detail
      const comps = d.address_components ?? []
      const locality = extractComponent(comps, 'sublocality_level_1') ||
                       extractComponent(comps, 'neighborhood') ||
                       extractComponent(comps, 'locality')
      const city     = extractComponent(comps, 'locality') ||
                       extractComponent(comps, 'administrative_area_level_2')
      const state    = extractComponent(comps, 'administrative_area_level_1')
      const label    = pred.structured_formatting.main_text +
                       (pred.structured_formatting.secondary_text ? ', ' + pred.structured_formatting.secondary_text : '')
      onChange({
        label,
        city, state, locality,
        lat: d.geometry?.location.lat ?? null,
        lng: d.geometry?.location.lng ?? null,
        placeId: pred.place_id,
        formattedAddress: d.formatted_address,
      })
      setQuery(label)
    } catch { /* keep typed text as label */
      onChange({
        label: pred.description, city: '', state: '', locality: '',
        lat: null, lng: null, placeId: pred.place_id, formattedAddress: pred.description,
      })
    }
    setLoading(false)
  }

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setDetecting(true)
    setQuery('Detecting location…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res   = await mapsReverseGeocode(lat, lng)
          const loc   = res.locations?.[0]
          if (loc) {
            const comps    = loc.address_components
            const locality = extractComponent(comps, 'sublocality_level_1') ||
                             extractComponent(comps, 'neighborhood') ||
                             extractComponent(comps, 'locality')
            const city     = extractComponent(comps, 'locality') ||
                             extractComponent(comps, 'administrative_area_level_2')
            const state    = extractComponent(comps, 'administrative_area_level_1')
            const label    = areaLabel(locality, city, loc.formatted_address)
            onChange({ label, city, state, locality, lat, lng, placeId: loc.place_id, formattedAddress: loc.formatted_address })
            setQuery(label)
          } else {
            const fallback = 'Current location detected'
            onChange({ label: fallback, city: '', state: '', locality: 'Current location', lat, lng, placeId: '', formattedAddress: fallback })
            setQuery(fallback)
          }
        } catch {
          const fallback = 'Current location detected'
          onChange({ label: fallback, city: '', state: '', locality: 'Current location', lat, lng, placeId: '', formattedAddress: fallback })
          setQuery(fallback)
        }
        setDetecting(false)
      },
      () => { setDetecting(false); setQuery('') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const clear = () => {
    setQuery('')
    setSugs([])
    setOpen(false)
    onClear()
    inputRef.current?.focus()
  }

  const hasValue = !!value?.label

  return (
    <div style={la.wrap} className={className}>
      <style>{`
        .la-input:focus   { border-color: rgba(255,214,0,0.7) !important; box-shadow: 0 0 0 3px rgba(255,214,0,0.14) !important; outline: none; }
        .la-input::placeholder { color: rgba(255,255,255,0.38); font-weight: 400; }
        .la-sug:hover  { background: rgba(255,214,0,0.09) !important; }
        .la-sug.active { background: rgba(255,214,0,0.13) !important; }
        .la-detect:hover:not(:disabled) { background: rgba(255,214,0,0.26) !important; border-color: rgba(255,214,0,0.55) !important; }
        @keyframes laSpin { to { transform: rotate(360deg); } }
        @keyframes laDrop { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Input row */}
      <div style={la.row}>
        <MapPin size={14} color={hasValue ? '#FFD600' : 'rgba(255,255,255,0.35)'} style={la.mapPin} />
        <input
          ref={inputRef}
          style={la.input}
          className="la-input"
          placeholder={placeholder}
          value={detecting ? 'Detecting location…' : query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length) setOpen(true) }}
          autoComplete="off"
          spellCheck={false}
          disabled={detecting}
        />

        {/* Spinner while fetching */}
        {(loading && !detecting) && (
          <span style={la.spinner} />
        )}

        {/* Clear button when filled */}
        {hasValue && !detecting && !loading && (
          <button style={la.iconBtn} onClick={clear} title="Clear location">
            <X size={12} color="rgba(255,255,255,0.45)" />
          </button>
        )}

        {/* Detect / spinner */}
        {!hasValue && !loading && (
          <button style={la.detectBtn} className="la-detect" onClick={detectLocation} disabled={detecting} title="Use my location">
            {detecting
              ? <span style={la.spinner} />
              : <><Locate size={11} style={{ flexShrink: 0 }} /><span>Detect</span></>
            }
          </button>
        )}
      </div>

      {/* Selected location pill */}
      {value?.city && (
        <div style={la.pill}>
          <MapPin size={10} color="#FFD600" />
          <span style={la.pillText}>{[value.locality, value.city, value.state].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div style={la.dropdown} ref={dropRef}>
          {suggestions.map((pred, i) => (
            <button
              key={pred.place_id}
              style={{ ...la.sug, ...(i < suggestions.length - 1 ? la.sugBorder : {}) }}
              className="la-sug"
              onClick={() => selectPrediction(pred)}
            >
              <div style={la.sugIcon}><MapPin size={12} color="rgba(255,255,255,0.4)" /></div>
              <div style={la.sugText}>
                <span style={la.sugMain}>{pred.structured_formatting.main_text}</span>
                {pred.structured_formatting.secondary_text && (
                  <span style={la.sugSub}>{pred.structured_formatting.secondary_text}</span>
                )}
              </div>
              <ChevronRight size={12} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
            </button>
          ))}
          <div style={la.poweredBy}>
            <Search size={9} color="rgba(255,255,255,0.2)" />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>Powered by Google</span>
          </div>
        </div>
      )}

      {/* Fallback: API not available — plain text mode hint */}
      {!apiAvailable && !hasValue && query.length > 1 && (
        <div style={la.fallbackHint}>
          <Search size={10} color="rgba(255,255,255,0.3)" />
          <span>Type your city or area name and press Enter</span>
          <button style={la.fallbackUse} onClick={() => {
            onChange({ label: query, city: query, state: '', locality: '', lat: null, lng: null, placeId: '', formattedAddress: query })
            setOpen(false)
          }}>Use "{query}"</button>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const la: Record<string, React.CSSProperties> = {
  wrap:  { position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px' },

  row: {
    position: 'relative',
    display: 'flex', alignItems: 'center',
  },
  mapPin: {
    position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
    pointerEvents: 'none', flexShrink: 0,
  },
  input: {
    width: '100%', padding: '10px 80px 10px 30px',
    background: 'rgba(255,255,255,0.08)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: '10px',
    fontSize: '13px', fontWeight: '500', color: 'white', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  iconBtn: {
    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  detectBtn: {
    position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', gap: '3px',
    padding: '5px 9px',
    background: 'rgba(255,214,0,0.16)', border: '1px solid rgba(255,214,0,0.35)',
    borderRadius: '7px',
    fontSize: '11px', fontWeight: '700', color: '#FFD600',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.13s', flexShrink: 0,
  },
  spinner: {
    display: 'inline-block',
    width: '12px', height: '12px',
    border: '2px solid rgba(255,214,0,0.2)',
    borderTopColor: '#FFD600',
    borderRadius: '50%',
    animation: 'laSpin 0.7s linear infinite',
    flexShrink: 0,
  },

  // Resolved location pill
  pill: {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '4px 9px',
    background: 'rgba(255,214,0,0.08)',
    border: '1px solid rgba(255,214,0,0.22)',
    borderRadius: '7px',
    width: 'fit-content',
  },
  pillText:  { fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  pillCoord: { fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginLeft: '4px' },

  // Dropdown
  dropdown: {
    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 500,
    background: '#0c1d40',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '13px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
    overflow: 'hidden',
    animation: 'laDrop 0.17s ease',
  },
  sug: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px',
    background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', transition: 'background 0.1s',
    fontFamily: 'inherit',
  },
  sugBorder: { borderBottom: '1px solid rgba(255,255,255,0.07)' },
  sugIcon:  { display: 'flex', alignItems: 'center', flexShrink: 0 },
  sugText:  { display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 },
  sugMain:  { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sugSub:   { fontSize: '11px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  poweredBy: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', justifyContent: 'flex-end' },

  // API fallback
  fallbackHint: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '11px', color: 'rgba(255,255,255,0.4)',
  },
  fallbackUse: {
    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontWeight: '700', color: '#FFD600', fontFamily: 'inherit',
    padding: '2px 0', flexShrink: 0,
  },
}

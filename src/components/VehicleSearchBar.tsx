/**
 * VehicleSearchBar
 * Variants: 'header' (compact, inline) | 'page' (full width, standalone)
 * Features: autocomplete · voice · recent searches · popular · grouped dropdown
 */

import {
  useState, useEffect, useRef, useCallback,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Mic, MicOff, ArrowRight, Bot,
  Bike, Car, Zap, Wrench, Clock, TrendingUp, Loader,
} from 'lucide-react'
import {
  loadIndex, isLoaded, autocomplete, popular, trending,
  getRecentSearches, getPopularSearches, logSearch,
  VehicleResult, SEG_COLORS,
} from '../lib/vehicleSearch'

interface Props {
  variant?: 'header' | 'page'
  placeholder?: string
  autoFocus?: boolean
  onSelect?: (r: VehicleResult) => void
}

const ROTATE_PLACEHOLDERS = [
  'Search Honda Activa, Hero Splendor…',
  'Ask BikeAI anything…',
  'Find nearest workshop…',
  'Check tyre pressure for my bike…',
  'Book service appointment…',
  'Ather 450X battery range?',
  'KTM Duke 390 specs…',
]

// Session ID persisted in sessionStorage
function getSessionId(): string {
  let id = sessionStorage.getItem('bikeai_sid')
  if (!id) { id = `s${Date.now()}${Math.random().toString(36).slice(2, 6)}`; sessionStorage.setItem('bikeai_sid', id) }
  return id
}

export default function VehicleSearchBar({ variant = 'page', placeholder, autoFocus = false, onSelect }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VehicleResult[]>([])
  const [open, setOpen] = useState(false)
  const [indexReady, setIndexReady] = useState(isLoaded())
  const [listening, setListening] = useState(false)
  const [phIdx, setPhIdx] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularSearches, setPopularSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sid = useRef(getSessionId())

  // Load index
  useEffect(() => {
    if (!isLoaded()) {
      loadIndex().then(() => {
        setIndexReady(true)
        setResults(popular(6))
      })
    } else {
      setResults(popular(6))
    }
  }, [])

  // Fetch recent + popular for empty-state dropdown
  useEffect(() => {
    getRecentSearches(sid.current).then(setRecentSearches)
    getPopularSearches().then(setPopularSearches)
  }, [])

  // Rotate placeholder
  useEffect(() => {
    if (placeholder) return
    const t = setInterval(() => setPhIdx(i => (i + 1) % ROTATE_PLACEHOLDERS.length), 3000)
    return () => clearInterval(t)
  }, [placeholder])

  // Auto-focus
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const runSearch = useCallback((q: string) => {
    const res = autocomplete(q)
    setResults(res)
    if (q.length >= 2) {
      logSearch({ query: q, results: res.length, sessionId: sid.current })
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    if (debounce.current) clearTimeout(debounce.current)
    if (!v.trim()) { setResults(popular(6)); return }
    debounce.current = setTimeout(() => runSearch(v), 140)
  }

  const handleFocus = () => {
    setOpen(true)
    if (!query) setResults(popular(6))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    if (e.key === 'Enter' && query.trim()) go(query)
  }

  const go = (q: string) => {
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const pick = (r: VehicleResult) => {
    setOpen(false)
    logSearch({ query, results: results.length, clickedId: r.id, clickedType: r.type, sessionId: sid.current })
    if (onSelect) { onSelect(r); return }
    if (r.type === 'oem') navigate(`/search?oem=${r.oemSlug}`)
    else if (r.type === 'model') navigate(`/search?q=${encodeURIComponent(r.title)}`)
    else if (r.type === 'segment') navigate(`/search?segment=${r.segment}`)
    else if (r.action === 'book') navigate('/bookings/new')
    else if (r.action === 'workshop') navigate(`/search?q=${encodeURIComponent(query || 'nearest workshop')}`)
    else if (r.type === 'nlp') navigate(`/search?q=${encodeURIComponent(query)}`)
    else go(query)
  }

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.onstart = () => setListening(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript as string
      setQuery(t)
      setOpen(true)
      runSearch(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
  }

  const isHeader = variant === 'header'

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: isHeader ? '#f8f9fc' : 'white',
        border: `1.5px solid ${open ? '#0f2044' : '#e2e6f0'}`,
        borderRadius: isHeader ? '9px' : '12px',
        padding: isHeader ? '7px 10px' : '11px 14px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: open ? '0 0 0 3px rgba(15,32,68,0.06)' : 'none',
      }}>
        {!indexReady
          ? <Loader size={16} color="#9aa3b8" style={{ flexShrink: 0, animation: 'bikeai-spin 1s linear infinite' }} />
          : <Search size={16} color={open ? '#0f2044' : '#9aa3b8'} style={{ flexShrink: 0 }} />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? ROTATE_PLACEHOLDERS[phIdx]}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'none',
            fontSize: isHeader ? '13px' : '14.5px',
            color: '#0f2044', fontFamily: 'inherit',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(popular(6)); inputRef.current?.focus() }}
            style={B.iconBtn}>
            <X size={13} color="#9aa3b8" />
          </button>
        )}
        <button onClick={startVoice} title="Voice search" style={{ ...B.iconBtn, color: listening ? '#dc2626' : '#9aa3b8' }}>
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        {!isHeader && (
          <button
            onClick={() => query.trim() && go(query)}
            style={B.searchBtn}>
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <style>{`@keyframes bikeai-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e2e6f0', borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(15,32,68,0.16)', zIndex: 500,
          maxHeight: isHeader ? '380px' : '460px', overflowY: 'auto',
        }}>
          {!indexReady ? (
            <LoadingDrop />
          ) : !query.trim() ? (
            <EmptyDrop
              recent={recentSearches}
              popular={popularSearches.length ? popularSearches : DEFAULT_POPULAR}
              trending={trending(6)}
              onPick={pick}
              onQuery={go}
            />
          ) : results.length === 0 ? (
            <NoResults query={query} />
          ) : (
            <ResultsDrop results={results} query={query} onPick={pick} />
          )}

          {/* Full results link */}
          {query.trim() && (
            <button onClick={() => go(query)} style={B.seeAll}>
              <Search size={12} /> See all results for "{query}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Dropdown sub-components ──────────────────────────────────────────────────

function LoadingDrop() {
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <Loader size={22} color="#9aa3b8" style={{ display: 'block', margin: '0 auto 8px', animation: 'bikeai-spin 1s linear infinite' }} />
      <span style={{ fontSize: '13px', color: '#9aa3b8' }}>Loading vehicle database…</span>
    </div>
  )
}

const DEFAULT_POPULAR = [
  'Honda Activa 6G', 'Hero Splendor Plus', 'TVS Apache RTR 160',
  'Royal Enfield Classic 350', 'KTM Duke 390', 'Ather 450X',
]

function EmptyDrop({ recent, popular, trending, onPick, onQuery }: {
  recent: string[]; popular: string[]; trending: VehicleResult[];
  onPick: (r: VehicleResult) => void; onQuery: (q: string) => void
}) {
  return (
    <>
      {recent.length > 0 && (
        <DropSection label="Recent" icon={<Clock size={12} />}>
          {recent.slice(0, 4).map(q => (
            <button key={q} onMouseDown={() => onQuery(q)} style={B.textRow}>
              <Clock size={13} color="#9aa3b8" />
              <span style={{ fontSize: '13.5px', color: '#374151' }}>{q}</span>
            </button>
          ))}
        </DropSection>
      )}
      <DropSection label="Trending" icon={<TrendingUp size={12} />}>
        {popular.slice(0, 5).map(q => (
          <button key={q} onMouseDown={() => onQuery(q)} style={B.textRow}>
            <TrendingUp size={13} color="#f5e019" />
            <span style={{ fontSize: '13.5px', color: '#374151' }}>{q}</span>
          </button>
        ))}
      </DropSection>
      {trending.length > 0 && (
        <DropSection label="Popular Models" icon={<Bike size={12} />}>
          {trending.slice(0, 4).map(r => <ResultRow key={r.id} r={r} onPick={onPick} />)}
        </DropSection>
      )}
    </>
  )
}

function ResultsDrop({ results, query: _q, onPick }: { results: VehicleResult[]; query: string; onPick: (r: VehicleResult) => void }) {
  const nlp = results.filter(r => r.type === 'nlp')
  const oems = results.filter(r => r.type === 'oem')
  const models = results.filter(r => r.type === 'model')
  const segs = results.filter(r => r.type === 'segment')
  const actions = results.filter(r => r.type === 'action')
  return (
    <>
      {nlp.map(r => <NLPRow key={r.id} r={r} onPick={onPick} />)}
      {oems.length > 0 && <DropSection label="Brands" icon={<Bike size={12} />}>{oems.map(r => <ResultRow key={r.id} r={r} onPick={onPick} />)}</DropSection>}
      {models.length > 0 && <DropSection label="Models" icon={<Car size={12} />}>{models.map(r => <ResultRow key={r.id} r={r} onPick={onPick} />)}</DropSection>}
      {segs.length > 0 && <DropSection label="Categories" icon={<Zap size={12} />}>{segs.map(r => <ResultRow key={r.id} r={r} onPick={onPick} />)}</DropSection>}
      {actions.length > 0 && <DropSection label="Quick Actions" icon={<Wrench size={12} />}>{actions.map(r => <ResultRow key={r.id} r={r} onPick={onPick} />)}</DropSection>}
    </>
  )
}

function DropSection({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={B.groupLabel}>{icon} {label}</div>
      {children}
    </div>
  )
}

function NLPRow({ r, onPick }: { r: VehicleResult; onPick: (r: VehicleResult) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onMouseDown={() => onPick(r)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '100%', padding: '10px 14px', background: hov ? '#fffbeb' : '#fffef7', border: 'none', borderBottom: '1px solid #fef3c7', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
    >
      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f5e019', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Bot size={14} color="#0f2044" />
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#d97706', letterSpacing: '0.06em', marginBottom: '3px' }}>BikeAI Answer</div>
        <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{r.nlpAnswer?.slice(0, 110)}…</div>
      </div>
    </button>
  )
}

function ResultRow({ r, onPick }: { r: VehicleResult; onPick: (r: VehicleResult) => void }) {
  const [hov, setHov] = useState(false)
  const segColor = r.segment ? (SEG_COLORS[r.segment] ?? '#6b7595') : '#6b7595'
  const iconBg = r.isEV ? '#dcfce7' : r.type === 'oem' ? '#eef2f8' : `${segColor}18`
  const iconColor = r.isEV ? '#16a34a' : r.type === 'oem' ? '#0f2044' : segColor

  const Icon = r.type === 'oem' ? Bike : r.type === 'action' ? Wrench : r.type === 'segment' ? Zap : Car

  return (
    <button
      onMouseDown={() => onPick(r)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '100%', padding: '8px 14px', background: hov ? '#f8f9fc' : 'white', border: 'none', borderBottom: '1px solid #f8f9fc', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', gap: '10px', alignItems: 'center' }}
    >
      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        <div style={{ fontSize: '11.5px', color: '#9aa3b8' }}>{r.subtitle}</div>
      </div>
      {r.badge && (
        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '7px', background: `${r.badgeColor ?? '#6b7595'}18`, color: r.badgeColor ?? '#6b7595', flexShrink: 0 }}>
          {r.badge}
        </span>
      )}
    </button>
  )
}

function NoResults({ query }: { query: string }) {
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <Search size={24} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 8px' }} />
      <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f2044', marginBottom: '4px' }}>No results for "{query}"</div>
      <div style={{ fontSize: '12.5px', color: '#9aa3b8' }}>Try: "Honda Activa", "sports bike", "tyre pressure"</div>
    </div>
  )
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const B: Record<string, React.CSSProperties> = {
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0 },
  searchBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#0f2044', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', flexShrink: 0 },
  groupLabel: { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px 3px', fontSize: '10.5px', fontWeight: '700', color: '#9aa3b8', textTransform: 'uppercase' as const, letterSpacing: '0.09em' },
  textRow: { width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', display: 'flex', gap: '10px', alignItems: 'center' },
  seeAll: { width: '100%', padding: '10px 14px', background: '#f8f9fc', border: 'none', borderTop: '1px solid #f1f3f8', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#0f2044', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' },
}

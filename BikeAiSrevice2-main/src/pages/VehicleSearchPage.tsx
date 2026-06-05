import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  loadIndex, isLoaded, search as engineSearch,
  trending as getTrending, VehicleResult, SEG_COLORS, SEG_LABELS,
} from '../lib/vehicleSearch'
import VehicleSearchBar from '../components/VehicleSearchBar'
import { Bot, Car, Bike, Zap, Calendar, ChevronRight, LayoutGrid, List, ListFilter as Filter, TrendingUp, Wrench, MapPin, Star, Search, ChartBar as BarChart3 } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POPULAR_QUERIES = [
  'Honda Activa 6G', 'Hero Splendor Plus', 'TVS Apache RTR 160',
  'Royal Enfield Classic 350', 'KTM Duke 390', 'Ather 450X',
  'Bajaj Pulsar 150', 'Yamaha FZ-S V3', 'Suzuki Access 125',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleSearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const q = params.get('q') ?? ''
  const oemParam = params.get('oem') ?? ''
  const segParam = params.get('segment') ?? ''

  const [all, setAll] = useState<VehicleResult[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [segFilter, setSegFilter] = useState('')
  const [evOnly, setEvOnly] = useState(false)
  const [expandedNlp, setExpandedNlp] = useState<string | null>(null)

  const runSearch = useCallback(async () => {
    setLoading(true)
    if (!isLoaded()) await loadIndex()
    const query = q || oemParam || segParam || ''
    let res = query ? engineSearch(query, 40) : getTrending(16)
    if (oemParam) res = res.filter(r => r.oemSlug === oemParam || r.type === 'nlp' || r.type === 'action')
    if (segParam) res = res.filter(r => r.segment === segParam || r.type === 'nlp' || r.type === 'action')
    setAll(res)
    setLoading(false)
  }, [q, oemParam, segParam])

  useEffect(() => { runSearch() }, [runSearch])

  // Derived
  const nlp = all.find(r => r.type === 'nlp')
  const oems = all.filter(r => r.type === 'oem')
  const actions = all.filter(r => r.type === 'action')
  let models = all.filter(r => r.type === 'model')
  if (segFilter) models = models.filter(r => r.segment === segFilter)
  if (evOnly) models = models.filter(r => r.isEV)

  const segments = [...new Set(all.filter(r => r.segment).map(r => r.segment!))]
  const displayQuery = q || (oemParam ? oemParam.replace(/-/g, ' ') : '') || (segParam ? SEG_LABELS[segParam] ?? segParam : '')

  return (
    <div style={S.page}>
      {/* Page header */}
      <div style={S.pageTop}>
        <div>
          <h1 style={S.heading}>
            {displayQuery
              ? <><span style={{ color: '#9aa3b8', fontWeight: 400 }}>Results for </span>"{displayQuery}"</>
              : 'Vehicle Search'}
          </h1>
          <p style={S.sub}>
            {loading ? 'Searching vehicle database…'
              : `${models.length} model${models.length !== 1 ? 's' : ''} found · ${all.filter(r => r.type === 'oem').length} brand${all.filter(r => r.type === 'oem').length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* Analytics mini-bar */}
        <div style={S.analyticsRow}>
          <AnalyticsChip icon={<BarChart3 size={12} />} label="Search Analytics" value="Live" color="#0284c7" />
          <AnalyticsChip icon={<Bike size={12} />} label="Models" value={`${all.filter(r => r.type === 'model').length}`} color="#0f2044" />
          <AnalyticsChip icon={<Zap size={12} />} label="EV Models" value={`${all.filter(r => r.isEV).length}`} color="#16a34a" />
        </div>
      </div>

      {/* Standalone search bar */}
      <VehicleSearchBar variant="page" placeholder={`Refine: "${displayQuery || 'Search anything…'}"`} />

      {/* NLP AI Answer Banner */}
      {nlp && (
        <NLPBanner
          result={nlp}
          expanded={expandedNlp === nlp.id}
          onToggle={() => setExpandedNlp(p => p === nlp.id ? null : nlp.id)}
          onAction={(action) => {
            if (action === 'book') navigate('/bookings/new')
            else navigate('/search?q=nearest+workshop')
          }}
        />
      )}

      {/* OEM chips */}
      {oems.length > 0 && (
        <div>
          <SectionTitle icon={<Bike size={14} />} label={`Brands (${oems.length})`} />
          <div style={S.chipRow}>
            {oems.map(r => <OEMChip key={r.id} r={r} onClick={() => navigate(`/search?oem=${r.oemSlug}`)} />)}
          </div>
        </div>
      )}

      {/* Quick action cards */}
      {actions.length > 0 && (
        <div style={S.actionRow}>
          {actions.map(r => (
            <button key={r.id} onClick={() => r.action === 'book' ? navigate('/bookings/new') : null} style={S.actionCard}>
              <Wrench size={16} color="#0284c7" />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f2044' }}>{r.title}</div>
                <div style={{ fontSize: '12px', color: '#9aa3b8' }}>{r.subtitle}</div>
              </div>
              <ChevronRight size={14} color="#0284c7" style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* Filter + view toggle bar */}
      {!loading && (
        <div style={S.toolbar}>
          <div style={S.filters}>
            <FilterBtn active={!segFilter && !evOnly} label={`All (${all.filter(r => r.type === 'model').length})`} icon={<Filter size={11} />} color="#0f2044" onClick={() => { setSegFilter(''); setEvOnly(false) }} />
            <FilterBtn active={evOnly} label="EV Only" icon={<Zap size={11} />} color="#16a34a" onClick={() => { setEvOnly(p => !p); setSegFilter('') }} />
            {segments.slice(0, 7).map(s => (
              <FilterBtn
                key={s} active={segFilter === s}
                label={SEG_LABELS[s] ?? s}
                color={SEG_COLORS[s] ?? '#6b7595'}
                onClick={() => setSegFilter(p => p === s ? '' : s)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ViewBtn icon={<LayoutGrid size={14} />} active={view === 'grid'} onClick={() => setView('grid')} />
            <ViewBtn icon={<List size={14} />} active={view === 'list'} onClick={() => setView('list')} />
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <Skeleton />
      ) : models.length > 0 ? (
        <div>
          <SectionTitle icon={<Car size={14} />} label={`Models (${models.length})`} />
          {view === 'grid'
            ? <div style={S.grid}>{models.map(r => <ModelCard key={r.id} r={r} onBook={() => navigate('/bookings/new')} />)}</div>
            : <div style={S.list}>{models.map(r => <ModelListRow key={r.id} r={r} onBook={() => navigate('/bookings/new')} />)}</div>
          }
        </div>
      ) : (
        !nlp && <Empty onPopular={(p) => navigate(`/search?q=${encodeURIComponent(p)}`)} />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NLPBanner({ result: r, expanded, onToggle, onAction }: {
  result: VehicleResult; expanded: boolean
  onToggle: () => void; onAction: (a: string) => void
}) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #fffef5, #fffbeb)', border: '1.5px solid #fde68a', borderRadius: '14px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5e019', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={18} color="#0f2044" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>
            BikeAI Answer
          </div>
          <p style={{ fontSize: '13.5px', color: '#374151', lineHeight: '1.7', margin: 0 }}>
            {expanded ? r.nlpAnswer : (r.nlpAnswer?.slice(0, 140) + (r.nlpAnswer && r.nlpAnswer.length > 140 ? '…' : ''))}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {r.nlpAnswer && r.nlpAnswer.length > 140 && (
              <button onClick={onToggle} style={S.nlpBtn}>{expanded ? 'Show less' : 'Read full answer'}</button>
            )}
            {r.action && r.action !== 'specs' && (
              <button onClick={() => onAction(r.action!)} style={{ ...S.nlpBtn, background: '#0f2044', color: 'white', borderColor: '#0f2044' }}>
                {r.action === 'book' ? <><Calendar size={12} /> Book Service</> : r.action === 'workshop' ? <><MapPin size={12} /> Find Workshop</> : <><Wrench size={12} /> View Details</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OEMChip({ r, onClick }: { r: VehicleResult; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: hov ? '#0f2044' : 'white', border: '1.5px solid #e2e6f0', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.14s' }}
    >
      <Bike size={13} color={hov ? '#f5e019' : '#0f2044'} />
      <span style={{ fontSize: '13px', fontWeight: '600', color: hov ? 'white' : '#0f2044' }}>{r.title}</span>
      {r.isEV && <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '5px', background: '#dcfce7', color: '#16a34a' }}>EV</span>}
    </button>
  )
}

function ModelCard({ r, onBook }: { r: VehicleResult; onBook: () => void }) {
  const [hov, setHov] = useState(false)
  const segColor = r.segment ? (SEG_COLORS[r.segment] ?? '#6b7595') : '#6b7595'
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'white', border: '1.5px solid #e2e6f0', borderRadius: '14px', padding: '16px', transition: 'transform 0.15s, box-shadow 0.15s', transform: hov ? 'translateY(-3px)' : 'none', boxShadow: hov ? '0 8px 24px rgba(15,32,68,0.1)' : '0 1px 3px rgba(15,32,68,0.04)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.oemName}</span>
        {r.isEV && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '7px', background: '#dcfce7', color: '#16a34a' }}>
            <Zap size={9} /> EV
          </span>
        )}
      </div>
      <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f2044', letterSpacing: '-0.3px', marginBottom: '8px', lineHeight: 1.2 }}>
        {r.title.replace((r.oemName ?? '') + ' ', '')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
        {r.segment && (
          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '7px', background: `${segColor}14`, color: segColor, textTransform: 'capitalize' }}>
            {r.segment}
          </span>
        )}
        {r.startYear && (
          <span style={{ fontSize: '11px', color: '#9aa3b8', background: '#f1f3f8', padding: '2px 8px', borderRadius: '7px' }}>
            {r.startYear}–present
          </span>
        )}
        {r.fuelTypes?.map(f => (
          <span key={f} style={{ fontSize: '11px', color: f === 'electric' ? '#16a34a' : '#6b7595', background: f === 'electric' ? '#dcfce7' : '#f1f3f8', padding: '2px 8px', borderRadius: '7px', textTransform: 'capitalize' }}>{f}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onBook} style={{ flex: 1, padding: '8px', background: '#0f2044', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Calendar size={12} /> Book Service
        </button>
        <button style={{ padding: '8px 10px', background: 'white', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Star size={11} />
        </button>
      </div>
    </div>
  )
}

function ModelListRow({ r, onBook }: { r: VehicleResult; onBook: () => void }) {
  const segColor = r.segment ? (SEG_COLORS[r.segment] ?? '#6b7595') : '#6b7595'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '10px', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${segColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bike size={16} color={segColor} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
            <span style={{ fontSize: '11.5px', color: segColor, fontWeight: '600', textTransform: 'capitalize' }}>{r.segment}</span>
            {r.startYear && <span style={{ fontSize: '11px', color: '#9aa3b8' }}>{r.startYear}–present</span>}
            {r.isEV && <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#dcfce7', color: '#16a34a' }}>EV</span>}
          </div>
        </div>
      </div>
      <button onClick={onBook} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: '#0f2044', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
        <Calendar size={12} /> Book <ChevronRight size={12} />
      </button>
    </div>
  )
}

function Empty({ onPopular }: { onPopular: (q: string) => void }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
      <Search size={40} color="#e2e6f0" style={{ display: 'block', margin: '0 auto 12px' }} />
      <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f2044', marginBottom: '6px' }}>No vehicles found</div>
      <div style={{ fontSize: '13.5px', color: '#9aa3b8', maxWidth: '360px', margin: '0 auto 20px' }}>
        Try a brand name (Hero, Honda, TVS), model (Activa, Pulsar), or category (scooter, sports bike)
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#9aa3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <TrendingUp size={13} /> Popular searches
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {POPULAR_QUERIES.map(p => (
          <button key={p} onClick={() => onPopular(p)} style={{ padding: '6px 14px', background: '#f8f9fc', border: '1px solid #e2e6f0', borderRadius: '20px', fontSize: '12.5px', color: '#0f2044', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
        ))}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[1, 2, 3, 4, 6].map(i => (
        <div key={i} style={{ height: '68px', background: 'linear-gradient(90deg,#f1f3f8 25%,#e8ecf4 50%,#f1f3f8 75%)', backgroundSize: '200% 100%', borderRadius: '10px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes shimmer{to{background-position:-200% 0}}`}</style>
    </div>
  )
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#6b7595', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
      {icon} {label}
    </div>
  )
}

function AnalyticsChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: `${color}10`, border: `1px solid ${color}25`, borderRadius: '7px' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: '11px', color: '#6b7595' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '700', color }}>{value}</span>
    </div>
  )
}

function FilterBtn({ active, label, icon, color, onClick }: { active: boolean; label: string; icon?: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.14s', background: active ? color : 'white', color: active ? 'white' : color, border: active ? `1px solid ${color}` : '1px solid #e2e6f0' }}>
      {icon}{label}
    </button>
  )
}

function ViewBtn({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e6f0', borderRadius: '7px', cursor: 'pointer', background: active ? '#0f2044' : 'white', color: active ? 'white' : '#9aa3b8', transition: 'all 0.14s' }}>
      {icon}
    </button>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '16px' },
  pageTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  heading: { fontSize: '22px', fontWeight: '800', color: '#0f2044', letterSpacing: '-0.3px', marginBottom: '4px' },
  sub: { fontSize: '13px', color: '#9aa3b8' },
  analyticsRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  chipRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  actionCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '11px', cursor: 'pointer', fontFamily: 'inherit', flex: '1 1 240px', textAlign: 'left' },
  toolbar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  filters: { display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  nlpBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', border: '1.5px solid #0f2044', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', color: '#0f2044', cursor: 'pointer', background: 'white', fontFamily: 'inherit' },
}

import { useEffect, useState } from 'react'
import { safeGet } from '../lib/api'
import { VehicleOEM, VehicleModel, OEM_COLORS } from '../types/vehicle'
import { Search, Zap, ChevronDown, ChevronRight } from 'lucide-react'

export default function VehiclesPage() {
  const [oems, setOems] = useState<VehicleOEM[]>([])
  const [models, setModels] = useState<Record<string, VehicleModel[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const data = await safeGet<VehicleOEM[]>('/api/vehicle-oems', [])
      setOems((data || []) as VehicleOEM[])
      setLoading(false)
    })()
  }, [])

  const toggleOem = async (oem: VehicleOEM) => {
    if (expanded === oem.id) { setExpanded(null); return }
    setExpanded(oem.id)
    if (!models[oem.id]) {
      setLoadingModels(oem.id)
      const data = await safeGet<VehicleModel[]>(`/api/vehicle-models?oemId=${encodeURIComponent(oem.id)}`, [])
      setModels(prev => ({ ...prev, [oem.id]: (data || []) as VehicleModel[] }))
      setLoadingModels(null)
    }
  }

  const filteredOems = oems.filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalModels = Object.values(models).reduce((s, m) => s + m.length, 0)

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Vehicle Database</h2>
          <p style={styles.pageSub}>{oems.length} brands · {totalModels > 0 ? `${totalModels}+ models loaded` : 'expand a brand to load models'}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div style={styles.statsStrip}>
        <StatChip label="Total Brands" value={oems.length} />
        <StatChip label="Petrol Brands" value={oems.filter(o => !o.is_ev_brand).length} color="#0f2044" />
        <StatChip label="EV Brands" value={oems.filter(o => o.is_ev_brand).length} color="#16a34a" />
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <Search size={14} color="#9aa3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brands..."
          style={styles.searchInput}
        />
      </div>

      {/* OEM list */}
      {loading ? (
        <Loader />
      ) : (
        <div style={styles.list}>
          {filteredOems.map(oem => {
            const colors = OEM_COLORS[oem.slug] || { primary: '#0f2044', bg: '#eef2f8' }
            const isOpen = expanded === oem.id
            const oemModels = models[oem.id] || []
            return (
              <div key={oem.id} style={styles.oemRow}>
                <button onClick={() => toggleOem(oem)} style={styles.oemHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ ...styles.oemBadge, background: colors.bg, color: colors.primary }}>
                      {oem.name[0]}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={styles.oemName}>{oem.name}</span>
                        {oem.is_ev_brand && (
                          <span style={styles.evPill}><Zap size={9} /> EV Brand</span>
                        )}
                      </div>
                      <span style={styles.oemCountry}>{oem.country}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isOpen && oemModels.length > 0 && (
                      <span style={styles.modelCount}>{oemModels.length} models</span>
                    )}
                    {isOpen ? <ChevronDown size={16} color="#9aa3b8" /> : <ChevronRight size={16} color="#9aa3b8" />}
                  </div>
                </button>

                {isOpen && (
                  <div style={styles.modelArea}>
                    {loadingModels === oem.id ? (
                      <Loader />
                    ) : (
                      <div style={styles.modelGrid}>
                        {oemModels.map(m => (
                          <ModelCard key={m.id} model={m} brandColor={colors.primary} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelCard({ model, brandColor }: { model: VehicleModel; brandColor: string }) {
  const isEV = model.fuel_types?.includes('electric')
  const yearRange = model.end_year
    ? `${model.start_year}–${model.end_year}`
    : `${model.start_year}–present`

  return (
    <div style={mcStyles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={mcStyles.name}>{model.name}</span>
        {isEV && <span style={mcStyles.evTag}><Zap size={8} /> EV</span>}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ ...mcStyles.tag, color: brandColor, background: `${brandColor}14` }}>
          {model.segment}
        </span>
        <span style={mcStyles.tag2}>{yearRange}</span>
      </div>
    </div>
  )
}

function StatChip({ label, value, color = '#6b7595' }: { label: string; value: number; color?: string }) {
  return (
    <div style={styles.statChip}>
      <span style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '12px', color: '#9aa3b8' }}>{label}</span>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#0f2044', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7595' },
  statsStrip: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  statChip: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px 20px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '10px', minWidth: '110px' },
  searchWrap: { position: 'relative' },
  searchInput: { width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #e2e6f0', borderRadius: '9px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  oemRow: { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden' },
  oemHeader: { width: '100%', padding: '14px 18px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit', transition: 'background 0.15s' },
  oemBadge: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', flexShrink: 0 },
  oemName: { fontSize: '15px', fontWeight: '600', color: '#0f2044' },
  oemCountry: { fontSize: '12px', color: '#9aa3b8', display: 'block' },
  evPill: { display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dcfce7', color: '#16a34a', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px' },
  modelCount: { fontSize: '12px', fontWeight: '600', color: '#0f2044', background: '#eef2f8', padding: '3px 10px', borderRadius: '20px' },
  modelArea: { borderTop: '1px solid #f1f3f8', padding: '16px 18px', background: '#fafbfd' },
  modelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' },
}

const mcStyles: Record<string, React.CSSProperties> = {
  card: { padding: '10px 12px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px' },
  name: { fontSize: '13px', fontWeight: '600', color: '#1e2438' },
  evTag: { display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#dcfce7', color: '#16a34a', fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '8px' },
  tag: { fontSize: '10px', fontWeight: '500', padding: '2px 7px', borderRadius: '8px', textTransform: 'capitalize' },
  tag2: { fontSize: '10px', color: '#9aa3b8', background: '#f1f3f8', padding: '2px 7px', borderRadius: '8px' },
}

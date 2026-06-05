/**
 * BikeAI Vehicle Search Engine
 * Fuzzy matching · NLP intent parsing · typo correction · ranked results
 * Client-side in-memory index built from backend OEM + model data.
 */

import { api, safeGet } from './api'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ResultType = 'oem' | 'model' | 'segment' | 'nlp' | 'action' | 'dealer'

export interface VehicleResult {
  id: string
  type: ResultType
  title: string
  subtitle: string
  score: number            // 0–100
  badge?: string
  badgeColor?: string
  oemName?: string
  oemSlug?: string
  modelSlug?: string
  segment?: string
  fuelTypes?: string[]
  startYear?: number
  isEV?: boolean
  action?: 'book' | 'workshop' | 'tyre' | 'specs'
  nlpAnswer?: string
}

export interface SearchAnalyticsEvent {
  query: string
  results: number
  clickedId?: string
  clickedType?: string
  sessionId: string
}

// ─── Internal index types ──────────────────────────────────────────────────────

interface IndexOEM {
  id: string
  name: string
  slug: string
  country: string
  isEV: boolean
  order: number
}

interface IndexModel {
  id: string
  oemId: string
  oemName: string
  oemSlug: string
  oemIsEV: boolean
  name: string
  slug: string
  segment: string
  fuelTypes: string[]
  startYear: number
  endYear: number | null
}

// ─── In-memory index ──────────────────────────────────────────────────────────

let OEMS: IndexOEM[] = []
let MODELS: IndexModel[] = []
let loaded = false
let loading = false
let loadPromise: Promise<void> | null = null

export async function loadIndex(): Promise<void> {
  if (loaded) return
  if (loading && loadPromise) return loadPromise
  loading = true
  loadPromise = (async () => {
    // TODO: Confirm backend endpoints for vehicle master data used by search.
    const [oems, models] = await Promise.all([
      safeGet<any[]>('/api/vehicle-oems', []),
      safeGet<any[]>('/api/vehicle-models', []),
    ])
    OEMS = (oems ?? []).map(o => ({
      id: o.id, name: o.name, slug: o.slug ?? slugify(o.name),
      country: o.country ?? '', isEV: o.is_ev_brand ?? o.is_ev ?? false, order: o.sort_order ?? 99,
    }))
    const oemMap = new Map(OEMS.map(o => [o.id, o]))
    MODELS = ((models ?? []) as Array<{
      id: string; oem_id: string; name: string; slug: string;
      segment: string; fuel_types: string[]; start_year: number;
      end_year: number | null; is_active: boolean | null;
    }>)
      .filter(m => m.is_active !== false)
      .map(m => {
        const oem = oemMap.get(m.oem_id)
        return {
          id: m.id, oemId: m.oem_id,
          oemName: oem?.name ?? '', oemSlug: oem?.slug ?? '', oemIsEV: oem?.isEV ?? false,
          name: m.name, slug: m.slug ?? slugify(m.name),
          segment: m.segment ?? '', fuelTypes: (m.fuel_types ?? []).filter(ft => ft !== 'diesel'),
          startYear: m.start_year ?? 0, endYear: m.end_year ?? null,
        }
      })
    loaded = true
    loading = false
  })()
  return loadPromise
}

export const isLoaded = () => loaded

// ─── NLP intent patterns ──────────────────────────────────────────────────────

const INTENTS: Array<{ rx: RegExp[]; answer: string; action: VehicleResult['action'] }> = [
  {
    rx: [/tyre.?pressure/i, /tire.?pressure/i, /\bpsi\b/i, /tyres?\s+inflate/i],
    answer: 'Standard tyre pressures — Commuter 100–125cc: Front 25–28 PSI, Rear 30–35 PSI. Sports 150–200cc: Front 30–32 PSI, Rear 36–38 PSI. Scooters: Front 26 PSI, Rear 29 PSI. Always check when cold.',
    action: 'tyre',
  },
  {
    rx: [/service.?interval/i, /when.*service/i, /service.?due/i, /next.*service/i, /km.*service/i, /service.*km/i],
    answer: 'Service intervals: Free Service 500–3,000 km · General Service every 3,000–6,000 km · Major Service every 12,000 km or 12 months. Book directly through BikeAI for any model.',
    action: 'book',
  },
  {
    rx: [/mileage.*drop/i, /poor.*mileage/i, /low.*mileage/i, /fuel.*consumption.*high/i, /petrol.*fast/i],
    answer: 'Sudden mileage drop causes: dirty air filter, worn spark plug, incorrect tyre pressure, or clogged fuel injector/carburettor. Book a free diagnostics check — BikeAI AI pinpoints the exact issue.',
    action: 'workshop',
  },
  {
    rx: [/battery.*(issue|problem|drain|dead|weak)/i, /ev.*battery/i, /charge.*not/i, /won.?t charge/i],
    answer: 'Battery troubleshooting: check terminals for corrosion, test voltage (12.6V+ for 12V petrol, 48V+ for EV systems). If EV range dropped >20%, book a battery health scan at a BikeAI EV centre.',
    action: 'workshop',
  },
  {
    rx: [/nearest.*workshop/i, /workshop.*near/i, /service.?cent(re|er)/i, /mechanic.*near/i, /garage.*near/i],
    answer: 'BikeAI has 140+ certified workshops across India. Use the workshop finder or share your location for the nearest certified centre with live availability.',
    action: 'workshop',
  },
  {
    rx: [/book.*service/i, /schedule.*service/i, /appointment/i, /slot.*available/i, /book.*appointment/i],
    answer: 'Book a service in under 60 seconds — select vehicle, pick workshop, choose slot. BikeAI sends instant WhatsApp confirmation and reminder alerts.',
    action: 'book',
  },
  {
    rx: [/engine.?oil/i, /oil.?change/i, /which.?oil/i, /oil.?recommend/i, /oil.?grade/i],
    answer: 'Engine oil guide: Hero/Honda 125cc → 10W-30 genuine. TVS/Bajaj sports → 10W-40. Royal Enfield → 20W-50. Ather/Ola (EV) → no engine oil needed. Change every 3,000 km for petrol bikes.',
    action: 'specs',
  },
  {
    rx: [/insurance/i, /renew.*insur/i, /policy.*expir/i, /insur.*date/i],
    answer: 'BikeAI CRM auto-reminds 30 days before insurance expiry via WhatsApp. Log in to check your renewal date or set up an automated alert for your entire fleet.',
    action: 'specs',
  },
  {
    rx: [/pickup.*service/i, /doorstep.*pickup/i, /home.*pickup/i, /collect.*bike/i, /pick.*up.*bike/i],
    answer: 'BikeAI doorstep pickup: free for service bookings in 40+ cities, 8AM–8PM, 7 days/week. Book online or WhatsApp +91 90000 00000 for same-day pickup.',
    action: 'book',
  },
  {
    rx: [/spark.?plug/i, /plug.*replace/i, /plug.*change/i],
    answer: 'Spark plug replacement recommended every 8,000–12,000 km. Common specs: NGK BCPR6ES (Hero Splendor), NGK CR7HSA (Activa), NGK CR8E (FZ-S). BikeAI workshops stock all major brands.',
    action: 'workshop',
  },
  {
    rx: [/electric.*scooter/i, /ev.*scooter/i, /best.*ev/i, /electric.*bike/i, /ev.*recommend/i],
    answer: 'Top EV scooters in India: Ather 450X (85–116km range), Ola S1 Pro (195km claim), TVS iQube (100km), Bajaj Chetak (108km), Ola S1 Air (101km). BikeAI tracks EV servicing for all brands.',
    action: 'specs',
  },
  {
    rx: [/range.*ev/i, /ev.*range/i, /battery.*range/i, /how.*far.*electric/i],
    answer: 'Real-world EV ranges (India conditions): Ather 450X 75–85km, Ola S1 Pro 120–150km, TVS iQube 80–90km, Bajaj Chetak 85–95km, Revolt RV400 100–110km. Range varies with load and road type.',
    action: 'specs',
  },
]

// ─── Alias / abbreviation expansion ──────────────────────────────────────────

const ALIASES: [RegExp, string][] = [
  [/\bre\b/i, 'royal enfield'],
  [/\benfield\b/i, 'royal enfield'],
  [/splendour/i, 'splendor'],
  [/activa\s*6g?/i, 'activa 6g'],
  [/activa\s*125/i, 'activa 125'],
  [/pulsar\s*150/i, 'pulsar 150'],
  [/pulsar\s*160/i, 'pulsar 160ns'],
  [/pulsar\s*200/i, 'pulsar 200ns'],
  [/apache\s*160/i, 'apache rtr 160'],
  [/apache\s*200/i, 'apache rtr 200'],
  [/duke\s*390/i, 'duke 390'],
  [/duke\s*200/i, 'duke 200'],
  [/r15/i, 'r15 v4'],
  [/\bfz\b/i, 'fz-s v3'],
  [/ather\s*450/i, 'ather 450x'],
  [/ola\s*s1/i, 's1 pro'],
  [/chetak/i, 'chetak ev'],
  [/himalayan/i, 'himalayan'],
  [/classic\s*350/i, 'classic 350'],
  [/bullet/i, 'bullet 350'],
  [/interceptor/i, 'interceptor 650'],
  [/hayabusa/i, 'hayabusa'],
  [/\bev\b/i, 'electric'],
  [/sports?\s*bike/i, 'sports'],
  [/adventure\s*bike/i, 'adventure'],
  [/naked\s*bike/i, 'naked'],
]

// ─── Public search API ────────────────────────────────────────────────────────

export function search(rawQuery: string, limit = 14): VehicleResult[] {
  const q = normalize(rawQuery)
  if (!q) return trending(8)

  const out: VehicleResult[] = []

  // NLP intent
  const nlp = parseIntent(rawQuery)
  if (nlp) out.push(nlp)

  // OEM matches
  scoreOEMs(q).forEach(r => out.push(r))

  // Model matches
  scoreModels(q).forEach(r => out.push(r))

  // Segment matches
  scoreSegments(q).forEach(r => out.push(r))

  // Action suggestions
  parseActions(rawQuery).forEach(r => out.push(r))

  return dedup(out).sort((a, b) => b.score - a.score).slice(0, limit)
}

export function autocomplete(rawQuery: string, limit = 8): VehicleResult[] {
  if (!rawQuery.trim() || rawQuery.length < 2) return popular(limit)
  const q = normalize(rawQuery)
  const out: VehicleResult[] = []
  const nlp = parseIntent(rawQuery)
  if (nlp) out.push(nlp)
  scoreOEMs(q).slice(0, 2).forEach(r => out.push(r))
  scoreModels(q).slice(0, 6).forEach(r => out.push(r))
  return dedup(out).sort((a, b) => b.score - a.score).slice(0, limit)
}

export function trending(limit = 8): VehicleResult[] {
  const names = ['Activa 6G', 'Splendor Plus', 'Apache RTR 160', 'Duke 390',
    '450X', 'Classic 350', 'Pulsar 150', 'Jupiter', 'FZ-S V3', 'Access 125']
  return names.flatMap(n => {
    const m = MODELS.find(x => x.name === n || x.name.includes(n))
    return m ? [toModelResult(m, 50)] : []
  }).slice(0, limit)
}

export function popular(limit = 6): VehicleResult[] { return trending(limit) }

export async function logSearch(evt: SearchAnalyticsEvent): Promise<void> {
  // TODO: Confirm backend endpoint for logging vehicle search analytics.
  await api.post('/api/search-queries', {
    query: evt.query,
    result_count: evt.results,
    clicked_result_id: evt.clickedId ?? null,
    clicked_result_type: evt.clickedType ?? null,
    session_id: evt.sessionId,
  })
}

export async function getRecentSearches(sessionId: string): Promise<string[]> {
  // TODO: Confirm backend endpoint for fetching recent searches by session id.
  const data = await safeGet<Array<{ query: string }>>(
    `/api/search-queries/recent?sessionId=${encodeURIComponent(sessionId)}&limit=8`,
    [],
  )
  return [...new Set((data ?? []).map(r => r.query as string))]
}

export async function getPopularSearches(): Promise<string[]> {
  // TODO: Confirm backend endpoint for fetching popular searches.
  const data = await safeGet<Array<{ query: string }>>('/api/search-queries/popular?limit=200', [])
  if (!data || data.length === 0) return DEFAULT_POPULAR
  const freq: Record<string, number> = {}
  data.forEach(r => { freq[r.query] = (freq[r.query] ?? 0) + 1 })
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([q]) => q)
}

const DEFAULT_POPULAR = [
  'Honda Activa 6G', 'Hero Splendor Plus', 'TVS Apache RTR 160',
  'Royal Enfield Classic 350', 'KTM Duke 390', 'Ather 450X',
  'Bajaj Pulsar 150', 'Yamaha FZ-S V3',
]

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function scoreOEMs(q: string): VehicleResult[] {
  const out: VehicleResult[] = []
  for (const o of OEMS) {
    const s = fuzzy(q, o.name.toLowerCase())
    if (s < 0.25) continue
    const mCount = MODELS.filter(m => m.oemId === o.id).length
    out.push({
      id: `oem:${o.id}`, type: 'oem',
      title: o.name, subtitle: `${o.country} · ${mCount} models`,
      score: Math.round(s * 88),
      badge: o.isEV ? 'EV Brand' : o.country,
      badgeColor: o.isEV ? '#16a34a' : '#6b7595',
      oemName: o.name, oemSlug: o.slug, isEV: o.isEV,
    })
  }
  return out
}

function scoreModels(q: string): VehicleResult[] {
  const out: VehicleResult[] = []
  for (const m of MODELS) {
    const full = `${m.oemName} ${m.name}`.toLowerCase()
    const s = Math.max(fuzzy(q, m.name.toLowerCase()), fuzzy(q, full))
    if (s < 0.2) continue
    out.push(toModelResult(m, Math.round(s * 84)))
  }
  return out
}

function scoreSegments(q: string): VehicleResult[] {
  const segs = ['scooter', 'commuter', 'sports', 'adventure', 'cruiser', 'naked', 'retro', 'electric']
  return segs
    .filter(s => s.includes(q) || q.includes(s))
    .map(s => {
      const count = MODELS.filter(m =>
        m.segment === s || (s === 'electric' && m.fuelTypes.includes('electric'))
      ).length
      return {
        id: `seg:${s}`, type: 'segment' as const,
        title: `${cap(s)} Bikes`, subtitle: `${count} models in database`,
        score: 52,
        badge: cap(s), badgeColor: SEG_COLORS[s] ?? '#6b7595',
        segment: s,
      } satisfies VehicleResult
    })
}

function parseIntent(raw: string): VehicleResult | null {
  for (const { rx, answer, action } of INTENTS) {
    if (rx.some(r => r.test(raw))) {
      return {
        id: `nlp:${answer.slice(0, 20)}`, type: 'nlp',
        title: answer.slice(0, 90) + (answer.length > 90 ? '…' : ''),
        subtitle: 'AI Answer — tap to expand',
        score: 98, nlpAnswer: answer, action,
        badge: 'AI', badgeColor: '#f5e019',
      }
    }
  }
  return null
}

function parseActions(raw: string): VehicleResult[] {
  const out: VehicleResult[] = []
  if (/book|service|appointment|slot/i.test(raw))
    out.push({ id: 'act:book', type: 'action', title: 'Book a Service', subtitle: 'Schedule at a BikeAI-certified workshop', score: 68, badge: 'Action', badgeColor: '#0284c7', action: 'book' })
  if (/workshop|garage|service.?cent|near/i.test(raw))
    out.push({ id: 'act:ws', type: 'action', title: 'Find Nearest Workshop', subtitle: '140+ centres across India', score: 68, badge: 'Action', badgeColor: '#0284c7', action: 'workshop' })
  return out
}

function toModelResult(m: IndexModel, score: number): VehicleResult {
  const isEV = m.fuelTypes.includes('electric') || m.oemIsEV
  const yearLabel = m.endYear ? `${m.startYear}–${m.endYear}` : `${m.startYear}–present`
  return {
    id: `model:${m.id}`, type: 'model',
    title: `${m.oemName} ${m.name}`,
    subtitle: `${cap(m.segment)} · ${yearLabel}`,
    score,
    badge: isEV ? 'EV' : cap(m.segment),
    badgeColor: isEV ? '#16a34a' : (SEG_COLORS[m.segment] ?? '#6b7595'),
    oemName: m.oemName, oemSlug: m.oemSlug, modelSlug: m.slug,
    segment: m.segment, fuelTypes: m.fuelTypes,
    startYear: m.startYear, isEV,
  }
}

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

function fuzzy(q: string, target: string): number {
  if (!q || !target) return 0
  if (target === q) return 1
  if (target.startsWith(q)) return 0.96
  if (target.includes(q)) return 0.82
  const tScore = tokenScore(q, target)
  const bScore = bigramSim(q, target)
  return Math.max(tScore, bScore)
}

function tokenScore(q: string, target: string): number {
  const qt = q.split(/\s+/).filter(Boolean)
  const tt = target.split(/\s+/).filter(Boolean)
  if (!qt.length) return 0
  let hits = 0
  for (const qw of qt) {
    let best = 0
    for (const tw of tt) {
      if (tw.startsWith(qw) || tw.includes(qw)) { best = 1; break }
      const lev = levSim(qw, tw)
      if (lev > best) best = lev
    }
    hits += best
  }
  return hits / qt.length
}

function levSim(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length)
}

function bigramSim(a: string, b: string): number {
  const bg = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const ba = bg(a), bb = bg(b)
  let overlap = 0
  ba.forEach(x => { if (bb.has(x)) overlap++ })
  return (2 * overlap) / (ba.size + bb.size || 1)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalize(raw: string): string {
  let s = raw.toLowerCase().trim()
  for (const [rx, sub] of ALIASES) s = s.replace(rx, sub)
  return s
}

function dedup(results: VehicleResult[]): VehicleResult[] {
  const seen = new Set<string>()
  return results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
}

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }

function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

export const SEG_COLORS: Record<string, string> = {
  scooter: '#0284c7', commuter: '#64748b', sports: '#dc2626',
  adventure: '#d97706', cruiser: '#7c3aed', naked: '#0f2044',
  retro: '#92400e', electric: '#16a34a',
}

export const SEG_LABELS: Record<string, string> = {
  scooter: 'Scooter', commuter: 'Commuter', sports: 'Sports',
  adventure: 'Adventure', cruiser: 'Cruiser', naked: 'Naked',
  retro: 'Retro', electric: 'Electric',
}

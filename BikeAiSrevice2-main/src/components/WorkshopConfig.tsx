import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, Check, Zap } from 'lucide-react'

// ─── Taxonomy data ────────────────────────────────────────────────────────────

export interface ServiceItem { slug: string; name: string }
export interface ServiceGroup {
  slug: string
  name: string
  color: string
  bg: string
  isEv?: boolean
  services: ServiceItem[]
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    slug: 'primary', name: 'Primary Services', color: '#0f2044', bg: '#eef2f8',
    services: [
      { slug: 'free-service',         name: 'Free Service' },
      { slug: 'general-service',      name: 'General Service' },
      { slug: 'paid-service',         name: 'Paid Service' },
      { slug: 'minor-service',        name: 'Minor Service' },
      { slug: 'major-service',        name: 'Major Service' },
      { slug: 'periodic-maintenance', name: 'Periodic Maintenance' },
      { slug: 'amc-service',          name: 'AMC Service' },
      { slug: 'express-service',      name: 'Express Service' },
      { slug: 'doorstep-service',     name: 'Doorstep Service' },
    ],
  },
  {
    slug: 'mechanical', name: 'Mechanical Services', color: '#b45309', bg: '#fffbeb',
    services: [
      { slug: 'engine-repair',     name: 'Engine Repair' },
      { slug: 'clutch-work',       name: 'Clutch Work' },
      { slug: 'brake-service',     name: 'Brake Service' },
      { slug: 'suspension-repair', name: 'Suspension Repair' },
      { slug: 'electrical-repair', name: 'Electrical Repair' },
    ],
  },
  {
    slug: 'tyre', name: 'Tyre & Battery', color: '#0284c7', bg: '#f0f9ff',
    services: [
      { slug: 'tyre-change',         name: 'Tyre Change' },
      { slug: 'puncture-repair',     name: 'Puncture Repair' },
      { slug: 'wheel-balancing',     name: 'Wheel Balancing' },
      { slug: 'battery-replacement', name: 'Battery Replacement' },
      { slug: 'battery-diagnostics', name: 'Battery Diagnostics' },
    ],
  },
  {
    slug: 'accident', name: 'Accident & Insurance', color: '#dc2626', bg: '#fef2f2',
    services: [
      { slug: 'accident-repair', name: 'Accident Repair' },
      { slug: 'insurance-claim', name: 'Insurance Claim Support' },
      { slug: 'body-work',       name: 'Body Work' },
      { slug: 'painting',        name: 'Painting' },
    ],
  },
  {
    slug: 'rsa', name: 'Emergency & RSA', color: '#7c3aed', bg: '#f5f3ff',
    services: [
      { slug: 'breakdown-service', name: 'Breakdown Service' },
      { slug: 'rsa-support',       name: 'RSA Support' },
      { slug: 'emergency-pickup',  name: 'Emergency Pickup' },
      { slug: 'towing-support',    name: 'Towing Support' },
    ],
  },
  {
    slug: 'ev', name: 'EV-Specific Services', color: '#059669', bg: '#f0fdf4', isEv: true,
    services: [
      { slug: 'ev-diagnostics',      name: 'EV Diagnostics' },
      { slug: 'ev-battery-health',   name: 'Battery Health Check' },
      { slug: 'charging-inspection', name: 'Charging Inspection' },
      { slug: 'software-updates',    name: 'Software Updates' },
      { slug: 'controller-diag',     name: 'Controller Diagnostics' },
    ],
  },
]

export interface Facility { slug: string; label: string }
export const FACILITIES: Facility[] = [
  { slug: 'pickup-drop',          label: 'Pickup & Drop' },
  { slug: 'doorstep-service',     label: 'Doorstep Service' },
  { slug: 'live-tracking',        label: 'Live Tracking' },
  { slug: 'quick-service',        label: 'Quick Service' },
  { slug: 'waiting-lounge',       label: 'Waiting Lounge' },
  { slug: 'washing-facility',     label: 'Washing Facility' },
  { slug: 'express-delivery',     label: 'Express Delivery' },
  { slug: 'customer-parking',     label: 'Customer Parking' },
  { slug: 'rsa-availability',     label: 'RSA Availability' },
  { slug: 'insurance-assistance', label: 'Insurance Assistance' },
  { slug: 'mobile-mechanic',      label: 'Mobile Mechanic Support' },
  { slug: 'ev-charging-support',  label: 'EV Charging Support' },
]

export interface CapabilityTag { slug: string; label: string; color: string; bg: string }
export const CAPABILITY_TAGS: CapabilityTag[] = [
  { slug: 'ev-certified',       label: 'EV Certified',          color: '#059669', bg: '#f0fdf4' },
  { slug: 'premium-workshop',   label: 'Premium Workshop',       color: '#b45309', bg: '#fffbeb' },
  { slug: 'rsa-enabled',        label: 'RSA Enabled',            color: '#dc2626', bg: '#fef2f2' },
  { slug: 'insurance-approved', label: 'Insurance Approved',     color: '#7c3aed', bg: '#f5f3ff' },
  { slug: 'pickup-available',   label: 'Pickup Available',       color: '#0284c7', bg: '#f0f9ff' },
  { slug: 'express-center',     label: 'Express Service Center', color: '#d97706', bg: '#fffbeb' },
  { slug: 'multi-brand',        label: 'Multi-Brand Workshop',   color: '#0f2044', bg: '#eef2f8' },
  { slug: 'oem-authorized',     label: 'OEM Authorized',         color: '#0f2044', bg: '#e0e7ef' },
  { slug: 'ai-enabled',         label: 'AI Enabled Workshop',    color: '#2563eb', bg: '#eff6ff' },
  { slug: '24x7-support',       label: '24x7 Support',           color: '#16a34a', bg: '#f0fdf4' },
]

export interface OemBrand { slug: string; name: string; type: 'ice' | 'ev' | 'both' }
export const OEM_BRANDS: OemBrand[] = [
  { slug: 'hero',          name: 'Hero',          type: 'ice' },
  { slug: 'honda',         name: 'Honda',         type: 'ice' },
  { slug: 'tvs',           name: 'TVS',           type: 'both' },
  { slug: 'bajaj',         name: 'Bajaj',         type: 'both' },
  { slug: 'yamaha',        name: 'Yamaha',        type: 'ice' },
  { slug: 'suzuki',        name: 'Suzuki',        type: 'ice' },
  { slug: 'royal-enfield', name: 'Royal Enfield', type: 'ice' },
  { slug: 'ktm',           name: 'KTM',           type: 'ice' },
  { slug: 'ola',           name: 'Ola Electric',  type: 'ev' },
  { slug: 'ather',         name: 'Ather Energy',  type: 'ev' },
  { slug: 'ultraviolette', name: 'Ultraviolette', type: 'ev' },
  { slug: 'revolt',        name: 'Revolt',        type: 'ev' },
]

const WORKSHOP_TYPES = [
  { slug: 'oem_dealership',  label: 'OEM Dealership',       emoji: '🏭', color: '#0f2044', bg: '#eef2f8' },
  { slug: 'multi_brand',     label: 'Multi-Brand Workshop',  emoji: '🔧', color: '#374151', bg: '#f9fafb' },
  { slug: 'ev_center',       label: 'EV Service Center',     emoji: '⚡', color: '#059669', bg: '#f0fdf4' },
  { slug: 'premium',         label: 'Premium Workshop',      emoji: '⭐', color: '#b45309', bg: '#fffbeb' },
  { slug: 'rsa',             label: 'RSA Operations',        emoji: '🚨', color: '#dc2626', bg: '#fef2f2' },
  { slug: 'pickup_delivery', label: 'Pickup & Delivery',     emoji: '🚐', color: '#0284c7', bg: '#f0f9ff' },
]

const SEGMENTS = [
  { slug: 'commuter', label: 'Commuter' },
  { slug: 'scooter',  label: 'Scooter' },
  { slug: 'sport',    label: 'Sport' },
  { slug: 'cruiser',  label: 'Cruiser' },
  { slug: 'electric', label: 'Electric' },
  { slug: 'premium',  label: 'Premium' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkshopConfigValue {
  workshopServices:  Record<string, string[]>
  facilities:        string[]
  capabilityTags:    string[]
  supportedOems:     string[]
  supportedSegments: string[]
  workshopType:      string
}

interface Props {
  value: WorkshopConfigValue
  onChange: (v: WorkshopConfigValue) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkshopConfig({ value, onChange }: Props) {
  const [search, setSearch]         = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(SERVICE_GROUPS.map(g => g.slug))
  )
  const [oemFilter, setOemFilter]   = useState<'all' | 'ice' | 'ev'>('all')

  const totalSelected = useMemo(
    () => Object.values(value.workshopServices).reduce((sum, arr) => sum + arr.length, 0),
    [value.workshopServices]
  )

  const filteredGroups = useMemo(() => {
    if (!search) return SERVICE_GROUPS
    const q = search.toLowerCase()
    return SERVICE_GROUPS
      .map(g => ({ ...g, services: g.services.filter(s => s.name.toLowerCase().includes(q)) }))
      .filter(g => g.services.length > 0)
  }, [search])

  function toggleExpand(slug: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  function toggleService(groupSlug: string, serviceSlug: string) {
    const current = value.workshopServices[groupSlug] ?? []
    const next = current.includes(serviceSlug)
      ? current.filter(s => s !== serviceSlug)
      : [...current, serviceSlug]
    onChange({ ...value, workshopServices: { ...value.workshopServices, [groupSlug]: next } })
  }

  function selectAllGroup(groupSlug: string, services: ServiceItem[]) {
    const current = value.workshopServices[groupSlug] ?? []
    const all     = services.map(s => s.slug)
    const isAll   = all.every(s => current.includes(s))
    onChange({ ...value, workshopServices: { ...value.workshopServices, [groupSlug]: isAll ? [] : all } })
  }

  function toggleFacility(slug: string) {
    const arr = value.facilities
    onChange({ ...value, facilities: arr.includes(slug) ? arr.filter(f => f !== slug) : [...arr, slug] })
  }

  function toggleTag(slug: string) {
    const arr = value.capabilityTags
    onChange({ ...value, capabilityTags: arr.includes(slug) ? arr.filter(t => t !== slug) : [...arr, slug] })
  }

  function toggleOem(slug: string) {
    const arr = value.supportedOems
    onChange({ ...value, supportedOems: arr.includes(slug) ? arr.filter(o => o !== slug) : [...arr, slug] })
  }

  function toggleSegment(slug: string) {
    const arr = value.supportedSegments
    onChange({ ...value, supportedSegments: arr.includes(slug) ? arr.filter(s => s !== slug) : [...arr, slug] })
  }

  const filteredOems = oemFilter === 'all'
    ? OEM_BRANDS
    : OEM_BRANDS.filter(o => o.type === oemFilter || o.type === 'both')

  return (
    <div style={s.root}>

      {/* ── Workshop Type ── */}
      <Section title="Workshop Type" subtitle="Classify your workshop for AI dealer matching">
        <div style={s.typeGrid}>
          {WORKSHOP_TYPES.map(wt => (
            <button
              key={wt.slug}
              type="button"
              onClick={() => onChange({ ...value, workshopType: wt.slug })}
              style={{
                ...s.typeCard,
                border:     value.workshopType === wt.slug ? `2px solid ${wt.color}` : '2px solid #e5e7eb',
                background: value.workshopType === wt.slug ? wt.bg : 'white',
              }}
            >
              <span style={{ fontSize: '22px' }}>{wt.emoji}</span>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: value.workshopType === wt.slug ? wt.color : '#374151', textAlign: 'center', lineHeight: '1.3' }}>
                {wt.label}
              </span>
              {value.workshopType === wt.slug && (
                <Check size={12} color={wt.color} style={{ position: 'absolute', top: '6px', right: '6px' }} />
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Services ── */}
      <Section
        title="Services Offered"
        subtitle={`${totalSelected} service${totalSelected !== 1 ? 's' : ''} selected`}
        action={
          <div style={s.searchWrap}>
            <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services..."
              style={s.searchInput}
            />
          </div>
        }
      >
        <div style={s.groupList}>
          {filteredGroups.map(group => {
            const selected    = value.workshopServices[group.slug] ?? []
            const allSelected = group.services.every(sv => selected.includes(sv.slug))
            const someSelected= selected.length > 0
            const expanded    = expandedGroups.has(group.slug)

            return (
              <div key={group.slug} style={{ ...s.groupCard, border: `1px solid ${someSelected ? group.color + '40' : '#e5e7eb'}` }}>
                <div style={s.groupHeader}>
                  <button type="button" style={s.groupToggle} onClick={() => toggleExpand(group.slug)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ ...s.groupDot, background: group.color }} />
                      <span style={s.groupName}>{group.name}</span>
                      {group.isEv && <span style={s.evBadge}><Zap size={10} /> EV</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selected.length > 0 && (
                        <span style={{ ...s.countBadge, background: group.bg, color: group.color }}>
                          {selected.length}/{group.services.length}
                        </span>
                      )}
                      {expanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllGroup(group.slug, group.services)}
                    style={{ ...s.selectAllBtn, color: group.color }}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {expanded && (
                  <div style={s.serviceChips}>
                    {group.services.map(svc => {
                      const active = selected.includes(svc.slug)
                      return (
                        <button
                          key={svc.slug}
                          type="button"
                          onClick={() => toggleService(group.slug, svc.slug)}
                          style={{
                            ...s.chip,
                            background: active ? group.color : 'white',
                            color:      active ? 'white' : '#374151',
                            border:     `1.5px solid ${active ? group.color : '#e5e7eb'}`,
                          }}
                        >
                          {active && <Check size={11} style={{ flexShrink: 0 }} />}
                          {svc.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Facilities ── */}
      <Section title="Facilities Available" subtitle={`${value.facilities.length} selected`}>
        <div style={s.chipRow}>
          {FACILITIES.map(f => {
            const active = value.facilities.includes(f.slug)
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => toggleFacility(f.slug)}
                style={{ ...s.facilityChip, background: active ? '#0f2044' : 'white', color: active ? 'white' : '#374151', border: `1.5px solid ${active ? '#0f2044' : '#e5e7eb'}` }}
              >
                {active && <Check size={11} style={{ flexShrink: 0 }} />}
                {f.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Capability Tags ── */}
      <Section title="Capability Tags" subtitle="Enables AI dealer matching and smart discovery">
        <div style={s.chipRow}>
          {CAPABILITY_TAGS.map(tag => {
            const active = value.capabilityTags.includes(tag.slug)
            return (
              <button
                key={tag.slug}
                type="button"
                onClick={() => toggleTag(tag.slug)}
                style={{ ...s.tagChip, background: active ? tag.color : 'white', color: active ? 'white' : tag.color, border: `1.5px solid ${active ? tag.color : tag.color + '50'}` }}
              >
                {active && <Check size={11} style={{ flexShrink: 0 }} />}
                {tag.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── OEM Brands ── */}
      <Section
        title="OEM & Brand Compatibility"
        subtitle={`${value.supportedOems.length} brand${value.supportedOems.length !== 1 ? 's' : ''} selected`}
        action={
          <div style={s.filterTabs}>
            {(['all', 'ice', 'ev'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setOemFilter(f)}
                style={{ ...s.filterTab, background: oemFilter === f ? '#0f2044' : 'transparent', color: oemFilter === f ? 'white' : '#6b7280' }}
              >
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        <div style={s.oemGrid}>
          {filteredOems.map(oem => {
            const active = value.supportedOems.includes(oem.slug)
            const isEv   = oem.type === 'ev'
            return (
              <button
                key={oem.slug}
                type="button"
                onClick={() => toggleOem(oem.slug)}
                style={{ ...s.oemCard, background: active ? (isEv ? '#f0fdf4' : '#eef2f8') : 'white', border: `2px solid ${active ? (isEv ? '#059669' : '#0f2044') : '#e5e7eb'}` }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ ...s.oemInitial, background: isEv ? '#f0fdf4' : '#eef2f8', color: isEv ? '#059669' : '#0f2044', border: `1px solid ${isEv ? '#a7f3d0' : '#c7d2e8'}` }}>
                    {oem.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#111827', textAlign: 'center', lineHeight: '1.3' }}>{oem.name}</span>
                  {isEv && <span style={s.evMini}>EV</span>}
                </div>
                {active && (
                  <div style={{ position: 'absolute', top: '5px', right: '5px' }}>
                    <Check size={11} color={isEv ? '#059669' : '#0f2044'} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Segments ── */}
      <Section title="Vehicle Segments" subtitle="What types of vehicles do you service?">
        <div style={s.chipRow}>
          {SEGMENTS.map(seg => {
            const active = value.supportedSegments.includes(seg.slug)
            return (
              <button
                key={seg.slug}
                type="button"
                onClick={() => toggleSegment(seg.slug)}
                style={{ ...s.segChip, background: active ? '#0f2044' : 'white', color: active ? 'white' : '#374151', border: `1.5px solid ${active ? '#0f2044' : '#e5e7eb'}` }}
              >
                {active && <Check size={11} style={{ flexShrink: 0 }} />}
                {seg.label}
              </button>
            )
          })}
        </div>
      </Section>

    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, subtitle, action, children }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <div>
          <h4 style={s.sectionTitle}>{title}</h4>
          {subtitle && <p style={s.sectionSub}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:         { display: 'flex', flexDirection: 'column', gap: '0' },
  section:      { padding: '20px 0', borderBottom: '1px solid #f3f4f6' },
  sectionHeader:{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' },
  sectionTitle: { fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '2px' },
  sectionSub:   { fontSize: '12px', color: '#9ca3af' },

  typeGrid:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  typeCard:     { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },

  searchWrap:   { position: 'relative', flexShrink: 0 },
  searchInput:  { paddingLeft: '30px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', color: '#374151', width: '180px' },

  groupList:    { display: 'flex', flexDirection: 'column', gap: '8px' },
  groupCard:    { borderRadius: '10px', overflow: 'hidden', background: 'white' },
  groupHeader:  { padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' },
  groupToggle:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: 'inherit' },
  groupDot:     { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  groupName:    { fontSize: '13px', fontWeight: '600', color: '#111827' },
  evBadge:      { display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px', background: '#f0fdf4', color: '#059669', borderRadius: '4px', fontSize: '10px', fontWeight: '700', border: '1px solid #a7f3d0' },
  countBadge:   { padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  selectAllBtn: { fontSize: '11.5px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0, fontFamily: 'inherit' },
  serviceChips: { padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '7px' },
  chip:         { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' },

  chipRow:      { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  facilityChip: { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' },
  tagChip:      { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '20px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' },
  segChip:      { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit' },

  filterTabs:   { display: 'flex', gap: '4px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '3px', background: '#f9fafb' },
  filterTab:    { padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  oemGrid:      { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' },
  oemCard:      { position: 'relative', padding: '12px 8px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', background: 'white' },
  oemInitial:   { width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' },
  evMini:       { padding: '1px 5px', background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '4px', fontSize: '9px', fontWeight: '700' },
}

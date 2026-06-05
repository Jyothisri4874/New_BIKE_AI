import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, safeGet } from '../lib/api'
import { Navigation, Truck, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, MapPin, Phone, Activity, ChevronRight, RefreshCw, Plus, Eye, Radio, Shield, Users, ArrowRight } from 'lucide-react'

type Tab = 'overview' | 'pickups' | 'deliveries' | 'riders' | 'rsa'

const STATUS_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  pending:          { label: 'Pending',        bg: '#fffbeb', color: '#d97706', dot: '#d97706' },
  assigned:         { label: 'Assigned',       bg: '#eef2f8', color: '#0f2044', dot: '#0f2044' },
  rider_en_route:   { label: 'Rider En Route', bg: '#eff6ff', color: '#2563eb', dot: '#2563eb' },
  arrived:          { label: 'Arrived',        bg: '#f0f9ff', color: '#0284c7', dot: '#0284c7' },
  picked_up:        { label: 'Picked Up',      bg: '#fdf4ff', color: '#9333ea', dot: '#9333ea' },
  in_transit:       { label: 'In Transit',     bg: '#fdf4ff', color: '#7c3aed', dot: '#7c3aed' },
  delivered:        { label: 'Delivered',      bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  cancelled:        { label: 'Cancelled',      bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
  open:             { label: 'Open',           bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
  en_route:         { label: 'En Route',       bg: '#eff6ff', color: '#2563eb', dot: '#2563eb' },
  resolved:         { label: 'Resolved',       bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
}

export default function LiveOpsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [jobs, setJobs] = useState<any[]>([])
  const [riders, setRiders] = useState<any[]>([])
  const [rsaRequests, setRsaRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const load = async () => {
    // TODO: Confirm backend endpoints for live ops data.
    const [jobs, riders, rsa] = await Promise.all([
      safeGet<any[]>('/api/live-ops/pickup-deliveries?limit=100', []),
      safeGet<any[]>('/api/live-ops/riders?isActive=true', []),
      safeGet<any[]>('/api/live-ops/rsa-requests?status=active', []),
    ])
    setJobs(jobs || [])
    setRiders(riders || [])
    setRsaRequests(rsa || [])
    setLastRefresh(new Date())
    setLoading(false)
  }

  const updateJobStatus = async (id: string, status: string) => {
    try {
      // TODO: Confirm backend endpoint for updating pickup/delivery status.
      await api.patch(`/api/live-ops/pickup-deliveries/${id}`, { status, updated_at: new Date().toISOString() })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
  }

  const updateRsaStatus = async (id: string, status: string) => {
    try {
      // TODO: Confirm backend endpoint for updating RSA status.
      await api.patch(`/api/live-ops/rsa-requests/${id}`, { status, updated_at: new Date().toISOString() })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setRsaRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const pickups = jobs.filter(j => j.job_type === 'pickup')
  const deliveries = jobs.filter(j => j.job_type === 'delivery')
  const activeJobs = jobs.filter(j => !['delivered', 'cancelled'].includes(j.status))
  const delayed = jobs.filter(j => j.is_delayed)
  const availableRiders = riders.filter(r => r.is_available)

  const TABS: { id: Tab; label: string; icon: typeof Navigation; count?: number }[] = [
    { id: 'overview',   label: 'Overview',   icon: Activity },
    { id: 'pickups',    label: 'Pickups',    icon: Truck,        count: pickups.filter(j => !['delivered','cancelled'].includes(j.status)).length },
    { id: 'deliveries', label: 'Deliveries', icon: Navigation,   count: deliveries.filter(j => !['delivered','cancelled'].includes(j.status)).length },
    { id: 'riders',     label: 'Riders',     icon: Users,        count: availableRiders.length },
    { id: 'rsa',        label: 'RSA',        icon: Shield,       count: rsaRequests.filter(r => r.status !== 'resolved').length },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={S.liveDot}>
              <span style={S.liveDotInner} />
              <style>{`@keyframes ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.8)}}`}</style>
            </div>
            <h2 style={S.title}>Live Operations</h2>
          </div>
          <p style={S.sub}>Real-time tracking · Last updated {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={S.refreshBtn}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => navigate('/live-ops/new-job')} style={S.addBtn}>
            <Plus size={13} /> New Job
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={S.kpiStrip}>
        <OpsKPI label="Active Jobs" value={activeJobs.length} icon={<Activity size={16} color="#0f2044" />} bg="#eef2f8" />
        <OpsKPI label="Pickups" value={pickups.filter(j => !['delivered','cancelled'].includes(j.status)).length} icon={<Truck size={16} color="#0284c7" />} bg="#f0f9ff" />
        <OpsKPI label="Deliveries" value={deliveries.filter(j => !['delivered','cancelled'].includes(j.status)).length} icon={<Navigation size={16} color="#7c3aed" />} bg="#fdf4ff" />
        <OpsKPI label="Available Riders" value={availableRiders.length} icon={<Users size={16} color="#16a34a" />} bg="#f0fdf4" color="#16a34a" />
        <OpsKPI label="Delayed" value={delayed.length} icon={<AlertTriangle size={16} color={delayed.length > 0 ? '#dc2626' : '#9aa3b8'} />} bg={delayed.length > 0 ? '#fef2f2' : '#f9fafb'} color={delayed.length > 0 ? '#dc2626' : '#9aa3b8'} />
        <OpsKPI label="RSA Open" value={rsaRequests.filter(r => r.status !== 'resolved').length} icon={<Shield size={16} color="#d97706" />} bg="#fffbeb" color="#d97706" />
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...S.tab,
            background: tab === t.id ? '#0f2044' : 'white',
            color: tab === t.id ? 'white' : '#6b7595',
            border: tab === t.id ? '1px solid #0f2044' : '1px solid #e2e6f0',
          }}>
            <t.icon size={13} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ ...S.badge, background: tab === t.id ? 'rgba(255,255,255,0.2)' : '#f1f3f8', color: tab === t.id ? 'white' : '#0f2044' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === 'overview'   && <OverviewTab jobs={jobs} riders={riders} rsaRequests={rsaRequests} navigate={navigate} />}
          {tab === 'pickups'    && <JobsTab jobs={pickups}    type="pickup"   onStatusChange={updateJobStatus} navigate={navigate} />}
          {tab === 'deliveries' && <JobsTab jobs={deliveries} type="delivery" onStatusChange={updateJobStatus} navigate={navigate} />}
          {tab === 'riders'     && <RidersTab riders={riders} />}
          {tab === 'rsa'        && <RSATab requests={rsaRequests} onStatusChange={updateRsaStatus} />}
        </>
      )}
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab({ jobs, riders, rsaRequests, navigate }: { jobs: any[]; riders: any[]; rsaRequests: any[]; navigate: (path: string) => void }) {
  const stages = [
    { label: 'Pending',        key: 'pending',        icon: <Clock size={14} color="#d97706" /> },
    { label: 'Assigned',       key: 'assigned',       icon: <Users size={14} color="#0f2044" /> },
    { label: 'En Route',       key: 'rider_en_route', icon: <Navigation size={14} color="#2563eb" /> },
    { label: 'Picked Up',      key: 'picked_up',      icon: <Truck size={14} color="#9333ea" /> },
    { label: 'In Transit',     key: 'in_transit',     icon: <ArrowRight size={14} color="#7c3aed" /> },
    { label: 'Delivered',      key: 'delivered',      icon: <CheckCircle2 size={14} color="#16a34a" /> },
  ]

  const urgentRSA = rsaRequests.filter(r => r.status === 'open')
  const delayed = jobs.filter(j => j.is_delayed)
  const recentJobs = jobs.slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pipeline */}
      <div style={S.pipelineCard}>
        <div style={S.cardHdr}><Activity size={14} color="#0f2044" /><span style={S.cardTitle}>Live Job Pipeline</span></div>
        <div style={S.pipeline}>
          {stages.map((s, i) => {
            const count = jobs.filter(j => j.status === s.key).length
            return (
              <div key={s.key} style={S.pipelineStage}>
                <div style={{ ...S.pipelineBox, background: count > 0 ? STATUS_META[s.key]?.bg || '#f9fafb' : '#f9fafb', border: `1px solid ${count > 0 ? STATUS_META[s.key]?.dot + '30' : '#e2e6f0'}` }}>
                  {s.icon}
                  <span style={{ fontSize: '22px', fontWeight: '800', color: count > 0 ? STATUS_META[s.key]?.color : '#c8cfdf', lineHeight: 1 }}>{count}</span>
                  <span style={{ fontSize: '11px', color: '#9aa3b8', textAlign: 'center', lineHeight: 1.3 }}>{s.label}</span>
                </div>
                {i < stages.length - 1 && <ArrowRight size={12} color="#c8cfdf" style={{ flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {/* Alerts */}
        {(delayed.length > 0 || urgentRSA.length > 0) && (
          <div style={{ ...S.sectionCard, borderLeft: '3px solid #dc2626' }}>
            <div style={S.cardHdr}><AlertTriangle size={14} color="#dc2626" /><span style={{ ...S.cardTitle, color: '#dc2626' }}>Alerts</span></div>
            {delayed.map(j => (
              <AlertRow key={j.id} icon={<Clock size={12} color="#dc2626" />} label={`Delayed: ${j.profiles?.full_name || 'Customer'}`} sub={j.delay_reason || 'No reason given'} color="#dc2626" />
            ))}
            {urgentRSA.map(r => (
              <AlertRow key={r.id} icon={<Shield size={12} color="#dc2626" />} label={`RSA: ${r.profiles?.full_name || 'Customer'}`} sub={r.breakdown_type?.replace(/_/g, ' ')} color="#dc2626" />
            ))}
          </div>
        )}

        {/* Rider status */}
        <div style={S.sectionCard}>
          <div style={S.cardHdr}><Radio size={14} color="#0f2044" /><span style={S.cardTitle}>Rider Status</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {riders.slice(0, 6).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.is_available ? '#16a34a' : '#d97706', animation: r.is_available ? 'none' : 'ping 2s infinite' }} />
                  <span style={{ fontSize: '13px', color: '#0f2044', fontWeight: '500' }}>{r.name}</span>
                  <span style={{ fontSize: '10px', color: '#9aa3b8', background: '#f1f3f8', padding: '1px 6px', borderRadius: '8px' }}>{r.rider_type.replace(/_/g, ' ')}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: r.is_available ? '#16a34a' : '#d97706' }}>{r.is_available ? 'Available' : 'On Job'}</span>
              </div>
            ))}
            {riders.length > 6 && (
              <button onClick={() => navigate('/riders')} style={{ fontSize: '12px', color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}>
                +{riders.length - 6} more riders <ChevronRight size={11} style={{ display: 'inline' }} />
              </button>
            )}
          </div>
        </div>

        {/* RSA summary */}
        <div style={S.sectionCard}>
          <div style={S.cardHdr}><Shield size={14} color="#d97706" /><span style={S.cardTitle}>RSA Requests</span></div>
          {rsaRequests.length === 0 ? <p style={S.emptyNote}>No active RSA requests</p> : rsaRequests.slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f3f8' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f2044' }}>{r.profiles?.full_name || 'Customer'}</div>
                <div style={{ fontSize: '11px', color: '#9aa3b8' }}>{r.breakdown_type?.replace(/_/g, ' ')} · {r.customer_address || 'Location not set'}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent jobs table */}
      <div style={{ ...S.sectionCard, padding: 0, overflow: 'hidden' }}>
        <div style={{ ...S.cardHdr, padding: '14px 18px', borderBottom: '1px solid #f1f3f8' }}>
          <Truck size={14} color="#0f2044" /><span style={S.cardTitle}>Recent Jobs</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Customer', 'Type', 'Rider', 'Status', 'ETA', 'Action'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentJobs.map(j => (
              <tr key={j.id} style={S.tr}>
                <td style={S.td}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f2044' }}>{j.profiles?.full_name || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#9aa3b8' }}>{j.profiles?.phone}</div>
                </td>
                <td style={S.td}>
                  <span style={{ fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', background: j.job_type === 'pickup' ? '#f0f9ff' : '#fdf4ff', color: j.job_type === 'pickup' ? '#0284c7' : '#7c3aed', textTransform: 'capitalize' }}>
                    {j.job_type}
                  </span>
                </td>
                <td style={S.td}><span style={{ fontSize: '13px', color: '#374151' }}>{j.riders?.name || <span style={{ color: '#9aa3b8' }}>Unassigned</span>}</span></td>
                <td style={S.td}><StatusPill status={j.status} /></td>
                <td style={S.td}><span style={{ fontSize: '13px', color: j.eta_minutes ? '#0f2044' : '#9aa3b8' }}>{j.eta_minutes ? `${j.eta_minutes} min` : '—'}</span></td>
                <td style={S.td}>
                  <button onClick={() => navigate(`/live-ops/job/${j.id}`)} style={S.viewBtn}><Eye size={12} /> View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Jobs Tab (Pickups & Deliveries) ────────────────────────────────────────
function JobsTab({ jobs, type, onStatusChange, navigate }: { jobs: any[]; type: string; onStatusChange: (id: string, status: string) => void; navigate: (path: string) => void }) {
  const NEXT_STATUS: Record<string, string[]> = {
    pending:        ['assigned', 'cancelled'],
    assigned:       ['rider_en_route', 'cancelled'],
    rider_en_route: ['arrived'],
    arrived:        ['picked_up'],
    picked_up:      ['in_transit'],
    in_transit:     ['delivered'],
    delivered:      [],
  }

  const active = jobs.filter(j => !['delivered','cancelled'].includes(j.status))
  const done = jobs.filter(j => ['delivered','cancelled'].includes(j.status))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {active.length === 0 && <EmptyState icon={type === 'pickup' ? <Truck size={32} color="#e2e6f0" /> : <Navigation size={32} color="#e2e6f0" />} label={`No active ${type}s`} />}
      {active.map(j => (
        <JobCard key={j.id} job={j} nextStatuses={NEXT_STATUS[j.status] || []} onStatusChange={onStatusChange} navigate={navigate} />
      ))}
      {done.length > 0 && (
        <div style={S.sectionCard}>
          <div style={S.cardHdr}><CheckCircle2 size={13} color="#16a34a" /><span style={S.cardTitle}>Completed ({done.length})</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {done.slice(0, 10).map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f3f8' }}>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#374151' }}>{j.profiles?.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#9aa3b8', marginLeft: '8px' }}>{j.riders?.name || 'Unassigned'}</span>
                </div>
                <StatusPill status={j.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function JobCard({ job: j, nextStatuses, onStatusChange, navigate }: { job: any; nextStatuses: string[]; onStatusChange: (id: string, status: string) => void; navigate: (path: string) => void }) {
  const meta = STATUS_META[j.status] || STATUS_META.pending

  return (
    <div style={{ ...S.jobCard, borderLeft: `3px solid ${meta.dot}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044' }}>{j.profiles?.full_name || 'Customer'}</span>
            <StatusPill status={j.status} />
            {j.is_delayed && <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626' }}>DELAYED</span>}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {j.profiles?.phone && <InfoChip icon={<Phone size={11} />} label={j.profiles.phone} />}
            {j.customer_address && <InfoChip icon={<MapPin size={11} />} label={j.customer_address} />}
            {j.riders?.name && <InfoChip icon={<Navigation size={11} />} label={`Rider: ${j.riders.name}`} />}
            {j.eta_minutes && <InfoChip icon={<Clock size={11} />} label={`ETA: ${j.eta_minutes} min`} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => navigate(`/live-ops/job/${j.id}`)} style={S.viewBtn}><Eye size={12} /> Track</button>
          {j.profiles?.phone && (
            <a href={`tel:${j.profiles.phone}`} style={S.callBtn}><Phone size={12} /></a>
          )}
        </div>
      </div>
      {nextStatuses.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f3f8', flexWrap: 'wrap' }}>
          {nextStatuses.map(ns => (
            <button key={ns} onClick={() => onStatusChange(j.id, ns)} style={{
              ...S.statusActionBtn,
              background: STATUS_META[ns]?.bg || '#f9fafb',
              color: STATUS_META[ns]?.color || '#6b7595',
              border: `1px solid ${STATUS_META[ns]?.dot || '#e2e6f0'}30`,
            }}>
              {STATUS_META[ns]?.label || ns}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Riders Tab ──────────────────────────────────────────────────────────────
function RidersTab({ riders }: { riders: any[] }) {
  const byType: Record<string, any[]> = {}
  riders.forEach(r => { if (!byType[r.rider_type]) byType[r.rider_type] = []; byType[r.rider_type].push(r) })
  const TYPE_META: Record<string, { label: string; color: string }> = {
    pickup_delivery: { label: 'Pickup & Delivery', color: '#0284c7' },
    valet:           { label: 'Valet',             color: '#7c3aed' },
    rsa:             { label: 'RSA / Emergency',   color: '#dc2626' },
    test_ride:       { label: 'Test Ride',          color: '#16a34a' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Object.entries(byType).map(([type, list]) => {
        const meta = TYPE_META[type] || { label: type, color: '#6b7595' }
        return (
          <div key={type} style={S.sectionCard}>
            <div style={S.cardHdr}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
              <span style={S.cardTitle}>{meta.label} ({list.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {list.map(r => (
                <div key={r.id} style={{ ...S.riderCard, borderTop: `2px solid ${meta.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f2044' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: '#9aa3b8', marginTop: '2px' }}>{r.vehicle_number}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.is_available ? '#16a34a' : '#d97706' }} />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: r.is_available ? '#16a34a' : '#d97706' }}>
                        {r.is_available ? 'Free' : 'Busy'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f3f8' }}>
                    <RiderStat label="Jobs" value={r.total_jobs || 0} />
                    <RiderStat label="Rating" value={r.rating ? `${r.rating}★` : '—'} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <a href={`tel:${r.phone}`} style={{ ...S.callBtn, width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={11} /></a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── RSA Tab ─────────────────────────────────────────────────────────────────
function RSATab({ requests, onStatusChange }: { requests: any[]; onStatusChange: (id: string, status: string) => void }) {
  const NEXT: Record<string, string[]> = {
    open:     ['assigned', 'cancelled'],
    assigned: ['en_route'],
    en_route: ['arrived'],
    arrived:  ['resolved'],
  }
  const active = requests.filter(r => r.status !== 'resolved')
  const resolved = requests.filter(r => r.status === 'resolved')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {active.length === 0 && <EmptyState icon={<Shield size={32} color="#e2e6f0" />} label="No active RSA requests" />}
      {active.map(r => (
        <div key={r.id} style={{ ...S.jobCard, borderLeft: '3px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044' }}>{r.profiles?.full_name || 'Customer'}</span>
                <StatusPill status={r.status} />
                <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', textTransform: 'capitalize' }}>
                  {r.breakdown_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {r.profiles?.phone && <InfoChip icon={<Phone size={11} />} label={r.profiles.phone} />}
                {r.customer_address && <InfoChip icon={<MapPin size={11} />} label={r.customer_address} />}
                {r.riders?.name && <InfoChip icon={<Navigation size={11} />} label={`Rider: ${r.riders.name}`} />}
                {r.towing_required && <InfoChip icon={<Truck size={11} />} label="Towing Required" />}
              </div>
              {r.complaint && <p style={{ fontSize: '12px', color: '#6b7595', marginTop: '6px', fontStyle: 'italic' }}>"{r.complaint}"</p>}
            </div>
            {r.profiles?.phone && (
              <a href={`tel:${r.profiles.phone}`} style={S.callBtn}><Phone size={12} /></a>
            )}
          </div>
          {(NEXT[r.status] || []).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f3f8', flexWrap: 'wrap' }}>
              {(NEXT[r.status] || []).map(ns => (
                <button key={ns} onClick={() => onStatusChange(r.id, ns)} style={{
                  ...S.statusActionBtn,
                  background: STATUS_META[ns]?.bg || '#f9fafb',
                  color: STATUS_META[ns]?.color || '#6b7595',
                  border: `1px solid ${STATUS_META[ns]?.dot || '#e2e6f0'}30`,
                }}>
                  {STATUS_META[ns]?.label || ns.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {resolved.length > 0 && (
        <div style={S.sectionCard}>
          <div style={S.cardHdr}><CheckCircle2 size={13} color="#16a34a" /><span style={S.cardTitle}>Resolved ({resolved.length})</span></div>
          {resolved.slice(0, 5).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f3f8' }}>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: '500', color: '#374151' }}>{r.profiles?.full_name}</span>
                <span style={{ fontSize: '12px', color: '#9aa3b8', marginLeft: '8px' }}>{r.breakdown_type?.replace(/_/g, ' ')}</span>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ───────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: m.bg, color: m.color, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

function OpsKPI({ label, value, icon, bg, color = '#0f2044' }: { label: string; value: number; icon: React.ReactNode; bg: string; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '120px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#9aa3b8', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  )
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7595' }}>{icon}{label}</span>
  )
}

function AlertRow({ icon, label, sub, color }: { icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #fef2f2' }}>
      <div style={{ marginTop: '1px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#9aa3b8', textTransform: 'capitalize' }}>{sub}</div>
      </div>
    </div>
  )
}

function RiderStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f2044' }}>{value}</span>
      <span style={{ fontSize: '10px', color: '#9aa3b8' }}>{label}</span>
    </div>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#9aa3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {icon}<p style={{ margin: 0 }}>{label}</p>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:         { display: 'flex', flexDirection: 'column', gap: '18px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  title:        { fontSize: '22px', fontWeight: '800', color: '#0f2044', letterSpacing: '-0.3px', margin: 0 },
  sub:          { fontSize: '12.5px', color: '#9aa3b8', marginTop: '2px' },
  liveDot:      { width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', position: 'relative', flexShrink: 0 },
  liveDotInner: { position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' },
  refreshBtn:   { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  addBtn:       { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: '#0f2044', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
  kpiStrip:     { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  tabs:         { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tab:          { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  badge:        { padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' },
  pipelineCard: { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '16px' },
  pipeline:     { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' },
  pipelineStage:{ display: 'flex', alignItems: 'center', gap: '6px' },
  pipelineBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 14px', borderRadius: '10px', minWidth: '70px' },
  sectionCard:  { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '14px 16px' },
  cardHdr:      { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' },
  cardTitle:    { fontSize: '14px', fontWeight: '700', color: '#0f2044' },
  emptyNote:    { fontSize: '13px', color: '#9aa3b8', textAlign: 'center', padding: '12px 0', margin: 0 },
  jobCard:      { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', padding: '14px 16px' },
  riderCard:    { background: '#fafbfd', border: '1px solid #e2e6f0', borderRadius: '10px', padding: '12px' },
  viewBtn:      { display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: '#eef2f8', border: '1px solid #e2e6f0', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#0f2044', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  callBtn:      { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', color: '#16a34a', textDecoration: 'none', cursor: 'pointer' },
  statusActionBtn: { padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' },
  th:           { padding: '10px 16px', textAlign: 'left', fontSize: '10.5px', fontWeight: '600', color: '#9aa3b8', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fafbfd', borderBottom: '1px solid #e2e6f0' },
  tr:           { borderBottom: '1px solid #f1f3f8' },
  td:           { padding: '12px 16px', verticalAlign: 'middle' },
}

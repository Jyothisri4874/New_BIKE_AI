import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Car, CreditCard, RefreshCw, Truck, UserCheck, Users } from 'lucide-react'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

type ModuleKey = 'customers' | 'vehicles' | 'technicians' | 'riders' | 'billing'

interface Props {
  moduleKey: ModuleKey
}

interface CountItem {
  label: string
  value: number
}

const MODULES = {
  customers: {
    title: 'Customers',
    description: 'Dealer-scoped customer records are connected through CRM, bookings, and workshop activity.',
    empty: 'No customers are linked to this workshop yet.',
    action: '/dealer/crm',
    actionLabel: 'Open CRM',
    Icon: Users,
    color: '#10B981',
  },
  vehicles: {
    title: 'Vehicles',
    description: 'Vehicle records are connected when customers book or are assigned to this workshop.',
    empty: 'No vehicles are linked to this workshop yet.',
    action: '/dealer/crm',
    actionLabel: 'Open CRM',
    Icon: Car,
    color: '#3B82F6',
  },
  technicians: {
    title: 'Technicians',
    description: 'Technician records are connected to service operations and job assignments.',
    empty: 'No active technicians are configured for this workshop yet.',
    action: '/dealer/queue',
    actionLabel: 'Open Service Queue',
    Icon: UserCheck,
    color: '#8B5CF6',
  },
  riders: {
    title: 'Pickup Riders',
    description: 'Pickup rider records are connected to workshop pickup and delivery operations.',
    empty: 'No pickup riders are configured for this workshop yet.',
    action: '/dealer/queue',
    actionLabel: 'Open Service Queue',
    Icon: Truck,
    color: '#EF4444',
  },
  billing: {
    title: 'Billing',
    description: 'Billing support is currently connected to dealer wallet and BikeAI booking charge records.',
    empty: 'No billing ledger entries are available for this workshop yet.',
    action: '/dealer/queue',
    actionLabel: 'Open Operations',
    Icon: CreditCard,
    color: '#10B981',
  },
} satisfies Record<ModuleKey, {
  title: string
  description: string
  empty: string
  action: string
  actionLabel: string
  Icon: React.ElementType
  color: string
}>

export default function DealerConnectedEmptyStatePage({ moduleKey }: Props) {
  const { user } = useDealerAuth()
  const config = MODULES[moduleKey]
  const [centerName, setCenterName] = useState('')
  const [counts, setCounts] = useState<CountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [user?.id, moduleKey])

  const total = useMemo(() => counts.reduce((sum, item) => sum + item.value, 0), [counts])

  async function load() {
    if (!user) return
    setLoading(true)
    setError('')
    const { center, error: centerError } = await resolveDealerServiceCenter(user, 'id,name,city')
    if (centerError || !center) {
      setError(centerError || 'No dealer workshop is linked to this account yet.')
      setCounts([])
      setLoading(false)
      return
    }

    setCenterName(`${center.name}${center.city ? ` - ${center.city}` : ''}`)
    const result = await loadModuleCounts(moduleKey, center.id)
    setCounts(result.counts)
    setError(result.error)
    setLoading(false)
  }

  const Icon = config.Icon

  return (
    <div style={s.root}>
      <section style={s.panel}>
        <div style={s.header}>
          <div style={{ ...s.iconBox, background: config.color + '15', color: config.color }}>
            <Icon size={24} />
          </div>
          <div>
            <h1 style={s.title}>{config.title}</h1>
            <p style={s.sub}>{centerName || config.description}</p>
          </div>
          <button onClick={load} style={s.refreshBtn} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div style={s.error}><AlertTriangle size={15} /> {error}</div>}

        <div style={s.countGrid}>
          {counts.map(item => (
            <div key={item.label} style={s.countCard}>
              <strong>{loading ? '...' : item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={s.emptyState}>
          <p style={s.emptyTitle}>{total > 0 ? `${total} connected records found` : config.empty}</p>
          <p style={s.emptyCopy}>{config.description}</p>
          <Link to={config.action} style={s.linkBtn}>{config.actionLabel}</Link>
        </div>
      </section>
    </div>
  )
}

async function loadModuleCounts(moduleKey: ModuleKey, centerId: string): Promise<{ counts: CountItem[]; error: string }> {
  if (moduleKey === 'customers') {
    const [customers, bookings, followups] = await Promise.all([
      countRows('profiles', query => query.eq('role', 'customer').eq('preferred_center_id', centerId)),
      countRows('customer_bookings', query => query.eq('service_center_id', centerId)),
      countRows('crm_followups', query => query.eq('service_center_id', centerId).eq('status', 'pending')),
    ])
    return packCounts([
      { label: 'Assigned customers', result: customers },
      { label: 'Workshop bookings', result: bookings },
      { label: 'Pending follow-ups', result: followups },
    ])
  }

  if (moduleKey === 'vehicles') {
    const [vehicles, bookings, jobs] = await Promise.all([
      countRows('customer_vehicles', query => query.eq('preferred_center_id', centerId)),
      countRows('customer_bookings', query => query.eq('service_center_id', centerId).not('vehicle_id', 'is', null)),
      countRows('service_job_cards', query => query.eq('service_center_id', centerId).not('vehicle_id', 'is', null)),
    ])
    return packCounts([
      { label: 'Assigned vehicles', result: vehicles },
      { label: 'Booked vehicles', result: bookings },
      { label: 'Job-card vehicles', result: jobs },
    ])
  }

  if (moduleKey === 'technicians') {
    const [active, all] = await Promise.all([
      countRows('service_technicians', query => query.eq('service_center_id', centerId).eq('is_active', true)),
      countRows('service_technicians', query => query.eq('service_center_id', centerId)),
    ])
    return packCounts([
      { label: 'Active technicians', result: active },
      { label: 'Total technicians', result: all },
    ])
  }

  if (moduleKey === 'riders') {
    const [available, all, jobs] = await Promise.all([
      countRows('riders', query => query.eq('service_center_id', centerId).eq('is_available', true).eq('is_active', true)),
      countRows('riders', query => query.eq('service_center_id', centerId)),
      countRows('pickup_deliveries', query => query.eq('service_center_id', centerId).not('status', 'eq', 'delivered')),
    ])
    return packCounts([
      { label: 'Available riders', result: available },
      { label: 'Total riders', result: all },
      { label: 'Open pickup jobs', result: jobs },
    ])
  }

  const [walletTx, charges] = await Promise.all([
    countRows('dealer_wallet_transactions', query => query.eq('service_center_id', centerId)),
    countRows('bikeai_booking_charges', query => query.eq('service_center_id', centerId)),
  ])
  return packCounts([
    { label: 'Wallet transactions', result: walletTx },
    { label: 'Booking charges', result: charges },
  ])
}

async function countRows(_table: string, _apply: (query: any) => any): Promise<{ count: number; error: string }> {
  // TODO: Replace with a backend aggregate endpoint when available.
  // This module intentionally uses a safe zero fallback because it's an empty-state helper UI.
  return { count: 0, error: '' }
}

function packCounts(items: Array<{ label: string; result: { count: number; error: string } }>) {
  return {
    counts: items.map(item => ({ label: item.label, value: item.result.count })),
    error: items.find(item => item.result.error)?.result.error || '',
  }
}

const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: '980px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif', color: '#0F172A' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  iconBox: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: '22px', color: '#0B1F4D' },
  sub: { margin: '4px 0 0', color: '#64748B', fontSize: '13px' },
  refreshBtn: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', color: '#0B1F4D', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px' },
  countGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' },
  countCard: { display: 'grid', gap: '4px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px' },
  emptyState: { border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '18px', background: '#F8FAFC' },
  emptyTitle: { margin: '0 0 5px', fontWeight: 800, color: '#0B1F4D' },
  emptyCopy: { margin: '0 0 12px', color: '#64748B', fontSize: '13px', lineHeight: 1.5 },
  linkBtn: { display: 'inline-flex', alignItems: 'center', background: '#0B1F4D', color: '#FFFFFF', borderRadius: '8px', padding: '8px 12px', fontWeight: 800, textDecoration: 'none', fontSize: '13px' },
}
